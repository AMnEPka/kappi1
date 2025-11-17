#!/bin/bash
# Скрипт для загрузки Docker образов из архивов

set -e

echo "📥 Загрузка Docker образов..."
echo ""

# Проверка наличия директории с образами
if [ ! -d "docker-images" ]; then
    echo "❌ Директория docker-images/ не найдена!"
    echo "Убедитесь, что вы находитесь в корневой директории проекта"
    echo "и скопировали docker-images/ с образами"
    exit 1
fi

# Загрузка образов
echo "📦 Загрузка MongoDB образа..."
docker load < docker-images/mongodb.tar.gz

echo "📦 Загрузка backend образа..."
docker load < docker-images/backend.tar.gz

echo "📦 Загрузка frontend образа..."
docker load < docker-images/frontend.tar.gz

echo ""
echo "✅ Все образы загружены!"
echo ""
echo "Список образов:"
docker images | grep -E "ssh-runner|mongo:6.0"
echo ""
echo "Следующий шаг:"
echo "docker-compose -f docker-compose.offline.yml up -d"
