# Инструкция по offline развертыванию

Этот документ описывает процесс подготовки и развертывания приложения в offline режиме (без доступа к интернету).

## Предварительные требования

На целевом хосте должны быть установлены:
- Docker Engine (версия 20.10+)
- Docker Compose (версия 2.0+)

## Шаг 1: Подготовка на машине с интернетом

### 1.1 Сборка образов

```bash
cd /path/to/project
./scripts/build-offline.sh
```

Этот скрипт:
- Соберет backend образ из ./backend/Dockerfile
- Соберет frontend образ из ./frontend/Dockerfile.prod (production build с nginx)
- Скачает MongoDB образ (mongo:6.0)

### 1.2 Сохранение образов в архивы

```bash
./scripts/save-images.sh
```

Этот скрипт создаст директорию `docker-images/` с тремя архивами:
- `backend.tar.gz` - FastAPI backend (~500MB)
- `frontend.tar.gz` - React frontend с nginx (~200MB)
- `mongodb.tar.gz` - MongoDB (~700MB)

### 1.3 Подготовка файлов для переноса

Соберите следующие файлы в одну директорию для переноса:

```
transfer/
├── docker-images/
│   ├── backend.tar.gz
│   ├── frontend.tar.gz
│   └── mongodb.tar.gz
├── docker-compose.offline.yml
├── scripts/
│   └── load-images.sh
└── .env (опционально)
```

```bash
# Создание архива для переноса
mkdir -p transfer
cp -r docker-images transfer/
cp docker-compose.offline.yml transfer/
cp -r scripts transfer/
cp .env.example transfer/.env  # Отредактируйте при необходимости

# Создание финального архива
tar -czf ssh-runner-offline.tar.gz transfer/
```

## Шаг 2: Развертывание на целевом хосте (offline)

### 2.1 Перенос файлов

Перенесите `ssh-runner-offline.tar.gz` на целевой хост (USB, локальная сеть, etc.)

```bash
# На целевом хосте
tar -xzf ssh-runner-offline.tar.gz
cd transfer/
```

### 2.2 Загрузка образов в Docker

```bash
./scripts/load-images.sh
```

Этот скрипт загрузит все три образа в локальный Docker daemon.

### 2.3 Настройка окружения (опционально)

Отредактируйте `.env` файл если требуется:

```bash
nano .env
```

Основные параметры:
- `ENCRYPTION_KEY` - ключ шифрования для паролей (НЕ меняйте если уже есть данные)
- `CORS_ORIGINS` - если требуется доступ с внешних доменов

### 2.4 Запуск приложения

```bash
docker-compose -f docker-compose.offline.yml up -d
```

### 2.5 Проверка статуса

```bash
# Проверка запущенных контейнеров
docker-compose -f docker-compose.offline.yml ps

# Просмотр логов
docker-compose -f docker-compose.offline.yml logs -f

# Проверка здоровья сервисов
docker ps --format "table {{.Names}}\t{{.Status}}"
```

## Шаг 3: Доступ к приложению

После успешного запуска:

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8001
- **MongoDB**: localhost:27017 (только внутри сети Docker)

### Первый вход

По умолчанию создается администратор:
- **Логин**: admin
- **Пароль**: admin123

⚠️ **Обязательно смените пароль после первого входа!**

## Управление приложением

### Остановка

```bash
docker-compose -f docker-compose.offline.yml down
```

### Перезапуск

```bash
docker-compose -f docker-compose.offline.yml restart
```

### Обновление

Для обновления приложения:
1. Остановите текущую версию
2. Повторите процесс с шага 1 на машине с интернетом
3. Перенесите новые образы
4. Загрузите новые образы (load-images.sh)
5. Запустите с новыми образами

### Резервное копирование данных

Все данные хранятся в Docker volumes. Для резервного копирования:

```bash
# Создание backup директории
mkdir -p backups

# Остановка контейнеров (данные сохраняются в volumes)
docker-compose -f docker-compose.offline.yml down

# Копирование MongoDB данных
docker run --rm -v ssh-runner_mongodb_data:/data -v $(pwd)/backups:/backup alpine tar czf /backup/mongodb-backup-$(date +%Y%m%d).tar.gz -C /data .

# Запуск контейнеров обратно
docker-compose -f docker-compose.offline.yml up -d
```

### Восстановление из резервной копии

```bash
# Остановка и удаление контейнеров (volumes останутся)
docker-compose -f docker-compose.offline.yml down

# Удаление старого volume (ВНИМАНИЕ: удалит все данные!)
docker volume rm ssh-runner_mongodb_data

# Создание нового volume
docker volume create ssh-runner_mongodb_data

# Восстановление данных
docker run --rm -v ssh-runner_mongodb_data:/data -v $(pwd)/backups:/backup alpine tar xzf /backup/mongodb-backup-YYYYMMDD.tar.gz -C /data

# Запуск контейнеров
docker-compose -f docker-compose.offline.yml up -d
```

## Troubleshooting

### Контейнеры не запускаются

1. Проверьте логи: `docker-compose -f docker-compose.offline.yml logs`
2. Убедитесь что порты 3000, 8001, 27017 не заняты: `netstat -tulpn | grep -E '3000|8001|27017'`
3. Проверьте свободное место: `df -h`

### MongoDB не запускается

Проверьте права на volume:
```bash
docker volume inspect ssh-runner_mongodb_data
```

### Frontend показывает ошибки соединения

Проверьте что backend доступен:
```bash
curl http://localhost:8001/api/hosts
```

Если не доступен, проверьте логи backend:
```bash
docker-compose -f docker-compose.offline.yml logs backend
```

## Различия между режимами развертывания

### Development (docker-compose.yml)
- Монтирует код с хоста (hot reload)
- Использует development сборку React
- Подходит для разработки

### Offline/Production (docker-compose.offline.yml)
- Весь код внутри образов
- Production сборка React с оптимизацией
- Nginx для frontend (вместо dev server)
- Не требует доступа к npm/pip репозиториям
- Полностью автономное развертывание

## Технические детали

### Архитектура

```
┌─────────────────────────────────────────┐
│  nginx:alpine (Frontend)                │
│  - Статические файлы React              │
│  - Port 3000 → 80                       │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  python:3.11-slim (Backend)             │
│  - FastAPI + Uvicorn                    │
│  - Port 8001                            │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  mongo:6.0 (Database)                   │
│  - Port 27017                           │
│  - Volumes: mongodb_data, mongodb_config│
└─────────────────────────────────────────┘
```

### Размеры образов

- **mongo:6.0**: ~700 MB
- **ssh-runner-backend:latest**: ~450 MB
- **ssh-runner-frontend:latest**: ~180 MB
- **Итого**: ~1.3 GB

### Сетевая конфигурация

Все контейнеры работают в одной сети `ssh-runner-network`:
- Внутри сети контейнеры обращаются друг к другу по имени сервиса
- Backend: `mongodb://mongodb:27017`
- Frontend → Backend: `http://backend:8001` (внутри) или `http://localhost:8001` (с хоста)
