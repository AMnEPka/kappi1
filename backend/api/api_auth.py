"""Authentication API endpoints"""

from fastapi import APIRouter, HTTPException, Depends, status, Request  # pyright: ignore[reportMissingImports]

from config.config_init import db
from config.config_security import verify_password, create_access_token
from models.auth_models import User, UserResponse, LoginRequest, LoginResponse
from services.services_auth import get_current_user, get_user_permissions
from utils.audit_utils import log_audit

router = APIRouter()


@router.post("/auth/login", response_model=LoginResponse)
async def login(login_data: LoginRequest, request: Request):
    """Login and get JWT token"""
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
    
    # Create access token
    access_token = create_access_token(data={"sub": user.id})
    
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
        "1", # Успешный вход
        user_id=user.id,
        username=user.username,
        details={
            "ip_address": final_ip,
            "user_agent": user_agent
        }
    )
    
    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_response
    )


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
