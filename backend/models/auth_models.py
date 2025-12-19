"""
models/auth_models.py
Pydantic models for authentication and user management
"""

from pydantic import BaseModel, Field, ConfigDict # pyright: ignore[reportMissingImports]
from typing import List, Optional
from datetime import datetime, timezone
import uuid


class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    full_name: str
    password_hash: str
    is_active: bool = True
    is_admin: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None


class UserCreate(BaseModel):
    username: str
    full_name: str
    password: str
    is_admin: bool = False


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    is_active: Optional[bool] = None
    is_admin: Optional[bool] = None


class UserResponse(BaseModel):
    """User response without password hash"""
    id: str
    username: str
    full_name: str
    is_active: bool
    is_admin: bool
    created_at: datetime
    created_by: Optional[str] = None


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    expires_in: int  # Access token expiration in seconds
    user: UserResponse


class RefreshToken(BaseModel):
    """Stored refresh token for tracking active sessions"""
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    token_id: str  # jti from JWT - for revocation
    device_info: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime


class RefreshTokenRequest(BaseModel):
    """Request to refresh access token"""
    refresh_token: str


class TokenRefreshResponse(BaseModel):
    """Response with new access token"""
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


class Role(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    permissions: List[str]
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None


class RoleCreate(BaseModel):
    name: str
    permissions: List[str]
    description: Optional[str] = None


class RoleUpdate(BaseModel):
    name: Optional[str] = None
    permissions: Optional[List[str]] = None
    description: Optional[str] = None


class UserRole(BaseModel):
    """Many-to-many relationship between users and roles"""
    model_config = ConfigDict(extra="ignore")
    
    user_id: str
    role_id: str


class PasswordResetRequest(BaseModel):
    new_password: str
