"""
config/security.py
Security configuration: JWT, password hashing, encryption, and HTTP bearer
"""

from passlib.context import CryptContext   # pyright: ignore[reportMissingModuleSource]
from fastapi.security import HTTPBearer # pyright: ignore[reportMissingImports]
from jose import jwt # pyright: ignore[reportMissingModuleSource]
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple
from cryptography.fernet import Fernet
import base64
import uuid
from config.config_settings import (   # pyright: ignore[reportMissingImports]
    JWT_SECRET_KEY,
    JWT_ALGORITHM,
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES,
    JWT_REFRESH_TOKEN_EXPIRE_DAYS,
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
    """Create JWT access token (short-lived)"""
    to_encode = data.copy()
    to_encode["type"] = "access"
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt


def create_refresh_token(user_id: str) -> Tuple[str, str, datetime]:
    """
    Create JWT refresh token (long-lived).
    
    Returns:
        Tuple of (token, token_id, expires_at)
    """
    token_id = str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(days=JWT_REFRESH_TOKEN_EXPIRE_DAYS)
    
    to_encode = {
        "sub": user_id,
        "type": "refresh",
        "jti": token_id,  # JWT ID for revocation
        "exp": expires_at
    }
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt, token_id, expires_at


def create_token_pair(user_id: str) -> dict:
    """
    Create access + refresh token pair.
    
    Returns:
        Dict with access_token, refresh_token, refresh_token_id, refresh_expires_at
    """
    access_token = create_access_token(data={"sub": user_id})
    refresh_token, token_id, expires_at = create_refresh_token(user_id)
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "refresh_token_id": token_id,
        "refresh_expires_at": expires_at
    }


def decode_token(token: str) -> dict:
    """Decode JWT token and return payload"""
    return jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])


def is_refresh_token(payload: dict) -> bool:
    """Check if token payload is a refresh token"""
    return payload.get("type") == "refresh"


def is_access_token(payload: dict) -> bool:
    """Check if token payload is an access token"""
    return payload.get("type") == "access"

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
