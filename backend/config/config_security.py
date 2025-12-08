"""
config/security.py
Security configuration: JWT, password hashing, encryption, and HTTP bearer
"""

from passlib.context import CryptContext   # pyright: ignore[reportMissingModuleSource]
from fastapi.security import HTTPBearer # pyright: ignore[reportMissingImports]
from jose import jwt # pyright: ignore[reportMissingModuleSource]
from datetime import datetime, timezone, timedelta
from typing import Optional
from cryptography.fernet import Fernet
import base64
from config.config_settings import (   # pyright: ignore[reportMissingImports]
    JWT_SECRET_KEY,
    JWT_ALGORITHM,
    JWT_ACCESS_TOKEN_EXPIRE_HOURS,
    ENCRYPTION_KEY
)

# ============================================================================
# PASSWORD HASHING
# ============================================================================

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    """Hash password for storage"""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash"""
    return pwd_context.verify(plain_password, hashed_password)

# ============================================================================
# JWT TOKEN MANAGEMENT
# ============================================================================

security = HTTPBearer(auto_error=False)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(hours=JWT_ACCESS_TOKEN_EXPIRE_HOURS)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt

def decode_token(token: str) -> dict:
    """Decode JWT token and return payload"""
    return jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])

# ============================================================================
# PASSWORD ENCRYPTION (for storing host credentials)
# ============================================================================

def _get_cipher_suite():
    """Get Fernet cipher suite for password encryption"""
    # Handle key - can be string or bytes
    key = ENCRYPTION_KEY
    if isinstance(key, str):
        key = key.encode()
    return Fernet(key)

cipher_suite = _get_cipher_suite()

def encrypt_password(password: str) -> str:
    """Encrypt password for storage in database"""
    encrypted = cipher_suite.encrypt(password.encode())
    return encrypted.decode()

def decrypt_password(encrypted_password: str) -> str:
    """Decrypt password for use"""
    decrypted = cipher_suite.decrypt(encrypted_password.encode())
    return decrypted.decode()
