# Utils Package Documentation

## Overview
Утилиты общего назначения для приложения SSH Script Runner.

## Modules

### db_utils.py
Утилиты для работы с MongoDB - сериализация и десериализация данных.

**Functions:**
- `prepare_for_mongo(data: dict) -> dict` - Подготовка данных для сохранения в MongoDB (datetime → ISO string)
- `parse_from_mongo(item: dict) -> dict` - Парсинг данных из MongoDB (ISO string → datetime)

**Usage:**
```python
from utils.db_utils import prepare_for_mongo, parse_from_mongo

# Сохранение в БД
host_obj = Host(**host_data)
doc = prepare_for_mongo(host_obj.model_dump())
await db.hosts.insert_one(doc)

# Чтение из БД
host_doc = await db.hosts.find_one({"id": host_id})
host = Host(**parse_from_mongo(host_doc))
```

### audit_utils.py
Утилиты для аудита и логирования событий.

**Functions:**
- `log_audit(event, *, user_id, username, details, level)` - Логирование событий с автоматической персистенцией
- `_persist_audit_log(entry)` - Внутренняя функция для сохранения логов в БД

**Usage:**
```python
from utils.audit_utils import log_audit

# Простое логирование
log_audit("15", user_id=user.id, username=user.username)

# С дополнительными деталями
log_audit(
    "16",
    user_id=current_user.id,
    username=current_user.username,
    details={
        "host_id": host_id,
        "host_name": host.name,
        "ip_address": host.hostname
    }
)
```

## Migration History

### Initial Creation (2025-11-25)
- Moved `prepare_for_mongo`, `parse_from_mongo` from server.py to db_utils.py
- Moved `log_audit`, `_persist_audit_log` from server.py to audit_utils.py
- Reduced server.py from 2917 to 2862 lines (-55 lines)

## Testing
All functions tested and confirmed working:
- ✅ prepare_for_mongo - serialization to MongoDB
- ✅ parse_from_mongo - deserialization from MongoDB
- ✅ log_audit - audit logging with persistence
