# 🔄 АЛГОРИТМ РАБОТЫ С НОВЫМ ФУНКЦИОНАЛОМ

## 📋 ОБЩИЙ ПОДХОД: Test-Driven Development (TDD)

Для каждого нового функционала мы следуем принципу **"Tests First"** - сначала пишем тесты, затем реализуем функционал.

---

## 🎯 ТИПЫ НОВОГО ФУНКЦИОНАЛА И АЛГОРИТМЫ

### 1. НОВЫЙ API ENDPOINT

#### Алгоритм внедрения:

```
┌─────────────────────────────────────────────────────┐
│  ШАГ 1: ПЛАНИРОВАНИЕ                               │
└─────────────────────────────────────────────────────┘
├─ Определить HTTP метод (GET/POST/PUT/DELETE)
├─ Определить URL path и параметры
├─ Определить request body schema (если нужен)
├─ Определить response schema
├─ Определить необходимые permissions
└─ Определить error cases (400, 401, 403, 404, 500)

┌─────────────────────────────────────────────────────┐
│  ШАГ 2: НАПИСАНИЕ ТЕСТОВ                           │
└─────────────────────────────────────────────────────┘
├─ Unit тест для бизнес-логики (services/)
│  └─ test_<service>_<method>.py
├─ Integration тест для API endpoint
│  └─ test_<endpoint>_flow.py
│     ├─ Happy path (успешный сценарий)
│     ├─ Error cases (валидация, права доступа)
│     └─ Edge cases (граничные случаи)
└─ API Contract тест
   └─ test_api_<endpoint>_contract.py
      ├─ Schema validation
      ├─ HTTP status codes
      └─ Response structure

┌─────────────────────────────────────────────────────┐
│  ШАГ 3: РЕАЛИЗАЦИЯ                                  │
└─────────────────────────────────────────────────────┘
├─ Создать/обновить модель (models/)
├─ Реализовать бизнес-логику (services/)
├─ Создать API endpoint (api/)
├─ Добавить permissions в config_security.py
└─ Добавить audit logging (utils/audit_utils.py)

┌─────────────────────────────────────────────────────┐
│  ШАГ 4: ПРОВЕРКА                                    │
└─────────────────────────────────────────────────────┘
├─ Все тесты проходят
├─ Coverage ≥ 80% для нового кода
├─ Code review пройден
└─ Документация обновлена
```

#### Пример: Добавление endpoint для проверки синтаксиса

**Шаг 1: Планирование**
```python
# POST /api/scripts/validate-syntax
# Request: text/plain (содержимое скрипта)
# Response: {
#   "valid": bool,
#   "message": str (если valid=True),
#   "error": str (если valid=False)
# }
# Permissions: checks_create или checks_edit
```

**Шаг 2: Написание тестов**

```python
# backend/tests/unit/test_syntax_validation.py
import pytest
from services.services_scripts import validate_bash_syntax

class TestSyntaxValidation:
    @pytest.mark.asyncio
    async def test_valid_syntax(self):
        script = "#!/bin/bash\necho 'test'"
        result = await validate_bash_syntax(script)
        assert result["valid"] is True
        assert "message" in result
    
    @pytest.mark.asyncio
    async def test_invalid_syntax(self):
        script = "#!/bin/bash\necho 'test'"
        result = await validate_bash_syntax(script)
        assert result["valid"] is False
        assert "error" in result

# backend/tests/integration/test_syntax_validation_flow.py
@pytest.mark.integration
async def test_validate_syntax_endpoint(async_test_client, auth_token):
    response = await async_test_client.post(
        "/api/scripts/validate-syntax",
        content="#!/bin/bash\necho 'test'",
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    assert response.status_code == 200
    assert "valid" in response.json()
```

**Шаг 3: Реализация**

```python
# backend/api/api_scripts.py
@router.post("/scripts/validate-syntax")
async def validate_bash_syntax(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    await require_permission(current_user, 'checks_create')
    # ... реализация
```

---

### 2. НОВАЯ БИЗНЕС-ЛОГИКА (SERVICE)

#### Алгоритм внедрения:

```
┌─────────────────────────────────────────────────────┐
│  ШАГ 1: ПЛАНИРОВАНИЕ                               │
└─────────────────────────────────────────────────────┘
├─ Определить входные параметры
├─ Определить выходные данные
├─ Определить бизнес-правила
├─ Определить edge cases
└─ Определить зависимости (БД, внешние сервисы)

┌─────────────────────────────────────────────────────┐
│  ШАГ 2: НАПИСАНИЕ ТЕСТОВ                           │
└─────────────────────────────────────────────────────┘
├─ Unit тесты для каждого метода
│  ├─ Happy path
│  ├─ Error cases
│  ├─ Edge cases
│  └─ Mock зависимостей
└─ Integration тесты (если нужна БД)

┌─────────────────────────────────────────────────────┐
│  ШАГ 3: РЕАЛИЗАЦИЯ                                  │
└─────────────────────────────────────────────────────┘
├─ Создать service файл (services/)
├─ Реализовать методы
├─ Добавить error handling
└─ Добавить logging

┌─────────────────────────────────────────────────────┐
│  ШАГ 4: ИНТЕГРАЦИЯ                                  │
└─────────────────────────────────────────────────────┘
├─ Подключить service к API endpoint
├─ Добавить в services_init.py
└─ Обновить документацию
```

#### Пример: Версионирование processor_script

**Шаг 1: Планирование**
```python
# Функция: prepare_processor_script_version_update()
# Входные параметры:
#   - script_data: dict (текущие данные скрипта)
#   - new_content: str (новое содержимое)
#   - comment: str (комментарий к версии)
#   - create_new_version: bool (создать новую или обновить текущую)
#   - user_id: str (ID пользователя)
# Выходные данные:
#   - dict с обновленными данными для БД
# Бизнес-правила:
#   - Если нет текущей версии → создать версию 1
#   - Если create_new_version=True → сохранить текущую в историю, создать новую
#   - Если create_new_version=False → обновить текущую версию
#   - Если содержимое не изменилось → не создавать новую версию
```

**Шаг 2: Написание тестов**

```python
# backend/tests/unit/test_processor_versioning.py
import pytest
from utils.db_utils import prepare_processor_script_version_update

class TestProcessorVersioning:
    @pytest.mark.asyncio
    async def test_create_first_version(self):
        result = prepare_processor_script_version_update(
            script_data={},
            new_content="echo 'test'",
            comment="Первая версия",
            create_new_version=False,
            user_id="user1"
        )
        assert result["processor_script_version"]["version_number"] == 1
        assert result["processor_script_version"]["content"] == "echo 'test'"
    
    @pytest.mark.asyncio
    async def test_create_new_version(self):
        script_data = {
            "processor_script_version": {
                "content": "echo 'old'",
                "version_number": 1,
                "created_at": datetime.now(timezone.utc),
                "created_by": "user1"
            },
            "processor_script_versions": []
        }
        
        result = prepare_processor_script_version_update(
            script_data=script_data,
            new_content="echo 'new'",
            comment="Обновление",
            create_new_version=True,
            user_id="user2"
        )
        
        assert result["processor_script_version"]["version_number"] == 2
        assert len(result["processor_script_versions"]) == 1
        assert result["processor_script_versions"][0]["version_number"] == 1
    
    @pytest.mark.asyncio
    async def test_no_change_no_new_version(self):
        script_data = {
            "processor_script_version": {
                "content": "echo 'test'",
                "version_number": 1
            }
        }
        
        result = prepare_processor_script_version_update(
            script_data=script_data,
            new_content="echo 'test'",  # То же содержимое
            comment="Без изменений",
            create_new_version=True,
            user_id="user1"
        )
        
        assert result == {}  # Не создаем новую версию
```

**Шаг 3: Реализация**

```python
# backend/utils/db_utils.py
def prepare_processor_script_version_update(...):
    # Реализация согласно тестам
    pass
```

---

### 3. НОВЫЙ UI КОМПОНЕНТ (FRONTEND)

#### Алгоритм внедрения:

```
┌─────────────────────────────────────────────────────┐
│  ШАГ 1: ПЛАНИРОВАНИЕ                               │
└─────────────────────────────────────────────────────┘
├─ Определить props компонента
├─ Определить state компонента
├─ Определить user interactions
├─ Определить API вызовы
└─ Определить error handling

┌─────────────────────────────────────────────────────┐
│  ШАГ 2: НАПИСАНИЕ ТЕСТОВ                           │
└─────────────────────────────────────────────────────┘
├─ Unit тесты для компонента
│  ├─ Рендеринг компонента
│  ├─ User interactions (click, input, etc.)
│  ├─ API вызовы (mock с MSW)
│  ├─ Error states
│  └─ Loading states
└─ Integration тесты (если компонент сложный)

┌─────────────────────────────────────────────────────┐
│  ШАГ 3: РЕАЛИЗАЦИЯ                                  │
└─────────────────────────────────────────────────────┘
├─ Создать компонент (components/ui/ или pages/)
├─ Реализовать UI
├─ Подключить API вызовы
├─ Добавить error handling
└─ Добавить loading states

┌─────────────────────────────────────────────────────┐
│  ШАГ 4: ИНТЕГРАЦИЯ                                  │
└─────────────────────────────────────────────────────┘
├─ Подключить компонент к странице
├─ Добавить routing (если нужно)
└─ Обновить документацию
```

#### Пример: Диалог истории версий processor_script

**Шаг 1: Планирование**
```javascript
// Компонент: ProcessorVersionsDialog
// Props:
//   - scriptId: string
//   - open: boolean
//   - onOpenChange: (open: boolean) => void
// State:
//   - versions: Array<Version>
//   - loading: boolean
//   - error: string | null
// User interactions:
//   - Просмотр списка версий
//   - Откат к версии (кнопка "Откатить")
// API вызовы:
//   - GET /api/scripts/{id}/processor-versions
//   - POST /api/scripts/{id}/processor-versions/rollback
```

**Шаг 2: Написание тестов**

```javascript
// frontend/src/__tests__/components/ProcessorVersionsDialog.test.jsx
import { render, screen, waitFor } from '@testing-library/react';
import { ProcessorVersionsDialog } from '@/components/ProcessorVersionsDialog';
import { server } from '@/__mocks__/mswServer';

describe('ProcessorVersionsDialog', () => {
  it('should render versions list', async () => {
    render(
      <ProcessorVersionsDialog
        scriptId="script1"
        open={true}
        onOpenChange={() => {}}
      />
    );
    
    await waitFor(() => {
      expect(screen.getByText('v1')).toBeInTheDocument();
      expect(screen.getByText('v2')).toBeInTheDocument();
    });
  });
  
  it('should call rollback API on rollback button click', async () => {
    const { user } = render(
      <ProcessorVersionsDialog
        scriptId="script1"
        open={true}
        onOpenChange={() => {}}
      />
    );
    
    const rollbackButton = await screen.findByText('Откатить');
    await user.click(rollbackButton);
    
    await waitFor(() => {
      expect(screen.getByText('Откат выполнен')).toBeInTheDocument();
    });
  });
});
```

**Шаг 3: Реализация**

```javascript
// frontend/src/components/ProcessorVersionsDialog.jsx
export function ProcessorVersionsDialog({ scriptId, open, onOpenChange }) {
  // Реализация согласно тестам
}
```

---

### 4. НОВЫЙ ПОЛЬЗОВАТЕЛЬСКИЙ СЦЕНАРИЙ (E2E)

#### Алгоритм внедрения:

```
┌─────────────────────────────────────────────────────┐
│  ШАГ 1: ПЛАНИРОВАНИЕ                               │
└─────────────────────────────────────────────────────┘
├─ Определить пользовательский сценарий
├─ Определить шаги пользователя
├─ Определить ожидаемые результаты
└─ Определить edge cases

┌─────────────────────────────────────────────────────┐
│  ШАГ 2: НАПИСАНИЕ E2E ТЕСТА                        │
└─────────────────────────────────────────────────────┘
├─ Создать Page Object (если нужно)
├─ Написать E2E тест
│  ├─ Login (если нужно)
│  ├─ Navigation
│  ├─ User interactions
│  ├─ Assertions
│  └─ Screenshots (при ошибках)
└─ Добавить в CI/CD pipeline

┌─────────────────────────────────────────────────────┐
│  ШАГ 3: РЕАЛИЗАЦИЯ ФУНКЦИОНАЛА                      │
└─────────────────────────────────────────────────────┘
├─ Реализовать backend (если нужно)
├─ Реализовать frontend (если нужно)
└─ Убедиться, что E2E тест проходит

┌─────────────────────────────────────────────────────┐
│  ШАГ 4: ВАЛИДАЦИЯ                                  │
└─────────────────────────────────────────────────────┘
├─ E2E тест проходит
├─ Ручное тестирование
└─ Документация обновлена
```

#### Пример: E2E тест для версионирования processor_script

**Шаг 1: Планирование**
```
Сценарий: Пользователь создает новую версию processor_script и откатывает её

Шаги:
1. Login как admin
2. Перейти на страницу Scripts
3. Открыть скрипт для редактирования
4. Изменить processor_script
5. Сохранить (создать новую версию)
6. Нажать кнопку "Версии"
7. Проверить, что появилась новая версия в списке
8. Нажать "Откатить" на предыдущей версии
9. Проверить, что версия откатилась
```

**Шаг 2: Написание E2E теста**

```python
# tests/e2e/test_processor_script_versioning.py
import pytest
from tests.e2e.pages.login_page import LoginPage
from tests.e2e.pages.scripts_page import ScriptsPage

@pytest.mark.e2e
async def test_processor_script_versioning_flow(page):
    # Step 1: Login
    login_page = LoginPage(page)
    await login_page.goto()
    await login_page.login("admin", "admin123")
    
    # Step 2: Navigate to Scripts
    scripts_page = ScriptsPage(page)
    await scripts_page.goto()
    
    # Step 3: Open script for editing
    await scripts_page.open_script("test-script")
    
    # Step 4: Change processor_script
    await page.fill('textarea[name="processor_script"]', "echo 'new version'")
    
    # Step 5: Save (create new version)
    await page.click('button:has-text("Обновить")')
    await page.wait_for_selector('text=Проверка обновлена')
    
    # Step 6: Open versions dialog
    await page.click('button:has-text("Версии")')
    
    # Step 7: Verify new version in list
    await page.wait_for_selector('text=v2')
    assert await page.is_visible('text=Текущая версия')
    
    # Step 8: Rollback to previous version
    await page.click('button:has-text("Откатить")')
    await page.click('button:has-text("Подтвердить")')
    
    # Step 9: Verify rollback
    await page.wait_for_selector('text=Откат выполнен')
    # Refresh and verify version
    await page.reload()
    await scripts_page.open_script("test-script")
    processor_script = await page.input_value('textarea[name="processor_script"]')
    assert "echo 'old version'" in processor_script
```

---

## 📝 ЧЕКЛИСТ ДЛЯ КАЖДОГО НОВОГО ФУНКЦИОНАЛА

### Перед началом разработки

- [ ] **Планирование завершено**
  - [ ] Требования определены
  - [ ] API контракт определен (если применимо)
  - [ ] Edge cases определены
  - [ ] Зависимости определены

- [ ] **Тесты написаны (TDD)**
  - [ ] Unit тесты для бизнес-логики
  - [ ] Integration тесты для API (если применимо)
  - [ ] Frontend unit тесты для UI (если применимо)
  - [ ] E2E тесты для пользовательских сценариев (если применимо)

### Во время разработки

- [ ] **Итеративная разработка**
  - [ ] Тесты проходят после каждого этапа
  - [ ] Coverage не снижается
  - [ ] Код соответствует стандартам проекта (black, flake8)

- [ ] **Code review**
  - [ ] Код просмотрен коллегами
  - [ ] Комментарии учтены

### После завершения

- [ ] **Все тесты проходят**
  - [ ] Unit тесты: ✅
  - [ ] Integration тесты: ✅
  - [ ] Frontend unit тесты: ✅
  - [ ] E2E тесты: ✅

- [ ] **Coverage проверен**
  - [ ] Coverage ≥ 80% для нового кода
  - [ ] Coverage report сгенерирован

- [ ] **Документация обновлена**
  - [ ] API документация (если применимо)
  - [ ] Пользовательская документация
  - [ ] Комментарии в коде

- [ ] **Ручное тестирование**
  - [ ] Функционал протестирован вручную
  - [ ] Edge cases проверены
  - [ ] UI/UX проверен

---

## 🔄 WORKFLOW ДЛЯ COMMIT И PUSH

```
1. Написать тесты (TDD)
   └─ git commit -m "test: add tests for new feature X"

2. Реализовать функционал
   └─ git commit -m "feat: implement feature X"

3. Убедиться, что все тесты проходят
   └─ pytest tests/ && npm test

4. Обновить документацию
   └─ git commit -m "docs: update docs for feature X"

5. Push и создать PR
   └─ git push origin feature/X
```

---

## 🎯 ПРИОРИТЕТЫ ТЕСТИРОВАНИЯ

### Критичные функции (тестировать всегда)
- ✅ Аутентификация и авторизация
- ✅ RBAC и permissions
- ✅ Управление хостами
- ✅ Выполнение проектов
- ✅ Версионирование (новый функционал)

### Важные функции (тестировать при возможности)
- ✅ Управление проектами
- ✅ Планировщик заданий
- ✅ Экспорт результатов
- ✅ Группы проверок

### UI компоненты (тестировать основные)
- ✅ Формы (Login, Host, Script)
- ✅ Модальные окна
- ✅ Навигация
- ✅ Code editors

---

## 📚 ДОПОЛНИТЕЛЬНЫЕ РЕСУРСЫ

- `tests/testing_plan.md` - Полный стратегический план
- `tests/testing_algorithms.md` - Детальные алгоритмы выполнения тестов
- `tests/testing_configs.md` - Конфигурационные файлы и примеры
- `tests/IMPLEMENTATION_PLAN.md` - План внедрения тестирования

---

**Помните:** Тесты - это не обуза, а инструмент для уверенной разработки. Хорошие тесты экономят время и предотвращают регрессии.
