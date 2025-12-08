## ✅ services/ 

### ✅ 1. **services/helpers.py** 
**Функции:**
- `prepare_for_mongo()` - преобразование datetime в ISO для MongoDB
- `parse_from_mongo()` - обратное преобразование ISO в datetime
- `_parse_datetime_param()` - парсинг параметров даты из запроса
- `_parse_time_of_day()` - парсинг времени HH:MM
- `_normalize_run_times()` - нормализация списков времени

**Используется в:** всех остальных services

---

### ✅ 2. **services/auth.py** 
**Функции:**
- `get_current_user()` - Dependency для получения пользователя из JWT
- `get_user_permissions()` - получить права пользователя
- `has_permission()` - проверить одно право
- `require_permission()` - потребовать права (403 если нет)
- `can_access_project()` - проверить доступ к проекту

**Используется в:** всех API роутах

---

### ✅ 3. **services/execution.py** 
**Функции:**
- `execute_command()` - выполнить команду на хосте
- `execute_check_with_processor()` - выполнить проверку с обработкой
- `_ssh_connect_and_execute()` - SSH подключение и выполнение
- `_winrm_connect_and_execute()` - WinRM подключение и выполнение
- `_check_network_access()` - проверка сетевого доступа
- `_check_ssh_login()` - проверка SSH логина
- `_check_ssh_login_and_sudo()` - проверка SSH + sudo
- `_check_winrm_login()` - проверка WinRM логина
- `_check_admin_access()` - проверка admin доступа
- `_check_sudo_access_linux()` - проверка sudo на Linux

**Используется в:** execute_project() и тестировании хостов

---

### ✅ 4. **services/scheduler.py** 
**Функции:**
- `scheduler_worker()` - основной фоновый worker
- `_calculate_next_run()` - вычисление времени следующего запуска
- `_next_daily_occurrence()` - следующее ежедневное время
- `_execute_scheduler_job()` - выполнение job
- `_update_job_after_run()` - обновление статуса job
- `_handle_due_scheduler_job()` - обработка job к запуску
- `_consume_streaming_response()` - получение потокового ответа

**Используется в:** main.py (фоновый процесс)

---

### ✅ 5. **services/export.py** 
**Функции:**
- `export_executions_to_excel()` - экспорт результатов в Excel
- `generate_xlsx_file()` - генерация XLSX файла
- `create_execution_report()` - создание отчета о результатах

**Используется в:** api/executions.py

---

### ✅ 6. **services/crud.py** 
**Функции:**
- `get_or_create_category()` - получить или создать категорию
- `get_or_create_system()` - получить или создать систему
- `get_or_create_host()` - получить или создать хост
- `get_or_create_script()` - получить или создать скрипт

**Используется в:** api роутах при создании

---

### ✅ 7. **services/notifications.py** 
**Функции:**
- `send_notification()` - отправить уведомление
- `log_notification()` - залогировать уведомление
- `send_email()` - отправить email (заглушка)
- `send_slack_message()` - отправить в Slack (заглушка)
- `send_telegram_message()` - отправить в Telegram (заглушка)

**Используется в:** будущих интеграциях

---

### ✅ 8. **services/__init__.py** 
**Содержит:**
- Централизованные импорты из всех 7 файлов
- Полный `__all__` список всех функций