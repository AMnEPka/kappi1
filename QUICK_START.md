# SSH Script Runner - Quick Start

## 🚀 Быстрый запуск через Docker

### 1. Установите Docker
- **Linux**: `curl -fsSL https://get.docker.com -o get-docker.sh && sudo sh get-docker.sh`
- **Windows/Mac**: Скачайте [Docker Desktop](https://www.docker.com/products/docker-desktop/)

### 2. Клонируйте проект
```bash
git clone <your-repo-url>
cd ssh-script-runner
```

### 3. Запустите
```bash
docker compose up -d --build
```

### 4. Откройте
- Frontend: http://localhost:3000
- Backend API: http://localhost:8001/docs

---

## 📚 Полная документация
См. [DOCKER_DEPLOYMENT.md](./DOCKER_DEPLOYMENT.md)

---

## 🛑 Остановка
```bash
docker compose down
```

## 📊 Логи
```bash
docker compose logs -f
```

## 🔄 Перезапуск
```bash
docker compose restart
```
