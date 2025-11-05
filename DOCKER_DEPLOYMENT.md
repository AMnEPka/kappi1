# 🐳 Docker Deployment Guide - OSIB

Полная инструкция по локальному запуску проекта OSIB с использованием Docker.

---

## 📋 Требования

- **Docker**: версия 20.10 или выше
- **Docker Compose**: версия 2.0 или выше
- **Git**: для клонирования репозитория
- **Минимум 4GB RAM** и **10GB свободного места на диске**

## ⚠️ Решение проблем

Если возникают ошибки при сборке Docker образов, смотрите [DOCKER_TROUBLESHOOTING.md](./DOCKER_TROUBLESHOOTING.md)

### Установка Docker

#### На Linux (Ubuntu/Debian):
```bash
# Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Установка Docker Compose
sudo apt-get update
sudo apt-get install docker-compose-plugin

# Добавление пользователя в группу docker (чтобы не использовать sudo)
sudo usermod -aG docker $USER
newgrp docker

# Проверка установки
docker --version
docker compose version
```

#### На Windows:
1. Скачайте [Docker Desktop](https://www.docker.com/products/docker-desktop/)
2. Установите и запустите Docker Desktop
3. Убедитесь, что WSL 2 включен (Docker Desktop сделает это автоматически)

#### На macOS:
1. Скачайте [Docker Desktop](https://www.docker.com/products/docker-desktop/)
2. Установите и запустите Docker Desktop

---

## 🚀 Быстрый старт

### 1. Клонирование репозитория

```bash
# Клонируйте проект с GitHub
git clone <your-repository-url>
cd ssh-script-runner

# Или если вы используете SSH
git clone git@github.com:username/ssh-script-runner.git
cd ssh-script-runner
```

### 2. Создание файла переменных окружения (опционально)

```bash
# Создайте .env файл в корне проекта
cat > .env << 'EOF'
# Ключ шифрования для паролей (генерируйте свой!)
ENCRYPTION_KEY=cI31yQgFFdM8KF-iIoQN6GHRmWp82tKU_aUogjhyOWo=
EOF
```

**⚠️ Важно:** Для production окружения сгенерируйте свой ключ:
```bash
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### 3. Запуск приложения

```bash
# Сборка и запуск всех сервисов
docker compose up --build

# Или в фоновом режиме (detached mode)
docker compose up -d --build
```

### 4. Проверка работы

Откройте в браузере:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8001/docs (Swagger UI)
- **MongoDB**: localhost:27017 (доступ через MongoDB Compass или mongosh)

---

## 📁 Структура проекта

```
ssh-script-runner/
├── docker-compose.yml          # Orchestration файл
├── .env                        # Переменные окружения (создайте свой)
├── backend/
│   ├── Dockerfile             # Backend образ
│   ├── .dockerignore          # Исключения для Docker
│   ├── requirements.txt       # Python зависимости
│   ├── server.py              # FastAPI приложение
│   └── .env                   # Backend переменные (создаются автоматически)
└── frontend/
    ├── Dockerfile             # Frontend образ
    ├── .dockerignore          # Исключения для Docker
    ├── package.json           # Node.js зависимости
    ├── src/                   # React код
    └── .env                   # Frontend переменные (создаются автоматически)
```

---

## 🔧 Управление контейнерами

### Просмотр логов

```bash
# Все сервисы
docker compose logs -f

# Только backend
docker compose logs -f backend

# Только frontend
docker compose logs -f frontend

# Только MongoDB
docker compose logs -f mongodb

# Последние 100 строк
docker compose logs --tail=100
```

### Остановка сервисов

```bash
# Остановка всех контейнеров (данные сохраняются)
docker compose stop

# Остановка и удаление контейнеров (данные сохраняются в volumes)
docker compose down

# Остановка + удаление volumes (УДАЛЯЕТ ВСЕ ДАННЫЕ В БД!)
docker compose down -v
```

### Перезапуск сервисов

```bash
# Перезапуск всех сервисов
docker compose restart

# Перезапуск только backend
docker compose restart backend

# Перезапуск только frontend
docker compose restart frontend
```

### Пересборка после изменений

```bash
# Пересобрать все образы
docker compose build

# Пересобрать только backend
docker compose build backend

# Пересобрать и запустить
docker compose up --build
```

---

## 🐛 Отладка и устранение проблем

### Проблема: Порты уже заняты

**Ошибка:**
```
Error: Bind for 0.0.0.0:3000 failed: port is already allocated
```

**Решение:**
```bash
# Найдите процесс, использующий порт
sudo lsof -i :3000
sudo lsof -i :8001

# Остановите процесс или измените порты в docker-compose.yml
ports:
  - "3001:3000"  # Измените внешний порт
```

### Проблема: MongoDB не запускается

**Решение:**
```bash
# Проверьте логи
docker compose logs mongodb

# Удалите старые volumes и пересоздайте
docker compose down -v
docker compose up mongodb

# Проверьте права на папку данных
sudo chown -R 999:999 /var/lib/docker/volumes/
```

### Проблема: Backend не подключается к MongoDB

**Решение:**
```bash
# Проверьте, что MongoDB запущен и здоров
docker compose ps

# Проверьте сетевое соединение
docker compose exec backend ping mongodb

# Проверьте переменные окружения
docker compose exec backend env | grep MONGO
```

### Проблема: Frontend не видит Backend API

**Решение:**
```bash
# Проверьте переменные окружения
docker compose exec frontend env | grep REACT_APP

# Убедитесь, что backend работает
curl http://localhost:8001/api/hosts

# Проверьте CORS настройки в backend
```

### Проблема: Изменения кода не применяются

**Решение:**
```bash
# Для backend (hot reload работает автоматически)
docker compose restart backend

# Для frontend (hot reload работает автоматически)
# Если не работает, пересоберите образ
docker compose build frontend
docker compose up -d frontend
```

---

## 🔍 Полезные команды

### Вход в контейнер

```bash
# Backend shell
docker compose exec backend bash

# Frontend shell
docker compose exec frontend sh

# MongoDB shell
docker compose exec mongodb mongosh
```

### Проверка состояния контейнеров

```bash
# Список запущенных контейнеров
docker compose ps

# Статистика использования ресурсов
docker stats
```

### Очистка Docker

```bash
# Удалить все остановленные контейнеры
docker container prune

# Удалить неиспользуемые образы
docker image prune -a

# Удалить неиспользуемые volumes
docker volume prune

# Полная очистка (осторожно!)
docker system prune -a --volumes
```

---

## 💾 Работа с данными

### Бэкап MongoDB

```bash
# Создание бэкапа
docker compose exec mongodb mongodump --out=/data/backup --db=ssh_runner_db

# Копирование бэкапа на хост
docker cp ssh-runner-mongodb:/data/backup ./mongodb-backup
```

### Восстановление MongoDB

```bash
# Копирование бэкапа в контейнер
docker cp ./mongodb-backup ssh-runner-mongodb:/data/backup

# Восстановление
docker compose exec mongodb mongorestore --db=ssh_runner_db /data/backup/ssh_runner_db
```

### Экспорт данных

```bash
# Экспорт коллекции в JSON
docker compose exec mongodb mongoexport --db=ssh_runner_db --collection=hosts --out=/data/hosts.json

# Копирование на хост
docker cp ssh-runner-mongodb:/data/hosts.json ./hosts.json
```

---

## 🌐 Production деплой

Для production окружения рекомендуется:

1. **Изменить переменные окружения:**
```yaml
# docker-compose.prod.yml
services:
  backend:
    environment:
      - MONGO_URL=mongodb://mongodb:27017
      - CORS_ORIGINS=https://yourdomain.com
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}  # Из внешнего .env
    command: uvicorn server:app --host 0.0.0.0 --port 8001  # Без --reload

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.prod
    environment:
      - REACT_APP_BACKEND_URL=https://api.yourdomain.com
```

2. **Создать Dockerfile.prod для frontend:**
```dockerfile
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

3. **Использовать reverse proxy (nginx/traefik):**
```bash
# Добавьте nginx как reverse proxy перед приложением
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## 📚 Дополнительные ресурсы

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Documentation](https://react.dev/)
- [MongoDB Documentation](https://www.mongodb.com/docs/)

---

## 🆘 Получение помощи

Если у вас возникли проблемы:

1. Проверьте логи: `docker compose logs -f`
2. Проверьте статус: `docker compose ps`
3. Создайте issue в GitHub репозитории
4. Обратитесь в Discord сообщество Emergent

---

## ✅ Чеклист успешного запуска

- [ ] Docker и Docker Compose установлены
- [ ] Репозиторий склонирован
- [ ] `.env` файл создан (опционально)
- [ ] `docker compose up --build` выполнен
- [ ] http://localhost:3000 открывается в браузере
- [ ] http://localhost:8001/docs показывает Swagger UI
- [ ] Можно создать категорию через админ-панель
- [ ] Можно создать хост и скрипт

**Поздравляем! Ваш SSH Script Runner запущен! 🎉**
