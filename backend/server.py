from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Depends, status
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import paramiko
import winrm
import asyncio
from cryptography.fernet import Fernet
import base64
import json
import socket
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Border, Side, Alignment
from datetime import date
import tempfile
from passlib.context import CryptContext
from jose import JWTError, jwt

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

# JWT Configuration
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production-please-use-strong-random-key')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# HTTP Bearer for JWT
security = HTTPBearer()

# Permissions list
PERMISSIONS = {
    'categories_manage': 'Управление категориями и системами',
    'checks_create': 'Создание проверок',
    'checks_edit_own': 'Редактирование своих проверок',
    'checks_edit_all': 'Редактирование всех проверок',
    'checks_delete_own': 'Удаление своих проверок',
    'checks_delete_all': 'Удаление всех проверок',
    'hosts_create': 'Создание хостов',
    'hosts_edit_own': 'Редактирование своих хостов',
    'hosts_edit_all': 'Редактирование всех хостов',
    'hosts_delete_own': 'Удаление своих хостов',
    'hosts_delete_all': 'Удаление всех хостов',
    'users_manage': 'Управление пользователями',
    'roles_manage': 'Управление ролями',
    'results_view_all': 'Просмотр всех результатов',
    'results_export_all': 'Экспорт всех результатов',
    'projects_create': 'Создание проектов',
    'projects_execute': 'Выполнение проектов',
}


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

# Auth helper functions
def hash_password(password: str) -> str:
    """Hash password for storage"""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash"""
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


# Models
# Category Model
class Category(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    icon: str = "📁"
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None

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
    created_by: Optional[str] = None

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
    connection_type: str = "ssh"  # "ssh" for Linux, "winrm" for Windows, "k8s" for Kubernetes
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class HostCreate(BaseModel):
    name: str
    hostname: str
    port: int = 22
    username: str
    auth_type: str
    password: Optional[str] = None
    ssh_key: Optional[str] = None
    connection_type: str = "ssh"

class HostUpdate(BaseModel):
    name: Optional[str] = None
    hostname: Optional[str] = None
    port: Optional[int] = None
    username: Optional[str] = None
    auth_type: Optional[str] = None
    password: Optional[str] = None
    ssh_key: Optional[str] = None
    connection_type: Optional[str] = None

class Script(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    system_id: str  # ОБЯЗАТЕЛЬНАЯ связь с системой
    name: str
    description: Optional[str] = None
    content: str  # Команда (короткая, 1-2 строки)
    processor_script: Optional[str] = None  # Скрипт-обработчик результатов
    has_reference_files: bool = False  # Есть ли эталонные файлы
    test_methodology: Optional[str] = None  # Описание методики испытания
    success_criteria: Optional[str] = None  # Критерий успешного прохождения испытания
    order: int = 0  # Порядок отображения
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None

class ScriptCreate(BaseModel):
    system_id: str
    name: str
    description: Optional[str] = None
    content: str
    processor_script: Optional[str] = None
    has_reference_files: bool = False
    test_methodology: Optional[str] = None
    success_criteria: Optional[str] = None
    order: int = 0

class ScriptUpdate(BaseModel):
    system_id: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    content: Optional[str] = None
    processor_script: Optional[str] = None
    has_reference_files: Optional[bool] = None
    test_methodology: Optional[str] = None
    success_criteria: Optional[str] = None
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
    created_by: Optional[str] = None

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
    reference_data: Optional[dict] = Field(default_factory=dict)  # script_id -> reference text
    status: str = "pending"  # pending, running, completed, failed
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ProjectTaskCreate(BaseModel):
    host_id: str
    system_id: str
    script_ids: List[str]
    reference_data: Optional[dict] = Field(default_factory=dict)

class ProjectTaskUpdate(BaseModel):
    script_ids: Optional[List[str]] = None
    reference_data: Optional[dict] = None
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
    executed_by: Optional[str] = None

class ExecuteProjectRequest(BaseModel):
    """Request to execute a project"""
    project_id: str

class ExecuteRequest(BaseModel):
    """Legacy request to execute a single script on multiple hosts"""
    script_id: str
    host_ids: List[str]


# Auth Models
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    full_name: str
    password_hash: str
    is_active: bool = True
    is_admin: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None

class UserCreate(BaseModel):
    username: str
    full_name: str
    password: str
    is_admin: bool = False

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    is_active: Optional[bool] = None
    is_admin: Optional[bool] = None

class UserResponse(BaseModel):
    """User response without password hash"""
    id: str
    username: str
    full_name: str
    is_active: bool
    is_admin: bool
    created_at: datetime
    created_by: Optional[str] = None

class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class Role(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    permissions: List[str]
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None

class RoleCreate(BaseModel):
    name: str
    permissions: List[str]
    description: Optional[str] = None

class RoleUpdate(BaseModel):
    name: Optional[str] = None
    permissions: Optional[List[str]] = None
    description: Optional[str] = None

class UserRole(BaseModel):
    """Many-to-many relationship between users and roles"""
    model_config = ConfigDict(extra="ignore")
    
    user_id: str
    role_id: str

class ProjectAccess(BaseModel):
    """Access control for projects"""
    model_config = ConfigDict(extra="ignore")
    
    project_id: str
    user_id: str
    granted_by: str
    granted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PasswordResetRequest(BaseModel):
    new_password: str


# SSH Execution Function
async def execute_command(host: Host, command: str) -> ExecutionResult:
    """Execute command on host via appropriate connection method (SSH or WinRM)"""
    loop = asyncio.get_event_loop()
    
    if host.connection_type == "winrm":
        return await loop.run_in_executor(None, _winrm_connect_and_execute, host, command)
    elif host.connection_type == "ssh":
        return await loop.run_in_executor(None, _ssh_connect_and_execute, host, command)
    else:
        return ExecutionResult(
            host_id=host.id,
            host_name=host.name,
            success=False,
            output="",
            error=f"Неподдерживаемый тип подключения: {host.connection_type}"
        )

# Keep for backward compatibility
async def execute_ssh_command(host: Host, command: str) -> ExecutionResult:
    """Execute command on host via SSH"""
    return await execute_command(host, command)

async def execute_check_with_processor(host: Host, command: str, processor_script: Optional[str] = None, reference_data: Optional[str] = None) -> ExecutionResult:
    """Execute check command and process results with optional reference data"""
    # Step 1: Execute the main command
    main_result = await execute_command(host, command)
    
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
    
    # Step 2: Run processor script LOCALLY with main command output as input
    try:
        loop = asyncio.get_event_loop()
        
        # Execute processor script LOCALLY on our server
        # This avoids command line length limits and doesn't require write permissions on remote hosts
        import subprocess
        import os
        
        # Set environment variables for the local process
        env = os.environ.copy()
        env['CHECK_OUTPUT'] = main_result.output
        env['ETALON_INPUT'] = reference_data or ''
        
        print(f"[DEBUG] Executing processor script locally, output size: {len(main_result.output)} bytes")
        
        # Execute processor script locally using bash
        # User should write processor scripts in bash regardless of target OS
        result = subprocess.run(
            ['bash', '-c', processor_script],
            env=env,
            capture_output=True,
            text=True,
            timeout=30
        )
        
        print(f"[DEBUG] Local processor execution completed, return code: {result.returncode}")
        
        # Create processor result from local execution
        processor_result = type('obj', (object,), {
            'output': result.stdout,
            'error': result.stderr if result.returncode != 0 else None,
            'success': result.returncode == 0
        })()
        
        # Parse processor output to determine check result
        output = processor_result.output.strip()
        check_status = None
        
        # Look for status keywords
        for line in output.split('\n'):
            line_stripped = line.strip()
            line_lower = line_stripped.lower()
            
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
        result_output = f"=== Результат команды ===\n{main_result.output}\n\n=== Вывод обработчика ===\n{output}\n\n=== Статус проверки ===\n{check_status or 'Не определён'}"
        
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
        # Determine port based on connection type
        if host.connection_type == "winrm":
            check_port = 5985 if host.port == 22 else host.port  # Default WinRM HTTP port
        else:
            check_port = host.port
        
        # Try to connect to the port
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(5)
        result = sock.connect_ex((host.hostname, check_port))
        sock.close()
        
        if result == 0:
            return True, "Сетевой доступ есть"
        else:
            return False, f"Сетевой доступ отсутствует (порт {check_port} недоступен)"
    except socket.gaierror:
        return False, f"Не удается разрешить имя хоста {host.hostname}"
    except Exception as e:
        return False, f"Ошибка проверки сетевого доступа: {str(e)}"

def _check_winrm_login(host: Host) -> tuple[bool, str]:
    """Check if WinRM login is successful"""
    try:
        password = decrypt_password(host.password) if host.password else None
        if not password:
            return False, "Пароль не указан или не удалось расшифровать"
        
        winrm_port = host.port if host.port != 22 else 5985
        endpoint = f'http://{host.hostname}:{winrm_port}/wsman'
        
        session = winrm.Session(
            endpoint,
            auth=(host.username, password),
            transport='ntlm'
        )
        
        # Try simple command
        result = session.run_cmd('echo', ['test'])
        
        if result.status_code == 0:
            return True, "Логин успешен"
        else:
            return False, "Ошибка аутентификации: неверный логин/пароль"
    
    except Exception as e:
        return False, f"Ошибка логина: {str(e)}"

def _check_ssh_login_and_sudo(host: Host) -> tuple[bool, str, bool, str]:
    """Check if SSH login is successful AND check sudo in one connection"""
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        # Connect with appropriate authentication
        if host.auth_type == "password":
            password = decrypt_password(host.password) if host.password else None
            if not password:
                return False, "Пароль не указан или не удалось расшифровать", False, "Пароль не указан"
            ssh.connect(
                hostname=host.hostname,
                port=host.port,
                username=host.username,
                password=password,
                timeout=10,
                allow_agent=False,
                look_for_keys=False,
                banner_timeout=5,
                auth_timeout=10,
                gss_auth=False,
                gss_kex=False,
                gss_deleg_creds=False
            )
        else:  # key-based auth
            from io import StringIO
            if not host.ssh_key:
                return False, "SSH ключ не указан", False, "SSH ключ не указан"
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
                look_for_keys=False,
                banner_timeout=5,
                auth_timeout=10,
                gss_auth=False,
                gss_kex=False,
                gss_deleg_creds=False
            )
            # Enable keepalive to maintain connection
            transport = ssh.get_transport()
            if transport:
                transport.set_keepalive(30)
            # Small delay to let connection stabilize before opening channel
            import time
            time.sleep(1)
        
        # Login successful, now check sudo
        login_success = True
        login_msg = "Логин успешен"
        
        try:
            # Check sudo - simplified command without redirection
            # Increase timeout to 10 seconds to avoid channel opening timeout
            stdin, stdout, stderr = ssh.exec_command("sudo -n whoami", timeout=10, get_pty=False)
            channel = stdout.channel
            channel.settimeout(10)
            
            # Read both stdout and stderr
            output = stdout.read().decode('utf-8', errors='replace').strip()
            error_output = stderr.read().decode('utf-8', errors='replace').strip()
            exit_code = channel.recv_exit_status()
            
            print(f"[DEBUG] Sudo check for {host.name}: exit_code={exit_code}, output='{output}', stderr='{error_output}'")
            
            # Check results
            if exit_code == 0 and output:
                sudo_success = True
                sudo_msg = "sudo доступен"
            elif 'password' in error_output.lower() or 'password' in output.lower():
                sudo_success = False
                sudo_msg = "sudo недоступен (требуется пароль)"
            elif 'sorry' in error_output.lower() or 'not in sudoers' in error_output.lower():
                sudo_success = False
                sudo_msg = "sudo недоступен (пользователь не в sudoers)"
            else:
                sudo_success = False
                sudo_msg = f"sudo недоступен (код: {exit_code})"
        except socket.timeout as e:
            print(f"[DEBUG] Sudo check timeout for {host.name}: {str(e)}")
            sudo_success = False
            sudo_msg = "Таймаут проверки sudo"
        except Exception as e:
            print(f"[DEBUG] Sudo check error for {host.name}: {str(e)}")
            import traceback
            traceback.print_exc()
            sudo_success = False
            sudo_msg = f"Ошибка проверки sudo: {str(e)}"
        
        ssh.close()
        import time
        time.sleep(0.5)
        
        return login_success, login_msg, sudo_success, sudo_msg
    
    except paramiko.AuthenticationException:
        try:
            ssh.close()
        except:
            pass
        return False, "Ошибка аутентификации: неверный логин/пароль/ключ", False, "Логин не выполнен"
    except Exception as e:
        try:
            ssh.close()
        except:
            pass
        return False, f"Ошибка логина: {str(e)}", False, "Логин не выполнен"

def _check_ssh_login(host: Host) -> tuple[bool, str]:
    """Check if SSH login is successful (wrapper for compatibility)"""
    login_ok, login_msg, _, _ = _check_ssh_login_and_sudo(host)
    return login_ok, login_msg

def _check_ssh_login_original(host: Host) -> tuple[bool, str]:
    """Original SSH login check - kept for reference"""
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
                look_for_keys=False,
                banner_timeout=5,
                auth_timeout=10,
                gss_auth=False,
                gss_kex=False,
                gss_deleg_creds=False
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
                look_for_keys=False,
                banner_timeout=5,
                auth_timeout=10,
                gss_auth=False,
                gss_kex=False,
                gss_deleg_creds=False
            )
        
        ssh.close()
        import time
        time.sleep(0.5)  # Small delay to ensure connection is fully closed
        return True, "Логин успешен"
    
    except paramiko.AuthenticationException:
        ssh.close()
        return False, "Ошибка аутентификации: неверный логин/пароль/ключ"
    except Exception as e:
        try:
            ssh.close()
        except:
            pass
        return False, f"Ошибка логина: {str(e)}"

def _check_admin_access(host: Host) -> tuple[bool, str]:
    """Check if admin/sudo access is available"""
    if host.connection_type == "winrm":
        # For Windows, check if user has admin rights
        try:
            password = decrypt_password(host.password) if host.password else None
            if not password:
                return False, "Пароль не указан"
            
            winrm_port = host.port if host.port != 22 else 5985
            endpoint = f'http://{host.hostname}:{winrm_port}/wsman'
            
            session = winrm.Session(
                endpoint,
                auth=(host.username, password),
                transport='ntlm'
            )
            
            # Check if user is in Administrators group
            result = session.run_ps('([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")')
            
            if result.status_code == 0:
                output = result.std_out.decode('utf-8').strip()
                if output.lower() == 'true':
                    return True, "Права администратора доступны"
                else:
                    return False, "Пользователь не имеет прав администратора"
            else:
                return False, "Ошибка проверки прав администратора"
        
        except Exception as e:
            return False, f"Ошибка проверки прав: {str(e)}"
    else:
        # For Linux, check sudo
        return _check_sudo_access_linux(host)

def _check_sudo_access_linux(host: Host) -> tuple[bool, str]:
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
                look_for_keys=False,
                banner_timeout=5,
                auth_timeout=10,
                gss_auth=False,
                gss_kex=False,
                gss_deleg_creds=False
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
                look_for_keys=False,
                banner_timeout=5,
                auth_timeout=10,
                gss_auth=False,
                gss_kex=False,
                gss_deleg_creds=False
            )
        
        # Test sudo with a simple echo command (more reliable than whoami or true)
        # Use exec_command with shorter timeout and proper error handling
        try:
            stdin, stdout, stderr = ssh.exec_command("sudo -n echo 'SUDO_OK' 2>&1", timeout=5, get_pty=False)
            
            # Set shorter channel timeout
            channel = stdout.channel
            channel.settimeout(5)
            
            # Read output
            output = stdout.read().decode('utf-8', errors='replace').strip()
            error_output = stderr.read().decode('utf-8', errors='replace').strip()
            
            ssh.close()
            import time
            time.sleep(0.5)  # Small delay to ensure connection is fully closed
            
            # Check if sudo worked (should contain 'SUDO_OK')
            if 'SUDO_OK' in output:
                return True, "sudo доступен"
            elif 'password' in output.lower() or 'password' in error_output.lower():
                return False, "sudo недоступен (требуется пароль)"
            elif 'sorry' in output.lower() or 'sorry' in error_output.lower():
                return False, "sudo недоступен (пользователь не в sudoers)"
            else:
                return False, "sudo недоступен (требуется настройка NOPASSWD)"
        except socket.timeout:
            ssh.close()
            return False, "Таймаут при проверке sudo"
        except Exception as e:
            try:
                ssh.close()
            except:
                pass
            return False, f"Ошибка проверки sudo: {str(e)}"
    
    except Exception as e:
        return False, f"Ошибка проверки sudo: {str(e)}"

def _winrm_connect_and_execute(host: Host, command: str) -> ExecutionResult:
    """Internal function to connect via WinRM and execute command on Windows"""
    try:
        # Decrypt password
        password = decrypt_password(host.password) if host.password else None
        if not password:
            return ExecutionResult(
                host_id=host.id,
                host_name=host.name,
                success=False,
                output="",
                error="Пароль не указан или не удалось расшифровать"
            )
        
        # Connect to Windows host via WinRM
        # Default WinRM port is 5985 for HTTP, 5986 for HTTPS
        winrm_port = host.port if host.port != 22 else 5985
        endpoint = f'http://{host.hostname}:{winrm_port}/wsman'
        
        session = winrm.Session(
            endpoint,
            auth=(host.username, password),
            transport='ntlm'  # Use NTLM authentication
        )
        
        # Wrap command to ensure UTF-8 output encoding
        wrapped_command = f"""
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
{command}
"""
        
        # Execute command
        result = session.run_ps(wrapped_command)  # Run PowerShell command
        
        # Decode output - PowerShell returns output in cp1251 (Windows-1251) for Russian locale
        # Try different encodings: cp1251, utf-8, utf-16
        def decode_winrm_output(data):
            if not data:
                return ""
            
            encodings = ['cp1251', 'utf-8', 'utf-16-le', 'utf-16']
            for encoding in encodings:
                try:
                    decoded = data.decode(encoding)
                    # Check if decode was successful (no question marks)
                    if '?' not in decoded or decoded.isprintable():
                        return decoded
                except (UnicodeDecodeError, LookupError):
                    continue
            
            # Fallback: decode with errors ignored
            return data.decode('utf-8', errors='ignore')
        
        output_str = decode_winrm_output(result.std_out)
        error_str = decode_winrm_output(result.std_err)
        
        if result.status_code == 0:
            return ExecutionResult(
                host_id=host.id,
                host_name=host.name,
                success=True,
                output=output_str,
                error=None
            )
        else:
            return ExecutionResult(
                host_id=host.id,
                host_name=host.name,
                success=False,
                output=output_str,
                error=error_str if error_str else f"Exit code: {result.status_code}"
            )
    
    except Exception as e:
        return ExecutionResult(
            host_id=host.id,
            host_name=host.name,
            success=False,
            output="",
            error=f"Ошибка WinRM подключения: {str(e)}"
        )

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
                look_for_keys=False,
                banner_timeout=5,
                auth_timeout=10,
                gss_auth=False,
                gss_kex=False,
                gss_deleg_creds=False
            )
            # Enable keepalive to maintain connection
            transport = ssh.get_transport()
            if transport:
                transport.set_keepalive(30)
            # Small delay to let connection stabilize before opening channel
            import time
            time.sleep(1)
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
                look_for_keys=False,
                banner_timeout=5,
                auth_timeout=10,
                gss_auth=False,
                gss_kex=False,
                gss_deleg_creds=False
            )
            # Enable keepalive to maintain connection
            transport = ssh.get_transport()
            if transport:
                transport.set_keepalive(30)
            # Small delay to let connection stabilize before opening channel
            import time
            time.sleep(1)
        
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


# Authentication Middleware and Helper Functions
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    """Get current user from JWT token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user_doc = await db.users.find_one({"id": user_id})
    if user_doc is None:
        raise credentials_exception
    
    user = User(**user_doc)
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    
    return user

async def get_user_permissions(user: User) -> List[str]:
    """Get all permissions for a user from their roles"""
    if user.is_admin:
        # Admin has all permissions
        return list(PERMISSIONS.keys())
    
    # Get user roles
    user_roles = await db.user_roles.find({"user_id": user.id}).to_list(length=None)
    role_ids = [ur['role_id'] for ur in user_roles]
    
    # Get permissions from roles
    permissions = set()
    for role_id in role_ids:
        role_doc = await db.roles.find_one({"id": role_id})
        if role_doc:
            permissions.update(role_doc.get('permissions', []))
    
    return list(permissions)

async def has_permission(user: User, permission: str) -> bool:
    """Check if user has specific permission"""
    if user.is_admin:
        return True
    
    permissions = await get_user_permissions(user)
    return permission in permissions

async def require_permission(user: User, permission: str):
    """Raise exception if user doesn't have permission"""
    if not await has_permission(user, permission):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission denied: {permission}"
        )

async def can_access_project(user: User, project_id: str) -> bool:
    """Check if user can access a project"""
    if user.is_admin:
        return True
    
    # Check if user is project creator
    project = await db.projects.find_one({"id": project_id})
    if project and project.get('created_by') == user.id:
        return True
    
    # Check if user has explicit access
    access = await db.project_access.find_one({
        "project_id": project_id,
        "user_id": user.id
    })
    return access is not None


# API Routes - Authentication
@api_router.post("/auth/login", response_model=LoginResponse)
async def login(login_data: LoginRequest):
    """Login and get JWT token"""
    # Find user
    user_doc = await db.users.find_one({"username": login_data.username})
    if not user_doc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    
    user = User(**user_doc)
    
    # Verify password
    if not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    
    # Create access token
    access_token = create_access_token(data={"sub": user.id})
    
    # Return token and user data
    user_response = UserResponse(
        id=user.id,
        username=user.username,
        full_name=user.full_name,
        is_active=user.is_active,
        is_admin=user.is_admin,
        created_at=user.created_at,
        created_by=user.created_by
    )
    
    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_response
    )

@api_router.get("/auth/me")
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current user information and permissions"""
    permissions = await get_user_permissions(current_user)
    
    user_response = UserResponse(
        id=current_user.id,
        username=current_user.username,
        full_name=current_user.full_name,
        is_active=current_user.is_active,
        is_admin=current_user.is_admin,
        created_at=current_user.created_at,
        created_by=current_user.created_by
    )
    
    return {
        "user": user_response,
        "permissions": permissions
    }


# API Routes - Hosts
@api_router.post("/hosts", response_model=Host)
async def create_host(host_input: HostCreate, current_user: User = Depends(get_current_user)):
    """Create new host (requires hosts_create permission)"""
    await require_permission(current_user, 'hosts_create')
    
    host_dict = host_input.model_dump()
    
    # Encrypt password if provided
    if host_dict.get('password'):
        host_dict['password'] = encrypt_password(host_dict['password'])
    
    host_obj = Host(**host_dict, created_by=current_user.id)
    doc = prepare_for_mongo(host_obj.model_dump())
    
    await db.hosts.insert_one(doc)
    return host_obj

@api_router.get("/hosts", response_model=List[Host])
async def get_hosts(current_user: User = Depends(get_current_user)):
    """Get all hosts (filtered by permissions)"""
    # If user can edit all hosts OR can work with projects, show all hosts
    if (await has_permission(current_user, 'hosts_edit_all') or 
        await has_permission(current_user, 'projects_create') or 
        await has_permission(current_user, 'projects_execute') or
        await has_permission(current_user, 'results_view_all')):
        hosts = await db.hosts.find({}, {"_id": 0}).to_list(1000)
    else:
        # Show only own hosts
        hosts = await db.hosts.find({"created_by": current_user.id}, {"_id": 0}).to_list(1000)
    
    return [Host(**parse_from_mongo(host)) for host in hosts]

@api_router.get("/hosts/{host_id}", response_model=Host)
async def get_host(host_id: str, current_user: User = Depends(get_current_user)):
    """Get host by ID"""
    host = await db.hosts.find_one({"id": host_id}, {"_id": 0})
    if not host:
        raise HTTPException(status_code=404, detail="Хост не найден")
    
    # Check access
    if not await has_permission(current_user, 'hosts_edit_all'):
        if host.get('created_by') != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    return Host(**parse_from_mongo(host))

@api_router.post("/hosts/{host_id}/test")
async def test_host_connection(host_id: str):
    """Test SSH connection to host"""
    host_doc = await db.hosts.find_one({"id": host_id}, {"_id": 0})
    if not host_doc:
        raise HTTPException(status_code=404, detail="Хост не найден")
    
    host = Host(**parse_from_mongo(host_doc))
    
    # Try simple command
    result = await execute_command(host, "echo 'Connection test successful'")
    
    return {
        "success": result.success,
        "output": result.output,
        "error": result.error,
        "message": "Подключение успешно" if result.success else "Ошибка подключения"
    }

@api_router.put("/hosts/{host_id}", response_model=Host)
async def update_host(host_id: str, host_update: HostUpdate, current_user: User = Depends(get_current_user)):
    """Update host (requires hosts_edit_own or hosts_edit_all permission)"""
    # Check if host exists and get owner
    host = await db.hosts.find_one({"id": host_id})
    if not host:
        raise HTTPException(status_code=404, detail="Хост не найден")
    
    # Check permissions
    is_owner = host.get('created_by') == current_user.id
    if is_owner:
        await require_permission(current_user, 'hosts_edit_own')
    else:
        await require_permission(current_user, 'hosts_edit_all')
    
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
    
    updated_host = await db.hosts.find_one({"id": host_id}, {"_id": 0})
    return Host(**parse_from_mongo(updated_host))

@api_router.delete("/hosts/{host_id}")
async def delete_host(host_id: str, current_user: User = Depends(get_current_user)):
    """Delete host (requires hosts_delete_own or hosts_delete_all permission)"""
    # Check if host exists and get owner
    host = await db.hosts.find_one({"id": host_id})
    if not host:
        raise HTTPException(status_code=404, detail="Хост не найден")
    
    # Check permissions
    is_owner = host.get('created_by') == current_user.id
    if is_owner:
        await require_permission(current_user, 'hosts_delete_own')
    else:
        await require_permission(current_user, 'hosts_delete_all')
    
    result = await db.hosts.delete_one({"id": host_id})
    return {"message": "Хост удален"}


# API Routes - Categories
@api_router.post("/categories", response_model=Category)
async def create_category(category_input: CategoryCreate, current_user: User = Depends(get_current_user)):
    """Create new category (requires categories_manage permission)"""
    await require_permission(current_user, 'categories_manage')
    
    category_obj = Category(**category_input.model_dump(), created_by=current_user.id)
    doc = prepare_for_mongo(category_obj.model_dump())
    
    await db.categories.insert_one(doc)
    return category_obj

@api_router.get("/categories", response_model=List[Category])
async def get_categories(current_user: User = Depends(get_current_user)):
    """Get all categories"""
    categories = await db.categories.find({}, {"_id": 0}).to_list(1000)
    return [Category(**parse_from_mongo(cat)) for cat in categories]

@api_router.get("/categories/{category_id}", response_model=Category)
async def get_category(category_id: str, current_user: User = Depends(get_current_user)):
    """Get category by ID"""
    category = await db.categories.find_one({"id": category_id}, {"_id": 0})
    if not category:
        raise HTTPException(status_code=404, detail="Категория не найдена")
    return Category(**parse_from_mongo(category))

@api_router.put("/categories/{category_id}", response_model=Category)
async def update_category(category_id: str, category_update: CategoryUpdate, current_user: User = Depends(get_current_user)):
    """Update category (requires categories_manage permission)"""
    await require_permission(current_user, 'categories_manage')
    
    update_data = category_update.model_dump(exclude_unset=True)
    
    if not update_data:
        raise HTTPException(status_code=400, detail="Нет данных для обновления")
    
    result = await db.categories.update_one(
        {"id": category_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Категория не найдена")
    
    updated_cat = await db.categories.find_one({"id": category_id}, {"_id": 0})
    return Category(**parse_from_mongo(updated_cat))

@api_router.delete("/categories/{category_id}")
async def delete_category(category_id: str, current_user: User = Depends(get_current_user)):
    """Delete category and cascade to systems and scripts (requires categories_manage permission)"""
    await require_permission(current_user, 'categories_manage')
    
    # Delete all systems in category
    systems = await db.systems.find({"category_id": category_id}).to_list(1000)
    for system in systems:
        # Delete all scripts in system
        await db.scripts.delete_many({"system_id": system['id']})
    
    # Delete all systems
    await db.systems.delete_many({"category_id": category_id})
    
    # Delete category
    result = await db.categories.delete_one({"id": category_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Категория не найдена")
    
    return {"message": "Категория и связанные объекты удалены"}


# API Routes - Systems
@api_router.post("/categories/{category_id}/systems", response_model=System)
async def create_system(category_id: str, system_input: SystemCreate, current_user: User = Depends(get_current_user)):
    """Create new system (requires categories_manage permission)"""
    await require_permission(current_user, 'categories_manage')
    
    # Verify category exists
    category = await db.categories.find_one({"id": category_id})
    if not category:
        raise HTTPException(status_code=404, detail="Категория не найдена")
    
    system_obj = System(**system_input.model_dump(), created_by=current_user.id)
    doc = prepare_for_mongo(system_obj.model_dump())
    
    await db.systems.insert_one(doc)
    return system_obj

@api_router.get("/categories/{category_id}/systems", response_model=List[System])
async def get_systems(category_id: str, current_user: User = Depends(get_current_user)):
    """Get systems for category"""
    systems = await db.systems.find({"category_id": category_id}, {"_id": 0}).to_list(1000)
    return [System(**parse_from_mongo(sys)) for sys in systems]

@api_router.get("/systems", response_model=List[System])
async def get_all_systems(current_user: User = Depends(get_current_user)):
    """Get all systems"""
    systems = await db.systems.find({}, {"_id": 0}).to_list(1000)
    return [System(**parse_from_mongo(sys)) for sys in systems]

@api_router.get("/systems/{system_id}", response_model=System)
async def get_system(system_id: str, current_user: User = Depends(get_current_user)):
    """Get system by ID"""
    system = await db.systems.find_one({"id": system_id}, {"_id": 0})
    if not system:
        raise HTTPException(status_code=404, detail="Система не найдена")
    return System(**parse_from_mongo(system))

@api_router.put("/systems/{system_id}", response_model=System)
async def update_system(system_id: str, system_update: SystemUpdate, current_user: User = Depends(get_current_user)):
    """Update system (requires categories_manage permission)"""
    await require_permission(current_user, 'categories_manage')
    
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
async def delete_system(system_id: str, current_user: User = Depends(get_current_user)):
    """Delete system and all scripts (requires categories_manage permission)"""
    await require_permission(current_user, 'categories_manage')
    
    # Delete all scripts in system
    await db.scripts.delete_many({"system_id": system_id})
    
    result = await db.systems.delete_one({"id": system_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Система не найдена")
    return {"message": "Система и связанные проверки удалены"}


# API Routes - Scripts
@api_router.post("/systems/{system_id}/scripts", response_model=Script)
async def create_script(system_id: str, script_input: ScriptCreate, current_user: User = Depends(get_current_user)):
    """Create new script (requires checks_create permission)"""
    await require_permission(current_user, 'checks_create')
    
    # Verify system exists
    system = await db.systems.find_one({"id": system_id})
    if not system:
        raise HTTPException(status_code=404, detail="Система не найдена")
    
    script_obj = Script(**script_input.model_dump(), created_by=current_user.id)
    doc = prepare_for_mongo(script_obj.model_dump())
    
    await db.scripts.insert_one(doc)
    return script_obj

@api_router.get("/scripts")
async def get_scripts(system_id: Optional[str] = None, category_id: Optional[str] = None, current_user: User = Depends(get_current_user)):
    """Get all scripts with filtering options (filtered by permissions)"""
    query = {}
    
    if system_id:
        query["system_id"] = system_id
    elif category_id:
        # Find all systems in this category
        systems = await db.systems.find({"category_id": category_id}, {"_id": 0}).to_list(1000)
        system_ids = [sys["id"] for sys in systems]
        query["system_id"] = {"$in": system_ids}
    
    # Filter by permissions
    if not await has_permission(current_user, 'checks_edit_all'):
        # Show only own scripts
        query["created_by"] = current_user.id
    
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
async def get_script(script_id: str, current_user: User = Depends(get_current_user)):
    """Get script by ID"""
    script = await db.scripts.find_one({"id": script_id}, {"_id": 0})
    if not script:
        raise HTTPException(status_code=404, detail="Скрипт не найден")
    
    # Check access
    if not await has_permission(current_user, 'checks_edit_all'):
        if script.get('created_by') != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    return Script(**parse_from_mongo(script))

@api_router.put("/scripts/{script_id}", response_model=Script)
async def update_script(script_id: str, script_update: ScriptUpdate, current_user: User = Depends(get_current_user)):
    """Update script (requires checks_edit_own or checks_edit_all permission)"""
    script = await db.scripts.find_one({"id": script_id})
    if not script:
        raise HTTPException(status_code=404, detail="Скрипт не найден")
    
    # Check permissions
    is_owner = script.get('created_by') == current_user.id
    if is_owner:
        await require_permission(current_user, 'checks_edit_own')
    else:
        await require_permission(current_user, 'checks_edit_all')
    
    update_data = script_update.model_dump(exclude_unset=True)
    
    if not update_data:
        raise HTTPException(status_code=400, detail="Нет данных для обновления")
    
    result = await db.scripts.update_one(
        {"id": script_id},
        {"$set": update_data}
    )
    
    updated_script = await db.scripts.find_one({"id": script_id}, {"_id": 0})
    return Script(**parse_from_mongo(updated_script))

@api_router.delete("/scripts/{script_id}")
async def delete_script(script_id: str, current_user: User = Depends(get_current_user)):
    """Delete script (requires checks_delete_own or checks_delete_all permission)"""
    script = await db.scripts.find_one({"id": script_id})
    if not script:
        raise HTTPException(status_code=404, detail="Скрипт не найден")
    
    # Check permissions
    is_owner = script.get('created_by') == current_user.id
    if is_owner:
        await require_permission(current_user, 'checks_delete_own')
    else:
        await require_permission(current_user, 'checks_delete_all')
    
    result = await db.scripts.delete_one({"id": script_id})
    return {"message": "Скрипт удален"}


# API Routes - Projects
@api_router.post("/projects", response_model=Project)
async def create_project(project_input: ProjectCreate, current_user: User = Depends(get_current_user)):
    """Create new project (requires projects_create permission)"""
    await require_permission(current_user, 'projects_create')
    
    project_obj = Project(**project_input.model_dump(), created_by=current_user.id)
    doc = prepare_for_mongo(project_obj.model_dump())
    
    await db.projects.insert_one(doc)
    return project_obj

@api_router.get("/projects", response_model=List[Project])
async def get_projects(current_user: User = Depends(get_current_user)):
    """Get all accessible projects"""
    if current_user.is_admin or await has_permission(current_user, 'results_view_all'):
        # Admin or curator sees all projects
        projects = await db.projects.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    else:
        # Get projects created by user
        my_projects = await db.projects.find({"created_by": current_user.id}, {"_id": 0}).to_list(1000)
        
        # Get projects with explicit access
        access_records = await db.project_access.find({"user_id": current_user.id}).to_list(1000)
        project_ids = [rec['project_id'] for rec in access_records]
        accessible_projects = await db.projects.find({"id": {"$in": project_ids}}, {"_id": 0}).to_list(1000) if project_ids else []
        
        # Combine and deduplicate
        all_projects = {p['id']: p for p in my_projects + accessible_projects}
        projects = list(all_projects.values())
        projects.sort(key=lambda x: x.get('created_at', ''), reverse=True)
    
    return [Project(**parse_from_mongo(proj)) for proj in projects]

@api_router.get("/projects/{project_id}", response_model=Project)
async def get_project(project_id: str, current_user: User = Depends(get_current_user)):
    """Get project by ID"""
    if not await can_access_project(current_user, project_id):
        raise HTTPException(status_code=403, detail="Access denied to this project")
    
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")
    return Project(**parse_from_mongo(project))

@api_router.put("/projects/{project_id}", response_model=Project)
async def update_project(project_id: str, project_update: ProjectUpdate, current_user: User = Depends(get_current_user)):
    """Update project (only creator or admin)"""
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")
    
    if project.get('created_by') != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Only project creator or admin can update")
    
    update_data = project_update.model_dump(exclude_unset=True)
    
    if not update_data:
        raise HTTPException(status_code=400, detail="Нет данных для обновления")
    
    result = await db.projects.update_one(
        {"id": project_id},
        {"$set": update_data}
    )
    
    updated_project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    return Project(**parse_from_mongo(updated_project))

@api_router.delete("/projects/{project_id}")
async def delete_project(project_id: str, current_user: User = Depends(get_current_user)):
    """Delete project (only creator or admin)"""
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")
    
    if project.get('created_by') != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Only project creator or admin can delete")
    
    # Delete associated tasks
    await db.project_tasks.delete_many({"project_id": project_id})
    
    # Delete project access records
    await db.project_access.delete_many({"project_id": project_id})
    
    # Delete associated executions
    await db.executions.delete_many({"project_id": project_id})
    
    # Delete project
    result = await db.projects.delete_one({"id": project_id})
    return {"message": "Проект удален"}


# API Routes - Project Tasks
@api_router.post("/projects/{project_id}/tasks", response_model=ProjectTask)
async def create_project_task(project_id: str, task_input: ProjectTaskCreate, current_user: User = Depends(get_current_user)):
    """Create task in project (requires access to project)"""
    # Check project access
    if not await can_access_project(current_user, project_id):
        raise HTTPException(status_code=403, detail="Access denied to this project")
    
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")
    
    task_obj = ProjectTask(project_id=project_id, **task_input.model_dump())
    doc = prepare_for_mongo(task_obj.model_dump())
    
    await db.project_tasks.insert_one(doc)
    return task_obj

@api_router.get("/projects/{project_id}/tasks", response_model=List[ProjectTask])
async def get_project_tasks(project_id: str, current_user: User = Depends(get_current_user)):
    """Get all tasks for a project (requires access to project)"""
    if not await can_access_project(current_user, project_id):
        raise HTTPException(status_code=403, detail="Access denied to this project")
    
    tasks = await db.project_tasks.find({"project_id": project_id}, {"_id": 0}).to_list(1000)
    return [ProjectTask(**parse_from_mongo(task)) for task in tasks]

@api_router.get("/projects/{project_id}/tasks/bulk", response_model=List[ProjectTask])
async def get_project_tasks_bulk(project_id: str, current_user: User = Depends(get_current_user)):
    """Get all tasks for a project with all details (requires access to project)"""
    if not await can_access_project(current_user, project_id):
        raise HTTPException(status_code=403, detail="Access denied to this project")
    
    tasks = await db.project_tasks.find({"project_id": project_id}, {"_id": 0}).to_list(1000)
    return [ProjectTask(**parse_from_mongo(task)) for task in tasks]

@api_router.put("/projects/{project_id}/tasks/{task_id}", response_model=ProjectTask)
async def update_project_task(project_id: str, task_id: str, task_update: ProjectTaskUpdate, current_user: User = Depends(get_current_user)):
    """Update task in project (requires access to project)"""
    if not await can_access_project(current_user, project_id):
        raise HTTPException(status_code=403, detail="Access denied to this project")
    
    task = await db.project_tasks.find_one({"id": task_id, "project_id": project_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Задание не найдено")
    
    update_data = {k: v for k, v in task_update.dict().items() if v is not None}
    if update_data:
        await db.project_tasks.update_one(
            {"id": task_id, "project_id": project_id},
            {"$set": update_data}
        )
    
    updated_task = await db.project_tasks.find_one({"id": task_id}, {"_id": 0})
    return ProjectTask(**parse_from_mongo(updated_task))

@api_router.delete("/projects/{project_id}/tasks/{task_id}")
async def delete_project_task(project_id: str, task_id: str, current_user: User = Depends(get_current_user)):
    """Delete task from project (requires access to project)"""
    if not await can_access_project(current_user, project_id):
        raise HTTPException(status_code=403, detail="Access denied to this project")
    
    result = await db.project_tasks.delete_one({"id": task_id, "project_id": project_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Задание не найдено")
    return {"message": "Задание удалено"}


# Project Execution with Real-time Updates (SSE)
@api_router.get("/projects/{project_id}/execute")
async def execute_project(project_id: str, current_user: User = Depends(get_current_user)):
    """Execute project with real-time updates via Server-Sent Events (requires projects_execute permission and access to project)"""
    
    # Check permission
    if not await has_permission(current_user, 'projects_execute'):
        raise HTTPException(status_code=403, detail="Permission denied: projects_execute")
    
    # Check project access
    if not await can_access_project(current_user, project_id):
        raise HTTPException(status_code=403, detail="Access denied to this project")
    
    async def event_generator():
        try:
            # Store user_id for executions
            user_id = current_user.id
            
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
                    yield f"data: {json.dumps({'type': 'error', 'message': 'Скрипты не найдены для задания'})}\n\n"
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
                            check_status="Ошибка",
                            executed_by=user_id
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
                
                # 2. Check login and sudo (combined for SSH to avoid multiple connections)
                if host.connection_type == "winrm":
                    # For WinRM, check login first
                    login_ok, login_msg = await loop.run_in_executor(None, _check_winrm_login, host)
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
                                check_status="Ошибка",
                            executed_by=user_id
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
                    
                    # Then check admin access
                    sudo_ok, sudo_msg = await loop.run_in_executor(None, _check_admin_access, host)
                    yield f"data: {json.dumps({'type': 'check_sudo', 'host_name': host.name, 'success': sudo_ok, 'message': sudo_msg})}\n\n"
                else:
                    # For SSH, check both login and sudo in one connection
                    login_ok, login_msg, sudo_ok, sudo_msg = await loop.run_in_executor(None, _check_ssh_login_and_sudo, host)
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
                                check_status="Ошибка",
                            executed_by=user_id
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
                    
                    # Send sudo check result
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
                            check_status="Ошибка",
                            executed_by=user_id
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
                        # Get reference data for this script
                        reference_data = task_obj.reference_data.get(script.id, '') if task_obj.reference_data else ''
                        
                        # Use processor if available
                        result = await execute_check_with_processor(host, script.content, script.processor_script, reference_data)
                        
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
                    
                    # Update task status - host is successful if all preliminary checks passed
                    await db.project_tasks.update_one(
                        {"id": task_obj.id},
                        {"$set": {"status": "completed"}}
                    )
                    
                    # Host completed successfully (passed preliminary checks)
                    completed_tasks += 1
                    yield f"data: {json.dumps({'type': 'task_complete', 'host_name': host.name, 'success': True})}\n\n"
                
                except Exception as e:
                    failed_tasks += 1
                    await db.project_tasks.update_one(
                        {"id": task_obj.id},
                        {"$set": {"status": "failed"}}
                    )
                    yield f"data: {json.dumps({'type': 'task_error', 'host_name': host.name, 'error': str(e)})}\n\n"
            
            # Send completion event (don't update project status - project is reusable)
            # completed_tasks = hosts that passed all preliminary checks
            successful_hosts = completed_tasks
            final_status = "completed" if failed_tasks == 0 else "failed"
            yield f"data: {json.dumps({'type': 'complete', 'status': final_status, 'completed': completed_tasks, 'failed': failed_tasks, 'total': total_tasks, 'successful_hosts': successful_hosts, 'session_id': session_id})}\n\n"
        
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
async def get_session_executions(project_id: str, session_id: str, current_user: User = Depends(get_current_user)):
    """Get all executions for a specific session (requires results_view_all or project access)"""
    # Check if user can view all results or has access to project
    if not await has_permission(current_user, 'results_view_all'):
        if not await can_access_project(current_user, project_id):
            raise HTTPException(status_code=403, detail="Access denied to this project")
    
    executions = await db.executions.find(
        {"project_id": project_id, "execution_session_id": session_id},
        {"_id": 0}
    ).sort("executed_at", 1).to_list(1000)
    
    return [Execution(**parse_from_mongo(execution)) for execution in executions]


# API Routes - Execution (Legacy single-script execution)
@api_router.post("/execute")
async def execute_script(execute_req: ExecuteRequest, current_user: User = Depends(get_current_user)):
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
async def get_executions(current_user: User = Depends(get_current_user)):
    """Get all executions (requires results_view_all or shows own executions)"""
    if await has_permission(current_user, 'results_view_all'):
        executions = await db.executions.find({}, {"_id": 0}).sort("executed_at", -1).to_list(1000)
    else:
        executions = await db.executions.find({"executed_by": current_user.id}, {"_id": 0}).sort("executed_at", -1).to_list(1000)
    
    return [Execution(**parse_from_mongo(execution)) for execution in executions]

@api_router.get("/executions/{execution_id}", response_model=Execution)
async def get_execution(execution_id: str, current_user: User = Depends(get_current_user)):
    """Get execution by ID"""
    execution = await db.executions.find_one({"id": execution_id}, {"_id": 0})
    if not execution:
        raise HTTPException(status_code=404, detail="Выполнение не найдено")
    
    # Check access
    if not await has_permission(current_user, 'results_view_all'):
        if execution.get('executed_by') != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    return Execution(**parse_from_mongo(execution))


# Excel Export Endpoint
@api_router.get("/projects/{project_id}/sessions/{session_id}/export-excel")
async def export_session_to_excel(project_id: str, session_id: str, current_user: User = Depends(get_current_user)):
    """Export session execution results to Excel file (requires results_export_all or project access)"""
    
    # Check if user can export all results or has access to project
    if not await has_permission(current_user, 'results_export_all'):
        if not await can_access_project(current_user, project_id):
            raise HTTPException(status_code=403, detail="Access denied to this project")
    
    # Get project info
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")
    
    # Get executions for this session
    executions = await db.executions.find(
        {"project_id": project_id, "execution_session_id": session_id},
        {"_id": 0}
    ).sort("executed_at", 1).to_list(1000)
    
    if not executions:
        raise HTTPException(status_code=404, detail="Результаты выполнения не найдены")
    
    # Get scripts cache for methodology and criteria
    scripts_cache = {}
    hosts_cache = {}
    
    # Create workbook and worksheet
    wb = Workbook()
    ws = wb.active
    ws.title = "Протокол испытаний"
    
    # Define styles
    thick_border = Border(
        left=Side(style='thick'),
        right=Side(style='thick'),
        top=Side(style='thick'),
        bottom=Side(style='thick')
    )
    yellow_fill = PatternFill(start_color="FFD966", end_color="FFD966", fill_type="solid")
    header_font = Font(bold=True, size=11)
    
    # A1: Протокол
    ws['A1'] = "Протокол проведения испытаний №"
    ws['A1'].font = Font(bold=True, size=14)
    
    # A2: Информационная система
    ws['A2'] = "Информационная система ..."
    ws['A2'].font = Font(bold=True, size=12)
    
    # A4: Место проведения
    ws['A4'] = "Место проведения испытаний: удалённо"
    
    # A5: Дата
    ws['A5'] = f"Дата проведения испытаний: {date.today().strftime('%d.%m.%Y')}"
    
    # Row 8: Table headers
    headers = [
        "№ п/п",
        "Реализация требования ИБ",
        "№ п/п",
        "Описание методики испытания",
        "Критерий успешного прохождения испытания",
        "Результат испытания",
        "Комментарии",
        "Уровень критичности"
    ]
    
    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=8, column=col, value=header)
        cell.font = header_font
        cell.fill = yellow_fill
        cell.border = thick_border
        cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
    
    # Data rows starting from row 9
    row_num = 9
    for idx, execution_data in enumerate(executions, 1):
        execution = Execution(**parse_from_mongo(execution_data))
        
        # Get script info (with caching)
        if execution.script_id not in scripts_cache:
            script_doc = await db.scripts.find_one({"id": execution.script_id}, {"_id": 0})
            scripts_cache[execution.script_id] = script_doc
        script = scripts_cache.get(execution.script_id, {})
        
        # Get host info (with caching)
        if execution.host_id not in hosts_cache:
            host_doc = await db.hosts.find_one({"id": execution.host_id}, {"_id": 0})
            hosts_cache[execution.host_id] = host_doc
        host = hosts_cache.get(execution.host_id, {})
        
        # Prepare data
        test_methodology = script.get('test_methodology', '') or ''
        success_criteria = script.get('success_criteria', '') or ''
        
        # Result mapping
        result_map = {
            "Пройдена": "Пройдена",
            "Не пройдена": "Не пройдена",
            "Ошибка": "Ошибка",
            "Оператор": "Требует участия оператора"
        }
        result = result_map.get(execution.check_status, execution.check_status or "Не определён")
        
        # Level of criticality column - host and username info
        host_info = ""
        if host:
            hostname_or_ip = host.get('hostname', 'неизвестно')
            username = host.get('username', 'неизвестно')
            host_info = f"Испытания проводились на хосте {hostname_or_ip} под учетной записью {username}"
        
        # Write row data
        row_data = [
            idx,  # № п/п
            "",   # Реализация требования ИБ (пусто)
            idx,  # № п/п (дубликат)
            test_methodology,  # Описание методики
            success_criteria,  # Критерий успешного прохождения
            result,  # Результат
            "",  # Комментарии (пусто)
            host_info  # Уровень критичности
        ]
        
        for col, value in enumerate(row_data, 1):
            cell = ws.cell(row=row_num, column=col, value=value)
            cell.border = Border(
                left=Side(style='thin'),
                right=Side(style='thin'),
                top=Side(style='thin'),
                bottom=Side(style='thin')
            )
            cell.alignment = Alignment(vertical='top', wrap_text=True)
        
        row_num += 1
    
    # Set column widths
    ws.column_dimensions['A'].width = 8   # № п/п
    ws.column_dimensions['B'].width = 25  # Реализация требования ИБ
    ws.column_dimensions['C'].width = 8   # № п/п
    ws.column_dimensions['D'].width = 35  # Описание методики
    ws.column_dimensions['E'].width = 35  # Критерий успешного прохождения
    ws.column_dimensions['F'].width = 20  # Результат
    ws.column_dimensions['G'].width = 25  # Комментарии
    ws.column_dimensions['H'].width = 40  # Уровень критичности
    
    # Set row heights
    ws.row_dimensions[8].height = 40  # Header row
    
    # Save to temporary file
    with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp_file:
        wb.save(tmp_file.name)
        tmp_file_path = tmp_file.name
    
    # Generate filename
    filename = f"Протокол_испытаний_{date.today().strftime('%d%m%Y')}.xlsx"
    
    return FileResponse(
        path=tmp_file_path,
        filename=filename,
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )


# API Routes - User Management
@api_router.get("/users", response_model=List[UserResponse])
async def get_users(current_user: User = Depends(get_current_user)):
    """Get all users (requires users_manage permission)"""
    await require_permission(current_user, 'users_manage')
    
    users = await db.users.find().to_list(length=None)
    return [UserResponse(**user) for user in users]

@api_router.post("/users", response_model=UserResponse)
async def create_user(user_input: UserCreate, current_user: User = Depends(get_current_user)):
    """Create new user (requires users_manage permission)"""
    await require_permission(current_user, 'users_manage')
    
    # Check if username already exists
    existing = await db.users.find_one({"username": user_input.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Create user
    user = User(
        username=user_input.username,
        full_name=user_input.full_name,
        password_hash=hash_password(user_input.password),
        is_admin=user_input.is_admin,
        created_by=current_user.id
    )
    
    doc = prepare_for_mongo(user.model_dump())
    await db.users.insert_one(doc)
    
    return UserResponse(**user.model_dump())

@api_router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(user_id: str, user_update: UserUpdate, current_user: User = Depends(get_current_user)):
    """Update user (requires users_manage permission)"""
    await require_permission(current_user, 'users_manage')
    
    # Find user
    user_doc = await db.users.find_one({"id": user_id})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update fields
    update_data = {k: v for k, v in user_update.model_dump().items() if v is not None}
    if update_data:
        await db.users.update_one({"id": user_id}, {"$set": update_data})
    
    # Return updated user
    updated_doc = await db.users.find_one({"id": user_id})
    return UserResponse(**updated_doc)

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: User = Depends(get_current_user)):
    """Delete user and reassign their data to admin (requires users_manage permission)"""
    await require_permission(current_user, 'users_manage')
    
    # Cannot delete yourself
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    # Find admin user
    admin_user = await db.users.find_one({"is_admin": True})
    if not admin_user:
        raise HTTPException(status_code=500, detail="No admin user found")
    admin_id = admin_user['id']
    
    # Reassign all data to admin
    await db.categories.update_many({"created_by": user_id}, {"$set": {"created_by": admin_id}})
    await db.systems.update_many({"created_by": user_id}, {"$set": {"created_by": admin_id}})
    await db.scripts.update_many({"created_by": user_id}, {"$set": {"created_by": admin_id}})
    await db.hosts.update_many({"created_by": user_id}, {"$set": {"created_by": admin_id}})
    await db.projects.update_many({"created_by": user_id}, {"$set": {"created_by": admin_id}})
    await db.executions.update_many({"executed_by": user_id}, {"$set": {"executed_by": admin_id}})
    
    # Delete user roles
    await db.user_roles.delete_many({"user_id": user_id})
    
    # Delete project access
    await db.project_access.delete_many({"user_id": user_id})
    
    # Delete user
    result = await db.users.delete_one({"id": user_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "User deleted and data reassigned to admin"}

@api_router.put("/users/{user_id}/password")
async def reset_user_password(user_id: str, password_data: PasswordResetRequest, current_user: User = Depends(get_current_user)):
    """Reset user password (requires users_manage permission)"""
    await require_permission(current_user, 'users_manage')
    
    # Hash new password
    new_hash = hash_password(password_data.new_password)
    
    # Update password
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {"password_hash": new_hash}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "Password updated successfully"}

@api_router.get("/users/{user_id}/roles")
async def get_user_roles(user_id: str, current_user: User = Depends(get_current_user)):
    """Get user's roles (requires users_manage permission)"""
    await require_permission(current_user, 'users_manage')
    
    user_roles = await db.user_roles.find({"user_id": user_id}).to_list(length=None)
    role_ids = [ur['role_id'] for ur in user_roles]
    
    roles = []
    for role_id in role_ids:
        role_doc = await db.roles.find_one({"id": role_id})
        if role_doc:
            roles.append(Role(**role_doc))
    
    return roles

@api_router.put("/users/{user_id}/roles")
async def assign_user_roles(user_id: str, role_ids: List[str], current_user: User = Depends(get_current_user)):
    """Assign roles to user (requires users_manage permission)"""
    await require_permission(current_user, 'users_manage')
    
    # Delete existing roles
    await db.user_roles.delete_many({"user_id": user_id})
    
    # Add new roles
    for role_id in role_ids:
        await db.user_roles.insert_one({
            "user_id": user_id,
            "role_id": role_id
        })
    
    return {"message": "Roles assigned successfully"}


# API Routes - Role Management
@api_router.get("/roles", response_model=List[Role])
async def get_roles(current_user: User = Depends(get_current_user)):
    """Get all roles"""
    roles = await db.roles.find().to_list(length=None)
    return [Role(**role) for role in roles]

@api_router.post("/roles", response_model=Role)
async def create_role(role_input: RoleCreate, current_user: User = Depends(get_current_user)):
    """Create new role (requires roles_manage permission)"""
    await require_permission(current_user, 'roles_manage')
    
    # Create role
    role = Role(
        name=role_input.name,
        permissions=role_input.permissions,
        description=role_input.description,
        created_by=current_user.id
    )
    
    doc = prepare_for_mongo(role.model_dump())
    await db.roles.insert_one(doc)
    
    return role

@api_router.put("/roles/{role_id}", response_model=Role)
async def update_role(role_id: str, role_update: RoleUpdate, current_user: User = Depends(get_current_user)):
    """Update role (requires roles_manage permission)"""
    await require_permission(current_user, 'roles_manage')
    
    # Update fields
    update_data = {k: v for k, v in role_update.model_dump().items() if v is not None}
    if update_data:
        result = await db.roles.update_one({"id": role_id}, {"$set": update_data})
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Role not found")
    
    # Return updated role
    updated_doc = await db.roles.find_one({"id": role_id})
    return Role(**updated_doc)

@api_router.delete("/roles/{role_id}")
async def delete_role(role_id: str, current_user: User = Depends(get_current_user)):
    """Delete role (requires roles_manage permission)"""
    await require_permission(current_user, 'roles_manage')
    
    # Delete user-role assignments
    await db.user_roles.delete_many({"role_id": role_id})
    
    # Delete role
    result = await db.roles.delete_one({"id": role_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Role not found")
    
    return {"message": "Role deleted successfully"}

@api_router.get("/permissions")
async def get_permissions(current_user: User = Depends(get_current_user)):
    """Get all available permissions"""
    return PERMISSIONS


# API Routes - Project Access Management
@api_router.get("/projects/{project_id}/users")
async def get_project_users(project_id: str, current_user: User = Depends(get_current_user)):
    """Get users with access to project"""
    # Check if user can access project
    if not await can_access_project(current_user, project_id):
        raise HTTPException(status_code=403, detail="Access denied to this project")
    
    # Get project access records
    access_records = await db.project_access.find({"project_id": project_id}).to_list(length=None)
    user_ids = [record['user_id'] for record in access_records]
    
    # Get users
    users = []
    for user_id in user_ids:
        user_doc = await db.users.find_one({"id": user_id})
        if user_doc:
            users.append(UserResponse(**user_doc))
    
    return users

@api_router.post("/projects/{project_id}/users/{user_id}")
async def grant_project_access(project_id: str, user_id: str, current_user: User = Depends(get_current_user)):
    """Grant user access to project"""
    # Check if current user is project creator or admin
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if project.get('created_by') != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Only project creator or admin can grant access")
    
    # Check if access already exists
    existing = await db.project_access.find_one({
        "project_id": project_id,
        "user_id": user_id
    })
    
    if existing:
        return {"message": "User already has access"}
    
    # Grant access
    access = ProjectAccess(
        project_id=project_id,
        user_id=user_id,
        granted_by=current_user.id
    )
    
    doc = prepare_for_mongo(access.model_dump())
    await db.project_access.insert_one(doc)
    
    return {"message": "Access granted successfully"}

@api_router.delete("/projects/{project_id}/users/{user_id}")
async def revoke_project_access(project_id: str, user_id: str, current_user: User = Depends(get_current_user)):
    """Revoke user access to project"""
    # Check if current user is project creator or admin
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if project.get('created_by') != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Only project creator or admin can revoke access")
    
    # Revoke access
    result = await db.project_access.delete_one({
        "project_id": project_id,
        "user_id": user_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Access record not found")
    
    return {"message": "Access revoked successfully"}


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

@app.on_event("startup")
async def startup_db_init():
    """Initialize database on startup if needed"""
    try:
        # Check if admin user exists
        existing_admin = await db.users.find_one({"username": "admin"})
        
        if not existing_admin:
            logger.info("🚀 Initializing database with admin user and roles...")
            
            # Create admin user
            admin_id = str(uuid.uuid4())
            admin_user = {
                "id": admin_id,
                "username": "admin",
                "full_name": "Администратор",
                "password_hash": hash_password("admin123"),
                "is_active": True,
                "is_admin": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "created_by": None
            }
            await db.users.insert_one(admin_user)
            logger.info("✅ Created admin user")
            
            # Create default roles
            roles = [
                {
                    "id": str(uuid.uuid4()),
                    "name": "Администратор",
                    "permissions": list(PERMISSIONS.keys()),
                    "description": "Полный доступ ко всем функциям системы",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "created_by": admin_id
                },
                {
                    "id": str(uuid.uuid4()),
                    "name": "Исполнитель",
                    "permissions": ['projects_execute'],
                    "description": "Только выполнение назначенных проектов",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "created_by": admin_id
                },
                {
                    "id": str(uuid.uuid4()),
                    "name": "Куратор",
                    "permissions": ['results_view_all', 'results_export_all'],
                    "description": "Просмотр и экспорт всех результатов",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "created_by": admin_id
                },
                {
                    "id": str(uuid.uuid4()),
                    "name": "Разработчик проверок",
                    "permissions": [
                        'checks_create', 'checks_edit_own', 'checks_delete_own',
                        'hosts_create', 'hosts_edit_own', 'hosts_delete_own'
                    ],
                    "description": "Создание и редактирование своих проверок и хостов",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "created_by": admin_id
                },
                {
                    "id": str(uuid.uuid4()),
                    "name": "Менеджер проектов",
                    "permissions": [
                        'projects_create', 'projects_execute',
                        'results_view_all', 'results_export_all'
                    ],
                    "description": "Создание и выполнение проектов, просмотр результатов",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "created_by": admin_id
                }
            ]
            await db.roles.insert_many(roles)
            logger.info(f"✅ Created {len(roles)} default roles")
            
            # Migrate existing data - assign to admin
            categories_updated = await db.categories.update_many(
                {"created_by": {"$exists": False}},
                {"$set": {"created_by": admin_id}}
            )
            systems_updated = await db.systems.update_many(
                {"created_by": {"$exists": False}},
                {"$set": {"created_by": admin_id}}
            )
            scripts_updated = await db.scripts.update_many(
                {"created_by": {"$exists": False}},
                {"$set": {"created_by": admin_id}}
            )
            hosts_updated = await db.hosts.update_many(
                {"created_by": {"$exists": False}},
                {"$set": {"created_by": admin_id}}
            )
            projects_updated = await db.projects.update_many(
                {"created_by": {"$exists": False}},
                {"$set": {"created_by": admin_id}}
            )
            executions_updated = await db.executions.update_many(
                {"executed_by": {"$exists": False}},
                {"$set": {"executed_by": admin_id}}
            )
            
            logger.info(f"✅ Migrated existing data: {categories_updated.modified_count} categories, "
                       f"{systems_updated.modified_count} systems, {scripts_updated.modified_count} scripts, "
                       f"{hosts_updated.modified_count} hosts, {projects_updated.modified_count} projects, "
                       f"{executions_updated.modified_count} executions")
            
            logger.info("✨ Database initialization complete!")
        else:
            logger.info("✅ Database already initialized")
            
    except Exception as e:
        logger.error(f"❌ Database initialization failed: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()