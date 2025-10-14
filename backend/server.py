from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
import paramiko
import asyncio
from cryptography.fernet import Fernet
import base64

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Encryption key for passwords (in production, store securely)
ENCRYPTION_KEY = os.environ.get('ENCRYPTION_KEY', Fernet.generate_key().decode())
cipher_suite = Fernet(ENCRYPTION_KEY.encode())

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Helper functions
def encrypt_password(password: str) -> str:
    """Encrypt password for storage"""
    return cipher_suite.encrypt(password.encode()).decode()

def decrypt_password(encrypted_password: str) -> str:
    """Decrypt password for use"""
    return cipher_suite.decrypt(encrypted_password.encode()).decode()

def prepare_for_mongo(data: dict) -> dict:
    """Prepare data for MongoDB storage"""
    if isinstance(data.get('created_at'), datetime):
        data['created_at'] = data['created_at'].isoformat()
    return data

def parse_from_mongo(item: dict) -> dict:
    """Parse data from MongoDB"""
    if isinstance(item.get('created_at'), str):
        item['created_at'] = datetime.fromisoformat(item['created_at'])
    return item


# Models
class Host(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    hostname: str
    port: int = 22
    username: str
    auth_type: str  # "password" or "key"
    password: Optional[str] = None
    ssh_key: Optional[str] = None
    os_type: str = "linux"  # "linux" or "windows"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class HostCreate(BaseModel):
    name: str
    hostname: str
    port: int = 22
    username: str
    auth_type: str
    password: Optional[str] = None
    ssh_key: Optional[str] = None
    os_type: str = "linux"

class HostUpdate(BaseModel):
    name: Optional[str] = None
    hostname: Optional[str] = None
    port: Optional[int] = None
    username: Optional[str] = None
    auth_type: Optional[str] = None
    password: Optional[str] = None
    ssh_key: Optional[str] = None
    os_type: Optional[str] = None

class Script(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    content: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ScriptCreate(BaseModel):
    name: str
    description: Optional[str] = None
    content: str

class ScriptUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    content: Optional[str] = None

class ExecutionResult(BaseModel):
    host_id: str
    host_name: str
    success: bool
    output: str
    error: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Execution(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    script_id: str
    script_name: str
    host_ids: List[str]
    results: List[Dict[str, Any]]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ExecuteRequest(BaseModel):
    script_id: str
    host_ids: List[str]


# SSH Execution Function
async def execute_ssh_command(host: Host, command: str) -> ExecutionResult:
    """Execute command on remote host via SSH"""
    try:
        # Run SSH connection in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, _ssh_connect_and_execute, host, command)
        return result
    except Exception as e:
        return ExecutionResult(
            host_id=host.id,
            host_name=host.name,
            success=False,
            output="",
            error=f"Ошибка выполнения: {str(e)}"
        )

def _ssh_connect_and_execute(host: Host, command: str) -> ExecutionResult:
    """Internal function to connect via SSH and execute command"""
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        # Connect with appropriate authentication
        if host.auth_type == "password":
            password = decrypt_password(host.password) if host.password else None
            ssh.connect(
                hostname=host.hostname,
                port=host.port,
                username=host.username,
                password=password,
                timeout=10
            )
        else:  # key-based auth
            from io import StringIO
            key_file = StringIO(host.ssh_key)
            pkey = paramiko.RSAKey.from_private_key(key_file)
            ssh.connect(
                hostname=host.hostname,
                port=host.port,
                username=host.username,
                pkey=pkey,
                timeout=10
            )
        
        # Execute command based on OS type
        if host.os_type == "windows":
            # For Windows, use cmd or powershell
            exec_command = f"cmd /c {command}"
        else:
            # For Linux, use bash
            exec_command = f"bash -c '{command}'"
        
        stdin, stdout, stderr = ssh.exec_command(exec_command, timeout=30)
        
        output = stdout.read().decode('utf-8', errors='replace')
        error = stderr.read().decode('utf-8', errors='replace')
        exit_status = stdout.channel.recv_exit_status()
        
        ssh.close()
        
        return ExecutionResult(
            host_id=host.id,
            host_name=host.name,
            success=(exit_status == 0),
            output=output,
            error=error if error else None
        )
    
    except paramiko.AuthenticationException:
        return ExecutionResult(
            host_id=host.id,
            host_name=host.name,
            success=False,
            output="",
            error="Ошибка аутентификации"
        )
    except paramiko.SSHException as e:
        return ExecutionResult(
            host_id=host.id,
            host_name=host.name,
            success=False,
            output="",
            error=f"SSH ошибка: {str(e)}"
        )
    except Exception as e:
        return ExecutionResult(
            host_id=host.id,
            host_name=host.name,
            success=False,
            output="",
            error=f"Ошибка подключения: {str(e)}"
        )
    finally:
        ssh.close()


# API Routes - Hosts
@api_router.post("/hosts", response_model=Host)
async def create_host(host_input: HostCreate):
    """Create new host"""
    host_dict = host_input.model_dump()
    
    # Encrypt password if provided
    if host_dict.get('password'):
        host_dict['password'] = encrypt_password(host_dict['password'])
    
    host_obj = Host(**host_dict)
    doc = prepare_for_mongo(host_obj.model_dump())
    
    await db.hosts.insert_one(doc)
    return host_obj

@api_router.get("/hosts", response_model=List[Host])
async def get_hosts():
    """Get all hosts"""
    hosts = await db.hosts.find({}, {"_id": 0}).to_list(1000)
    return [Host(**parse_from_mongo(host)) for host in hosts]

@api_router.get("/hosts/{host_id}", response_model=Host)
async def get_host(host_id: str):
    """Get host by ID"""
    host = await db.hosts.find_one({"id": host_id}, {"_id": 0})
    if not host:
        raise HTTPException(status_code=404, detail="Хост не найден")
    return Host(**parse_from_mongo(host))

@api_router.put("/hosts/{host_id}", response_model=Host)
async def update_host(host_id: str, host_update: HostUpdate):
    """Update host"""
    update_data = host_update.model_dump(exclude_unset=True)
    
    # Encrypt password if provided
    if 'password' in update_data and update_data['password']:
        update_data['password'] = encrypt_password(update_data['password'])
    
    if not update_data:
        raise HTTPException(status_code=400, detail="Нет данных для обновления")
    
    result = await db.hosts.update_one(
        {"id": host_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Хост не найден")
    
    updated_host = await db.hosts.find_one({"id": host_id}, {"_id": 0})
    return Host(**parse_from_mongo(updated_host))

@api_router.delete("/hosts/{host_id}")
async def delete_host(host_id: str):
    """Delete host"""
    result = await db.hosts.delete_one({"id": host_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Хост не найден")
    return {"message": "Хост удален"}


# API Routes - Scripts
@api_router.post("/scripts", response_model=Script)
async def create_script(script_input: ScriptCreate):
    """Create new script"""
    script_obj = Script(**script_input.model_dump())
    doc = prepare_for_mongo(script_obj.model_dump())
    
    await db.scripts.insert_one(doc)
    return script_obj

@api_router.get("/scripts", response_model=List[Script])
async def get_scripts():
    """Get all scripts"""
    scripts = await db.scripts.find({}, {"_id": 0}).to_list(1000)
    return [Script(**parse_from_mongo(script)) for script in scripts]

@api_router.get("/scripts/{script_id}", response_model=Script)
async def get_script(script_id: str):
    """Get script by ID"""
    script = await db.scripts.find_one({"id": script_id}, {"_id": 0})
    if not script:
        raise HTTPException(status_code=404, detail="Скрипт не найден")
    return Script(**parse_from_mongo(script))

@api_router.put("/scripts/{script_id}", response_model=Script)
async def update_script(script_id: str, script_update: ScriptUpdate):
    """Update script"""
    update_data = script_update.model_dump(exclude_unset=True)
    
    if not update_data:
        raise HTTPException(status_code=400, detail="Нет данных для обновления")
    
    result = await db.scripts.update_one(
        {"id": script_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Скрипт не найден")
    
    updated_script = await db.scripts.find_one({"id": script_id}, {"_id": 0})
    return Script(**parse_from_mongo(updated_script))

@api_router.delete("/scripts/{script_id}")
async def delete_script(script_id: str):
    """Delete script"""
    result = await db.scripts.delete_one({"id": script_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Скрипт не найден")
    return {"message": "Скрипт удален"}


# API Routes - Execution
@api_router.post("/execute")
async def execute_script(execute_req: ExecuteRequest):
    """Execute script on selected hosts"""
    # Get script
    script_doc = await db.scripts.find_one({"id": execute_req.script_id}, {"_id": 0})
    if not script_doc:
        raise HTTPException(status_code=404, detail="Скрипт не найден")
    
    script = Script(**parse_from_mongo(script_doc))
    
    # Get hosts
    hosts_cursor = db.hosts.find({"id": {"$in": execute_req.host_ids}}, {"_id": 0})
    hosts = [Host(**parse_from_mongo(h)) for h in await hosts_cursor.to_list(1000)]
    
    if not hosts:
        raise HTTPException(status_code=404, detail="Хосты не найдены")
    
    # Execute on all hosts concurrently
    tasks = [execute_ssh_command(host, script.content) for host in hosts]
    results = await asyncio.gather(*tasks)
    
    # Save execution record
    execution = Execution(
        script_id=script.id,
        script_name=script.name,
        host_ids=execute_req.host_ids,
        results=[r.model_dump() for r in results]
    )
    
    doc = prepare_for_mongo(execution.model_dump())
    # Prepare results for MongoDB
    for result in doc['results']:
        if isinstance(result.get('timestamp'), datetime):
            result['timestamp'] = result['timestamp'].isoformat()
    
    await db.executions.insert_one(doc)
    
    return {"execution_id": execution.id, "results": results}

@api_router.get("/executions", response_model=List[Execution])
async def get_executions():
    """Get all executions"""
    executions = await db.executions.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    for execution in executions:
        parse_from_mongo(execution)
        # Parse timestamps in results
        for result in execution.get('results', []):
            if isinstance(result.get('timestamp'), str):
                result['timestamp'] = datetime.fromisoformat(result['timestamp'])
    
    return [Execution(**execution) for execution in executions]

@api_router.get("/executions/{execution_id}", response_model=Execution)
async def get_execution(execution_id: str):
    """Get execution by ID"""
    execution = await db.executions.find_one({"id": execution_id}, {"_id": 0})
    if not execution:
        raise HTTPException(status_code=404, detail="Выполнение не найдено")
    
    parse_from_mongo(execution)
    for result in execution.get('results', []):
        if isinstance(result.get('timestamp'), str):
            result['timestamp'] = datetime.fromisoformat(result['timestamp'])
    
    return Execution(**execution)


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()