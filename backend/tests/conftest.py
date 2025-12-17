"""
Global test fixtures and configuration for backend tests
"""


import pytest
import asyncio
import os
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
from typing import AsyncGenerator

# Add backend to Python path
BACKEND_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

os.environ["ENCRYPTION_KEY"] = "qkOe_grX2GLjfSeHl-0g4BE-40-objw81EB3eoZ2wY8="
os.environ["TESTING"] = "true"

# Set test environment variables
os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("LOG_LEVEL", "DEBUG")
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017/test_db")
os.environ.setdefault("DB_NAME", "test_db")
os.environ.setdefault(
    "JWT_SECRET_KEY",
    "test-jwt-secret-key-at-least-32-characters-long-for-testing"
)
os.environ.setdefault(
    "ENCRYPTION_KEY",
    "dGVzdC1lbmNyeXB0aW9uLWtleS0zMi1ieXRlcy1sb25nLWZvcmNvaQ=="
)


# Проверяем наличие mongomock-motor
try:
    from mongomock_motor import AsyncMongoMockClient
    MONGOMOCK_AVAILABLE = True
except ImportError:
    MONGOMOCK_AVAILABLE = False

# Для совместимости с Python 3.13 и pytest-asyncio 1.3.0
@pytest.fixture
def event_loop():
    """Создаем event loop для асинхронных тестов"""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="function")
async def mock_db() -> AsyncGenerator:
    """
    Mock MongoDB database for unit tests using mongomock-motor.
    This provides an in-memory MongoDB that doesn't require a real database.
    """
    if not MONGOMOCK_AVAILABLE:
        pytest.skip("mongomock-motor not installed. Install with: pip install mongomock-motor")
    
    client = AsyncMongoMockClient()
    db = client.kapibara_db  # Используем то же имя базы, что и в конфиге
    
    # Инициализируем коллекции, если они еще не созданы
    collections = [
        "users", "hosts", "categories", "systems", "scripts", 
        "check_groups", "projects", "tasks", "scheduler_jobs", 
        "executions", "audit_logs", "roles"
    ]
    
    for collection_name in collections:
        if collection_name not in await db.list_collection_names():
            await db.create_collection(collection_name)
    
    # Патчим только те модули, которые действительно имеют атрибут 'db'
    from unittest.mock import patch
    
    # Определяем модули, которые нужно патчить (только те, что импортируют db из config_init)
    modules_to_patch = [
        'config.config_init.db',  # Основной модуль с db
        'utils.audit_utils.db',   # Использует db из config_init
        'services.services_auth.db',  # Использует db из config_init
    ]
    
    patches = []
    for module_path in modules_to_patch:
        try:
            # Проверяем, существует ли атрибут перед патчингом
            module_name = module_path.split('.')[0]
            attr_name = module_path.split('.')[-1]
            
            if module_name in sys.modules:
                patch_obj = patch(module_path, client)
                patches.append(patch_obj)
                patch_obj.start()
        except (AttributeError, ModuleNotFoundError) as e:
            # Если модуль или атрибут не существуют, пропускаем
            print(f"Warning: Skipping patch for {module_path}: {e}")
            continue
    
    try:
        yield db
    finally:
        # Останавливаем все патчи
        for patch_obj in patches:
            try:
                patch_obj.stop()
            except:
                pass
        
        # Закрываем клиент
        try:
            if client is not None:
                await client.close()
        except Exception as e:
            # Игнорируем ошибки при закрытии в тестах
            print(f"Warning: Error closing mock client: {e}")

@pytest.fixture
def sample_admin_user():
    """Sample admin user data for tests"""
    return {
        "id": "b7918dad-2e81-4ccd-a066-f5f0643592fa",
        "username": "admin",
        "password": "admin123",
        "full_name": "Администратор",
        "is_active": True,
        "is_admin": True,
    }


@pytest.fixture
def sample_regular_user():
    """Sample regular user data for tests"""
    return {
        "id": "4449b88a-debe-471d-aaf2-045b8b135879",
        "username": "user",
        "email": "testuser@example.com",
        "password": "1234",
        "full_name": "Иванов Иван Иванович",
        "is_active": True,
        "is_admin": False,
    }


@pytest.fixture
def sample_host_ssh():
    """Sample SSH host data for tests"""
    return {
        "name": "linux-server-01",
        "hostname": "192.168.56.102",
        "port": 22,
        "username": "user",
        "password": "12345678",
        "auth_type": "password",
        "connection_type": "ssh"
    }


@pytest.fixture
def sample_host_winrm():
    """Sample WinRM host data for tests"""
    return {
        "name": "windows-server-01",
        "hostname": "192.168.56.103",
        "port": 5985,
        "username": "Administrator",
        "password": "Password123!",
        "auth_type": "password",
        "connection_type": "winrm"
    }


@pytest.fixture
def sample_category():
    """Sample category data for tests"""
    return {
        "name": "Security",
        "description": "Security category for testing"
    }


@pytest.fixture
def sample_system():
    """Sample system data for tests"""
    return {
        "name": "Firewall",
        "description": "Firewall checks",
        "os_type": "linux"
    }


@pytest.fixture
def sample_script():
    """Sample script/check data for tests"""
    return {
        "name": "Check iptables",
        "description": "Verify iptables rules",
        "commands": "sudo iptables -L -n",
        "handler_script": "#!/bin/bash\necho 'Passed'",
        "etalon_data": "Chain INPUT (policy ACCEPT)",
        "testing_methodology": "Execute iptables command and verify output",
        "success_criteria": "Output contains chain information",
        "order": 1,
        "check_groups": []
    }


@pytest.fixture
def sample_project():
    """Sample project data for tests"""
    return {
        "name": "Monthly Security Audit",
        "description": "Monthly security audit for all servers",
        "hosts": [],
        "tasks": []
    }


@pytest.fixture
def mock_ssh_client():
    """Mock SSH client for testing host connections"""
    mock_client = MagicMock()
    mock_client.exec_command = MagicMock(return_value=(
        MagicMock(read=lambda: b"output"),
        MagicMock(read=lambda: b""),
        0
    ))
    return mock_client


@pytest.fixture
def mock_winrm_session():
    """Mock WinRM session for testing Windows host connections"""
    mock_session = MagicMock()
    mock_session.run_cmd = MagicMock(return_value=MagicMock(
        status_code=0,
        std_out=b"output",
        std_err=b""
    ))
    return mock_session
    

@pytest.fixture
def test_client(mock_db):
    """
    FastAPI test client with mocked database.
    Note: This requires patching the database dependency in the app.
    """
    from fastapi.testclient import TestClient
    from server import app
    
    # Patch database dependency
    # This will be done in individual test files as needed
    client = TestClient(app)
    return client


@pytest.fixture(autouse=True)
def reset_environment():
    """Reset environment variables before each test"""
    yield
    # Cleanup if needed

