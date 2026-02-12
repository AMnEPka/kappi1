"""Authentication API endpoints with refresh token support"""

from fastapi import APIRouter, HTTPException, Depends, status, Request  # pyright: ignore[reportMissingImports]
from typing import Dict, Any
from jose import JWTError  # pyright: ignore[reportMissingModuleSource]

from config.config_init import db, PERMISSIONS, PERMISSION_GROUPS
from config.config_security import (
    verify_password, 
    create_token_pair, 
    create_access_token,
    decode_token,
    is_refresh_token
)
from config.config_settings import JWT_ACCESS_TOKEN_EXPIRE_MINUTES
from config.config_rate_limit import limiter, LOGIN_RATE_LIMIT
from models.auth_models import (
    User, UserResponse, LoginRequest, LoginResponse,
    RefreshToken, RefreshTokenRequest, TokenRefreshResponse
)
from services.services_auth import get_current_user, get_user_permissions
from services.services_sse_tickets import create_sse_ticket
from utils.audit_utils import log_audit
from utils.db_utils import prepare_for_mongo

router = APIRouter()


@router.post("/auth/login", response_model=LoginResponse)
@limiter.limit(LOGIN_RATE_LIMIT)
async def login(request: Request, login_data: LoginRequest):
    """Login and get access + refresh tokens"""
    # Получаем IP клиента
    client_ip = request.client.host if request.client else None
    
    # Получаем User-Agent (информация о браузере/устройстве)
    user_agent = request.headers.get("user-agent")
    
    # Получаем дополнительные заголовки
    forwarded_for = request.headers.get("x-forwarded-for")
    real_ip = request.headers.get("x-real-ip")
    
    # Используем цепочку приоритетов для IP
    final_ip = forwarded_for or real_ip or client_ip
    
    # Find user
    user_doc = await db.users.find_one({"username": login_data.username})
    if not user_doc:
        log_audit(
            "2",
            username=login_data.username,
            details={
                "reason": "user_not_found", 
                "ip_address": final_ip,
                "user_agent": user_agent
            }
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверные имя пользователя или пароль"
        )
    
    user = User(**user_doc)
    
    # Verify password
    if not verify_password(login_data.password, user.password_hash):
        log_audit(
            "2",
            user_id=user.id,
            username=user.username,
            details={
                "reason": "invalid_password", 
                "ip_address": final_ip,
                "user_agent": user_agent
            }
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверные имя пользователя или пароль"
        )
    
    if not user.is_active:
        log_audit(
            "2",
            user_id=user.id,
            username=user.username,
            details={
                "reason": "inactive_user", 
                "ip_address": final_ip,
                "user_agent": user_agent
            }
        )
        raise HTTPException(status_code=400, detail="Пользователь неактивен")
    
    # Create token pair (access + refresh)
    tokens = create_token_pair(user.id)
    
    # Store refresh token in database for tracking/revocation
    refresh_token_doc = RefreshToken(
        user_id=user.id,
        token_id=tokens["refresh_token_id"],
        device_info=user_agent[:255] if user_agent else None,
        ip_address=final_ip,
        expires_at=tokens["refresh_expires_at"]
    )
    await db.refresh_tokens.insert_one(prepare_for_mongo(refresh_token_doc.model_dump()))
    
    # Return token and user data
    user_response = UserResponse(
        id=user.id,
        username=user.username,
        full_name=user.full_name,
        is_active=user.is_active,
        is_admin=user.is_admin,
        created_at=user.created_at,
        created_by=user.created_by
    )
    
    log_audit(
        "1",  # Успешный вход
        user_id=user.id,
        username=user.username,
        details={
            "ip_address": final_ip,
            "user_agent": user_agent
        }
    )
    
    return LoginResponse(
        access_token=tokens["access_token"],
        refresh_token=tokens["refresh_token"],
        token_type="bearer",
        expires_in=JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,  # Convert to seconds
        user=user_response
    )


@router.post("/auth/refresh", response_model=TokenRefreshResponse)
@limiter.limit("10/minute")  # Prevent token refresh abuse
async def refresh_access_token(request: Request, refresh_request: RefreshTokenRequest):
    """Get new access token using refresh token"""
    try:
        payload = decode_token(refresh_request.refresh_token)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Недействительный refresh token"
        )
    
    # Verify it's a refresh token
    if not is_refresh_token(payload):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный тип токена"
        )
    
    user_id = payload.get("sub")
    token_id = payload.get("jti")
    
    if not user_id or not token_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Некорректный токен"
        )
    
    # Check if refresh token exists in database (not revoked)
    stored_token = await db.refresh_tokens.find_one({
        "token_id": token_id,
        "user_id": user_id
    })
    
    if not stored_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Токен отозван или не существует"
        )
    
    # Verify user still exists and is active
    user_doc = await db.users.find_one({"id": user_id})
    if not user_doc:
        # Clean up orphaned refresh token
        await db.refresh_tokens.delete_one({"token_id": token_id})
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Пользователь не найден"
        )
    
    user = User(**user_doc)
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Пользователь деактивирован"
        )
    
    # Create new access token
    new_access_token = create_access_token(data={"sub": user_id})
    
    return TokenRefreshResponse(
        access_token=new_access_token,
        expires_in=JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )


@router.post("/auth/logout")
async def logout(
    request: Request,
    refresh_request: RefreshTokenRequest,
    current_user: User = Depends(get_current_user)
):
    """Logout - invalidate refresh token"""
    try:
        payload = decode_token(refresh_request.refresh_token)
        token_id = payload.get("jti")
        
        if token_id:
            # Remove refresh token from database
            result = await db.refresh_tokens.delete_one({
                "token_id": token_id,
                "user_id": current_user.id
            })
            
            if result.deleted_count > 0:
                log_audit(
                    "3",  # Выход из системы
                    user_id=current_user.id,
                    username=current_user.username,
                    details={"method": "explicit_logout"}
                )
    except JWTError:
        pass  # Token already invalid, that's fine for logout
    
    return {"message": "Выход выполнен успешно"}


@router.post("/auth/logout-all")
async def logout_all_sessions(current_user: User = Depends(get_current_user)):
    """Logout from all sessions - invalidate all refresh tokens for user"""
    result = await db.refresh_tokens.delete_many({"user_id": current_user.id})
    
    log_audit(
        "3",  # Выход из системы
        user_id=current_user.id,
        username=current_user.username,
        details={
            "method": "logout_all_sessions",
            "sessions_terminated": result.deleted_count
        }
    )
    
    return {
        "message": "Выход из всех сессий выполнен",
        "sessions_terminated": result.deleted_count
    }


@router.get("/auth/sessions")
async def get_active_sessions(current_user: User = Depends(get_current_user)):
    """Get list of active sessions (refresh tokens) for current user"""
    sessions = await db.refresh_tokens.find(
        {"user_id": current_user.id},
        {"_id": 0, "token_id": 0}  # Don't expose token_id
    ).to_list(100)
    
    return [{
        "id": s.get("id"),
        "device_info": s.get("device_info"),
        "ip_address": s.get("ip_address"),
        "created_at": s.get("created_at"),
        "expires_at": s.get("expires_at")
    } for s in sessions]


@router.get("/auth/me")
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current user information and permissions"""
    permissions = await get_user_permissions(current_user)
    
    user_response = UserResponse(
        id=current_user.id,
        username=current_user.username,
        full_name=current_user.full_name,
        is_active=current_user.is_active,
        is_admin=current_user.is_admin,
        created_at=current_user.created_at,
        created_by=current_user.created_by
    )
    
    return {
        "user": user_response,
        "permissions": permissions
    }


@router.post("/auth/sse-ticket")
async def create_sse_ticket_endpoint(current_user: User = Depends(get_current_user)):
    """
    Create a short-lived, single-use ticket for SSE connections.

    The client should call this endpoint before opening an EventSource and pass
    the returned ``ticket`` as a query parameter instead of the raw JWT token.
    The ticket expires in 60 seconds and can only be used once.
    """
    ticket = await create_sse_ticket(current_user.id)
    return {"ticket": ticket}


@router.get("/permissions", response_model=Dict[str, Any])
async def get_permissions_list(current_user: User = Depends(get_current_user)):
    """Get all available permissions with descriptions and groups (requires authentication)"""
    return {
        "permissions": PERMISSIONS,
        "groups": PERMISSION_GROUPS
    }
