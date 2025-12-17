# 🔧 ПРАКТИЧЕСКОЕ РУКОВОДСТВО: АЛГОРИТМ ВНЕДРЕНИЯ ТЕСТОВ

## Часть 1: ОРГАНИЗАЦИЯ ТЕСТОВ В ПРОЕКТЕ

### 1.1 Архитектура тестирования

```
┌─────────────────────────────────────────────────────────────┐
│                    OSIB AUTOMATION TOOL                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │     FRONTEND     │  │      BACKEND     │                │
│  │   (React 19)     │  │    (FastAPI)     │                │
│  └────────┬─────────┘  └────────┬─────────┘                │
│           │                     │                           │
│  ┌────────▼──────────────────────▼────────┐                │
│  │   REST API  /  SSE (Real-time)         │                │
│  └────────┬───────────────────────────────┘                │
│           │                                                 │
│  ┌────────▼──────────────────────────────────────┐        │
│  │          MONGODB Database Layer               │        │
│  │  (Users, Hosts, Projects, Executions, Audit) │        │
│  └────────┬──────────────────────────────────────┘        │
│           │                                                 │
│  ┌────────▼──────────────────────────────────────┐        │
│  │     External Services (SSH/WinRM)             │        │
│  └───────────────────────────────────────────────┘        │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              TESTING LAYER (TEST PYRAMID)                   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│                     ▲ E2E Tests (Playwright)                │
│                    / \  - Full user workflows                │
│                   /   \ - Real browser                      │
│                  /─────\                                    │
│                 / Integ.\ Integration Tests                │
│                /         \ - API + Database                │
│               /           \ - Workflows                    │
│              /─────────────\                               │
│             / Unit Tests    \ - Services                   │
│            /                 \ - Utils                     │
│           /___________________\- Validators               │
│                                                             │
│           API Tests    Performance Tests   Security Tests  │
│           (Contract)    (Locust)           (Bandit)        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Где хранятся тесты и как они получают данные

```
BACKEND TESTS (Unit + Integration)
├─ Входные данные: Fixtures (conftest.py), JSON файлы
├─ База данных: mongomock (Unit) или MongoDB контейнер (Integration)
├─ Внешние сервисы: Mocked (SSH, WinRM, Excel export)
└─ Выходные данные: pytest reports, coverage reports

FRONTEND TESTS (Unit)
├─ Входные данные: Test data в тестовых файлах, MSW mocks
├─ Компоненты: Rendered in jsdom
├─ API вызовы: Intercepted by MSW
└─ Выходные данные: Jest reports, coverage reports

E2E TESTS
├─ Входные данные: Test data, Page Objects, real application state
├─ Frontend: Real React app (http://localhost:3000)
├─ Backend: Real FastAPI server (http://localhost:8001)
├─ База данных: Real MongoDB (docker container)
├─ Внешние сервисы: Mocked at API level
└─ Выходные данные: Screenshots, videos, Playwright reports

CI/CD WORKFLOW
├─ Входные данные: Code push/PR
├─ Выполнение: GitHub Actions workflows
├─ Параллельные job'ы: Unit, Integration, E2E, Quality, Performance
└─ Выходные данные: Test reports, coverage, pass/fail status
```

---

## Часть 2: ДЕТАЛЬНЫЕ АЛГОРИТМЫ ДЛЯ КАЖДОГО ТИПА ТЕСТОВ

### 2.1 UNIT TESTS ALGORITHM

```
┌─────────────────────────────────────────────────────┐
│         UNIT TEST EXECUTION FLOW                    │
└─────────────────────────────────────────────────────┘

1️⃣ SETUP PHASE (Preparation)
   ├─ Загрузить conftest.py (глобальные fixtures)
   ├─ Инициализировать mock MongoDB
   ├─ Загрузить test data (fixtures/builders)
   ├─ Mock внешние зависимости (Paramiko, pywinrm, email)
   └─ Инициализировать test client

2️⃣ TEST DISCOVERY
   ├─ Найти все test_*.py файлы в backend/tests/unit/
   ├─ Найти все Test* классы
   ├─ Найти все test_* методы
   └─ Собрать в граф зависимостей (fixtures)

3️⃣ EXECUTION (для каждого теста)
   ├─ ARRANGE: Подготовить тестовые данные
   │  └─ Используя fixtures и builders
   │
   ├─ ACT: Выполнить функцию/метод
   │  └─ Передать test data
   │
   ├─ ASSERT: Проверить результат
   │  ├─ assert result == expected
   │  ├─ assert mock.called
   │  ├─ assert exception raised
   │  └─ assert correct error message
   │
   └─ CLEANUP: Очистить состояние
      └─ Автоматически (autouse fixtures)

4️⃣ COLLECTION & REPORTING
   ├─ Собрать результаты каждого теста
   ├─ Генерировать coverage report
   │  └─ Какие строки кода покрыты
   │
   ├─ Генерировать HTML отчет
   ├─ Вывести в консоль (PASSED/FAILED/SKIPPED)
   └─ Сохранить JUnit XML (для CI)

ВХОДНЫЕ ДАННЫЕ:
├─ conftest.py: Global fixtures
├─ Fixtures в тестовом файле
├─ Builder classes: UserBuilder, HostBuilder, etc.
├─ test_data.json: Статические данные
└─ mongomock: In-memory mock database

ВЫХОДНЫЕ ДАННЫЕ:
├─ Terminal output:
│  ✓ test_auth_service.py::test_login_success PASSED
│  ✗ test_validator.py::test_invalid_email FAILED
│
├─ coverage/index.html - покрытие кода
├─ .coverage - бинарный файл покрытия
├─ JUnit XML для CI/CD
└─ pytest.ini конфигурация

КОМАНДА ЗАПУСКА:
$ cd backend
$ pytest tests/unit/ -v \
  --cov=app \
  --cov-report=html \
  --cov-report=term-missing
```

### 2.2 INTEGRATION TESTS ALGORITHM

```
┌──────────────────────────────────────────────────────┐
│    INTEGRATION TEST EXECUTION FLOW                   │
└──────────────────────────────────────────────────────┘

1️⃣ ENVIRONMENT SETUP
   ├─ Запустить MongoDB контейнер (testcontainers)
   ├─ Или подключиться к existing MongoDB
   ├─ Создать test database
   ├─ Инициализировать test client (FastAPI)
   └─ Подготовить mock SSH/WinRM сервисы

2️⃣ DATABASE INITIALIZATION
   ├─ Очистить БД перед каждым тестом
   ├─ Создать тестовых пользователей
   ├─ Создать тестовые хосты
   ├─ Создать тестовые категории
   └─ Seed data для scenario tests

3️⃣ WORKFLOW TESTING (Step by Step)
   
   Пример: "test_full_project_creation_and_execution"
   
   ├─ STEP 1: Login
   │  ├─ POST /api/auth/login
   │  ├─ Получить JWT token
   │  └─ Проверить в БД: запись в audit log
   │
   ├─ STEP 2: Create Host
   │  ├─ POST /api/hosts (with token in headers)
   │  ├─ Mock SSH connection test (Paramiko)
   │  ├─ Проверить хост сохранился в БД
   │  └─ Проверить encrypted credentials
   │
   ├─ STEP 3: Create Check Hierarchy
   │  ├─ POST /api/categories
   │  ├─ POST /api/systems
   │  ├─ POST /api/scripts
   │  └─ Проверить все в БД
   │
   ├─ STEP 4: Create Project
   │  ├─ POST /api/projects (with hosts & checks)
   │  ├─ Проверить tasks созданы
   │  └─ Проверить permissions соблюдены
   │
   ├─ STEP 5: Execute Project
   │  ├─ POST /api/projects/{id}/execute
   │  ├─ Mock SSH command execution
   │  ├─ Проверить execution session создана
   │  └─ Проверить results сохранены
   │
   └─ STEP 6: Verify Results
      ├─ GET /api/projects/{id}/sessions
      ├─ Проверить статус проверок
      └─ Проверить вывод команд сохранен

4️⃣ ERROR HANDLING SCENARIOS
   ├─ Test rollback при ошибке на шаге 3
   ├─ Test recovery при network error
   ├─ Test auth failure (wrong token)
   └─ Test permission denied (RBAC)

5️⃣ DATABASE STATE VERIFICATION
   ├─ После каждого шага:
   │  └─ SELECT from relevant collections
   │
   ├─ Проверить:
   │  ├─ Данные сохранены правильно
   │  ├─ Связи между сущностями OK
   │  ├─ Аудит логи добавлены
   │  └─ Temporal fields обновлены
   │
   └─ Cleanup:
      ├─ DELETE from all collections
      ├─ Reset counters/sequences
      └─ Close DB connections

6️⃣ REPORTING
   ├─ Для каждого workflow:
   │  ├─ "✓ Full project workflow PASSED"
   │  ├─ Execution time: 2.34s
   │  └─ DB operations: 15 queries
   │
   └─ Итоговый отчет:
      ├─ Пройдено: 12/12
      ├─ Не пройдено: 0
      └─ Skipped: 0

ВХОДНЫЕ ДАННЫЕ:
├─ conftest.py с MongoDB fixture
├─ Mock SSH/WinRM clients
├─ Test workflow definitions
├─ Sample user data
├─ Sample host data
└─ Scenario descriptions

ВЫХОДНЫЕ ДАННЫЕ:
├─ pytest report (passed/failed)
├─ Database state snapshots
├─ Network call logs (if applicable)
├─ Timing information
└─ Coverage report

КОМАНДА ЗАПУСКА:
$ cd backend
$ docker-compose -f ../docker-compose.test.yml up -d mongo
$ pytest tests/integration/ -v \
  --tb=short \
  --timeout=60 \
  -m integration

# Или с собственным MongoDB:
$ MONGO_URL=mongodb://localhost:27017/test_db pytest tests/integration/
```

### 2.3 E2E TESTS ALGORITHM

```
┌──────────────────────────────────────────────────────┐
│      E2E TEST EXECUTION FLOW (PLAYWRIGHT)            │
└──────────────────────────────────────────────────────┘

1️⃣ ENVIRONMENT STARTUP
   ├─ docker-compose up:
   │  ├─ MongoDB контейнер (тестовая БД)
   │  ├─ Backend контейнер (FastAPI на :8001)
   │  ├─ Frontend контейнер (React на :3000)
   │  └─ Nginx (reverse proxy если нужен)
   │
   └─ Дождаться health checks:
      ├─ Backend /api/auth/me returns 401 (не залогинены)
      ├─ Frontend http://localhost:3000 загружается
      └─ MongoDB здоров

2️⃣ TEST SETUP (per test)
   ├─ Запустить браузер (Chromium)
   ├─ Перейти на http://localhost:3000
   ├─ Очистить localStorage/cookies
   └─ Создать тестовых пользователей в БД

3️⃣ PAGE OBJECT PATTERN
   
   Каждая страница = класс Python с методами:
   
   ├─ LoginPage
   │  ├─ goto()
   │  ├─ login(username, password)
   │  ├─ see_error_message()
   │  └─ is_logged_in()
   │
   ├─ HostsPage
   │  ├─ goto()
   │  ├─ click_add_host()
   │  ├─ fill_host_form(data)
   │  ├─ verify_host_in_list(name)
   │  └─ delete_host(name)
   │
   ├─ ProjectsPage
   │  ├─ create_project(step1, step2, step3, step4)
   │  ├─ execute_project(name)
   │  ├─ monitor_progress()
   │  └─ view_results()
   │
   └─ et cetera...

4️⃣ TEST SCENARIO (пример)

   async def test_create_and_run_project(page):
       
       # LOGIN
       login_page = LoginPage(page)
       await login_page.goto()
       await login_page.login("admin", "admin123")
       
       # Waiters и assertions:
       assert await login_page.is_logged_in()
       await page.wait_for_url("**/dashboard")
       
       # NAVIGATE
       projects_page = ProjectsPage(page)
       await projects_page.goto()
       await page.wait_for_selector("text=My Projects")
       
       # CREATE (Wizard 4 steps)
       await projects_page.click_create_button()
       
       # Step 1: Name & Description
       await page.fill('input[name="project_name"]', "Security Audit")
       await page.fill('input[name="description"]', "Monthly audit")
       await page.click('button:has-text("Next")')
       
       # Step 2: Select Hosts
       await page.check('input[value="server-01"]')
       await page.click('button:has-text("Next")')
       
       # Step 3: Select Checks
       await page.check('input[name="check-firewall"]')
       await page.click('button:has-text("Next")')
       
       # Step 4: Review
       await page.click('button:has-text("Create Project")')
       await page.wait_for_selector("text=Project created successfully")
       
       # EXECUTE
       await page.click('button[title="Execute"]')
       
       # MONITOR PROGRESS
       # Waiters для SSE обновлений
       await page.wait_for_selector("text=Executing check 1 of 3")
       await page.wait_for_selector("text=Executing check 2 of 3")
       await page.wait_for_selector("text=Executing check 3 of 3")
       
       # Дождаться завершения
       await page.wait_for_selector("text=Execution completed", timeout=30000)
       
       # VIEW RESULTS
       await page.click('button:has-text("View Results")')
       
       # ASSERTIONS
       assert await page.is_visible('text=3/3 Passed')
       assert await page.is_visible('text=Passed')
       
       # SCREENSHOT
       await page.screenshot(path="results.png")

5️⃣ ADVANCED SCENARIOS
   
   ├─ RBAC Testing
   │  ├─ Login as admin → see all features
   │  ├─ Login as auditor → see read-only
   │  ├─ Try forbidden action → see 403 error
   │  └─ Verify buttons hidden by permissions
   │
   ├─ Error Handling
   │  ├─ Try to execute without hosts
   │  ├─ Try invalid host connection
   │  ├─ Try timeout scenario
   │  └─ Verify error message displayed
   │
   ├─ Concurrent Actions
   │  ├─ User A creates project
   │  ├─ User B views same project
   │  ├─ User A executes project
   │  └─ User B sees live updates (SSE)
   │
   └─ Export Functionality
      ├─ Create project with results
      ├─ Click "Export to Excel"
      ├─ Дождаться download
      ├─ Verify file structure
      └─ Verify GOST formatting

6️⃣ FAILURE HANDLING
   
   При падении теста:
   ├─ Сохранить screenshot текущего состояния
   ├─ Сохранить page.content() (HTML)
   ├─ Сохранить browser console logs
   ├─ Сохранить network tab logs
   ├─ Сохранить video (если enabled)
   ├─ Сохранить trace (для debugging)
   └─ Инстанс браузера остается открытым для анализа

7️⃣ CLEANUP
   ├─ Закрыть браузер
   ├─ docker-compose down (если нужно)
   ├─ Очистить downloads папку
   └─ Сохранить артефакты

ВХОДНЫЕ ДАННЫЕ:
├─ Page Object классы
├─ test_data.py: username/passwords
├─ docker-compose.test.yml
├─ Реальное приложение (Frontend + Backend + MongoDB)
└─ Browser (Chromium/Firefox/Webkit)

ВЫХОДНЫЕ ДАННЫЕ:
├─ test-results/
│  ├─ e2e-report.html (интерактивный)
│  ├─ screenshots/ (при ошибке)
│  ├─ videos/ (full video recording)
│  ├─ traces/ (для debugging)
│  └─ results.json (JUnit XML format)
│
└─ Console output:
   ✓ test_login_flow PASSED (1.23s)
   ✗ test_rbac_enforcement FAILED (5.67s)
     Error: Element not found

КОМАНДА ЗАПУСКА:
$ docker-compose -f docker-compose.test.yml up -d
$ sleep 10  # Дождаться инициализации
$ pytest tests/e2e/ -v \
  --headed \  # Видимый браузер
  --screenshot=only-on-failure \
  --video=on-failure
```

### 2.4 API CONTRACT TESTS ALGORITHM

```
┌──────────────────────────────────────────────────────┐
│    API CONTRACT TEST EXECUTION FLOW                  │
└──────────────────────────────────────────────────────┘

1️⃣ API ENDPOINT DISCOVERY
   ├─ Прочитать OpenAPI/Swagger spec
   ├─ Или manually define endpoints:
   │  ├─ POST /api/auth/login
   │  ├─ GET /api/hosts
   │  ├─ POST /api/projects/{id}/execute
   │  └─ ...и т.д.
   │
   └─ Для каждого endpoint:
      ├─ HTTP метод (GET/POST/PUT/DELETE)
      ├─ URL path
      ├─ Query parameters
      ├─ Request body schema
      └─ Expected response schema

2️⃣ REQUEST VALIDATION
   ├─ Для каждого endpoint:
   │  ├─ Создать валидный request
   │  ├─ Отправить на backend
   │  ├─ Проверить HTTP статус код
   │  └─ Проверить response structure
   │
   └─ Статус коды:
      ├─ 200 OK ← для успешных GET
      ├─ 201 Created ← для POST создания
      ├─ 400 Bad Request ← для невалидных данных
      ├─ 401 Unauthorized ← для отсутствия токена
      ├─ 403 Forbidden ← для недостатка прав
      ├─ 404 Not Found ← для несуществующего ресурса
      └─ 500 Internal Server Error ← для ошибок сервера

3️⃣ RESPONSE SCHEMA VALIDATION
   
   Используя jsonschema:
   
   ├─ GET /api/hosts → Array of Host objects
   │  └─ Каждый Host должен иметь:
   │     ├─ id (string)
   │     ├─ name (string)
   │     ├─ hostname (string)
   │     ├─ port (integer)
   │     ├─ connection_type (enum: ssh, winrm)
   │     └─ created_at (datetime)
   │
   ├─ POST /api/auth/login → Login Response
   │  └─ Должен содержать:
   │     ├─ access_token (string)
   │     ├─ token_type (string = "bearer")
   │     ├─ expires_in (integer)
   │     └─ user (User object)
   │
   └─ Validation:
      ├─ Правильный тип каждого поля
      ├─ Обязательные поля присутствуют
      ├─ Нет лишних полей (strict mode)
      └─ Значения в допустимых диапазонах

4️⃣ BACKWARD COMPATIBILITY CHECKS
   ├─ Response от v1 API совместима с v2?
   ├─ Старые клиенты могут работать с новым бэком?
   └─ Deprecated поля все еще присутствуют?

5️⃣ ERROR RESPONSE VALIDATION
   
   Для каждого error case:
   
   ├─ Invalid email → 400 Bad Request
   │  └─ Response: {"error": "Invalid email format", "code": "INVALID_EMAIL"}
   │
   ├─ Duplicate username → 400 Bad Request
   │  └─ Response: {"error": "User already exists", "code": "USER_EXISTS"}
   │
   ├─ Unauthorized access → 403 Forbidden
   │  └─ Response: {"error": "Insufficient permissions", "code": "FORBIDDEN"}
   │
   └─ Not found → 404 Not Found
      └─ Response: {"error": "Resource not found", "code": "NOT_FOUND"}

6️⃣ PERFORMANCE ASSERTIONS
   ├─ response.elapsed.total_seconds() < 1.0  # должно быть быстро
   ├─ response.headers['Content-Length'] < 1MB  # не слишком большое
   └─ response.headers['X-Response-Time'] < 500ms

ВХОДНЫЕ ДАННЫЕ:
├─ requests library
├─ jsonschema library
├─ API endpoint definitions
├─ Running backend server (http://localhost:8001)
└─ Valid JWT tokens для авторизации

ВЫХОДНЫЕ ДАННЫЕ:
├─ Console output:
│  ✓ GET /api/hosts - contract PASSED
│  ✗ POST /api/projects - response missing 'id' field FAILED
│
├─ Contract report (JSON)
└─ OpenAPI spec validation

КОМАНДА ЗАПУСКА:
$ pytest tests/api/ -v \
  --apiresource=http://localhost:8001 \
  --tb=short
```

### 2.5 PERFORMANCE TESTS ALGORITHM

```
┌──────────────────────────────────────────────────────┐
│    PERFORMANCE TEST EXECUTION FLOW (LOCUST)          │
└──────────────────────────────────────────────────────┘

1️⃣ LOAD PROFILE DEFINITION
   
   ├─ User класс: ProjectUser (наследует HttpUser)
   │  ├─ wait_time = between(1, 3) сек между действиями
   │  └─ Tasks (weighted):
   │     ├─ @task(1) list_projects - 1x вес
   │     ├─ @task(1) list_hosts - 1x вес
   │     ├─ @task(2) create_host - 2x вес (более частый)
   │     └─ @task(3) execute_project - 3x вес (самый частый)
   │
   └─ Ramp-up: 100 пользователей, 10 нов. пользователей/сек
      └─ Итого: 10 секунд для достижения пика

2️⃣ TEST EXECUTION PHASES
   
   Phase 1: Ramp-up (0-10 сек)
   ├─ Постепенно добавлять пользователей
   ├─ Каждый пользователь логинится
   └─ Мониторить CPU, память, response time
   
   Phase 2: Steady State (10-300 сек)
   ├─ 100 пользователей активны
   ├─ Каждый выполняет свои tasks
   ├─ Собирать метрики:
   │  ├─ Response time (min, max, avg, p50, p95, p99)
   │  ├─ Request rate (requests/sec)
   │  ├─ Error rate (failed requests %)
   │  ├─ User count
   │  └─ Load per endpoint
   │
   └─ Проверять alerting thresholds:
      ├─ Если response time > 2 сек → alert
      ├─ Если error rate > 1% → alert
      └─ Если memory > 80% → stop test
   
   Phase 3: Cool-down (300-310 сек)
   ├─ Постепенно выводить пользователей
   └─ Проверить graceful shutdown

3️⃣ METRICS COLLECTION
   
   ├─ Per Endpoint:
   │  ├─ List Projects:
   │  │  ├─ Request count: 450
   │  │  ├─ Response time (avg): 245ms
   │  │  ├─ Response time (p95): 890ms
   │  │  ├─ Error rate: 0%
   │  │  └─ Throughput: 1.5 req/sec
   │  │
   │  └─ Execute Project:
   │     ├─ Request count: 1350
   │     ├─ Response time (avg): 1,234ms
   │     ├─ Response time (p95): 3,450ms
   │     ├─ Error rate: 0.2%
   │     └─ Throughput: 4.5 req/sec
   │
   ├─ Overall Statistics:
   │  ├─ Total requests: 3,000
   │  ├─ Successful: 2,994
   │  ├─ Failed: 6
   │  ├─ Response time (avg): 689ms
   │  ├─ Response time (p95): 2,123ms
   │  ├─ Response time (p99): 4,567ms
   │  └─ Failures rate: 0.2%
   │
   └─ Resource Usage:
      ├─ CPU: 45% avg
      ├─ Memory: 62% avg
      ├─ Network I/O: 12 Mbps
      └─ Database connections: 8 active

4️⃣ RESULTS ANALYSIS
   
   ├─ Compare with baseline:
   │  ├─ Previous test: avg response 650ms
   │  ├─ Current test: avg response 689ms
   │  ├─ Regression: +6% (Ⓘ warning)
   │  └─ Action: Review recent changes
   │
   ├─ Identify bottlenecks:
   │  ├─ Slowest endpoint: Execute Project (1.2s avg)
   │  ├─ Most frequent: List Projects (450 req)
   │  ├─ Highest error rate: Create Host (2.1%)
   │  └─ Action: Optimize Execute Project
   │
   └─ Scalability assessment:
      ├─ Linear scaling? response time = f(users)
      ├─ Knee point: 100+ users, response time jumps to 5s
      ├─ Max capacity: ~150 concurrent users at p95 < 2s
      └─ Recommendation: Add cache or scale horizontally

5️⃣ REPORTING
   
   ├─ CSV Files (importable to Excel):
   │  ├─ results_stats.csv
   │  │  └─ Method, Name, # reqs, # fails, Avg, Min, Max, Average response time
   │  │
   │  ├─ results_failures.csv
   │  │  └─ Method, Name, # fails, Failure
   │  │
   │  └─ results_requests.csv
   │     └─ Type, Name, # requests, # fails, Median, Average, Min, Max, Average size
   │
   ├─ HTML Report (web UI):
   │  ├─ Real-time graph: RPS, response time trend
   │  ├─ Request statistics table
   │  ├─ Failure summary
   │  └─ User count over time
   │
   └─ JSON Report (for CI/CD):
      ├─ stats.json: Aggregated metrics
      └─ Used in SLA checks

6️⃣ SLA VALIDATION
   
   ├─ Target: p95 response time < 2 seconds
   │  └─ Result: 2.123s ✗ FAILED (exceeds by 6%)
   │
   ├─ Target: Error rate < 1%
   │  └─ Result: 0.2% ✓ PASSED
   │
   ├─ Target: Throughput > 5 req/sec
   │  └─ Result: 10.5 req/sec ✓ PASSED
   │
   └─ Overall SLA: 2/3 passed ⚠ WARNING

ВХОДНЫЕ ДАННЫЕ:
├─ locustfile.py (User definitions)
├─ Backend server (http://localhost:8001)
├─ Test duration (5 minutes)
├─ User ramp-up rate (10 users/sec)
├─ Peak user count (100)
└─ SLA thresholds (response time, error rate)

ВЫХОДНЫЕ ДАННЫЕ:
├─ results_stats.csv
├─ results_failures.csv
├─ results_requests.csv
├─ stats.json
├─ HTML UI report
├─ Performance graphs (RPS, response time)
└─ SLA pass/fail status

КОМАНДА ЗАПУСКА:
$ locust -f tests/performance/locustfile.py \
  --host=http://localhost:8001 \
  --users=100 \
  --spawn-rate=10 \
  --run-time=5m \
  --headless \
  --csv=results

# Результаты в:
# results_stats.csv
# results_failures.csv
# results_requests.csv
```

---

## Часть 3: ИНСТРУКЦИЯ ПО ЗАПУСКУ

### 3.1 Быстрый старт

```bash
# 1. Клонировать проект
git clone <repo>
cd osib-automation-tool

# 2. Установить зависимости
# Backend
cd backend
pip install -r requirements.txt
pip install -r requirements-test.txt

# Frontend
cd ../frontend
npm install

# 3. Запустить все тесты (основной вариант)
# В корне проекта:
docker-compose -f docker-compose.test.yml up -d

# Backend tests
cd backend && pytest tests/ -v

# Frontend tests
cd ../frontend && npm test -- --coverage

# E2E tests
pytest tests/e2e/ -v --headed

# Performance tests
locust -f tests/performance/locustfile.py --host=http://localhost:8001 --headless
```

### 3.2 Запуск отдельных типов тестов

```bash
# Unit tests только
pytest tests/unit/ -v -m unit

# Integration tests только
pytest tests/integration/ -v -m integration

# E2E tests только (требует docker-compose)
docker-compose -f docker-compose.test.yml up -d
pytest tests/e2e/ -v

# Specific test file
pytest tests/unit/test_auth_service.py -v

# Specific test function
pytest tests/unit/test_auth_service.py::test_login_success -v

# Coverage report
pytest tests/ --cov=app --cov-report=html
# Открыть htmlcov/index.html
```

### 3.3 Структура выходных данных

```
После запуска тестов:

project-root/
├─ test-results/
│  ├─ e2e/
│  │  ├─ test-results.json
│  │  ├─ results.xml
│  │  ├─ screenshots/
│  │  ├─ videos/
│  │  └─ traces/
│  ├─ performance/
│  │  ├─ results_stats.csv
│  │  ├─ results_failures.csv
│  │  └─ stats.json
│  └─ api/
│     └─ api-report.json
│
├─ backend/
│  ├─ .coverage
│  ├─ htmlcov/
│  │  ├─ index.html
│  │  ├─ status.json
│  │  └─ d_*.html (coverage per module)
│  ├─ coverage.xml (для CI/CD)
│  └─ junit.xml
│
├─ frontend/
│  ├─ coverage/
│  │  ├─ lcov.info
│  │  ├─ lcov-report/
│  │  │  └─ index.html
│  │  └─ coverage-summary.json
│  └─ jest-results.json
│
└─ reports/
   ├─ all-tests-report.html (consolidated)
   ├─ coverage-comparison.json
   └─ sla-report.json
```

---

## Заключение

Этот алгоритм обеспечивает:

✅ **Четкую организацию** тестов в проекте
✅ **Понятный поток выполнения** для каждого типа
✅ **Явные входные/выходные данные**
✅ **Готовые примеры кода** для быстрого внедрения
✅ **Детальный мониторинг** качества на каждом этапе
✅ **Масштабируемую архитектуру** для расширения

Время внедрения: **8-12 недель** (в зависимости от размера команды)
