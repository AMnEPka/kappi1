# Offline Deployment Guide

## Полное руководство по офлайн развертыванию SSH Script Runner

### Содержание
1. [Подготовка на машине с интернетом](#1-подготовка-на-машине-с-интернетом)
2. [Перенос на офлайн хост](#2-перенос-на-офлайн-хост)
3. [Запуск на офлайн хосте](#3-запуск-на-офлайн-хосте)
4. [Проверка работоспособности](#4-проверка-работоспособности)
5. [Управление приложением](#5-управление-приложением)
6. [Troubleshooting](#6-troubleshooting)

---

## 1. Подготовка на машине с интернетом

### Требования
- Docker 20.10+
- Docker Compose 2.0+
- Минимум 10 GB свободного места
- Bash shell

### Шаг 1.1: Сборка Docker образов

```bash
# Перейдите в директорию проекта
cd /path/to/project

# Сделайте скрипты исполняемыми
chmod +x scripts/*.sh

# Соберите все Docker образы
./scripts/build-images.sh
```

Этот скрипт:
- Собирает backend образ из `backend/Dockerfile.prod`
- Собирает frontend образ из `frontend/Dockerfile.prod`
- Скачивает MongoDB 6.0
- Скачивает Nginx Alpine

**Ожидаемое время:** 10-30 минут в зависимости от скорости интернета

### Шаг 1.2: Сохранение образов для переноса

```bash
# Экспортируйте все образы в архивы
./scripts/save-images.sh
```

Этот скрипт создаст директорию `docker-images/` с файлами:
- `backend.tar.gz` (~500-800 MB)
- `frontend.tar.gz` (~200-400 MB)
- `mongodb.tar.gz` (~400-600 MB)
- `nginx.tar.gz` (~10-20 MB)

**Общий размер:** ~1.5-2 GB

### Шаг 1.3: Подготовка файлов для переноса

```bash
# Создайте архив с исходниками и образами
tar -czf ssh-runner-offline.tar.gz \
  docker-images/ \
  backend/ \
  frontend/ \
  nginx/ \
  scripts/ \
  docker-compose.offline.yml \
  .env.example
```

---

## 2. Перенос на офлайн хост

### Шаг 2.1: Копирование файлов

Перенесите `ssh-runner-offline.tar.gz` на целевой хост любым удобным способом:
- USB носитель
- Внутренняя сеть
- SCP/SFTP (если есть доступ)

```bash
# На офлайн хосте
mkdir -p /opt/ssh-runner
cd /opt/ssh-runner

# Распакуйте архив
tar -xzf ssh-runner-offline.tar.gz
```

### Шаг 2.2: Проверка структуры

```bash
# Убедитесь, что все файлы на месте
ls -la

# Должны быть:
# - docker-images/
# - backend/
# - frontend/
# - nginx/
# - scripts/
# - docker-compose.offline.yml
```

---

## 3. Запуск на офлайн хосте

### Шаг 3.1: Загрузка Docker образов

```bash
# Сделайте скрипты исполняемыми (если еще не сделано)
chmod +x scripts/*.sh

# Загрузите образы в Docker
./scripts/load-images.sh
```

Этот скрипт загрузит все сохраненные образы в локальный Docker.

**Ожидаемое время:** 2-5 минут

### Шаг 3.2: Настройка переменных окружения

```bash
# Создайте .env файл из примера
cp .env.example .env

# Отредактируйте при необходимости
nano .env
```

Основные переменные:
```env
ENCRYPTION_KEY=cI31yQgFFdM8KF-iIoQN6GHRmWp82tKU_aUogjhyOWo=
MONGO_URL=mongodb://mongodb:27017
DB_NAME=ssh_runner_db
```

### Шаг 3.3: Запуск приложения

```bash
# Запустите все сервисы
docker compose -f docker-compose.offline.yml up -d

# Проверьте статус
docker compose -f docker-compose.offline.yml ps
```

Все сервисы должны быть в состоянии `Up (healthy)`

---

## 4. Проверка работоспособности

### Шаг 4.1: Проверка контейнеров

```bash
# Статус всех контейнеров
docker compose -f docker-compose.offline.yml ps

# Логи
docker compose -f docker-compose.offline.yml logs -f

# Логи конкретного сервиса
docker compose -f docker-compose.offline.yml logs -f backend
```

### Шаг 4.2: Проверка доступности

```bash
# Health check nginx
curl http://localhost/health
# Ожидаемый ответ: healthy

# Backend API
curl http://localhost/api/hosts
# Ожидаемый ответ: JSON с пустым массивом или данными

# Frontend
curl -I http://localhost/
# Ожидаемый ответ: HTTP/1.1 200 OK
```

### Шаг 4.3: Доступ к веб-интерфейсу

Откройте браузер и перейдите по адресу:
- **HTTP:** `http://<ip-адрес-хоста>`
- **HTTPS:** `https://<ip-адрес-хоста>` (если настроен SSL)

**Логин по умолчанию:**
- Username: `admin`
- Password: `admin`

**⚠️ ВАЖНО:** Сразу смените пароль администратора после первого входа!

---

## 5. Управление приложением

### Остановка
```bash
docker compose -f docker-compose.offline.yml stop
```

### Запуск
```bash
docker compose -f docker-compose.offline.yml start
```

### Перезапуск
```bash
docker compose -f docker-compose.offline.yml restart
```

### Полная остановка и удаление
```bash
# Остановить и удалить контейнеры (данные сохранятся)
docker compose -f docker-compose.offline.yml down

# Удалить все, включая volumes (⚠️ УДАЛИТ ВСЕ ДАННЫЕ)
docker compose -f docker-compose.offline.yml down -v
```

### Просмотр логов
```bash
# Все сервисы
docker compose -f docker-compose.offline.yml logs -f

# Конкретный сервис
docker compose -f docker-compose.offline.yml logs -f backend
docker compose -f docker-compose.offline.yml logs -f frontend
docker compose -f docker-compose.offline.yml logs -f nginx
docker compose -f docker-compose.offline.yml logs -f mongodb
```

### Обновление приложения

```bash
# 1. Остановите текущую версию
docker compose -f docker-compose.offline.yml down

# 2. Загрузите новые образы (см. шаги 1-2)
./scripts/load-images.sh

# 3. Запустите обновленную версию
docker compose -f docker-compose.offline.yml up -d
```

---

## 6. Troubleshooting

### Проблема: Контейнер не запускается

```bash
# Посмотрите логи
docker compose -f docker-compose.offline.yml logs <service-name>

# Проверьте статус
docker compose -f docker-compose.offline.yml ps
```

### Проблема: Backend не подключается к MongoDB

```bash
# Проверьте, что MongoDB запущен и healthy
docker compose -f docker-compose.offline.yml ps mongodb

# Проверьте логи MongoDB
docker compose -f docker-compose.offline.yml logs mongodb

# Проверьте сетевое подключение
docker compose -f docker-compose.offline.yml exec backend ping mongodb
```

### Проблема: Nginx не может подключиться к backend/frontend

```bash
# Проверьте, что сервисы запущены
docker compose -f docker-compose.offline.yml ps

# Проверьте конфигурацию nginx
docker compose -f docker-compose.offline.yml exec nginx nginx -t

# Перезагрузите nginx
docker compose -f docker-compose.offline.yml restart nginx
```

### Проблема: Порт 80 уже занят

```bash
# Найдите процесс, использующий порт 80
sudo lsof -i :80
# или
sudo netstat -tulpn | grep :80

# Измените порт в docker-compose.offline.yml
# nginx:
#   ports:
#     - "8080:80"  # вместо "80:80"
```

### Проблема: Недостаточно места на диске

```bash
# Проверьте использование диска
df -h

# Очистите неиспользуемые Docker ресурсы
docker system prune -a

# Удалите старые образы
docker images
docker rmi <image-id>
```

### Проблема: Данные потеряны после перезапуска

**Это нормально**, если вы используете `docker compose down -v`.

**Резервное копирование данных:**
```bash
# Создать бэкап MongoDB
docker compose -f docker-compose.offline.yml exec mongodb mongodump --out /data/backup

# Копировать бэкап на хост
docker cp ssh-runner-mongodb:/data/backup ./mongodb-backup

# Восстановить из бэкапа
docker cp ./mongodb-backup ssh-runner-mongodb:/data/backup
docker compose -f docker-compose.offline.yml exec mongodb mongorestore /data/backup
```

---

## Системные требования

### Минимальные
- **CPU:** 2 cores
- **RAM:** 4 GB
- **Disk:** 20 GB
- **OS:** Linux (Ubuntu 20.04+, CentOS 8+, Debian 11+)

### Рекомендуемые
- **CPU:** 4+ cores
- **RAM:** 8+ GB
- **Disk:** 50+ GB SSD
- **OS:** Ubuntu 22.04 LTS

---

## Безопасность

### Рекомендации:
1. **Смените пароль администратора** сразу после первого входа
2. **Настройте HTTPS** для production среды
3. **Используйте firewall** для ограничения доступа
4. **Регулярно делайте бэкапы** базы данных
5. **Обновляйте образы** при выходе новых версий

### Настройка SSL/TLS

```bash
# Создайте директорию для сертификатов
mkdir -p nginx/ssl

# Скопируйте ваши сертификаты
cp your-cert.crt nginx/ssl/
cp your-key.key nginx/ssl/

# Раскомментируйте HTTPS секцию в nginx/nginx.conf
# и укажите пути к сертификатам
```

---

## Поддержка

Если возникли проблемы:
1. Проверьте логи: `docker compose -f docker-compose.offline.yml logs`
2. Проверьте документацию в папке проекта
3. Проверьте health checks: `docker compose -f docker-compose.offline.yml ps`

---

## Changelog

### Version 1.0.0
- Первый релиз офлайн развертывания
- Поддержка Docker Compose
- Nginx reverse proxy
- Production-ready конфигурация
