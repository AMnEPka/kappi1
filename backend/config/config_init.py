"""
config/__init__.py
Configuration module initialization and centralized imports
"""
# Import settings
from config.config_settings import ( 
    ROOT_DIR,
    MONGO_URL,
    DB_NAME,
    ENCRYPTION_KEY,
    JWT_SECRET_KEY,
    JWT_ALGORITHM,
    JWT_ACCESS_TOKEN_EXPIRE_HOURS,
    SCHEDULER_POLL_SECONDS,
    logger,
    PERMISSIONS,
    PERMISSION_GROUPS
)

# Import security
from config.config_security import ( # pyright: ignore[reportMissingImports]
    pwd_context,
    hash_password,
    verify_password,
    security,
    create_access_token,
    create_refresh_token,
    create_token_pair,
    decode_token,
    is_refresh_token,
    is_access_token,
    encrypt_password,
    decrypt_password
)

from config.config_database import (
    client,
    db,
    ensure_indexes,
    check_db_health
)

__all__ = [
    # Settings
    "ROOT_DIR",
    "MONGO_URL",
    "DB_NAME",
    "ENCRYPTION_KEY",
    "JWT_SECRET_KEY",
    "JWT_ALGORITHM",
    "JWT_ACCESS_TOKEN_EXPIRE_HOURS",
    "SCHEDULER_POLL_SECONDS",
    "logger",
    "PERMISSIONS",
    "PERMISSION_GROUPS",
    
    # Security
    "pwd_context",
    "hash_password",
    "verify_password",
    "security",
    "create_access_token",
    "create_refresh_token",
    "create_token_pair",
    "decode_token",
    "is_refresh_token",
    "is_access_token",
    "encrypt_password",
    "decrypt_password",

    # DB
    "db",
    "client",
    "ensure_indexes",
    "check_db_health"
]
