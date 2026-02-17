"""
config/settings.py
Application settings, environment variables, and constants
"""

import os
import logging
from pathlib import Path
from dotenv import load_dotenv # pyright: ignore[reportMissingImports]
from datetime import timedelta

# Initialize root directory and load environment
ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

# ============================================================================
# ENVIRONMENT VARIABLES
# ============================================================================

# MongoDB Configuration
MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ.get('DB_NAME', 'ssh_runner_db')

# Encryption Key for storing passwords
ENCRYPTION_KEY = os.environ.get('ENCRYPTION_KEY', '')

# JWT Configuration
JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production-please-use-strong-random-key')
JWT_ALGORITHM = "HS256"
# Access token expiration time in minutes (default: 120 minutes / 2 hours)
# Set via JWT_ACCESS_TOKEN_EXPIRE_MINUTES environment variable
# Note: Frontend automatically refreshes token 5 minutes before expiration
#       and also refreshes on tab visibility change (return from background)
JWT_ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get('JWT_ACCESS_TOKEN_EXPIRE_MINUTES', '120'))
JWT_REFRESH_TOKEN_EXPIRE_DAYS = int(os.environ.get('JWT_REFRESH_TOKEN_EXPIRE_DAYS', '30'))
# Legacy support
JWT_ACCESS_TOKEN_EXPIRE_HOURS = 24

# Scheduler Configuration
SCHEDULER_POLL_SECONDS = int(os.environ.get("SCHEDULER_POLL_SECONDS", "30"))

# ============================================================================
# LOGGING CONFIGURATION
# ============================================================================

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("ssh_runner")

# ============================================================================
# PERMISSIONS DICTIONARY
# ============================================================================

PERMISSIONS = {
    'categories_manage': 'Управление категориями и системами',
    'checks_create': 'Создание проверок',
    'checks_edit_own': 'Редактирование своих проверок',
    'checks_edit_all': 'Редактирование всех проверок',
    'checks_delete_own': 'Удаление своих проверок',
    'checks_delete_all': 'Удаление всех проверок',
    'hosts_create': 'Создание хостов',
    'hosts_edit_own': 'Редактирование своих хостов',
    'hosts_edit_all': 'Редактирование всех хостов',
    'hosts_delete_own': 'Удаление своих хостов',
    'hosts_delete_all': 'Удаление всех хостов',
    'users_manage': 'Управление пользователями',
    'users_view': 'Просмотр списка пользователей',
    'roles_manage': 'Управление ролями',
    'results_view_all': 'Просмотр всех результатов',
    'results_export_all': 'Экспорт всех результатов',
    'projects_create': 'Создание проектов',
    'projects_execute': 'Выполнение проектов',
    'scheduler_access': 'Доступ к планировщику заданий',
    'logs_access': 'Доступ к логам',
    'is_catalog_view': 'Просмотр каталога ИС',
    'is_catalog_edit': 'Редактирование каталога ИС',
    'is_catalog_manage_schema': 'Управление полями каталога ИС (схема)',
    'ib_profiles_view': 'Просмотр профилей ИБ',
    'ib_profiles_manage': 'Управление профилями ИБ (создание, редактирование, удаление, экспорт)',
    'ib_profiles_apply': 'Применение профилей ИБ на хосты',
}

# ============================================================================
# PERMISSION GROUPS
# ============================================================================

PERMISSION_GROUPS = {
    'Категории и системы': ['categories_manage'],
    'Проверки': [
        'checks_create',
        'checks_edit_own',
        'checks_edit_all',
        'checks_delete_own',
        'checks_delete_all',
        'scheduler_access'
    ],
    'Хосты': [
        'hosts_create',
        'hosts_edit_own',
        'hosts_edit_all',
        'hosts_delete_own',
        'hosts_delete_all'
    ],
    'Проекты': [
        'projects_create',
        'projects_execute'
    ],
    'Каталог ИС': [
        'is_catalog_view',
        'is_catalog_edit',
        'is_catalog_manage_schema'
    ],
    'Профили ИБ': [
        'ib_profiles_view',
        'ib_profiles_manage',
        'ib_profiles_apply'
    ],
    'Результаты': [
        'results_view_all',
        'results_export_all'
    ],
    'Администрирование': [
        'roles_manage',
        'logs_access'
    ],
    'Пользователи': [
        'users_view',
        'users_manage'
    ],
}
