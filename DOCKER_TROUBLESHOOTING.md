# Решение проблем Docker деплоя

## Ошибка: "parent snapshot does not exist: not found"

### Описание проблемы
При сборке Docker образов появляется ошибка:
```
failed to prepare extraction snapshot: parent snapshot sha256:... does not exist: not found
```

Это происходит из-за поврежденного кеша Docker или конфликта промежуточных слоев.

### Решение

#### Способ 1: Очистка build cache (Рекомендуется)
```bash
# Очистить весь build cache
docker builder prune -af

# Затем пересобрать образы
docker-compose -f docker-compose.yml -f docker-compose.prod.yml build
```

#### Способ 2: Сборка без кеша
```bash
# Сборка с полной очисткой кеша
docker-compose -f docker-compose.yml -f docker-compose.prod.yml build --no-cache

# Или для конкретного сервиса
docker-compose -f docker-compose.yml -f docker-compose.prod.yml build --no-cache backend
```

#### Способ 3: Полная очистка Docker (Крайний случай)
⚠️ **Внимание**: Это удалит ВСЕ неиспользуемые образы, контейнеры и volumes!

```bash
# Остановить все контейнеры
docker-compose down

# Полная очистка
docker system prune -a --volumes

# Пересобрать и запустить
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

#### Способ 4: Удалить конкретные образы
```bash
# Посмотреть все образы
docker images

# Удалить образы проекта
docker rmi ssh-runner-backend ssh-runner-frontend

# Пересобрать
docker-compose -f docker-compose.yml -f docker-compose.prod.yml build
```

### Проверка места на диске
Иногда проблема возникает из-за нехватки места:
```bash
# Проверить место на диске
df -h

# Проверить использование Docker
docker system df

# Очистить неиспользуемые данные
docker system prune
```

### Для production деплоя

1. **Очистите кеш на сервере:**
```bash
ssh your-server
docker builder prune -af
```

2. **Пересоберите образы:**
```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml build --no-cache
```

3. **Запустите контейнеры:**
```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Дополнительные советы

- Используйте Docker версии 20.10 или выше
- Убедитесь, что у вас достаточно места на диске (минимум 10 GB свободного места)
- Проверьте что Docker daemon работает корректно: `docker info`
- Если проблема повторяется, попробуйте перезапустить Docker daemon

### Профилактика

Для предотвращения накопления мусора в Docker:

```bash
# Добавьте в cron еженедельную очистку
0 0 * * 0 docker system prune -f

# Или используйте автоматическую очистку при запуске
docker-compose down && docker builder prune -f && docker-compose up -d
```

## Другие частые проблемы

### Ошибка: "port already in use"
```bash
# Найти процесс использующий порт
sudo lsof -i :8001
sudo lsof -i :3000

# Или остановить все контейнеры
docker-compose down
```

### Ошибка: "connection refused" при обращении к MongoDB
```bash
# Проверить здоровье контейнеров
docker-compose ps

# Проверить логи MongoDB
docker-compose logs mongodb

# Перезапустить MongoDB
docker-compose restart mongodb
```

### Ошибка: "Cannot connect to the Docker daemon"
```bash
# Запустить Docker daemon
sudo systemctl start docker

# Проверить статус
sudo systemctl status docker

# Добавить пользователя в группу docker (чтобы не использовать sudo)
sudo usermod -aG docker $USER
newgrp docker
```
