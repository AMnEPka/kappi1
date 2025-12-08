"""
services/auth.py
Authentication and authorization services
"""

from typing import List, Optional
from fastapi import HTTPException, Depends, status, Query  # pyright: ignore[reportMissingImports]
from fastapi.security import HTTPAuthorizationCredentials # pyright: ignore[reportMissingImports]

from config.config_init import security, decode_token, logger, db
from models.models_init import User

async def get_current_user_from_token(token: str) -> User:
    """
    Get current user from JWT token string (for query parameter auth in SSE)
    """
    try:
        payload = decode_token(token)
        user_id: str = payload.get("sub")
        
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Ошибка авторизации",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Get user from database
        user_doc = await db.users.find_one({"id": user_id})
        if not user_doc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Пользователь не найден",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        return User(**user_doc)
        
    except Exception as e:
        logger.error(f"Authentication error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Ошибка авторизации",
            headers={"WWW-Authenticate": "Bearer"},
        )

async def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> User:
    """
    Dependency to get current user from JWT token
    """
    # Handle case when no credentials provided (auto_error=False in security)
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Требуется авторизация",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        token = credentials.credentials
        payload = decode_token(token)
        user_id: str = payload.get("sub")
        
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Неверный токен авторизации",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Get user from database
        user_doc = await db.users.find_one({"id": user_id})
        if not user_doc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Пользователь не найден",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        return User(**user_doc)
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        logger.error(f"Authentication error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Ошибка авторизации",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_user_permissions(user: User) -> List[str]:
    """
    Get all permissions for a user from their roles
    """
    if user.is_admin:
        # Admin has all permissions
        all_roles = await db.roles.find().to_list(None)
        permissions = set()
        for role in all_roles:
            permissions.update(role.get("permissions", []))
        return list(permissions)
    
    # Get user's roles
    user_roles = await db.user_roles.find({"user_id": user.id}).to_list(None)
    role_ids = [ur["role_id"] for ur in user_roles]
    
    if not role_ids:
        return []
    
    # Get permissions from roles
    roles = await db.roles.find({"id": {"$in": role_ids}}).to_list(None)
    permissions = set()
    for role in roles:
        permissions.update(role.get("permissions", []))
    
    return list(permissions)


async def has_permission(user: User, permission: str) -> bool:
    """
    Check if user has specific permission
    """
    permissions = await get_user_permissions(user)
    return permission in permissions


async def require_permission(user: User, *permissions: str) -> None:
    """
    Require one or more permissions, raise 403 if not authorized
    """
    user_permissions = await get_user_permissions(user)
    
    # Check if user has at least one of the required permissions
    if not any(perm in user_permissions for perm in permissions):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Недостаточно прав. Требуемые права: {', '.join(permissions)}"
        )


async def can_access_project(user: User, project_id: str) -> bool:
    """
    Check if user can access a specific project
    """
    if user.is_admin:
        return True
    
    # Check if user is project creator
    project = await db.projects.find_one({"id": project_id})
    if project and project.get("created_by") == user.id:
        return True
    
    # Check if project is shared with user
    access = await db.project_access.find_one({
        "project_id": project_id,
        "user_id": user.id
    })
    
    return access is not None
