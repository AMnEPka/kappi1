#!/bin/bash
# Скрипт проверки системных требований

echo "======================================"
echo "  Проверка системных требований"
echo "======================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# Function to check version
check_version() {
    local name=$1
    local current=$2
    local required=$3
    
    if [ -z "$current" ]; then
        echo -e "${RED}❌ $name: НЕ УСТАНОВЛЕН${NC}"
        ((ERRORS++))
        return 1
    fi
    
    echo -e "${GREEN}✅ $name: $current${NC}"
    return 0
}

# Docker
echo "📦 Docker Engine:"
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version | cut -d ' ' -f3 | cut -d ',' -f1)
    check_version "Docker" "$DOCKER_VERSION" "20.10"
else
    echo -e "${RED}❌ Docker НЕ УСТАНОВЛЕН${NC}"
    ((ERRORS++))
fi
echo ""

# Docker Compose
echo "📦 Docker Compose:"
if command -v docker-compose &> /dev/null; then
    COMPOSE_VERSION=$(docker-compose --version | cut -d ' ' -f4)
    check_version "Docker Compose" "$COMPOSE_VERSION" "2.0"
elif docker compose version &> /dev/null; then
    COMPOSE_VERSION=$(docker compose version --short)
    check_version "Docker Compose (plugin)" "$COMPOSE_VERSION" "2.0"
else
    echo -e "${RED}❌ Docker Compose НЕ УСТАНОВЛЕН${NC}"
    ((ERRORS++))
fi
echo ""

# Ports
echo "🔌 Проверка портов:"
for port in 3000 8001 27017; do
    if command -v netstat &> /dev/null; then
        if netstat -tuln 2>/dev/null | grep -q ":$port "; then
            echo -e "${YELLOW}⚠️  Порт $port ЗАНЯТ${NC}"
            ((WARNINGS++))
        else
            echo -e "${GREEN}✅ Порт $port свободен${NC}"
        fi
    elif command -v ss &> /dev/null; then
        if ss -tuln 2>/dev/null | grep -q ":$port "; then
            echo -e "${YELLOW}⚠️  Порт $port ЗАНЯТ${NC}"
            ((WARNINGS++))
        else
            echo -e "${GREEN}✅ Порт $port свободен${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  Не могу проверить порт $port (netstat/ss не найден)${NC}"
    fi
done
echo ""

# Disk space
echo "💾 Свободное место на диске:"
DISK_FREE=$(df -h / | tail -1 | awk '{print $4}')
DISK_FREE_GB=$(df -BG / | tail -1 | awk '{print $4}' | tr -d 'G')
echo "  Доступно: $DISK_FREE"
if [ "$DISK_FREE_GB" -lt 10 ]; then
    echo -e "${RED}❌ Недостаточно места! Требуется минимум 10GB${NC}"
    ((ERRORS++))
elif [ "$DISK_FREE_GB" -lt 20 ]; then
    echo -e "${YELLOW}⚠️  Рекомендуется минимум 20GB${NC}"
    ((WARNINGS++))
else
    echo -e "${GREEN}✅ Достаточно места${NC}"
fi
echo ""

# RAM
echo "🧠 Оперативная память:"
if command -v free &> /dev/null; then
    TOTAL_RAM=$(free -g | grep Mem | awk '{print $2}')
    FREE_RAM=$(free -g | grep Mem | awk '{print $7}')
    echo "  Всего: ${TOTAL_RAM}GB, Доступно: ${FREE_RAM}GB"
    if [ "$TOTAL_RAM" -lt 4 ]; then
        echo -e "${RED}❌ Недостаточно RAM! Требуется минимум 4GB${NC}"
        ((ERRORS++))
    elif [ "$TOTAL_RAM" -lt 8 ]; then
        echo -e "${YELLOW}⚠️  Рекомендуется минимум 8GB RAM${NC}"
        ((WARNINGS++))
    else
        echo -e "${GREEN}✅ Достаточно RAM${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Не могу проверить RAM${NC}"
fi
echo ""

# CPU
echo "⚙️  CPU:"
if command -v nproc &> /dev/null; then
    CPU_CORES=$(nproc)
    echo "  Ядер: $CPU_CORES"
    if [ "$CPU_CORES" -lt 2 ]; then
        echo -e "${RED}❌ Недостаточно ядер! Требуется минимум 2${NC}"
        ((ERRORS++))
    elif [ "$CPU_CORES" -lt 4 ]; then
        echo -e "${YELLOW}⚠️  Рекомендуется минимум 4 ядра${NC}"
        ((WARNINGS++))
    else
        echo -e "${GREEN}✅ Достаточно ядер${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Не могу проверить количество ядер${NC}"
fi
echo ""

# Optional: Node.js (для разработки)
echo "🔧 Опционально (для разработки):"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_MAJOR" -ge 20 ]; then
        echo -e "${GREEN}✅ Node.js: $NODE_VERSION${NC}"
    else
        echo -e "${YELLOW}⚠️  Node.js: $NODE_VERSION (требуется >=20 для разработки)${NC}"
    fi
else
    echo "  Node.js: не установлен (не требуется для Docker)"
fi

if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
    echo -e "${GREEN}✅ Python: $PYTHON_VERSION${NC}"
else
    echo "  Python: не установлен (не требуется для Docker)"
fi
echo ""

# Summary
echo "======================================"
echo "           ИТОГИ"
echo "======================================"
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ Все требования выполнены!${NC}"
    echo ""
    echo "Можно приступать к развертыванию:"
    echo "  ./scripts/build-offline.sh"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  $WARNINGS предупреждений${NC}"
    echo ""
    echo "Можно приступать к развертыванию, но рекомендуется"
    echo "устранить предупреждения для оптимальной работы."
    exit 0
else
    echo -e "${RED}❌ Обнаружено $ERRORS критических ошибок${NC}"
    if [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}⚠️  и $WARNINGS предупреждений${NC}"
    fi
    echo ""
    echo "Необходимо устранить критические ошибки перед развертыванием!"
    exit 1
fi
