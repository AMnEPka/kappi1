#!/bin/bash
# Скрипт для сборки образов для offline развертывания

set -e

echo "🔨 Сборка образов для offline развертывания..."
echo ""

# Переход в корневую директорию проекта
cd "$(dirname "$0")/.."

# Сборка образов
echo "📦 Сборка backend образа..."
docker build -t ssh-runner-backend:latest ./backend

echo ""
echo "📦 Сборка frontend образа..."
docker build -f ./frontend/Dockerfile.prod -t ssh-runner-frontend:latest ./frontend

echo ""
echo "📦 Pull MongoDB образа..."
docker pull mongo:6.0

echo ""
echo "✅ Все образы собраны!"
echo ""
echo "Список образов:"
docker images | grep -E "ssh-runner|mongo:6.0"
echo ""
echo "Следующий шаг: запустите ./scripts/save-images.sh для сохранения образов"
