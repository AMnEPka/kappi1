# 📋 Полный план тестирования проекта OSIB Automation Tool

---

## 📊 Структура плана

```
├── 1. Анализ архитектуры
├── 2. Стратегия тестирования
├── 3. Типы тестов и область покрытия
├── 4. Инфраструктура тестирования
├── 5. Промпты и алгоритмы для каждого типа
├── 6. Организация тестовых данных
├── 7. CI/CD интеграция
└── 8. Метрики качества
```

---

## 1. 🔍 АНАЛИЗ АРХИТЕКТУРЫ ПРОЕКТА

### Backend (FastAPI + MongoDB + Paramiko/pywinrm)
- **Слои:** API → Services → Models → Database
- **Критические компоненты:**
  - Аутентификация/Авторизация (JWT, RBAC)
  - Управление хостами (SSH/WinRM)
  - Иерархия: Категория → Система → Проверка
  - Система проектов и задач
  - Планировщик (Scheduler Worker)
  - Выполнение скриптов и команд
  - Экспорт в Excel

### Frontend (React 19 + Axios)
- **Страницы:** Login, Scripts, Projects, Scheduler, Roles, Users, Hosts
- **Компоненты:** Формы, таблицы, модали, фильтры
- **Контексты:** AuthContext для управления состоянием

### База данных (MongoDB)
- Collections: Users, Roles, Hosts, Categories, Systems, Scripts, CheckGroups, Projects, Tasks, SchedulerJobs, Executions, Audit

---

## 2. 🎯 СТРАТЕГИЯ ТЕСТИРОВАНИЯ

### Пирамида тестирования

```
        🔺 E2E Tests (10-15%)
       / \
      /   \  Integration Tests (20-30%)
     /     \
    /       \ Unit Tests (55-70%)
   /_________\
```

### Покрытие по функциям

| Функция | Unit | Integration | E2E | Приоритет |
|---------|------|-------------|-----|-----------|
| Аутентификация/JWT | ✅✅✅ | ✅✅ | ✅ | Критично |
| RBAC/Permissions | ✅✅✅ | ✅✅ | ✅ | Критично |
| Управление хостами | ✅✅ | ✅✅ | ✅ | Высокий |
| SSH/WinRM подключение | ✅ | ✅✅✅ | ✅ | Высокий |
| Проверки (Scripts) | ✅✅✅ | ✅✅ | ✅ | Высокий |
| Проекты | ✅✅ | ✅✅ | ✅ | Высокий |
| Планировщик | ✅✅ | ✅✅ | ✅ | Средний |
| Экспорт Excel | ✅✅ | ✅ | ✅ | Средний |
| Форм валидация | ✅✅✅ | - | ✅ | Средний |
| Обработка ошибок | ✅✅ | ✅✅ | ✅ | Средний |

---

## 3. 📝 ТИПЫ ТЕСТОВ И ОБЛАСТЬ ПОКРЫТИЯ

### 3.1 UNIT TESTS (Backend - FastAPI)

**Местоположение:** `backend/tests/unit/`

**Структура:**
```
backend/tests/unit/
├── test_auth_service.py
├── test_rbac_service.py
├── test_host_service.py
├── test_script_service.py
├── test_project_service.py
├── test_scheduler_service.py
├── test_excel_export.py
├── test_validators.py
└── conftest.py (fixtures)
```

**Инструменты:**
- `pytest` - фреймворк
- `pytest-asyncio` - асинхронное тестирование
- `mongomock` или `mongomock-motor` - mock MongoDB
- `unittest.mock` - mocking

**Покрываемые области:**

#### 1.1 Аутентификация & JWT
- ✅ Создание и валидация JWT токенов
- ✅ Хеширование паролей (bcrypt)
- ✅ Проверка истечения токена
- ✅ Обновление токена
- ✅ Logout и очистка сессии

#### 1.2 RBAC & Permissions
- ✅ Проверка прав доступа к ресурсам
- ✅ Создание ролей с набором permissions
- ✅ Присвоение ролей пользователям
- ✅ Гранулярные проверки прав
- ✅ Администраторские роли

#### 1.3 Валидация данных
- ✅ Валидация email
- ✅ Валидация имён хостов (IP, FQDN)
- ✅ Валидация портов (22, 5985, 5986)
- ✅ Валидация типов аутентификации
- ✅ Обязательные поля
- ✅ Длина строк и ограничения

#### 1.4 Шифрование данных
- ✅ Base64 кодирование скриптов
- ✅ Шифрование паролей (Fernet)
- ✅ Шифрование SSH ключей
- ✅ Расшифровка данных

#### 1.5 Бизнес-логика
- ✅ Иерархия: Category → System → Script
- ✅ Назначение проверок группам
- ✅ Создание проектов и задач
- ✅ Расчёт статуса проверок
- ✅ Логирование аудита

#### 1.6 Обработка ошибок
- ✅ 404 Not Found
- ✅ 403 Forbidden
- ✅ 400 Bad Request
- ✅ 500 Internal Server Error
- ✅ Валидационные ошибки

**Algoritm внедрения Unit Tests:**

```
1. Создать директорию: backend/tests/unit/
2. Установить зависимости: pytest, pytest-asyncio, mongomock-motor
3. Написать conftest.py с фиксциями:
   - client: TestClient(FastAPI app)
   - db: mongomock Database
   - sample_user: тестовый пользователь
   - sample_host: тестовый хост
   - async fixtures для асинхронных операций
4. Написать тесты для каждого модуля сервисов
5. Использовать mock для внешних зависимостей (Paramiko, pywinrm)
6. Запуск: pytest backend/tests/unit/ -v --cov=backend/services
```

**Пример conftest.py:**
```python
import pytest
from fastapi.testclient import TestClient
from mongomock_motor import AsyncMongoMockClient
from app.server import app
from app.models.user import User

@pytest.fixture
async def mock_db():
    client = AsyncMongoMockClient()
    db = client.test_db
    yield db
    await client.close()

@pytest.fixture
def test_client():
    return TestClient(app)

@pytest.fixture
def sample_user_data():
    return {
        "username": "testuser",
        "password": "TestPass123!",
        "email": "test@example.com"
    }

@pytest.fixture
def sample_host_data():
    return {
        "name": "prod-server-01",
        "hostname": "192.168.1.100",
        "port": 22,
        "username": "admin",
        "auth_type": "password",
        "connection_type": "ssh"
    }
```

---

### 3.2 UNIT TESTS (Frontend - React)

**Местоположение:** `frontend/src/__tests__/`

**Структура:**
```
frontend/src/__tests__/
├── components/
│   ├── LoginForm.test.jsx
│   ├── HostForm.test.jsx
│   ├── ProjectWizard.test.jsx
│   └── ScriptEditor.test.jsx
├── pages/
│   ├── LoginPage.test.jsx
│   └── ProjectsPage.test.jsx
├── contexts/
│   └── AuthContext.test.jsx
├── utils/
│   └── validators.test.js
└── setup.js
```

**Инструменты:**
- `React Testing Library` - компонент тестирование
- `Jest` - фреймворк
- `@testing-library/jest-dom` - матчеры
- `msw` (Mock Service Worker) - mock API

**Покрываемые области:**

#### 2.1 Компоненты формы
- ✅ Рендеринг формы
- ✅ Валидация на клиенте
- ✅ Обработка onChange событий
- ✅ Отправка формы (submit)
- ✅ Отображение ошибок

#### 2.2 Навигация и маршруты
- ✅ Доступность страниц для ролей
- ✅ Редирект при отсутствии токена
- ✅ Корректная смена страниц

#### 2.3 AuthContext
- ✅ Login/logout
- ✅ Сохранение токена
- ✅ Проверка authenticated состояния
- ✅ Управление пользовательскими данными

#### 2.4 API вызовы
- ✅ Правильные заголовки (Authorization)
- ✅ Корректные URL endpoints
- ✅ Обработка ошибок API

**Algoritm внедрения Unit Tests (Frontend):**

```
1. Установить: @testing-library/react, jest, msw
2. Создать setup.js для конфигурации MSW
3. Написать тесты для компонентов:
   - Использовать render() из RTL
   - fireEvent для событий
   - waitFor() для асинхронных операций
   - screen.getBy* для поиска элементов
4. Mock API ответы с MSW
5. Тестировать доступность (a11y)
6. Запуск: npm test -- --coverage
```

---

### 3.3 INTEGRATION TESTS (Backend + Database)

**Местоположение:** `backend/tests/integration/`

**Структура:**
```
backend/tests/integration/
├── test_auth_flow.py
├── test_host_management.py
├── test_script_execution.py
├── test_project_workflow.py
├── test_scheduler_job.py
├── test_rbac_integration.py
├── conftest.py (fixtures + real MongoDB container)
└── mocks/
    ├── mock_paramiko.py
    └── mock_pywinrm.py
```

**Инструменты:**
- `pytest` с `pytest-asyncio`
- `testcontainers` - Docker контейнеры для MongoDB
- `docker` - запуск MongoDB в контейнере
- Реальное MongoDB подключение (или Mock)

**Покрываемые области:**

#### 3.1 Auth Flow
- ✅ Регистрация → Login → JWT токен
- ✅ Использование токена в запросах
- ✅ Logout
- ✅ Refresh token
- ✅ Истечение токена

#### 3.2 RBAC Integration
- ✅ Создание роли с permissions
- ✅ Назначение роли пользователю
- ✅ Проверка доступа к запросу
- ✅ Иерархия ролей (Admin > User)

#### 3.3 Host Management Flow
- ✅ Создание хоста (POST /api/hosts)
- ✅ Сохранение в БД
- ✅ Проверка доступности (с mock SSH/WinRM)
- ✅ Редактирование хоста
- ✅ Удаление хоста

#### 3.4 Script Execution
- ✅ Создание категории → система → проверка
- ✅ Выполнение команды на хосте (mock)
- ✅ Обработка вывода скриптом
- ✅ Сохранение результата

#### 3.5 Project Workflow
- ✅ Создание проекта (4 шага)
- ✅ Выбор хостов и проверок
- ✅ Запуск проекта (POST /api/projects/{id}/execute)
- ✅ Отслеживание прогресса
- ✅ Сохранение сессии

#### 3.6 Scheduler Integration
- ✅ Создание запланированного задания
- ✅ Расчёт следующего запуска
- ✅ Выполнение задания в указанное время (mock timer)
- ✅ Обновление статуса
- ✅ История выполнений

#### 3.7 Excel Export
- ✅ Генерация Excel файла
- ✅ Форматирование по ГОСТ
- ✅ Корректные данные в ячейках
- ✅ Мультиязычный контент

**Algoritm внедрения Integration Tests:**

```
1. Создать conftest.py с реальным MongoDB (Docker Compose):
   ```python
   import pytest
   from testcontainers.mongodb import MongoDbContainer
   
   @pytest.fixture(scope="session")
   def mongodb():
       with MongoDbContainer(image="mongo:7.0") as container:
           yield container.get_connection_url()
   ```

2. Использовать real database с clean-up после каждого теста:
   ```python
   @pytest.fixture(autouse=True)
   async def cleanup_db(db):
       yield
       await db.users.delete_many({})
       await db.hosts.delete_many({})
   ```

3. Mock внешние сервисы (SSH/WinRM):
   ```python
   @pytest.fixture
   def mock_ssh_client(monkeypatch):
       def mock_execute(*args, **kwargs):
           return "output", "", 0
       monkeypatch.setattr("paramiko.SSHClient.exec_command", mock_execute)
   ```

4. Тестировать полные workflows:
   ```python
   async def test_full_project_workflow(test_client, mock_db):
       # 1. Login
       response = test_client.post("/api/auth/login", 
           json={"username": "admin", "password": "pass"})
       token = response.json()["access_token"]
       
       # 2. Create host
       headers = {"Authorization": f"Bearer {token}"}
       response = test_client.post("/api/hosts", 
           json=sample_host_data, headers=headers)
       host_id = response.json()["id"]
       
       # 3. Create check (Category → System → Script)
       # ... и т.д.
   ```

5. Запуск: pytest backend/tests/integration/ -v --docker
```

---

### 3.4 E2E TESTS (Full Stack - Selenium/Playwright)

**Местоположение:** `tests/e2e/`

**Структура:**
```
tests/e2e/
├── conftest.py (fixtures для браузера)
├── test_login_flow.py
├── test_host_management.py
├── test_create_project.py
├── test_execute_project.py
├── test_scheduler_flow.py
├── test_rbac_enforcement.py
├── pages/
│   ├── login_page.py (Page Object)
│   ├── hosts_page.py
│   ├── projects_page.py
│   └── base_page.py
└── test_data.py
```

**Инструменты:**
- `Playwright` или `Selenium` - браузер автоматизация
- `pytest-playwright` - интеграция с pytest
- `Python` - написание тестов

**Покрываемые области:**

#### 4.1 Login Flow
- ✅ Открыть приложение
- ✅ Ввести логин/пароль
- ✅ Нажать кнопку Login
- ✅ Проверить редирект на главную
- ✅ Проверить наличие токена в localStorage

#### 4.2 Host Management
- ✅ Перейти на страницу Hosts
- ✅ Нажать "Add Host"
- ✅ Заполнить форму
- ✅ Проверить доступность (mock)
- ✅ Сохранить хост
- ✅ Проверить в списке хостов
- ✅ Отредактировать хост
- ✅ Удалить хост

#### 4.3 Script Management
- ✅ Создать категорию
- ✅ Добавить систему
- ✅ Создать проверку (скрипт)
- ✅ Заполнить команды, скрипт-обработчик, эталон
- ✅ Сохранить проверку

#### 4.4 Project Creation & Execution
- ✅ Создать новый проект (мастер 4 шага)
- ✅ Выбрать хосты
- ✅ Выбрать системы и проверки
- ✅ Запустить проект
- ✅ Наблюдать прогресс в реальном времени (SSE)
- ✅ Просмотреть результаты
- ✅ Экспортировать в Excel

#### 4.5 Scheduler
- ✅ Перейти на Scheduler
- ✅ Создать одноразовое задание
- ✅ Создать повторяющееся задание
- ✅ Активировать/деактивировать
- ✅ Просмотреть историю

#### 4.6 RBAC & Access Control
- ✅ Login как Admin
- ✅ Создать роль с ограниченными правами
- ✅ Создать пользователя с этой ролью
- ✅ Login как обычный пользователь
- ✅ Проверить, что недоступные кнопки/страницы скрыты
- ✅ Проверить 403 ошибку при попытке доступа

**Algoritm внедрения E2E Tests:**

```
1. Установить Playwright:
   npm install --save-dev @playwright/test pytest-playwright

2. Создать Page Object classes для каждой страницы:
   ```python
   class LoginPage:
       def __init__(self, page):
           self.page = page
           
       async def goto(self):
           await self.page.goto("http://localhost:3000/login")
           
       async def login(self, username, password):
           await self.page.fill('input[name="username"]', username)
           await self.page.fill('input[name="password"]', password)
           await self.page.click('button:has-text("Login")')
           await self.page.wait_for_url("http://localhost:3000/dashboard")
   ```

3. Написать тесты используя Page Objects:
   ```python
   async def test_login_flow(page):
       login_page = LoginPage(page)
       await login_page.goto()
       await login_page.login("admin", "password")
       
       # Проверить что появилась главная страница
       assert await page.is_visible('text=Dashboard')
   ```

4. Использовать fixtures для setup/teardown:
   ```python
   @pytest.fixture(scope="function")
   async def authenticated_page(page):
       login_page = LoginPage(page)
       await login_page.goto()
       await login_page.login("admin", "password")
       yield page
   ```

5. Запуск:
   pytest tests/e2e/ -v --headed (или --headed для видимости браузера)
```

---

### 3.5 API TESTS (REST Contract Testing)

**Местоположение:** `tests/api/`

**Инструменты:**
- `requests` - HTTP клиент
- `pytest` - тестирование
- `jsonschema` - валидация JSON schema

**Покрываемые области:**

#### 5.1 Endpoint Contract Tests
- ✅ POST /api/auth/login - возвращает {access_token, token_type}
- ✅ GET /api/auth/me - возвращает {user data}
- ✅ GET /api/hosts - возвращает список с полями {id, name, hostname, ...}
- ✅ POST /api/hosts - создание с валидацией
- ✅ PUT /api/hosts/{id} - обновление
- ✅ DELETE /api/hosts/{id} - удаление
- ✅ И т.д. для всех 15+ endpoints

#### 5.2 HTTP Status Codes
- ✅ 200 OK - успешный запрос
- ✅ 201 Created - при создании ресурса
- ✅ 400 Bad Request - неправильные данные
- ✅ 401 Unauthorized - отсутствует токен
- ✅ 403 Forbidden - недостаточно прав
- ✅ 404 Not Found - ресурс не найден
- ✅ 500 Internal Server Error

#### 5.3 Response Schema Validation
- ✅ Правильная структура JSON
- ✅ Типы данных полей
- ✅ Обязательные поля присутствуют
- ✅ Нет лишних полей

**Algoritm внедрения API Tests:**

```
1. Создать файл test_api_contracts.py:
   
   ```python
   import requests
   import jsonschema
   
   BASE_URL = "http://localhost:8001"
   
   def test_host_list_contract():
       response = requests.get(f"{BASE_URL}/api/hosts")
       
       schema = {
           "type": "array",
           "items": {
               "type": "object",
               "properties": {
                   "id": {"type": "string"},
                   "name": {"type": "string"},
                   "hostname": {"type": "string"},
                   "port": {"type": "integer"},
                   "connection_type": {"type": "string", "enum": ["ssh", "winrm"]}
               },
               "required": ["id", "name", "hostname", "port"]
           }
       }
       
       jsonschema.validate(response.json(), schema)
   ```

2. Тестировать все HTTP методы и коды ошибок

3. Запуск: pytest tests/api/ -v
```

---

### 3.6 PERFORMANCE TESTS (Load Testing)

**Местоположение:** `tests/performance/`

**Инструменты:**
- `locust` - load testing
- `pytest-benchmark` - микро-бенчмарки

**Покрываемые сценарии:**

#### 6.1 Максимальная нагрузка
- ✅ 100 параллельных пользователей
- ✅ Каждый создает хост и проверку
- ✅ Запускает проект
- ✅ Проверить время ответа < 2 сек

#### 6.2 Стресс-тестирование
- ✅ Увеличивать нагрузку до отказа
- ✅ Точка излома (breaking point)
- ✅ Восстановление после пика

**Algoritm внедрения Performance Tests:**

```
1. Установить: pip install locust

2. Создать locustfile.py:
   ```python
   from locust import HttpUser, task, between
   
   class ProjectUser(HttpUser):
       wait_time = between(1, 3)
       
       @task
       def list_projects(self):
           self.client.get("/api/projects")
       
       @task
       def execute_project(self):
           self.client.post("/api/projects/project-id/execute")
   ```

3. Запуск:
   locust -f tests/performance/locustfile.py --host=http://localhost:8001
```

---

### 3.7 SECURITY TESTS

**Местоположение:** `tests/security/`

**Инструменты:**
- `bandit` - сканирование кода на уязвимости
- `safety` - проверка зависимостей
- `OWASP ZAP` - сканирование приложения

**Покрываемые области:**

#### 7.1 Authentication & Authorization
- ✅ SQL injection в login
- ✅ Brute force protection
- ✅ Token hijacking
- ✅ Cross-Site Request Forgery (CSRF)

#### 7.2 Data Security
- ✅ Пароли не хранятся в логах
- ✅ SSH ключи зашифрованы
- ✅ Скрипты зашифрованы (Base64)
- ✅ Нет sensitive data в ответах API

#### 7.3 API Security
- ✅ CORS правильно настроен
- ✅ Rate limiting для login
- ✅ Валидация input на backend
- ✅ Защита от XSS

**Algoritm внедрения Security Tests:**

```
1. Запустить bandit:
   bandit -r backend/

2. Запустить safety:
   safety check

3. Запустить OWASP ZAP:
   docker run -t owasp/zap2docker-stable zap-baseline.py \
     -t http://localhost:3000
```

---

## 4. 🏗️ ИНФРАСТРУКТУРА ТЕСТИРОВАНИЯ

### 4.1 Структура проекта с тестами

```
osib-automation-tool/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── models/
│   │   ├── services/
│   │   ├── scheduler/
│   │   └── utils/
│   ├── tests/  ← ДОБАВИТЬ
│   │   ├── __init__.py
│   │   ├── conftest.py
│   │   ├── unit/
│   │   │   ├── test_auth_service.py
│   │   │   ├── test_rbac_service.py
│   │   │   ├── test_validators.py
│   │   │   └── ...
│   │   ├── integration/
│   │   │   ├── test_auth_flow.py
│   │   │   ├── test_host_management.py
│   │   │   ├── test_project_workflow.py
│   │   │   └── ...
│   │   ├── mocks/
│   │   │   ├── mock_paramiko.py
│   │   │   └── mock_pywinrm.py
│   │   └── fixtures/
│   │       ├── sample_data.py
│   │       └── database.py
│   ├── requirements.txt
│   ├── requirements-test.txt  ← НОВЫЙ
│   └── pytest.ini  ← НОВЫЙ
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   └── __tests__/  ← ДОБАВИТЬ
│   │       ├── components/
│   │       ├── pages/
│   │       ├── contexts/
│   │       └── setup.js
│   ├── package.json
│   └── jest.config.js  ← НОВЫЙ
│
├── tests/  ← ДОБАВИТЬ (E2E, Performance, Security)
│   ├── e2e/
│   │   ├── conftest.py
│   │   ├── pages/
│   │   ├── test_*.py
│   │   └── test_data.py
│   ├── performance/
│   │   ├── locustfile.py
│   │   └── test_benchmarks.py
│   ├── security/
│   │   └── test_security.py
│   ├── api/
│   │   └── test_api_contracts.py
│   └── conftest.py
│
├── docker-compose.test.yml  ← НОВЫЙ
├── pytest.ini
└── tox.ini  ← НОВЫЙ
```

### 4.2 Docker Compose для тестирования

**Файл: `docker-compose.test.yml`**

```yaml
version: '3.9'

services:
  # MongoDB для integration тестов
  mongo-test:
    image: mongo:7.0
    ports:
      - "27018:27017"
    environment:
      MONGO_INITDB_ROOT_USERNAME: test
      MONGO_INITDB_ROOT_PASSWORD: test123
    healthcheck:
      test: echo 'db.runCommand("ping").ok' | mongosh localhost:27017/test -u test -p test123
      interval: 5s
      timeout: 10s
      retries: 5

  # Backend для E2E тестов
  backend-test:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8001:8001"
    environment:
      MONGO_URL: mongodb://test:test123@mongo-test:27017/test_db?authSource=admin
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
      JWT_SECRET_KEY: ${JWT_SECRET_KEY}
    depends_on:
      mongo-test:
        condition: service_healthy
    volumes:
      - ./backend:/app

  # Frontend для E2E тестов
  frontend-test:
    build:
      context: ./frontend
      dockerfile: Dockerfile.test
    ports:
      - "3000:3000"
    environment:
      REACT_APP_BACKEND_URL: http://backend-test:8001
    depends_on:
      - backend-test
```

### 4.3 Конфигурационные файлы

**`backend/pytest.ini`:**
```ini
[pytest]
asyncio_mode = auto
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
markers =
    unit: Unit tests
    integration: Integration tests
    slow: Slow tests
    security: Security tests
addopts =
    -v
    --strict-markers
    --tb=short
    --cov=app
    --cov-report=html
    --cov-report=term-missing
```

**`backend/requirements-test.txt`:**
```
pytest==7.4.0
pytest-asyncio==0.21.1
pytest-cov==4.1.0
mongomock-motor==4.0.0
mongomock==4.1.2
testcontainers==3.7.0
unittest-mock==1.5.0
requests==2.31.0
jsonschema==4.19.0
locust==2.16.1
```

**`frontend/jest.config.js`:**
```javascript
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  collectCoverageFrom: [
    'src/**/*.{js,jsx}',
    '!src/index.js',
    '!src/reportWebVitals.js',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};
```

---

## 5. 📚 ПРОМПТЫ И АЛГОРИТМЫ ДЛЯ КАЖДОГО ТИПА ТЕСТОВ

### 5.1 UNIT TEST PROMPT (Backend Services)

**Промпт для автоматизации:**

```
Создай Unit тесты для FastAPI сервиса на Python.

Модуль: {module_name}
Класс сервиса: {service_class}
Методы: {list_of_methods}

Требования:
1. Использовать pytest + pytest-asyncio (для async методов)
2. Mock зависимости (Database, External APIs)
3. Использовать fixtures из conftest.py
4. Тестировать Happy Path + Error Cases
5. Минимум покрытие: 85%
6. Структура теста:
   - Arrange (подготовка данных)
   - Act (вызов метода)
   - Assert (проверка результата)

Тестовые сценарии для каждого метода:
- Успешное выполнение
- Валидационная ошибка
- Ошибка БД
- Отсутствие прав доступа

Возврата: Файл test_{module_name}.py с полным покрытием
```

**Пример реализации:**

```python
# backend/tests/unit/test_auth_service.py
import pytest
from unittest.mock import AsyncMock, patch
from app.services.auth_service import AuthService
from app.models.user import User

class TestAuthService:
    
    @pytest.fixture
    def auth_service(self, mock_db):
        return AuthService(db=mock_db)
    
    # TEST 1: Успешная регистрация
    @pytest.mark.asyncio
    async def test_register_user_success(self, auth_service, sample_user_data):
        # Arrange
        expected_user = User(**sample_user_data)
        
        # Act
        result = await auth_service.register(sample_user_data)
        
        # Assert
        assert result["username"] == sample_user_data["username"]
        assert "user_id" in result
    
    # TEST 2: Регистрация с дублирующимся username
    @pytest.mark.asyncio
    async def test_register_duplicate_username(self, auth_service, sample_user_data):
        # Arrange
        await auth_service.register(sample_user_data)
        
        # Act & Assert
        with pytest.raises(ValueError, match="Username already exists"):
            await auth_service.register(sample_user_data)
    
    # TEST 3: Валидация email
    @pytest.mark.asyncio
    async def test_register_invalid_email(self, auth_service):
        # Act & Assert
        invalid_data = {"username": "test", "email": "invalid-email", "password": "pass"}
        with pytest.raises(ValueError, match="Invalid email"):
            await auth_service.register(invalid_data)
    
    # TEST 4: Login успешный
    @pytest.mark.asyncio
    async def test_login_success(self, auth_service, sample_user_data):
        # Arrange
        await auth_service.register(sample_user_data)
        
        # Act
        token = await auth_service.login(sample_user_data["username"], sample_user_data["password"])
        
        # Assert
        assert "access_token" in token
        assert token["token_type"] == "bearer"
    
    # TEST 5: Login с неправильным паролем
    @pytest.mark.asyncio
    async def test_login_wrong_password(self, auth_service, sample_user_data):
        # Arrange
        await auth_service.register(sample_user_data)
        
        # Act & Assert
        with pytest.raises(ValueError, match="Invalid credentials"):
            await auth_service.login(sample_user_data["username"], "wrongpassword")
```

---

### 5.2 INTEGRATION TEST PROMPT

**Промпт:**

```
Создай Integration тесты для полного workflow в FastAPI.

Workflow: {workflow_name}
Шаги:
1. {step_1}
2. {step_2}
...

Требования:
1. Использовать real MongoDB (testcontainers или mock)
2. Тестировать end-to-end flow через API
3. Mock внешние сервисы (SSH, WinRM)
4. Проверить состояние БД после каждого шага
5. Очистить БД после теста (cleanup)
6. Использовать fixtures для setup

Тестировать:
- Успешное выполнение workflow
- Откат при ошибке
- Состояние данных в БД
- Логирование аудита

Возврата: Файл test_{workflow_name}_flow.py
```

**Пример реализации:**

```python
# backend/tests/integration/test_project_workflow.py
@pytest.mark.integration
async def test_full_project_creation_and_execution(
    async_test_client, mock_db, mock_ssh_service
):
    """
    Тестирует полный workflow:
    1. Login пользователя
    2. Создание хоста
    3. Создание категории → системы → проверки
    4. Создание проекта
    5. Запуск проекта
    6. Проверка результатов
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
        "name": "test-server-01",
        "hostname": "192.168.1.100",
        "port": 22,
        "username": "root",
        "auth_type": "password",
        "connection_type": "ssh"
    }
    host_response = await async_test_client.post(
        "/api/hosts",
        json=host_data,
        headers=headers
    )
    assert host_response.status_code == 201
    host_id = host_response.json()["id"]
    
    # Проверить что хост сохранился в БД
    host_in_db = await mock_db.hosts.find_one({"_id": host_id})
    assert host_in_db is not None
    
    # STEP 3: Create Category → System → Script
    category_response = await async_test_client.post(
        "/api/categories",
        json={"name": "Security", "description": "Security checks"},
        headers=headers
    )
    assert category_response.status_code == 201
    category_id = category_response.json()["id"]
    
    system_response = await async_test_client.post(
        f"/api/categories/{category_id}/systems",
        json={"name": "Firewall", "description": "Firewall checks"},
        headers=headers
    )
    assert system_response.status_code == 201
    system_id = system_response.json()["id"]
    
    script_data = {
        "name": "Check iptables",
        "description": "Verify iptables rules",
        "commands": "sudo iptables -L",
        "handler_script": "echo 'Passed'",
        "etalon_data": "[expected output]",
        "order": 1,
        "check_groups": []
    }
    script_response = await async_test_client.post(
        f"/api/systems/{system_id}/scripts",
        json=script_data,
        headers=headers
    )
    assert script_response.status_code == 201
    script_id = script_response.json()["id"]
    
    # STEP 4: Create Project
    project_data = {
        "name": "Security Audit",
        "description": "Monthly security audit",
        "hosts": [host_id],
        "tasks": [
            {
                "host_id": host_id,
                "system_id": system_id,
                "script_id": script_id,
                "etalon_data": "[updated etalon]"
            }
        ]
    }
    project_response = await async_test_client.post(
        "/api/projects",
        json=project_data,
        headers=headers
    )
    assert project_response.status_code == 201
    project_id = project_response.json()["id"]
    
    # STEP 5: Execute Project
    # Использовать mock SSE для отслеживания прогресса
    with patch('app.services.execution_service.execute_on_host') as mock_exec:
        mock_exec.return_value = ("iptables list", "", 0)
        
        exec_response = await async_test_client.post(
            f"/api/projects/{project_id}/execute",
            headers=headers
        )
        assert exec_response.status_code == 200
    
    # STEP 6: Verify Results
    results_response = await async_test_client.get(
        f"/api/projects/{project_id}/sessions",
        headers=headers
    )
    assert results_response.status_code == 200
    
    sessions = results_response.json()
    assert len(sessions) >= 1
    
    latest_session = sessions[0]
    assert latest_session["status"] in ["completed", "success"]
    
    # Проверить что выполнение записалось в БД
    execution_in_db = await mock_db.executions.find_one({
        "session_id": latest_session["id"]
    })
    assert execution_in_db is not None
    assert execution_in_db["status"] in ["passed", "failed", "error"]
```

---

### 5.3 E2E TEST PROMPT

**Промпт:**

```
Создай E2E тесты для веб-приложения используя Playwright.

Сценарий: {scenario_name}
Шаги (на UI):
1. {step_1}
2. {step_2}
...

Требования:
1. Использовать Playwright + pytest-playwright
2. Использовать Page Object Pattern
3. Реальный браузер (Chromium)
4. Реальное приложение (Backend + Frontend)
5. Явные ожидания (wait_for_*)
6. Скриншоты при ошибках
7. Логирование действий

Проверить:
- UI элементы видимы
- Данные корректно заполнены
- Редиректы работают
- Уведомления/alerts отображаются

Возврата: Файл test_{scenario_name}.py с Page Objects
```

**Пример реализации:**

```python
# tests/e2e/pages/base_page.py
class BasePage:
    def __init__(self, page):
        self.page = page
    
    async def goto(self, url):
        await self.page.goto(url)
    
    async def click(self, selector):
        await self.page.click(selector)
    
    async def fill(self, selector, text):
        await self.page.fill(selector, text)
    
    async def is_visible(self, selector):
        return await self.page.is_visible(selector)
    
    async def get_text(self, selector):
        return await self.page.text_content(selector)

# tests/e2e/pages/login_page.py
class LoginPage(BasePage):
    async def goto(self):
        await super().goto("http://localhost:3000/login")
    
    async def login(self, username, password):
        await self.fill('input[name="username"]', username)
        await self.fill('input[name="password"]', password)
        await self.click('button:has-text("Login")')
        await self.page.wait_for_url("http://localhost:3000/dashboard")

# tests/e2e/test_project_creation.py
@pytest.mark.e2e
async def test_create_and_execute_project(page):
    """E2E тест: создание и выполнение проекта"""
    
    # STEP 1: Login
    login_page = LoginPage(page)
    await login_page.goto()
    await login_page.login("admin", "admin123")
    
    # STEP 2: Navigate to Projects
    await page.click('a:has-text("Projects")')
    await page.wait_for_url("**/projects")
    
    # STEP 3: Create new project
    await page.click('button:has-text("Create Project")')
    
    # STEP 3.1: Fill wizard step 1 (Project name)
    await page.fill('input[name="project_name"]', "Test Project")
    await page.fill('input[name="project_description"]', "Test Description")
    await page.click('button:has-text("Next")')
    
    # STEP 3.2: Select hosts
    await page.check('input[value="test-server-01"]')
    await page.click('button:has-text("Next")')
    
    # STEP 3.3: Select systems and checks
    await page.check('input[name="system_firewall"]')
    await page.check('input[name="check_iptables"]')
    await page.click('button:has-text("Next")')
    
    # STEP 3.4: Review and create
    await page.click('button:has-text("Create Project")')
    
    # STEP 4: Verify project appears in list
    await page.wait_for_selector('text=Test Project')
    assert await page.is_visible('text=Test Project')
    
    # STEP 5: Execute project
    await page.click('button[title="Execute"]')
    
    # STEP 6: Monitor progress
    await page.wait_for_selector('text=Execution in progress')
    await page.wait_for_selector('text=Execution completed', timeout=30000)
    
    # STEP 7: View results
    await page.click('button:has-text("View Results")')
    
    # STEP 8: Verify results
    assert await page.is_visible('text=Passed')
    
    # Take screenshot for report
    await page.screenshot(path="test_results.png")
```

---

### 5.4 PERFORMANCE TEST PROMPT

**Промпт:**

```
Создай Performance тесты используя Locust.

Сценарий нагрузки: {scenario}
Пользователи: {num_users}
Ramp-up время: {ramp_up_time}
Длительность: {duration}

Действия пользователя:
1. {action_1}
2. {action_2}
...

Требования:
1. Использовать Locust для load testing
2. Тестировать реальное приложение
3. Мониторить метрики: response time, throughput, errors
4. Целевые метрики:
   - Response time p95: < 2 сек
   - Success rate: > 99%
   - Throughput: > X requests/sec

Возврата: locustfile.py с несколькими scenarios
```

**Пример реализации:**

```python
# tests/performance/locustfile.py
from locust import HttpUser, task, between, events
import json
import logging

logger = logging.getLogger(__name__)

class ProjectUser(HttpUser):
    wait_time = between(1, 3)
    
    def on_start(self):
        """Выполняется при старте пользователя"""
        # Login
        response = self.client.post("/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        }, name="Login")
        
        if response.status_code == 200:
            self.token = response.json()["access_token"]
        else:
            logger.error("Login failed")
    
    @task(1)
    def list_projects(self):
        """Просмотр списка проектов"""
        headers = {"Authorization": f"Bearer {self.token}"}
        self.client.get("/api/projects", 
                       headers=headers,
                       name="List Projects")
    
    @task(1)
    def list_hosts(self):
        """Просмотр списка хостов"""
        headers = {"Authorization": f"Bearer {self.token}"}
        self.client.get("/api/hosts",
                       headers=headers,
                       name="List Hosts")
    
    @task(2)
    def execute_project(self):
        """Выполнение проекта"""
        headers = {"Authorization": f"Bearer {self.token}"}
        self.client.post("/api/projects/project-id/execute",
                        headers=headers,
                        name="Execute Project")

@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    print("Load testing started")

@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    print("Load testing stopped")
```

Запуск:
```bash
locust -f tests/performance/locustfile.py \
  --host=http://localhost:8001 \
  --users=100 \
  --spawn-rate=10 \
  --run-time=5m \
  --headless
```

---

## 6. 📁 ОРГАНИЗАЦИЯ ТЕСТОВЫХ ДАННЫХ

### 6.1 Test Fixtures и Factory Pattern

**Файл: `backend/tests/conftest.py`**

```python
import pytest
import pytest_asyncio
from mongomock_motor import AsyncMongoMockClient
from fastapi.testclient import TestClient
from app.server import app
from app.models.user import User

@pytest_asyncio.fixture
async def mock_db():
    """MongoDB mock для тестов"""
    client = AsyncMongoMockClient()
    db = client.test_db
    
    # Инициализация коллекций
    await db.create_collection("users")
    await db.create_collection("hosts")
    await db.create_collection("projects")
    
    yield db
    
    # Cleanup
    await client.close()

@pytest.fixture
def test_client(mock_db):
    """FastAPI test client"""
    # Переопределить зависимость БД
    def override_get_db():
        return mock_db
    
    app.dependency_overrides[get_db] = override_get_db
    
    client = TestClient(app)
    yield client
    
    app.dependency_overrides.clear()

# FIXTURES для тестовых данных
@pytest.fixture
def sample_admin_user():
    return {
        "username": "admin",
        "password": "Admin123!",
        "email": "admin@example.com",
        "role": "admin"
    }

@pytest.fixture
def sample_regular_user():
    return {
        "username": "user",
        "password": "User123!",
        "email": "user@example.com",
        "role": "user"
    }

@pytest.fixture
def sample_host_ssh():
    return {
        "name": "linux-server-01",
        "hostname": "192.168.1.100",
        "port": 22,
        "username": "admin",
        "password": "password123",
        "auth_type": "password",
        "connection_type": "ssh"
    }

@pytest.fixture
def sample_host_winrm():
    return {
        "name": "windows-server-01",
        "hostname": "192.168.1.50",
        "port": 5985,
        "username": "Administrator",
        "password": "Password123!",
        "auth_type": "password",
        "connection_type": "winrm"
    }

@pytest.fixture
def sample_category():
    return {
        "name": "Security",
        "description": "Security category"
    }

@pytest.fixture
def sample_system():
    return {
        "name": "Firewall",
        "description": "Firewall checks"
    }

@pytest.fixture
def sample_script():
    return {
        "name": "Check iptables",
        "description": "Verify iptables rules",
        "commands": "sudo iptables -L -n",
        "handler_script": "#!/bin/bash\necho 'Passed'",
        "etalon_data": "Chain INPUT (policy ACCEPT)\ntarget prot opt source destination",
        "testing_methodology": "Execute iptables command and verify output",
        "success_criteria": "Output contains chain information",
        "order": 1,
        "check_groups": []
    }

@pytest.fixture
def sample_project():
    return {
        "name": "Monthly Security Audit",
        "description": "Monthly security audit for all servers",
        "hosts": [],  # Будет заполнено в тесте
        "tasks": []   # Будет заполнено в тесте
    }
```

### 6.2 Test Data Builder Pattern

**Файл: `backend/tests/fixtures/builders.py`**

```python
class UserBuilder:
    def __init__(self):
        self.data = {
            "username": "testuser",
            "email": "test@example.com",
            "password": "TestPass123!",
            "role": "user"
        }
    
    def with_username(self, username):
        self.data["username"] = username
        return self
    
    def with_role(self, role):
        self.data["role"] = role
        return self
    
    def as_admin(self):
        self.data["role"] = "admin"
        return self
    
    def build(self):
        return self.data

class HostBuilder:
    def __init__(self):
        self.data = {
            "name": "server-01",
            "hostname": "192.168.1.100",
            "port": 22,
            "username": "admin",
            "auth_type": "password",
            "connection_type": "ssh"
        }
    
    def with_name(self, name):
        self.data["name"] = name
        return self
    
    def as_windows(self):
        self.data["port"] = 5985
        self.data["connection_type"] = "winrm"
        return self
    
    def with_ssh_key(self):
        self.data["auth_type"] = "key"
        return self
    
    def build(self):
        return self.data

# Использование:
def test_create_admin_user():
    user_data = UserBuilder().as_admin().with_username("admin").build()
    assert user_data["role"] == "admin"

def test_create_windows_host():
    host_data = HostBuilder().as_windows().with_name("win-server").build()
    assert host_data["connection_type"] == "winrm"
```

### 6.3 Test Data в JSON файлах

**Файл: `backend/tests/fixtures/test_data.json`**

```json
{
  "users": [
    {
      "username": "admin",
      "email": "admin@example.com",
      "password": "Admin123!",
      "role": "admin"
    },
    {
      "username": "auditor",
      "email": "auditor@example.com",
      "password": "Auditor123!",
      "role": "auditor"
    }
  ],
  "hosts": [
    {
      "name": "linux-prod-01",
      "hostname": "10.0.1.100",
      "port": 22,
      "connection_type": "ssh"
    },
    {
      "name": "windows-prod-01",
      "hostname": "10.0.1.50",
      "port": 5985,
      "connection_type": "winrm"
    }
  ],
  "categories": [
    {
      "name": "Access Control",
      "description": "Access control and authentication checks"
    },
    {
      "name": "Firewall",
      "description": "Firewall configuration checks"
    }
  ]
}
```

---

## 7. 🔄 CI/CD ИНТЕГРАЦИЯ

### 7.1 GitHub Actions Workflow

**Файл: `.github/workflows/tests.yml`**

```yaml
name: Automated Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  # UNIT TESTS (Backend)
  unit-tests-backend:
    runs-on: ubuntu-latest
    services:
      mongo:
        image: mongo:7.0
        options: >-
          --health-cmd mongosh
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 27017:27017
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        working-directory: backend
        run: |
          pip install -r requirements.txt
          pip install -r requirements-test.txt
      
      - name: Run unit tests
        working-directory: backend
        run: pytest tests/unit/ -v --cov=app --cov-report=xml
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./backend/coverage.xml
          flags: backend-unit
  
  # UNIT TESTS (Frontend)
  unit-tests-frontend:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        working-directory: frontend
        run: npm ci
      
      - name: Run unit tests
        working-directory: frontend
        run: npm test -- --coverage --watchAll=false
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./frontend/coverage/lcov.info
          flags: frontend-unit
  
  # INTEGRATION TESTS
  integration-tests:
    runs-on: ubuntu-latest
    services:
      mongo:
        image: mongo:7.0
        options: >-
          --health-cmd mongosh
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 27017:27017
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        working-directory: backend
        run: |
          pip install -r requirements.txt
          pip install -r requirements-test.txt
      
      - name: Run integration tests
        working-directory: backend
        run: pytest tests/integration/ -v --tb=short
        env:
          MONGO_URL: mongodb://localhost:27017/test_db
  
  # E2E TESTS
  e2e-tests:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Python & Node
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Start services with Docker Compose
        run: docker-compose -f docker-compose.test.yml up -d
      
      - name: Wait for services
        run: sleep 10
      
      - name: Install Playwright dependencies
        run: pip install pytest-playwright && playwright install
      
      - name: Run E2E tests
        run: pytest tests/e2e/ -v --screenshot=only-on-failure
      
      - name: Upload test reports
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: e2e-reports
          path: test-results/
      
      - name: Stop services
        if: always()
        run: docker-compose -f docker-compose.test.yml down
  
  # CODE QUALITY
  code-quality:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: |
          pip install flake8 black isort bandit safety pylint
      
      - name: Run flake8
        working-directory: backend
        run: flake8 app/ --max-line-length=100
      
      - name: Check formatting with black
        working-directory: backend
        run: black --check app/
      
      - name: Run bandit security check
        working-directory: backend
        run: bandit -r app/
      
      - name: Run safety check
        working-directory: backend
        run: safety check
  
  # PERFORMANCE TESTS
  performance-tests:
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Start services
        run: docker-compose -f docker-compose.test.yml up -d
      
      - name: Wait for services
        run: sleep 10
      
      - name: Install Locust
        run: pip install locust
      
      - name: Run performance tests
        run: |
          locust -f tests/performance/locustfile.py \
            --host=http://localhost:8001 \
            --users=50 \
            --spawn-rate=5 \
            --run-time=2m \
            --headless \
            -c 1 \
            --csv=results
      
      - name: Upload performance results
        uses: actions/upload-artifact@v3
        with:
          name: performance-results
          path: results.*
      
      - name: Stop services
        if: always()
        run: docker-compose -f docker-compose.test.yml down
```

---

## 8. 📊 МЕТРИКИ КАЧЕСТВА И ОТЧЕТЫ

### 8.1 Целевые метрики

| Метрика | Целевое значение | Инструмент |
|---------|-----------------|------------|
| Code Coverage (Backend) | ≥ 80% | pytest-cov |
| Code Coverage (Frontend) | ≥ 75% | jest |
| Test Execution Time | < 10 мин | -|
| E2E Tests Success Rate | > 95% | Playwright |
| Performance: Response Time P95 | < 2 сек | Locust |
| Security Vulnerabilities | 0 критических | Bandit, Safety |
| Code Quality Score | ≥ 8.0 | SonarQube |

### 8.2 Отчеты и артефакты

```
test-results/
├── coverage/
│   ├── backend-coverage.html
│   ├── frontend-coverage.html
│   └── coverage.xml
├── e2e/
│   ├── test-results.json
│   ├── screenshots/
│   ├── videos/
│   └── traces/
├── performance/
│   ├── results_stats.csv
│   ├── results_failures.csv
│   └── results_requests.csv
├── security/
│   ├── bandit-report.json
│   ├── safety-report.json
│   └── owasp-zap-report.html
└── quality/
    ├── sonarqube-report.json
    └── pylint-report.txt
```

### 8.3 Dashboards и мониторинг

```bash
# SonarQube
sonar-scanner \
  -Dsonar.projectKey=osib-automation-tool \
  -Dsonar.sources=backend,frontend \
  -Dsonar.host.url=http://sonarqube:9000

# Coverage Report
pytest --cov=app --cov-report=html
# Открыть htmlcov/index.html
```

---

## 📋 ПЛАН ВНЕДРЕНИЯ (ДОРОЖНАЯ КАРТА)

### Phase 1: Foundation (Недели 1-2)
- [ ] Настройка структуры тестов
- [ ] Написание Unit тестов для Auth & RBAC
- [ ] Настройка pytest и fixtures
- [ ] CI/CD pipeline for unit tests

### Phase 2: Backend Integration (Недели 3-4)
- [ ] Integration тесты для основных workflows
- [ ] Mock SSH/WinRM сервисов
- [ ] Тестирование Scheduler
- [ ] Database cleanup и fixtures

### Phase 3: Frontend & E2E (Недели 5-6)
- [ ] Unit тесты React компонентов
- [ ] E2E тесты основных сценариев
- [ ] Page Object Pattern
- [ ] Скриншоты и видео при ошибках

### Phase 4: Quality & Security (Недель 7-8)
- [ ] Performance тесты (Locust)
- [ ] Security сканирование (Bandit, OWASP ZAP)
- [ ] Code quality анализ (SonarQube)
- [ ] Coverage reports and dashboards

### Phase 5: Documentation (Неделя 9)
- [ ] Документация по запуску тестов
- [ ] Troubleshooting гайд
- [ ] Best practices для contributors
- [ ] Training для команды

---

## ✅ ЧЕКЛИСТ РЕАЛИЗАЦИИ

**Backend Setup:**
- [ ] `backend/tests/` структура создана
- [ ] `conftest.py` с fixtures написан
- [ ] `requirements-test.txt` добавлен
- [ ] `pytest.ini` конфигурирован
- [ ] Mock MongoDB работает
- [ ] Unit tests покрывают сервисы на 80%+
- [ ] Integration tests для workflows написаны
- [ ] CI workflow добавлен в GitHub Actions

**Frontend Setup:**
- [ ] `frontend/src/__tests__/` структура создана
- [ ] `jest.config.js` конфигурирован
- [ ] `setup.js` для MSW написан
- [ ] Unit tests компонентов написаны (70%+ coverage)
- [ ] MSW mocks для API созданы

**E2E Setup:**
- [ ] `tests/e2e/` структура создана
- [ ] `conftest.py` для Playwright написан
- [ ] Page Objects созданы
- [ ] E2E tests для основных workflows написаны
- [ ] `docker-compose.test.yml` работает
- [ ] Screenshots/videos на ошибки включены

**Quality & Security:**
- [ ] Performance tests написаны (Locust)
- [ ] Security checks настроены (Bandit, Safety)
- [ ] SonarQube интегрирован
- [ ] Coverage reports публикуются
- [ ] Метрики качества трекируются

---

## 🎯 ВЫВОДЫ

Этот план обеспечит:

✅ **Высокое качество кода** через многоуровневое тестирование
✅ **Быстрое обнаружение регрессий** через CI/CD
✅ **Безопасность** через security scanning
✅ **Производительность** через load testing
✅ **Документированность** через примеры и best practices
✅ **Масштабируемость** через модульную архитектуру тестов

Общее время внедрения: **8-9 недель** (при 1 разработчике, работающем part-time на тестах)
