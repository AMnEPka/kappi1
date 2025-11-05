from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
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
import json
import socket

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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class HostCreate(BaseModel):
    name: str
    hostname: str
    port: int = 22
    username: str
    auth_type: str
    password: Optional[str] = None
    ssh_key: Optional[str] = None

class HostUpdate(BaseModel):
    name: Optional[str] = None
    hostname: Optional[str] = None
    port: Optional[int] = None
    username: Optional[str] = None
    auth_type: Optional[str] = None
    password: Optional[str] = None
    ssh_key: Optional[str] = None

class Script(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    system_id: str  # ОБЯЗАТЕЛЬНАЯ связь с системой
    name: str
    description: Optional[str] = None
    content: str  # Команда (короткая, 1-2 строки)
    processor_script: Optional[str] = None  # Скрипт-обработчик результатов
    has_reference_files: bool = False  # Есть ли эталонные файлы
    order: int = 0  # Порядок отображения
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ScriptCreate(BaseModel):
    system_id: str
    name: str
    description: Optional[str] = None
    content: str
    processor_script: Optional[str] = None
    has_reference_files: bool = False
    order: int = 0

class ScriptUpdate(BaseModel):
    system_id: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    content: Optional[str] = None
    processor_script: Optional[str] = None
    has_reference_files: Optional[bool] = None
    order: Optional[int] = None

# Project Models
class Project(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    status: str = "draft"  # draft, running, completed, failed
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None

# Project Task Models
class ProjectTask(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    project_id: str
    host_id: str
    system_id: str
    script_ids: List[str]
    status: str = "pending"  # pending, running, completed, failed
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ProjectTaskCreate(BaseModel):
    host_id: str
    system_id: str
    script_ids: List[str]

class ProjectTaskUpdate(BaseModel):
    script_ids: Optional[List[str]] = None
    status: Optional[str] = None

class ExecutionResult(BaseModel):
    host_id: str
    host_name: str
    success: bool
    output: str
    error: Optional[str] = None
    check_status: Optional[str] = None  # Пройдена, Не пройдена, Ошибка, Оператор
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Updated Execution Model
class Execution(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    project_id: Optional[str] = None  # Link to project
    project_task_id: Optional[str] = None  # Link to task
    execution_session_id: Optional[str] = None  # NEW: Group executions by session (each project run)
    host_id: str
    system_id: str
    script_id: str
    script_name: str
    success: bool
    output: str
    error: Optional[str] = None
    check_status: Optional[str] = None  # Пройдена, Не пройдена, Ошибка, Оператор
    executed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ExecuteProjectRequest(BaseModel):
    """Request to execute a project"""
    project_id: str

class ExecuteRequest(BaseModel):
    """Legacy request to execute a single script on multiple hosts"""
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

async def execute_check_with_processor(host: Host, command: str, processor_script: Optional[str] = None) -> ExecutionResult:
    """Execute check command and process results"""
    # Step 1: Execute the main command
    main_result = await execute_ssh_command(host, command)
    
    if not processor_script:
        # No processor - return as is
        return main_result
    
    if not main_result.success:
        # Main command failed - return error
        return ExecutionResult(
            host_id=host.id,
            host_name=host.name,
            success=False,
            output=main_result.output,
            error=main_result.error
        )
    
    # Step 2: Run processor script with main command output as input
    try:
        loop = asyncio.get_event_loop()
        
        # Encode output and processor script as base64 to safely pass any characters
        import base64
        encoded_output = base64.b64encode(main_result.output.encode('utf-8')).decode('ascii')
        encoded_processor = base64.b64encode(processor_script.encode('utf-8')).decode('ascii')
        
        # Create processor command with output available via:
        # 1. Environment variable CHECK_OUTPUT (decoded from base64)
        # 2. stdin (decoded and piped)
        # Use base64 for processor script to avoid heredoc conflicts
        processor_cmd = f"""
export CHECK_OUTPUT=$(echo '{encoded_output}' | base64 -d)
echo '{encoded_output}' | base64 -d | echo '{encoded_processor}' | base64 -d | bash
"""
        processor_result = await loop.run_in_executor(None, _ssh_connect_and_execute, host, processor_cmd)
        
        # Parse processor output to determine check result
        output = processor_result.output.strip()
        check_status = None
        
        # Look for status keywords
        for line in output.split('\n'):
            line_lower = line.strip().lower()
            if 'пройдена' in line_lower and 'не пройдена' not in line_lower:
                check_status = 'Пройдена'
                break
            elif 'не пройдена' in line_lower:
                check_status = 'Не пройдена'
                break
            elif 'ошибка' in line_lower:
                check_status = 'Ошибка'
                break
            elif 'оператор' in line_lower:
                check_status = 'Оператор'
                break
        
        # Build result message - only command output and final status
        result_output = f"=== Результат команды ===\n{main_result.output}\n\n=== Статус проверки ===\n{check_status or 'Не определён'}"
        
        return ExecutionResult(
            host_id=host.id,
            host_name=host.name,
            success=(check_status == 'Пройдена'),
            output=result_output,
            error=processor_result.error if processor_result.error else None,
            check_status=check_status
        )
        
    except Exception as e:
        return ExecutionResult(
            host_id=host.id,
            host_name=host.name,
            success=False,
            output=main_result.output,
            error=f"Ошибка обработчика: {str(e)}"
        )

def _check_network_access(host: Host) -> tuple[bool, str]:
    """Check if host is reachable via network"""
    import socket
    try:
        # Try to connect to SSH port
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(5)
        result = sock.connect_ex((host.hostname, host.port))
        sock.close()
        
        if result == 0:
            return True, "Сетевой доступ есть"
        else:
            return False, f"Сетевой доступ отсутствует (порт {host.port} недоступен)"
    except socket.gaierror:
        return False, f"Не удается разрешить имя хоста {host.hostname}"
    except Exception as e:
        return False, f"Ошибка проверки сетевого доступа: {str(e)}"

def _check_ssh_login(host: Host) -> tuple[bool, str]:
    """Check if SSH login is successful"""
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        # Connect with appropriate authentication
        if host.auth_type == "password":
            password = decrypt_password(host.password) if host.password else None
            if not password:
                return False, "Пароль не указан или не удалось расшифровать"
            ssh.connect(
                hostname=host.hostname,
                port=host.port,
                username=host.username,
                password=password,
                timeout=10,
                allow_agent=False,
                look_for_keys=False
            )
        else:  # key-based auth
            from io import StringIO
            if not host.ssh_key:
                return False, "SSH ключ не указан"
            key_file = StringIO(host.ssh_key)
            try:
                pkey = paramiko.RSAKey.from_private_key(key_file)
            except:
                key_file = StringIO(host.ssh_key)
                try:
                    pkey = paramiko.DSSKey.from_private_key(key_file)
                except:
                    key_file = StringIO(host.ssh_key)
                    try:
                        pkey = paramiko.ECDSAKey.from_private_key(key_file)
                    except:
                        key_file = StringIO(host.ssh_key)
                        pkey = paramiko.Ed25519Key.from_private_key(key_file)
            
            ssh.connect(
                hostname=host.hostname,
                port=host.port,
                username=host.username,
                pkey=pkey,
                timeout=10,
                allow_agent=False,
                look_for_keys=False
            )
        
        ssh.close()
        return True, "Логин успешен"
    
    except paramiko.AuthenticationException as e:
        return False, f"Ошибка аутентификации: неверный логин/пароль/ключ"
    except Exception as e:
        return False, f"Ошибка логина: {str(e)}"

def _check_sudo_access(host: Host) -> tuple[bool, str]:
    """Check if sudo is available and working"""
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        # Connect with appropriate authentication
        if host.auth_type == "password":
            password = decrypt_password(host.password) if host.password else None
            if not password:
                return False, "Пароль не указан"
            ssh.connect(
                hostname=host.hostname,
                port=host.port,
                username=host.username,
                password=password,
                timeout=10,
                allow_agent=False,
                look_for_keys=False
            )
        else:
            from io import StringIO
            if not host.ssh_key:
                return False, "SSH ключ не указан"
            key_file = StringIO(host.ssh_key)
            try:
                pkey = paramiko.RSAKey.from_private_key(key_file)
            except:
                key_file = StringIO(host.ssh_key)
                try:
                    pkey = paramiko.DSSKey.from_private_key(key_file)
                except:
                    key_file = StringIO(host.ssh_key)
                    try:
                        pkey = paramiko.ECDSAKey.from_private_key(key_file)
                    except:
                        key_file = StringIO(host.ssh_key)
                        pkey = paramiko.Ed25519Key.from_private_key(key_file)
            
            ssh.connect(
                hostname=host.hostname,
                port=host.port,
                username=host.username,
                pkey=pkey,
                timeout=10,
                allow_agent=False,
                look_for_keys=False
            )
        
        # Test sudo with a simple command
        stdin, stdout, stderr = ssh.exec_command("sudo -n true", timeout=10)
        exit_status = stdout.channel.recv_exit_status()
        
        ssh.close()
        
        if exit_status == 0:
            return True, "sudo доступен"
        else:
            return False, "sudo недоступен (требуется настройка NOPASSWD или пароль)"
    
    except Exception as e:
        return False, f"Ошибка проверки sudo: {str(e)}"

def _ssh_connect_and_execute(host: Host, command: str) -> ExecutionResult:
    """Internal function to connect via SSH and execute command"""
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        logger.info(f"Attempting SSH connection to {host.hostname}:{host.port} as {host.username}")
        
        # Connect with appropriate authentication
        if host.auth_type == "password":
            logger.info(f"Using password authentication for {host.name}")
            password = decrypt_password(host.password) if host.password else None
            if not password:
                raise Exception("Пароль не указан или не удалось расшифровать")
            ssh.connect(
                hostname=host.hostname,
                port=host.port,
                username=host.username,
                password=password,
                timeout=10,
                allow_agent=False,
                look_for_keys=False
            )
        else:  # key-based auth
            logger.info(f"Using key-based authentication for {host.name}")
            from io import StringIO
            if not host.ssh_key:
                raise Exception("SSH ключ не указан")
            key_file = StringIO(host.ssh_key)
            try:
                pkey = paramiko.RSAKey.from_private_key(key_file)
            except:
                # Try DSA key
                key_file = StringIO(host.ssh_key)
                try:
                    pkey = paramiko.DSSKey.from_private_key(key_file)
                except:
                    # Try ECDSA key
                    key_file = StringIO(host.ssh_key)
                    try:
                        pkey = paramiko.ECDSAKey.from_private_key(key_file)
                    except:
                        # Try Ed25519 key
                        key_file = StringIO(host.ssh_key)
                        pkey = paramiko.Ed25519Key.from_private_key(key_file)
            
            ssh.connect(
                hostname=host.hostname,
                port=host.port,
                username=host.username,
                pkey=pkey,
                timeout=10,
                allow_agent=False,
                look_for_keys=False
            )
        
        logger.info(f"Successfully connected to {host.name}")
        
        # Execute command with bash
        exec_command = f"bash -c '{command}'"
        logger.info(f"Executing command on {host.name}: {exec_command[:100]}...")
        
        stdin, stdout, stderr = ssh.exec_command(exec_command, timeout=30)
        
        output = stdout.read().decode('utf-8', errors='replace')
        error = stderr.read().decode('utf-8', errors='replace')
        exit_status = stdout.channel.recv_exit_status()
        
        logger.info(f"Command completed on {host.name} with exit status {exit_status}")
        
        ssh.close()
        
        return ExecutionResult(
            host_id=host.id,
            host_name=host.name,
            success=(exit_status == 0),
            output=output,
            error=error if error else None
        )
    
    except paramiko.AuthenticationException as e:
        logger.error(f"Authentication failed for {host.name}: {str(e)}")
        return ExecutionResult(
            host_id=host.id,
            host_name=host.name,
            success=False,
            output="",
            error=f"Ошибка аутентификации: {str(e)}"
        )
    except paramiko.SSHException as e:
        logger.error(f"SSH error for {host.name}: {str(e)}")
        return ExecutionResult(
            host_id=host.id,
            host_name=host.name,
            success=False,
            output="",
            error=f"SSH ошибка: {str(e)}"
        )
    except socket.timeout:
        logger.error(f"Connection timeout for {host.name}")
        return ExecutionResult(
            host_id=host.id,
            host_name=host.name,
            success=False,
            output="",
            error=f"Превышено время ожидания подключения к {host.hostname}:{host.port}"
        )
    except socket.gaierror as e:
        logger.error(f"DNS resolution failed for {host.name}: {str(e)}")
        return ExecutionResult(
            host_id=host.id,
            host_name=host.name,
            success=False,
            output="",
            error=f"Не удалось разрешить имя хоста {host.hostname}: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Connection error for {host.name}: {str(e)}")
        return ExecutionResult(
            host_id=host.id,
            host_name=host.name,
            success=False,
            output="",
            error=f"Ошибка подключения: {str(e)}"
        )
    finally:
        try:
            ssh.close()
        except:
            pass


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

@api_router.post("/hosts/{host_id}/test")
async def test_host_connection(host_id: str):
    """Test SSH connection to host"""
    host_doc = await db.hosts.find_one({"id": host_id}, {"_id": 0})
    if not host_doc:
        raise HTTPException(status_code=404, detail="Хост не найден")
    
    host = Host(**parse_from_mongo(host_doc))
    
    # Try simple command
    result = await execute_ssh_command(host, "echo 'Connection test successful'")
    
    return {
        "success": result.success,
        "output": result.output,
        "error": result.error,
        "message": "Подключение успешно" if result.success else "Ошибка подключения"
    }

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


# API Routes - Projects
@api_router.post("/projects", response_model=Project)
async def create_project(project_input: ProjectCreate):
    """Create new project"""
    project_obj = Project(**project_input.model_dump())
    doc = prepare_for_mongo(project_obj.model_dump())
    
    await db.projects.insert_one(doc)
    return project_obj

@api_router.get("/projects", response_model=List[Project])
async def get_projects():
    """Get all projects"""
    projects = await db.projects.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [Project(**parse_from_mongo(proj)) for proj in projects]

@api_router.get("/projects/{project_id}", response_model=Project)
async def get_project(project_id: str):
    """Get project by ID"""
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")
    return Project(**parse_from_mongo(project))

@api_router.put("/projects/{project_id}", response_model=Project)
async def update_project(project_id: str, project_update: ProjectUpdate):
    """Update project"""
    update_data = project_update.model_dump(exclude_unset=True)
    
    if not update_data:
        raise HTTPException(status_code=400, detail="Нет данных для обновления")
    
    result = await db.projects.update_one(
        {"id": project_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Проект не найден")
    
    updated_project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    return Project(**parse_from_mongo(updated_project))

@api_router.delete("/projects/{project_id}")
async def delete_project(project_id: str):
    """Delete project"""
    # Delete associated tasks
    await db.project_tasks.delete_many({"project_id": project_id})
    
    # Delete associated executions
    await db.executions.delete_many({"project_id": project_id})
    
    # Delete project
    result = await db.projects.delete_one({"id": project_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Проект не найден")
    return {"message": "Проект удален"}


# API Routes - Project Tasks
@api_router.post("/projects/{project_id}/tasks", response_model=ProjectTask)
async def create_project_task(project_id: str, task_input: ProjectTaskCreate):
    """Create task in project"""
    # Verify project exists
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")
    
    task_obj = ProjectTask(project_id=project_id, **task_input.model_dump())
    doc = prepare_for_mongo(task_obj.model_dump())
    
    await db.project_tasks.insert_one(doc)
    return task_obj

@api_router.get("/projects/{project_id}/tasks", response_model=List[ProjectTask])
async def get_project_tasks(project_id: str):
    """Get all tasks for a project"""
    tasks = await db.project_tasks.find({"project_id": project_id}, {"_id": 0}).to_list(1000)
    return [ProjectTask(**parse_from_mongo(task)) for task in tasks]

@api_router.delete("/projects/{project_id}/tasks/{task_id}")
async def delete_project_task(project_id: str, task_id: str):
    """Delete task from project"""
    result = await db.project_tasks.delete_one({"id": task_id, "project_id": project_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Задание не найдено")
    return {"message": "Задание удалено"}


# Project Execution with Real-time Updates (SSE)
@api_router.get("/projects/{project_id}/execute")
async def execute_project(project_id: str):
    """Execute project with real-time updates via Server-Sent Events"""
    
    async def event_generator():
        try:
            # Get project
            project = await db.projects.find_one({"id": project_id}, {"_id": 0})
            if not project:
                yield f"data: {json.dumps({'type': 'error', 'message': 'Проект не найден'})}\n\n"
                return
            
            # Create unique session ID for this execution
            session_id = str(uuid.uuid4())
            
            # Don't update project status - projects are reusable templates now
            yield f"data: {json.dumps({'type': 'status', 'message': 'Начало выполнения проекта', 'session_id': session_id})}\n\n"
            
            # Get all tasks for this project
            tasks_cursor = db.project_tasks.find({"project_id": project_id}, {"_id": 0})
            tasks = await tasks_cursor.to_list(1000)
            
            if not tasks:
                yield f"data: {json.dumps({'type': 'error', 'message': 'Нет заданий для выполнения'})}\n\n"
                return
            
            total_tasks = len(tasks)
            completed_tasks = 0
            failed_tasks = 0
            
            yield f"data: {json.dumps({'type': 'info', 'message': f'Всего заданий: {total_tasks}'})}\n\n"
            
            # Process each task (each task = one host with multiple scripts)
            for task in tasks:
                task_obj = ProjectTask(**parse_from_mongo(task))
                
                # Get host
                host_doc = await db.hosts.find_one({"id": task_obj.host_id}, {"_id": 0})
                if not host_doc:
                    yield f"data: {json.dumps({'type': 'error', 'message': f'Хост не найден: {task_obj.host_id}'})}\n\n"
                    failed_tasks += 1
                    continue
                
                host = Host(**parse_from_mongo(host_doc))
                
                # Get system
                system_doc = await db.systems.find_one({"id": task_obj.system_id}, {"_id": 0})
                if not system_doc:
                    yield f"data: {json.dumps({'type': 'error', 'message': f'Система не найдена: {task_obj.system_id}'})}\n\n"
                    failed_tasks += 1
                    continue
                
                system = System(**parse_from_mongo(system_doc))
                
                # Get scripts
                scripts_cursor = db.scripts.find({"id": {"$in": task_obj.script_ids}}, {"_id": 0})
                scripts = [Script(**parse_from_mongo(s)) for s in await scripts_cursor.to_list(1000)]
                
                if not scripts:
                    yield f"data: {json.dumps({'type': 'error', 'message': f'Скрипты не найдены для задания'})}\n\n"
                    failed_tasks += 1
                    continue
                
                # Update task status
                await db.project_tasks.update_one(
                    {"id": task_obj.id},
                    {"$set": {"status": "running"}}
                )
                
                yield f"data: {json.dumps({'type': 'task_start', 'host_name': host.name, 'host_address': host.hostname, 'system_name': system.name, 'scripts_count': len(scripts)})}\n\n"
                
                # Perform preliminary checks
                loop = asyncio.get_event_loop()
                
                # 1. Check network access
                network_ok, network_msg = await loop.run_in_executor(None, _check_network_access, host)
                yield f"data: {json.dumps({'type': 'check_network', 'host_name': host.name, 'success': network_ok, 'message': network_msg})}\n\n"
                
                if not network_ok:
                    # Mark all scripts as failed with network error
                    for script in scripts:
                        execution = Execution(
                            project_id=project_id,
                            project_task_id=task_obj.id,
                            execution_session_id=session_id,
                            host_id=host.id,
                            system_id=system.id,
                            script_id=script.id,
                            script_name=script.name,
                            success=False,
                            output="",
                            error=network_msg,
                            check_status="Ошибка"
                        )
                        exec_doc = prepare_for_mongo(execution.model_dump())
                        await db.executions.insert_one(exec_doc)
                    
                    await db.project_tasks.update_one(
                        {"id": task_obj.id},
                        {"$set": {"status": "failed"}}
                    )
                    failed_tasks += 1
                    yield f"data: {json.dumps({'type': 'task_error', 'host_name': host.name, 'error': network_msg})}\n\n"
                    continue
                
                # 2. Check SSH login
                login_ok, login_msg = await loop.run_in_executor(None, _check_ssh_login, host)
                yield f"data: {json.dumps({'type': 'check_login', 'host_name': host.name, 'success': login_ok, 'message': login_msg})}\n\n"
                
                if not login_ok:
                    # Mark all scripts as failed with login error
                    for script in scripts:
                        execution = Execution(
                            project_id=project_id,
                            project_task_id=task_obj.id,
                            execution_session_id=session_id,
                            host_id=host.id,
                            system_id=system.id,
                            script_id=script.id,
                            script_name=script.name,
                            success=False,
                            output="",
                            error=login_msg,
                            check_status="Ошибка"
                        )
                        exec_doc = prepare_for_mongo(execution.model_dump())
                        await db.executions.insert_one(exec_doc)
                    
                    await db.project_tasks.update_one(
                        {"id": task_obj.id},
                        {"$set": {"status": "failed"}}
                    )
                    failed_tasks += 1
                    yield f"data: {json.dumps({'type': 'task_error', 'host_name': host.name, 'error': login_msg})}\n\n"
                    continue
                
                # 3. Check sudo access
                sudo_ok, sudo_msg = await loop.run_in_executor(None, _check_sudo_access, host)
                yield f"data: {json.dumps({'type': 'check_sudo', 'host_name': host.name, 'success': sudo_ok, 'message': sudo_msg})}\n\n"
                
                if not sudo_ok:
                    # Mark all scripts as failed with sudo error
                    for script in scripts:
                        execution = Execution(
                            project_id=project_id,
                            project_task_id=task_obj.id,
                            execution_session_id=session_id,
                            host_id=host.id,
                            system_id=system.id,
                            script_id=script.id,
                            script_name=script.name,
                            success=False,
                            output="",
                            error=sudo_msg,
                            check_status="Ошибка"
                        )
                        exec_doc = prepare_for_mongo(execution.model_dump())
                        await db.executions.insert_one(exec_doc)
                    
                    await db.project_tasks.update_one(
                        {"id": task_obj.id},
                        {"$set": {"status": "failed"}}
                    )
                    failed_tasks += 1
                    yield f"data: {json.dumps({'type': 'task_error', 'host_name': host.name, 'error': sudo_msg})}\n\n"
                    continue
                
                # All checks passed, proceed with script execution
                task_success = True
                task_results = []
                scripts_completed = 0
                
                try:
                    # Execute scripts sequentially on the same host with one connection
                    for idx, script in enumerate(scripts, 1):
                        yield f"data: {json.dumps({'type': 'script_start', 'host_name': host.name, 'script_name': script.name})}\n\n"
                        
                        # Use processor if available
                        result = await execute_check_with_processor(host, script.content, script.processor_script)
                        
                        scripts_completed += 1
                        yield f"data: {json.dumps({'type': 'script_progress', 'host_name': host.name, 'completed': scripts_completed, 'total': len(scripts)})}\n\n"
                        
                        # Save execution result with session_id
                        execution = Execution(
                            project_id=project_id,
                            project_task_id=task_obj.id,
                            execution_session_id=session_id,  # NEW: Link to session
                            host_id=host.id,
                            system_id=system.id,
                            script_id=script.id,
                            script_name=script.name,
                            success=result.success,
                            output=result.output,
                            error=result.error,
                            check_status=result.check_status
                        )
                        
                        exec_doc = prepare_for_mongo(execution.model_dump())
                        await db.executions.insert_one(exec_doc)
                        
                        task_results.append(execution)
                        
                        if not result.success:
                            task_success = False
                            yield f"data: {json.dumps({'type': 'script_error', 'host_name': host.name, 'script_name': script.name, 'error': result.error})}\n\n"
                        else:
                            yield f"data: {json.dumps({'type': 'script_success', 'host_name': host.name, 'script_name': script.name})}\n\n"
                    
                    # Update task status
                    await db.project_tasks.update_one(
                        {"id": task_obj.id},
                        {"$set": {"status": "completed" if task_success else "failed"}}
                    )
                    
                    if task_success:
                        completed_tasks += 1
                        yield f"data: {json.dumps({'type': 'task_complete', 'host_name': host.name, 'success': True})}\n\n"
                    else:
                        failed_tasks += 1
                        yield f"data: {json.dumps({'type': 'task_complete', 'host_name': host.name, 'success': False})}\n\n"
                
                except Exception as e:
                    failed_tasks += 1
                    await db.project_tasks.update_one(
                        {"id": task_obj.id},
                        {"$set": {"status": "failed"}}
                    )
                    yield f"data: {json.dumps({'type': 'task_error', 'host_name': host.name, 'error': str(e)})}\n\n"
            
            # Send completion event (don't update project status - project is reusable)
            final_status = "completed" if failed_tasks == 0 else "failed"
            yield f"data: {json.dumps({'type': 'complete', 'status': final_status, 'completed': completed_tasks, 'failed': failed_tasks, 'total': total_tasks, 'session_id': session_id})}\n\n"
        
        except Exception as e:
            logger.error(f"Error during project execution: {str(e)}")
            yield f"data: {json.dumps({'type': 'error', 'message': f'Ошибка: {str(e)}'})}\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


# Get project execution results
@api_router.get("/projects/{project_id}/executions", response_model=List[Execution])
async def get_project_executions(project_id: str):
    """Get all execution results for a project"""
    executions = await db.executions.find(
        {"project_id": project_id},
        {"_id": 0}
    ).sort("executed_at", -1).to_list(1000)
    
    return [Execution(**parse_from_mongo(execution)) for execution in executions]

# Get execution sessions for project (list of unique session runs)
@api_router.get("/projects/{project_id}/sessions")
async def get_project_sessions(project_id: str):
    """Get list of execution sessions for a project"""
    # Get distinct session IDs with their timestamps and check status counts
    # If check_status is not one of the expected values, count it as error
    pipeline = [
        {"$match": {"project_id": project_id, "execution_session_id": {"$ne": None}}},
        {"$group": {
            "_id": "$execution_session_id",
            "executed_at": {"$first": "$executed_at"},
            "count": {"$sum": 1},
            "passed_count": {
                "$sum": {"$cond": [{"$eq": ["$check_status", "Пройдена"]}, 1, 0]}
            },
            "failed_count": {
                "$sum": {"$cond": [{"$eq": ["$check_status", "Не пройдена"]}, 1, 0]}
            },
            "operator_count": {
                "$sum": {"$cond": [{"$eq": ["$check_status", "Оператор"]}, 1, 0]}
            },
            "explicit_error_count": {
                "$sum": {"$cond": [{"$eq": ["$check_status", "Ошибка"]}, 1, 0]}
            },
            # Count executions with null, empty, or unexpected check_status as errors
            "other_count": {
                "$sum": {
                    "$cond": [
                        {
                            "$and": [
                                {"$ne": ["$check_status", "Пройдена"]},
                                {"$ne": ["$check_status", "Не пройдена"]},
                                {"$ne": ["$check_status", "Оператор"]},
                                {"$ne": ["$check_status", "Ошибка"]}
                            ]
                        },
                        1,
                        0
                    ]
                }
            }
        }},
        {"$sort": {"executed_at": -1}}
    ]
    
    sessions = await db.executions.aggregate(pipeline).to_list(1000)
    
    return [{
        "session_id": s["_id"],
        "executed_at": s["executed_at"],
        "total_checks": s["count"],
        "passed_count": s["passed_count"],
        "failed_count": s["failed_count"],
        # Combine explicit errors and unknown statuses
        "error_count": s["explicit_error_count"] + s["other_count"],
        "operator_count": s["operator_count"]
    } for s in sessions]

# Get executions for specific session
@api_router.get("/projects/{project_id}/sessions/{session_id}/executions", response_model=List[Execution])
async def get_session_executions(project_id: str, session_id: str):
    """Get all executions for a specific session"""
    executions = await db.executions.find(
        {"project_id": project_id, "execution_session_id": session_id},
        {"_id": 0}
    ).sort("executed_at", 1).to_list(1000)
    
    return [Execution(**parse_from_mongo(execution)) for execution in executions]


# API Routes - Execution (Legacy single-script execution)
@api_router.post("/execute")
async def execute_script(execute_req: ExecuteRequest):
    """Execute script on selected hosts (legacy endpoint)"""
    # Get script
    script_doc = await db.scripts.find_one({"id": execute_req.script_id}, {"_id": 0})
    if not script_doc:
        raise HTTPException(status_code=404, detail="Скрипт не найден")
    
    script = Script(**parse_from_mongo(script_doc))
    
    # Get system for this script
    system_doc = await db.systems.find_one({"id": script.system_id}, {"_id": 0})
    if not system_doc:
        raise HTTPException(status_code=404, detail="Система не найдена")
    
    system = System(**parse_from_mongo(system_doc))
    
    # Get hosts
    hosts_cursor = db.hosts.find({"id": {"$in": execute_req.host_ids}}, {"_id": 0})
    hosts = [Host(**parse_from_mongo(h)) for h in await hosts_cursor.to_list(1000)]
    
    if not hosts:
        raise HTTPException(status_code=404, detail="Хосты не найдены")
    
    # Execute on all hosts concurrently
    tasks = [execute_check_with_processor(host, script.content, script.processor_script) for host in hosts]
    results = await asyncio.gather(*tasks)
    
    # Save execution records (one per host)
    execution_ids = []
    for host, result in zip(hosts, results):
        execution = Execution(
            host_id=host.id,
            system_id=system.id,
            script_id=script.id,
            script_name=script.name,
            success=result.success,
            output=result.output,
            error=result.error,
            check_status=result.check_status
        )
        
        doc = prepare_for_mongo(execution.model_dump())
        await db.executions.insert_one(doc)
        execution_ids.append(execution.id)
    
    return {"execution_ids": execution_ids, "results": [r.model_dump() for r in results]}

@api_router.get("/executions", response_model=List[Execution])
async def get_executions():
    """Get all executions"""
    executions = await db.executions.find({}, {"_id": 0}).sort("executed_at", -1).to_list(1000)
    return [Execution(**parse_from_mongo(execution)) for execution in executions]

@api_router.get("/executions/{execution_id}", response_model=Execution)
async def get_execution(execution_id: str):
    """Get execution by ID"""
    execution = await db.executions.find_one({"id": execution_id}, {"_id": 0})
    if not execution:
        raise HTTPException(status_code=404, detail="Выполнение не найдено")
    
    return Execution(**parse_from_mongo(execution))


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