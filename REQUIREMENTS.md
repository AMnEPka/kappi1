# Технические требования

## Системные требования

### Минимальные требования для запуска
- **CPU**: 2 cores
- **RAM**: 4 GB
- **Disk**: 10 GB свободного места
- **OS**: Linux (Ubuntu 20.04+, CentOS 7+, Debian 10+) или Windows с WSL2

### Рекомендуемые требования
- **CPU**: 4 cores
- **RAM**: 8 GB
- **Disk**: 20 GB SSD
- **OS**: Linux (Ubuntu 22.04+)

## Программное обеспечение

### Обязательное ПО

#### Docker Engine
- **Минимальная версия**: 20.10
- **Рекомендуемая**: 24.0+
- **Установка**: https://docs.docker.com/engine/install/

Проверка версии:
```bash
docker --version
# Docker version 24.0.0, build
```

#### Docker Compose
- **Минимальная версия**: 2.0
- **Рекомендуемая**: 2.20+
- **Установка**: https://docs.docker.com/compose/install/

Проверка версии:
```bash
docker-compose --version
# Docker Compose version v2.20.0
```

### Для разработки (опционально)

#### Node.js
- **Требуемая версия**: 20.0.0+
- **Причина**: React Router Dom 7.9.4 требует Node >=20
- **Установка**: https://nodejs.org/

Проверка версии:
```bash
node --version
# v20.11.0
```

#### Python
- **Требуемая версия**: 3.11+
- **Установка**: https://www.python.org/downloads/

Проверка версии:
```bash
python3 --version
# Python 3.11.0
```

## Сетевые требования

### Порты

#### Обязательные порты (должны быть свободны):
- **3000** - Frontend (HTTP)
- **8001** - Backend API (HTTP)
- **27017** - MongoDB (внутри Docker, опционально снаружи)

Проверка занятости портов:
```bash
# Linux
netstat -tulpn | grep -E '3000|8001|27017'

# Или с помощью ss
ss -tulpn | grep -E '3000|8001|27017'
```

### Доступ к сети

#### Development режим:
- ✅ Требуется интернет для установки зависимостей
- ✅ Требуется доступ к:
  - registry.npmjs.org (npm packages)
  - pypi.org (Python packages)
  - hub.docker.com (Docker images)

#### Offline/Production режим:
- ❌ Интернет НЕ требуется
- ✅ Все зависимости упакованы в образы

## Зависимости в образах

### Backend (Python)
Установленные пакеты из requirements.txt:
```
fastapi>=0.104.0
uvicorn[standard]>=0.24.0
motor>=3.3.1
pydantic>=2.4.0
python-jose[cryptography]
passlib[bcrypt]
python-multipart
paramiko>=3.3.1
pywinrm>=0.4.3
cryptography>=41.0.5
openpyxl>=3.1.2
python-dotenv>=1.0.0
```

**Размер образа**: ~450 MB

### Frontend (Node.js)
Основные зависимости из package.json:
```json
{
  "react": "^19.0.0",
  "react-dom": "^19.0.0",
  "react-router-dom": "^7.9.4",
  "axios": "^1.6.0",
  "tailwindcss": "^3.3.5"
}
```

**Node.js версия в образе**: 20-alpine
**Размер образа**: ~180 MB (production build + nginx)

### MongoDB
- **Версия**: 6.0
- **Образ**: mongo:6.0 (официальный)
- **Размер образа**: ~700 MB

## Совместимость

### Операционные системы

| OS | Status | Notes |
|---|---|---|
| Ubuntu 20.04+ | ✅ Полностью поддерживается | Рекомендуемая |
| Ubuntu 22.04+ | ✅ Полностью поддерживается | Рекомендуемая |
| Debian 10+ | ✅ Поддерживается | |
| CentOS 7+ | ✅ Поддерживается | Требуется Docker CE |
| RHEL 8+ | ✅ Поддерживается | |
| Windows 10/11 + WSL2 | ✅ Поддерживается | С Docker Desktop |
| macOS | ✅ Поддерживается | С Docker Desktop |

### Браузеры

| Browser | Minimum Version | Recommended |
|---|---|---|
| Chrome | 90+ | Latest |
| Firefox | 88+ | Latest |
| Safari | 14+ | Latest |
| Edge | 90+ | Latest |

## Безопасность

### Firewall правила

Для доступа извне необходимо открыть порты:
```bash
# Ubuntu/Debian (ufw)
sudo ufw allow 3000/tcp
sudo ufw allow 8001/tcp

# CentOS/RHEL (firewalld)
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --permanent --add-port=8001/tcp
sudo firewall-cmd --reload
```

### SELinux

На RHEL/CentOS с SELinux могут потребоваться дополнительные настройки:
```bash
# Разрешить Docker работать с volumes
sudo setsebool -P container_manage_cgroup on
```

## Производительность

### Рекомендации по настройке

#### Docker
```bash
# /etc/docker/daemon.json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

#### MongoDB
Для production нагрузки рекомендуется:
- Использовать SSD диск для MongoDB volume
- Настроить limits в docker-compose:
```yaml
mongodb:
  deploy:
    resources:
      limits:
        cpus: '2'
        memory: 2G
```

## Проверка соответствия требованиям

Скрипт для быстрой проверки:
```bash
#!/bin/bash
echo "=== Проверка системных требований ==="
echo ""

# Docker
echo -n "Docker: "
docker --version || echo "❌ НЕ УСТАНОВЛЕН"

# Docker Compose
echo -n "Docker Compose: "
docker-compose --version || echo "❌ НЕ УСТАНОВЛЕН"

# Свободные порты
echo ""
echo "Проверка портов:"
for port in 3000 8001 27017; do
  if netstat -tuln 2>/dev/null | grep -q ":$port "; then
    echo "❌ Порт $port ЗАНЯТ"
  else
    echo "✅ Порт $port свободен"
  fi
done

# Диск
echo ""
echo "Свободное место на диске:"
df -h / | tail -1

# RAM
echo ""
echo "Доступная память:"
free -h | grep Mem

# CPU
echo ""
echo "CPU:"
nproc
echo "cores"
```

Сохраните как `check-requirements.sh` и запустите:
```bash
chmod +x check-requirements.sh
./check-requirements.sh
```

## Обновления зависимостей

### Обновление Node.js версии

Если требуется обновить Node.js в образах:
```dockerfile
# В frontend/Dockerfile и frontend/Dockerfile.prod
FROM node:20-alpine  # Измените версию здесь
```

### Обновление Python версии

Если требуется обновить Python в образе:
```dockerfile
# В backend/Dockerfile
FROM python:3.11-slim  # Измените версию здесь
```

### Обновление MongoDB версии

Если требуется обновить MongoDB:
```yaml
# В docker-compose.yml и docker-compose.offline.yml
mongodb:
  image: mongo:6.0  # Измените версию здесь
```

⚠️ **Внимание**: При обновлении major версий требуется тестирование!
