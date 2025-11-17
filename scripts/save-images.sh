#!/bin/bash
# Скрипт для сохранения Docker образов в архивы

set -e

echo "💾 Сохранение Docker образов..."
echo ""

# Создание директории для образов
mkdir -p docker-images

# Сохранение образов
echo "📦 Сохранение backend образа..."
docker save ssh-runner-backend:latest | gzip > docker-images/backend.tar.gz

echo "📦 Сохранение frontend образа..."
docker save ssh-runner-frontend:latest | gzip > docker-images/frontend.tar.gz

echo "📦 Сохранение MongoDB образа..."
docker save mongo:6.0 | gzip > docker-images/mongodb.tar.gz

echo ""
echo "✅ Все образы сохранены в директории docker-images/"
echo ""
echo "Размеры архивов:"
ls -lh docker-images/
echo ""
echo "Следующие шаги:"
echo "1. Скопируйте директорию docker-images/ на целевой хост"
echo "2. Скопируйте docker-compose.offline.yml на целевой хост"
echo "3. Скопируйте scripts/load-images.sh на целевой хост"
echo "4. На целевом хосте запустите: ./scripts/load-images.sh"
echo "5. Затем: docker-compose -f docker-compose.offline.yml up -d"
