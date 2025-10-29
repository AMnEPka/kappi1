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
# Category Model
class Category(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    icon: str = "📁"
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CategoryCreate(BaseModel):
    name: str
    icon: str = "📁"
    description: Optional[str] = None

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    description: Optional[str] = None

# System Model
class System(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    category_id: str
    name: str
    description: Optional[str] = None
    os_type: str = "linux"  # "linux" or "windows"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SystemCreate(BaseModel):
    category_id: str
    name: str
    description: Optional[str] = None
    os_type: str = "linux"

class SystemUpdate(BaseModel):
    category_id: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    os_type: Optional[str] = None

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
    system_id: str  # ОБЯЗАТЕЛЬНАЯ связь с системой
    name: str
    description: Optional[str] = None
    content: str
    order: int = 0  # Порядок отображения
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ScriptCreate(BaseModel):
    system_id: str
    name: str
    description: Optional[str] = None
    content: str
    order: int = 0

class ScriptUpdate(BaseModel):
    system_id: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    content: Optional[str] = None
    order: Optional[int] = None

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


# API Routes - Categories
@api_router.post("/categories", response_model=Category)
async def create_category(category_input: CategoryCreate):
    """Create new category (admin only in future)"""
    category_obj = Category(**category_input.model_dump())
    doc = prepare_for_mongo(category_obj.model_dump())
    
    await db.categories.insert_one(doc)
    return category_obj

@api_router.get("/categories", response_model=List[Category])
async def get_categories():
    """Get all categories"""
    categories = await db.categories.find({}, {"_id": 0}).to_list(1000)
    return [Category(**parse_from_mongo(cat)) for cat in categories]

@api_router.get("/categories/{category_id}", response_model=Category)
async def get_category(category_id: str):
    """Get category by ID"""
    category = await db.categories.find_one({"id": category_id}, {"_id": 0})
    if not category:
        raise HTTPException(status_code=404, detail="Категория не найдена")
    return Category(**parse_from_mongo(category))

@api_router.put("/categories/{category_id}", response_model=Category)
async def update_category(category_id: str, category_update: CategoryUpdate):
    """Update category"""
    update_data = category_update.model_dump(exclude_unset=True)
    
    if not update_data:
        raise HTTPException(status_code=400, detail="Нет данных для обновления")
    
    result = await db.categories.update_one(
        {"id": category_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Категория не найдена")
    
    updated_category = await db.categories.find_one({"id": category_id}, {"_id": 0})
    return Category(**parse_from_mongo(updated_category))

@api_router.delete("/categories/{category_id}")
async def delete_category(category_id: str):
    """Delete category"""
    # Check if category has systems
    systems = await db.systems.find_one({"category_id": category_id})
    if systems:
        raise HTTPException(status_code=400, detail="Невозможно удалить категорию с системами")
    
    result = await db.categories.delete_one({"id": category_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Категория не найдена")
    return {"message": "Категория удалена"}


# API Routes - Systems
@api_router.post("/systems", response_model=System)
async def create_system(system_input: SystemCreate):
    """Create new system (admin only in future)"""
    # Verify category exists
    category = await db.categories.find_one({"id": system_input.category_id})
    if not category:
        raise HTTPException(status_code=404, detail="Категория не найдена")
    
    system_obj = System(**system_input.model_dump())
    doc = prepare_for_mongo(system_obj.model_dump())
    
    await db.systems.insert_one(doc)
    return system_obj

@api_router.get("/systems", response_model=List[System])
async def get_systems(category_id: Optional[str] = None):
    """Get all systems, optionally filtered by category"""
    query = {"category_id": category_id} if category_id else {}
    systems = await db.systems.find(query, {"_id": 0}).to_list(1000)
    return [System(**parse_from_mongo(sys)) for sys in systems]

@api_router.get("/systems/{system_id}", response_model=System)
async def get_system(system_id: str):
    """Get system by ID"""
    system = await db.systems.find_one({"id": system_id}, {"_id": 0})
    if not system:
        raise HTTPException(status_code=404, detail="Система не найдена")
    return System(**parse_from_mongo(system))

@api_router.put("/systems/{system_id}", response_model=System)
async def update_system(system_id: str, system_update: SystemUpdate):
    """Update system"""
    update_data = system_update.model_dump(exclude_unset=True)
    
    if not update_data:
        raise HTTPException(status_code=400, detail="Нет данных для обновления")
    
    # If category_id is being updated, verify it exists
    if 'category_id' in update_data:
        category = await db.categories.find_one({"id": update_data['category_id']})
        if not category:
            raise HTTPException(status_code=404, detail="Категория не найдена")
    
    result = await db.systems.update_one(
        {"id": system_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Система не найдена")
    
    updated_system = await db.systems.find_one({"id": system_id}, {"_id": 0})
    return System(**parse_from_mongo(updated_system))

@api_router.delete("/systems/{system_id}")
async def delete_system(system_id: str):
    """Delete system"""
    # Check if system has scripts
    scripts = await db.scripts.find_one({"system_id": system_id})
    if scripts:
        raise HTTPException(status_code=400, detail="Невозможно удалить систему со скриптами")
    
    result = await db.systems.delete_one({"id": system_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Система не найдена")
    return {"message": "Система удалена"}


# API Routes - Scripts
@api_router.post("/scripts", response_model=Script)
async def create_script(script_input: ScriptCreate):
    """Create new script"""
    # Verify system exists
    system = await db.systems.find_one({"id": script_input.system_id})
    if not system:
        raise HTTPException(status_code=404, detail="Система не найдена")
    
    script_obj = Script(**script_input.model_dump())
    doc = prepare_for_mongo(script_obj.model_dump())
    
    await db.scripts.insert_one(doc)
    return script_obj

@api_router.get("/scripts")
async def get_scripts(system_id: Optional[str] = None, category_id: Optional[str] = None):
    """Get all scripts with filtering options"""
    query = {}
    
    if system_id:
        query["system_id"] = system_id
    elif category_id:
        # Find all systems in this category
        systems = await db.systems.find({"category_id": category_id}, {"_id": 0}).to_list(1000)
        system_ids = [sys["id"] for sys in systems]
        query["system_id"] = {"$in": system_ids}
    
    scripts = await db.scripts.find(query, {"_id": 0}).sort("order", 1).to_list(1000)
    
    # Enrich with system and category info
    enriched_scripts = []
    for script in scripts:
        script_data = parse_from_mongo(script)
        
        # Check if script has system_id (old scripts might not have it)
        if "system_id" not in script_data or not script_data["system_id"]:
            # Skip old scripts without system_id or add default values
            script_data["system_name"] = "Не назначена"
            script_data["system_os_type"] = "linux"
            script_data["category_name"] = "Без категории"
            script_data["category_icon"] = "❓"
            enriched_scripts.append(script_data)
            continue
        
        # Get system info
        system = await db.systems.find_one({"id": script_data["system_id"]}, {"_id": 0})
        if system:
            script_data["system_name"] = system["name"]
            script_data["system_os_type"] = system["os_type"]
            
            # Get category info
            category = await db.categories.find_one({"id": system["category_id"]}, {"_id": 0})
            if category:
                script_data["category_name"] = category["name"]
                script_data["category_icon"] = category.get("icon", "📁")
        else:
            # System not found
            script_data["system_name"] = "Система удалена"
            script_data["system_os_type"] = "linux"
            script_data["category_name"] = "Без категории"
            script_data["category_icon"] = "❓"
        
        enriched_scripts.append(script_data)
    
    return enriched_scripts

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