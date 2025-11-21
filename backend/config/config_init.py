"""
config/__init__.py
Configuration module initialization and centralized imports
"""

# Import settings
from config.settings import (  # pyright: ignore[reportMissingImports]
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

# Import database
from config.database import ( # pyright: ignore[reportMissingImports]
    connect_to_mongo,
    close_mongo_connection,
    get_db,
    db,
    client
)

# Import security
from config.security import ( # pyright: ignore[reportMissingImports]
    pwd_context,
    hash_password,
    verify_password,
    security,
    create_access_token,
    decode_token,
    encrypt_password,
    decrypt_password
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
    
    # Database
    "connect_to_mongo",
    "close_mongo_connection",
    "get_db",
    "db",
    "client",
    
    # Security
    "pwd_context",
    "hash_password",
    "verify_password",
    "security",
    "create_access_token",
    "decode_token",
    "encrypt_password",
    "decrypt_password"
]
