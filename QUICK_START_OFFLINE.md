# 🚀 Quick Start - Offline Deployment

## Быстрый старт для оффлайн развертывания

### На машине С интернетом:

```bash
# 1. Соберите образы
./scripts/build-images.sh

# 2. Сохраните образы
./scripts/save-images.sh

# 3. Создайте архив для переноса
tar -czf ssh-runner-offline.tar.gz \
  docker-images/ \
  backend/ \
  frontend/ \
  nginx/ \
  scripts/ \
  docker-compose.offline.yml \
  .env.example \
  OFFLINE_DEPLOYMENT_GUIDE.md
```

### На оффлайн машине:

```bash
# 1. Распакуйте архив
tar -xzf ssh-runner-offline.tar.gz
cd ssh-runner

# 2. Загрузите образы
chmod +x scripts/*.sh
./scripts/load-images.sh

# 3. Настройте окружение
cp .env.example .env
nano .env  # при необходимости

# 4. Запустите
docker compose -f docker-compose.offline.yml up -d

# 5. Проверьте
docker compose -f docker-compose.offline.yml ps
```

### Доступ к приложению:

🌐 **URL:** http://your-server-ip

👤 **Логин:** admin  
🔑 **Пароль:** admin

⚠️ **ВАЖНО:** Сразу смените пароль!

---

## Управление

```bash
# Остановить
docker compose -f docker-compose.offline.yml stop

# Запустить
docker compose -f docker-compose.offline.yml start

# Перезапустить
docker compose -f docker-compose.offline.yml restart

# Логи
docker compose -f docker-compose.offline.yml logs -f

# Статус
docker compose -f docker-compose.offline.yml ps
```

---

Полная инструкция: `OFFLINE_DEPLOYMENT_GUIDE.md`
