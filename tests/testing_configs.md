# ⚙️ КОНФИГУРАЦИОННЫЕ ФАЙЛЫ И ПРИМЕРЫ КОДА

## 1. КОНФИГУРАЦИОННЫЕ ФАЙЛЫ

### 1.1 `backend/pytest.ini`

```ini
[pytest]
# Асинхронный режим для pytest-asyncio
asyncio_mode = auto
asyncio_default_fixture_scope = function

# Пути и паттерны
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*

# Маркеры для категоризации тестов
markers =
    unit: Unit tests (быстрые, без БД)
    integration: Integration tests (с БД, workflows)
    e2e: End-to-end tests (реальное приложение)
    api: API contract tests
    performance: Performance tests (load testing)
    security: Security tests
    slow: Slow tests (> 5 сек)
    skip_ci: Skip in CI/CD pipeline

# Опции CLI по умолчанию
addopts =
    -v
    --strict-markers
    --tb=short
    --disable-warnings
    --cov=app
    --cov-report=html
    --cov-report=term-missing
    --cov-report=xml
    --cov-fail-under=80
    --junitxml=junit.xml
    -ra

# Timeout для тестов (в секундах)
timeout = 60
timeout_method = thread

# Игнорируемые пути
norecursedirs = __pycache__ .git .venv .pytest_cache build dist
```

### 1.2 `backend/requirements-test.txt`

```txt
# Testing frameworks
pytest==7.4.0
pytest-asyncio==0.21.1
pytest-cov==4.1.0
pytest-timeout==2.1.0
pytest-mock==3.11.1
pytest-xdist==3.3.1  # Параллельное выполнение

# Database mocking
mongomock==4.1.2
mongomock-motor==4.0.0

# HTTP testing
requests==2.31.0
httpx==0.24.1

# JSON/Data validation
jsonschema==4.19.0
pydantic==2.3.0

# Mocking & fixtures
unittest-mock==1.5.0
faker==19.6.0  # Генерация fake data
factory-boy==3.3.0  # Factory pattern for models

# Performance testing
locust==2.16.1

# Security testing
bandit==1.7.5
safety==2.3.5

# Code quality
black==23.9.1
flake8==6.1.0
isort==5.12.0
pylint==2.17.5

# Test utilities
python-dotenv==1.0.0
```

### 1.3 `frontend/jest.config.js`

```javascript
module.exports = {
  testEnvironment: 'jsdom',
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
  
  // Module mapping
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/__mocks__/fileMock.js',
  },
  
  // Transform files
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  
  // Coverage settings
  collectCoverageFrom: [
    'src/**/*.{js,jsx}',
    '!src/index.js',
    '!src/reportWebVitals.js',
    '!src/**/*.test.{js,jsx}',
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
    './src/components/': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  
  // Test match patterns
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{js,jsx}',
    '<rootDir>/src/**/*.{spec,test}.{js,jsx}',
  ],
  
  // Module directories
  moduleDirectories: ['node_modules', 'src'],
};
```

### 1.4 `frontend/src/setupTests.js`

```javascript
import '@testing-library/jest-dom';
import { server } from './__mocks__/mswServer';

// Establish API mocking before all tests
beforeAll(() => server.listen());

// Reset any request handlers that we may add during the tests,
// so they don't affect other tests
afterEach(() => server.resetHandlers());

// Clean up after the tests are finished
afterAll(() => server.close());

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;
```

### 1.5 `docker-compose.test.yml`

```yaml
version: '3.9'

services:
  # MongoDB для integration и E2E тестов
  mongo-test:
    image: mongo:7.0-alpine
    container_name: osib-mongo-test
    ports:
      - "27018:27017"
    environment:
      MONGO_INITDB_ROOT_USERNAME: testuser
      MONGO_INITDB_ROOT_PASSWORD: testpass123
      MONGO_INITDB_DATABASE: test_db
    volumes:
      - mongo-test-data:/data/db
    healthcheck:
      test: |
        mongosh -u testuser -p testpass123 --authenticationDatabase admin 
        --eval "db.adminCommand('ping')" || exit 1
      interval: 5s
      timeout: 10s
      retries: 5
    networks:
      - test-network

  # Backend для E2E и Performance тестов
  backend-test:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: osib-backend-test
    ports:
      - "8001:8001"
    environment:
      MONGO_URL: mongodb://testuser:testpass123@mongo-test:27017/test_db?authSource=admin
      ENCRYPTION_KEY: ${ENCRYPTION_KEY:-dGVzdC1lbmNyeXB0aW9uLWtleS0zMi1ieXRlcy1sb25nLWZvcmNvaQ==}
      JWT_SECRET_KEY: ${JWT_SECRET_KEY:-test-jwt-secret-key-at-least-32-characters-long}
      LOG_LEVEL: INFO
      ENVIRONMENT: test
    depends_on:
      mongo-test:
        condition: service_healthy
    volumes:
      - ./backend:/app
    healthcheck:
      test: curl -f http://localhost:8001/api/auth/me || exit 1
      interval: 5s
      timeout: 10s
      retries: 5
    networks:
      - test-network

  # Frontend для E2E тестов
  frontend-test:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        REACT_APP_BACKEND_URL: http://backend-test:8001
    container_name: osib-frontend-test
    ports:
      - "3000:3000"
    environment:
      REACT_APP_BACKEND_URL: http://localhost:8001
      CI: true
    depends_on:
      - backend-test
    healthcheck:
      test: curl -f http://localhost:3000 || exit 1
      interval: 5s
      timeout: 10s
      retries: 5
    networks:
      - test-network

volumes:
  mongo-test-data:

networks:
  test-network:
    driver: bridge
```

### 1.6 `pytest.ini` (в корне проекта)

```ini
[pytest]
testpaths = tests backend/tests frontend/tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*

markers =
    e2e: End-to-end tests
    integration: Integration tests
    unit: Unit tests
    performance: Performance tests
    api: API contract tests
    security: Security tests

addopts =
    -v
    --strict-markers
    --tb=short
```

### 1.7 `conftest.py` (в корне для E2E тестов)

```python
# tests/conftest.py
import asyncio
import pytest
import pytest_asyncio
from pathlib import Path
import os

# Add project root to Python path
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

# Environment variables for tests
os.environ["ENVIRONMENT"] = "test"
os.environ["LOG_LEVEL"] = "DEBUG"

@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="session")
def test_env():
    """Test environment configuration"""
    return {
        "backend_url": "http://localhost:8001",
        "frontend_url": "http://localhost:3000",
        "mongo_url": "mongodb://testuser:testpass123@localhost:27018/test_db",
        "admin_username": "admin",
        "admin_password": "admin123",
    }

@pytest.fixture(autouse=True)
def reset_test_data():
    """Reset test data before each test"""
    yield
    # Cleanup if needed

@pytest.fixture
def mock_ssh_factory():
    """Factory for creating mock SSH clients"""
    from unittest.mock import MagicMock
    
    def create_mock_ssh(hostname, output="", error="", return_code=0):
        mock_ssh = MagicMock()
        mock_ssh.exec_command.return_value = (
            MagicMock(read=lambda: output.encode()),
            MagicMock(read=lambda: error.encode()),
            return_code
        )
        return mock_ssh
    
    return create_mock_ssh
```

---

## 2. ПРИМЕРЫ ТЕСТОВ

### 2.1 Unit Test: Auth Service

```python
# backend/tests/unit/test_auth_service.py
import pytest
from unittest.mock import AsyncMock, patch
from app.services.auth_service import AuthService
from app.models.user import User

class TestAuthService:
    
    @pytest.fixture
    def auth_service(self, mock_db):
        """Создание экземпляра сервиса с mock БД"""
        return AuthService(db=mock_db)
    
    @pytest.mark.asyncio
    async def test_register_user_success(self, auth_service):
        """Test: Успешная регистрация пользователя"""
        # ARRANGE
        user_data = {
            "username": "newuser",
            "email": "newuser@example.com",
            "password": "SecurePass123!"
        }
        
        # ACT
        result = await auth_service.register(user_data)
        
        # ASSERT
        assert result["username"] == user_data["username"]
        assert result["email"] == user_data["email"]
        assert "user_id" in result
        assert "password" not in result  # Password не должен быть в ответе
    
    @pytest.mark.asyncio
    async def test_register_duplicate_username(self, auth_service):
        """Test: Попытка регистрации с существующим username"""
        # ARRANGE
        user_data = {"username": "admin", "email": "admin@test.com", "password": "pass"}
        
        # ACT & ASSERT
        with pytest.raises(ValueError, match="Username already exists"):
            await auth_service.register(user_data)
    
    @pytest.mark.asyncio
    async def test_register_invalid_email(self, auth_service):
        """Test: Валидация неправильного email"""
        user_data = {
            "username": "testuser",
            "email": "invalid-email",
            "password": "pass"
        }
        
        with pytest.raises(ValueError, match="Invalid email"):
            await auth_service.register(user_data)
    
    @pytest.mark.asyncio
    async def test_login_success(self, auth_service):
        """Test: Успешный login"""
        # ARRANGE
        await auth_service.register({
            "username": "testuser",
            "email": "test@example.com",
            "password": "TestPass123!"
        })
        
        # ACT
        result = await auth_service.login("testuser", "TestPass123!")
        
        # ASSERT
        assert "access_token" in result
        assert result["token_type"] == "bearer"
        assert "expires_in" in result
    
    @pytest.mark.asyncio
    async def test_login_wrong_password(self, auth_service):
        """Test: Login с неправильным паролем"""
        # ARRANGE
        await auth_service.register({
            "username": "testuser",
            "email": "test@example.com",
            "password": "TestPass123!"
        })
        
        # ACT & ASSERT
        with pytest.raises(ValueError, match="Invalid credentials"):
            await auth_service.login("testuser", "WrongPassword123!")
    
    @pytest.mark.asyncio
    async def test_verify_token_valid(self, auth_service):
        """Test: Проверка валидного токена"""
        # ARRANGE
        login_result = await auth_service.login("admin", "admin123")
        token = login_result["access_token"]
        
        # ACT
        user = await auth_service.verify_token(token)
        
        # ASSERT
        assert user["username"] == "admin"
```

### 2.2 Integration Test: Host Management Flow

```python
# backend/tests/integration/test_host_management_flow.py
import pytest
from httpx import AsyncClient
from app.server import app

class TestHostManagementFlow:
    
    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_full_host_workflow(self, async_test_client, mock_ssh_service):
        """
        Full workflow: Login → Create Host → Verify Connection → Update → Delete
        """
        
        # STEP 1: Login
        login_response = await async_test_client.post(
            "/api/auth/login",
            json={"username": "admin", "password": "admin123"}
        )
        assert login_response.status_code == 200
        token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # STEP 2: Create Host
        host_data = {
            "name": "prod-server-01",
            "hostname": "192.168.1.100",
            "port": 22,
            "username": "admin",
            "password": "pass123",
            "auth_type": "password",
            "connection_type": "ssh"
        }
        
        create_response = await async_test_client.post(
            "/api/hosts",
            json=host_data,
            headers=headers
        )
        assert create_response.status_code == 201
        host_id = create_response.json()["id"]
        
        # STEP 3: Verify Host in DB
        host_in_db = await mock_db.hosts.find_one({"_id": host_id})
        assert host_in_db is not None
        assert host_in_db["name"] == host_data["name"]
        # Проверить что пароль зашифрован
        assert host_in_db["password"] != host_data["password"]
        
        # STEP 4: Verify Connection (mock SSH)
        verify_response = await async_test_client.post(
            f"/api/hosts/{host_id}/verify",
            headers=headers
        )
        assert verify_response.status_code == 200
        assert verify_response.json()["status"] == "connected"
        
        # STEP 5: Update Host
        update_data = {
            "name": "prod-server-01-updated",
            "port": 2222
        }
        update_response = await async_test_client.put(
            f"/api/hosts/{host_id}",
            json=update_data,
            headers=headers
        )
        assert update_response.status_code == 200
        
        # STEP 6: Verify Update
        get_response = await async_test_client.get(
            f"/api/hosts/{host_id}",
            headers=headers
        )
        assert get_response.status_code == 200
        assert get_response.json()["name"] == "prod-server-01-updated"
        
        # STEP 7: Delete Host
        delete_response = await async_test_client.delete(
            f"/api/hosts/{host_id}",
            headers=headers
        )
        assert delete_response.status_code == 204
        
        # STEP 8: Verify Deletion
        get_after_delete = await async_test_client.get(
            f"/api/hosts/{host_id}",
            headers=headers
        )
        assert get_after_delete.status_code == 404
```

### 2.3 Frontend Component Test

```javascript
// frontend/src/__tests__/components/LoginForm.test.jsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LoginForm } from '../../components/LoginForm';

describe('LoginForm Component', () => {
  
  it('should render login form with email and password inputs', () => {
    render(<LoginForm />);
    
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
  });
  
  it('should display validation error for empty fields', async () => {
    render(<LoginForm />);
    
    const loginButton = screen.getByRole('button', { name: /login/i });
    fireEvent.click(loginButton);
    
    await waitFor(() => {
      expect(screen.getByText(/username is required/i)).toBeInTheDocument();
      expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    });
  });
  
  it('should display validation error for invalid email', async () => {
    render(<LoginForm />);
    
    const usernameInput = screen.getByLabelText(/username/i);
    fireEvent.change(usernameInput, { target: { value: 'invalid-email' } });
    
    const loginButton = screen.getByRole('button', { name: /login/i });
    fireEvent.click(loginButton);
    
    await waitFor(() => {
      expect(screen.getByText(/invalid email format/i)).toBeInTheDocument();
    });
  });
  
  it('should call onLogin with credentials on successful submit', async () => {
    const onLoginMock = jest.fn();
    render(<LoginForm onLogin={onLoginMock} />);
    
    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    
    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    
    const loginButton = screen.getByRole('button', { name: /login/i });
    fireEvent.click(loginButton);
    
    await waitFor(() => {
      expect(onLoginMock).toHaveBeenCalledWith({
        username: 'testuser',
        password: 'password123'
      });
    });
  });
  
  it('should display API error message', async () => {
    const errorMessage = 'Invalid credentials';
    render(<LoginForm errorMessage={errorMessage} />);
    
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });
  
  it('should disable submit button while loading', () => {
    render(<LoginForm isLoading={true} />);
    
    const loginButton = screen.getByRole('button', { name: /login/i });
    expect(loginButton).toBeDisabled();
  });
});
```

### 2.4 E2E Test: Project Creation

```python
# tests/e2e/test_project_creation.py
import pytest
from tests.e2e.pages.login_page import LoginPage
from tests.e2e.pages.projects_page import ProjectsPage
from tests.e2e.pages.hosts_page import HostsPage

class TestProjectCreation:
    
    @pytest.mark.e2e
    async def test_create_and_execute_project(self, page):
        """
        E2E Test: Full project creation and execution workflow
        """
        
        # STEP 1: Login
        login_page = LoginPage(page)
        await login_page.goto()
        await login_page.login("admin", "admin123")
        
        # Verify logged in
        assert await page.is_visible('text=Dashboard')
        
        # STEP 2: Navigate to Projects
        await page.click('a:has-text("Projects")')
        await page.wait_for_url("**/projects")
        
        # STEP 3: Start Project Creation (Wizard)
        projects_page = ProjectsPage(page)
        await projects_page.click_create_button()
        
        # STEP 3.1: Step 1 - Project Info
        await page.fill('input[name="project_name"]', "Security Audit 2024")
        await page.fill('textarea[name="description"]', "Monthly security audit")
        await page.click('button:has-text("Next")')
        
        # STEP 3.2: Step 2 - Select Hosts
        await page.check('input[value="prod-server-01"]')
        await page.check('input[value="windows-prod-01"]')
        await page.click('button:has-text("Next")')
        
        # STEP 3.3: Step 3 - Select Checks
        await page.check('input[name="check-firewall"]')
        await page.check('input[name="check-ssh"]')
        await page.check('input[name="check-updates"]')
        await page.click('button:has-text("Next")')
        
        # STEP 3.4: Step 4 - Review & Create
        # Verify all selections appear
        assert await page.is_visible('text=Security Audit 2024')
        assert await page.is_visible('text=prod-server-01')
        assert await page.is_visible('text=check-firewall')
        
        # Create project
        await page.click('button:has-text("Create Project")')
        
        # Wait for success message
        await page.wait_for_selector('text=Project created successfully')
        
        # STEP 4: Verify project in list
        await page.wait_for_selector('text=Security Audit 2024')
        assert await page.is_visible('text=Security Audit 2024')
        
        # STEP 5: Execute Project
        await page.click('button[title="Execute Project"]')
        
        # STEP 6: Monitor Progress
        # Waiters для SSE обновлений
        await page.wait_for_selector('text=Execution started')
        
        # Monitor each check
        await page.wait_for_selector('text=Check firewall', timeout=30000)
        await page.wait_for_selector('text=Check firewall PASSED', timeout=10000)
        
        # Wait for completion
        await page.wait_for_selector('text=Execution completed', timeout=60000)
        
        # STEP 7: View Results
        await page.click('button:has-text("View Results")')
        
        # STEP 8: Verify Results
        await page.wait_for_selector('text=Results for: Security Audit 2024')
        
        # Проверить статистику
        passed_count = await page.locator('text=✓ Passed').count()
        assert passed_count >= 3
        
        # STEP 9: Export to Excel
        await page.click('button:has-text("Export to Excel")')
        
        # Дождаться download
        async with page.expect_download() as download_info:
            await page.click('a:has-text("Download Excel")')
        
        download = await download_info.value
        assert download.suggested_filename.endswith('.xlsx')
        
        # STEP 10: Take screenshot
        await page.screenshot(path="project_completed.png")
```

### 2.5 API Contract Test

```python
# tests/api/test_host_endpoints.py
import requests
import jsonschema

BASE_URL = "http://localhost:8001"

class TestHostEndpoints:
    
    def setup_method(self):
        """Setup before each test"""
        self.session = requests.Session()
        # Login and get token
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": "admin", "password": "admin123"}
        )
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_list_hosts_contract(self):
        """Test: GET /api/hosts returns correct schema"""
        response = self.session.get(
            f"{BASE_URL}/api/hosts",
            headers=self.headers
        )
        
        # Verify HTTP status
        assert response.status_code == 200
        
        # Verify response schema
        schema = {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "name": {"type": "string"},
                    "hostname": {"type": "string"},
                    "port": {"type": "integer", "minimum": 1, "maximum": 65535},
                    "connection_type": {"type": "string", "enum": ["ssh", "winrm"]},
                    "created_at": {"type": "string", "format": "date-time"},
                    "created_by": {"type": "string"}
                },
                "required": ["id", "name", "hostname", "port", "connection_type"]
            }
        }
        
        jsonschema.validate(response.json(), schema)
    
    def test_create_host_contract(self):
        """Test: POST /api/hosts returns correct schema"""
        host_data = {
            "name": "test-host",
            "hostname": "192.168.1.100",
            "port": 22,
            "username": "admin",
            "password": "pass",
            "auth_type": "password",
            "connection_type": "ssh"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/hosts",
            json=host_data,
            headers=self.headers
        )
        
        # Verify HTTP status (201 Created)
        assert response.status_code == 201
        
        # Verify response schema
        schema = {
            "type": "object",
            "properties": {
                "id": {"type": "string"},
                "name": {"type": "string"},
                "hostname": {"type": "string"},
                "port": {"type": "integer"},
                "connection_type": {"type": "string"},
                "created_at": {"type": "string", "format": "date-time"}
            },
            "required": ["id", "name", "hostname", "port"]
        }
        
        jsonschema.validate(response.json(), schema)
    
    def test_invalid_request_returns_400(self):
        """Test: Invalid request returns 400 Bad Request"""
        invalid_data = {
            "name": "test-host",
            # Missing required 'hostname'
            "port": 22
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/hosts",
            json=invalid_data,
            headers=self.headers
        )
        
        assert response.status_code == 400
        
        # Verify error schema
        error = response.json()
        assert "error" in error
        assert "message" in error or "detail" in error
```

---

## 3. MSW Mock для Frontend

### 3.1 `frontend/src/__mocks__/handlers.js`

```javascript
import { rest } from 'msw';

const BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

export const handlers = [
  // Auth endpoints
  rest.post(`${BASE_URL}/api/auth/login`, (req, res, ctx) => {
    const { username, password } = req.body;
    
    if (username === 'admin' && password === 'admin123') {
      return res(
        ctx.status(200),
        ctx.json({
          access_token: 'mock-jwt-token-' + Date.now(),
          token_type: 'bearer',
          expires_in: 3600,
          user: {
            id: '1',
            username: 'admin',
            email: 'admin@example.com',
            role: 'admin'
          }
        })
      );
    }
    
    return res(
      ctx.status(401),
      ctx.json({ error: 'Invalid credentials' })
    );
  }),
  
  rest.get(`${BASE_URL}/api/auth/me`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        id: '1',
        username: 'admin',
        email: 'admin@example.com',
        role: 'admin',
        permissions: ['admin']
      })
    );
  }),
  
  // Hosts endpoints
  rest.get(`${BASE_URL}/api/hosts`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json([
        {
          id: '1',
          name: 'prod-server-01',
          hostname: '192.168.1.100',
          port: 22,
          connection_type: 'ssh',
          created_at: new Date().toISOString()
        },
        {
          id: '2',
          name: 'windows-prod-01',
          hostname: '192.168.1.50',
          port: 5985,
          connection_type: 'winrm',
          created_at: new Date().toISOString()
        }
      ])
    );
  }),
  
  rest.post(`${BASE_URL}/api/hosts`, (req, res, ctx) => {
    return res(
      ctx.status(201),
      ctx.json({
        id: '3',
        name: req.body.name,
        hostname: req.body.hostname,
        port: req.body.port,
        connection_type: req.body.connection_type,
        created_at: new Date().toISOString()
      })
    );
  }),
  
  // Projects endpoints
  rest.get(`${BASE_URL}/api/projects`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json([
        {
          id: '1',
          name: 'Security Audit 2024',
          description: 'Monthly security audit',
          hosts: ['1', '2'],
          created_at: new Date().toISOString(),
          created_by: 'admin'
        }
      ])
    );
  })
];
```

### 3.2 `frontend/src/__mocks__/mswServer.js`

```javascript
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

---

## Итого

Эти файлы обеспечивают:

✅ **Полную конфигурацию** для всех типов тестов
✅ **Примеры кода** для быстрого старта
✅ **Best practices** для организации тестов
✅ **Mock'и и fixtures** для изоляции тестов
✅ **Docker setup** для контролируемого окружения

Используйте эти файлы как шаблоны для вашего проекта!
