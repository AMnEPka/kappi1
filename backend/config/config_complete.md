## config/ 

### 📊 Статус



### ✅ 1. **config/settings.py** 

**Содержит:**
- Переменные окружения (MONGO_URL, DB_NAME, ENCRYPTION_KEY, JWT параметры)
- Логирование (logger)
- PERMISSIONS словарь (20+ разрешений)
- PERMISSION_GROUPS (7 групп разрешений)

**Назначение:** Централизованная конфигурация приложения

**Ключевые переменные:**
```python
MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ.get('DB_NAME', 'ssh_runner_db')
ENCRYPTION_KEY = os.environ.get('ENCRYPTION_KEY', '')
JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', '...')
JWT_ACCESS_TOKEN_EXPIRE_HOURS = 24
SCHEDULER_POLL_SECONDS = int(os.environ.get("SCHEDULER_POLL_SECONDS", "30"))
```

---

### ✅ 2. **config/database.py** 

**Содержит:**
- `client` - MongoDB AsyncIO клиент
- `db` - экземпляр базы данных
- `connect_to_mongo()` - инициализация подключения
- `close_mongo_connection()` - закрытие подключения
- `get_db()` - получение экземпляра БД

**Назначение:** Управление MongoDB подключением и жизненным циклом

**Использование в main.py:**
```python
@app.on_event("startup")
async def startup():
    await connect_to_mongo()

@app.on_event("shutdown")
async def shutdown():
    await close_mongo_connection()
```

---

### ✅ 3. **config/security.py** 

**Содержит функции для:**

1. **Хеширование паролей пользователей:**
   - `hash_password(password: str) -> str`
   - `verify_password(plain_password: str, hashed_password: str) -> bool`

2. **JWT токены:**
   - `create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str`
   - `decode_token(token: str) -> dict`

3. **Шифрование паролей хостов (для БД):**
   - `encrypt_password(password: str) -> str`
   - `decrypt_password(encrypted_password: str) -> str`

4. **HTTP Bearer:**
   - `security = HTTPBearer()`

**Назначение:** Вся безопасность приложения в одном файле

---

### ✅ 4. **config/__init__.py** 

**Содержит:**
- Централизованные импорты из всех файлов config/
- Полный `__all__` список для публичного API

**Использование в других модулях:**
```python
# Вместо множественных импортов:
from config.settings import logger
from config.security import hash_password, create_access_token
from config.database import get_db

# Просто:
from config import logger, hash_password, create_access_token, get_db
```