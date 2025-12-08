# Scheduler Package Documentation

## Overview
Модуль для планирования и выполнения фоновых заданий SSH Script Runner.

## Modules

### scheduler_utils.py
Утилиты для работы с временными расчетами и парсингом расписаний.

**Functions:**
- `parse_datetime_param(value, *, end_of_day)` - Парсинг параметров даты/времени из строки
- `parse_time_of_day(value)` - Парсинг времени в формате HH:MM
- `next_daily_occurrence(config, *, reference, initial)` - Расчет следующего ежедневного запуска
- `normalize_run_times(run_times)` - Нормализация и сортировка времен запуска в UTC
- `calculate_next_run(job, *, reference, initial)` - Расчет следующего времени выполнения задания

**Job Types:**
- `one_time` - Одноразовое задание
- `multi_run` - Множественный запуск по заданным временам
- `recurring` - Повторяющееся ежедневное задание

### scheduler_execution.py
Функции для выполнения запланированных заданий.

**Functions:**
- `consume_streaming_response(streaming_response)` - Чтение SSE потока и извлечение session_id и статуса
- `update_job_after_run(job, *, run_success)` - Обновление задания после выполнения
- `execute_scheduler_job(job)` - Выполнение запланированного задания через запуск проекта
- `handle_due_scheduler_job(job_doc)` - Полная обработка готового к выполнению задания

**Workflow:**
1. Задание извлекается из БД
2. Создается запись SchedulerRun
3. Выполняется проект через execute_project()
4. Потребляется SSE поток для получения результата
5. Обновляется статус задания и запись о запуске
6. Рассчитывается следующее время выполнения

### scheduler_worker.py
Фоновый worker для периодической проверки и запуска заданий.

**Functions:**
- `scheduler_worker()` - Главный worker цикл

**Behavior:**
- Запускается при старте приложения
- Проверяет БД каждые SCHEDULER_POLL_SECONDS секунд
- Находит активные задания с next_run_at <= текущее время
- Запускает их через handle_due_scheduler_job()
- Обрабатывает ошибки и продолжает работу

## Usage Example

```python
from scheduler import scheduler_worker, calculate_next_run

# Запуск worker (в startup event)
scheduler_task = asyncio.create_task(scheduler_worker())

# Расчет следующего запуска
next_run = calculate_next_run(job, reference=datetime.now(timezone.utc))
```

## Migration History

### Initial Creation (2025-11-25)
Moved from server.py:
- `_parse_datetime_param` → scheduler_utils.parse_datetime_param
- `_parse_time_of_day` → scheduler_utils.parse_time_of_day
- `_next_daily_occurrence` → scheduler_utils.next_daily_occurrence
- `_normalize_run_times` → scheduler_utils.normalize_run_times
- `_calculate_next_run` → scheduler_utils.calculate_next_run
- `_consume_streaming_response` → scheduler_execution.consume_streaming_response
- `_update_job_after_run` → scheduler_execution.update_job_after_run
- `_execute_scheduler_job` → scheduler_execution.execute_scheduler_job
- `_handle_due_scheduler_job` → scheduler_execution.handle_due_scheduler_job
- `scheduler_worker` → scheduler_worker.scheduler_worker

Reduced server.py from 2862 to 2684 lines (-178 lines)

## Testing
- ✅ Server starts successfully with scheduler modules
- ✅ No import errors
- ✅ Health check passes
