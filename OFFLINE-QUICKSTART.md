# Быстрый старт: Offline развертывание

## Предварительная проверка

```bash
# Проверка системных требований
./scripts/check-requirements.sh
```

## На машине с интернетом

```bash
# 1. Сборка образов
./scripts/build-offline.sh

# 2. Сохранение образов в архивы
./scripts/save-images.sh

# 3. Подготовка для переноса
mkdir -p transfer
cp -r docker-images transfer/
cp docker-compose.offline.yml transfer/
cp -r scripts transfer/
cp .env.example transfer/.env  # Отредактируйте при необходимости

# 4. Создание архива
tar -czf ssh-runner-offline.tar.gz transfer/
```

**Результат**: Файл `ssh-runner-offline.tar.gz` (~1.3 GB) готов к переносу

## На целевом хосте (без интернета)

```bash
# 1. Распаковка
tar -xzf ssh-runner-offline.tar.gz
cd transfer/

# 2. Загрузка образов
./scripts/load-images.sh

# 3. (Опционально) Настройка .env
nano .env

# 4. Запуск
docker-compose -f docker-compose.offline.yml up -d

# 5. Проверка
docker-compose -f docker-compose.offline.yml ps
```

## Доступ

- Frontend: http://localhost:3000
- Backend: http://localhost:8001
- Логин: `admin` / Пароль: `admin123`

## Управление

```bash
# Остановка
docker-compose -f docker-compose.offline.yml down

# Перезапуск
docker-compose -f docker-compose.offline.yml restart

# Логи
docker-compose -f docker-compose.offline.yml logs -f

# Статус
docker-compose -f docker-compose.offline.yml ps
```

## Важно

✅ Все зависимости упакованы в образы - интернет НЕ требуется
✅ Данные сохраняются в Docker volumes даже после остановки
✅ Подробности в [OFFLINE-DEPLOYMENT.md](./OFFLINE-DEPLOYMENT.md)
