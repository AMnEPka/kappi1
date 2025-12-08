"""Users and Roles API endpoints"""

from fastapi import APIRouter, HTTPException, Depends  # pyright: ignore[reportMissingImports]
from typing import List

from config.config_init import db
from config.config_security import hash_password
from models.auth_models import User, UserResponse, UserCreate, UserUpdate, Role, RoleCreate, RoleUpdate, PasswordResetRequest
from services.services_auth import get_current_user, require_permission
from utils.db_utils import prepare_for_mongo
from utils.audit_utils import log_audit

router = APIRouter()


# ============================================================================
# User Management
# ============================================================================

@router.get("/users", response_model=List[UserResponse])
async def get_users(current_user: User = Depends(get_current_user)):
    """Get all users (requires users_manage permission)"""
    await require_permission(current_user, 'users_manage', 'users_view')
    
    users = await db.users.find().to_list(length=None)
    return [UserResponse(**user) for user in users]


@router.post("/users", response_model=UserResponse)
async def create_user(user_input: UserCreate, current_user: User = Depends(get_current_user)):
    """Create new user (requires users_manage permission)"""
    await require_permission(current_user, 'users_manage')
    
    # Check if username already exists
    existing = await db.users.find_one({"username": user_input.username})
    if existing:
        raise HTTPException(status_code=400, detail="Пользователь с таким логином уже существует")
    
    # Create user
    user = User(
        username=user_input.username,
        full_name=user_input.full_name,
        password_hash=hash_password(user_input.password),
        is_admin=user_input.is_admin,
        created_by=current_user.id
    )
    
    doc = prepare_for_mongo(user.model_dump())
    await db.users.insert_one(doc)
    
    # Логирование создания пользователя
    log_audit(
        "3",  # Создание пользователя
        user_id=current_user.id,
        username=current_user.username,
        details={
            "username": user_input.username,
            "target_full_name": user_input.full_name
        }
    )
    
    return UserResponse(**user.model_dump())


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(user_id: str, user_update: UserUpdate, current_user: User = Depends(get_current_user)):
    """Update user (requires users_manage permission)"""
    await require_permission(current_user, 'users_manage')
    
    # Find user
    user_doc = await db.users.find_one({"id": user_id})
    if not user_doc:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    old_user = User(**user_doc)
    
    # Подготовка данных для логирования изменений
    changed_fields = {}
    update_data = {}
    
    for field, new_value in user_update.model_dump().items():
        if new_value is not None:
            old_value = getattr(old_user, field, None)
            if old_value != new_value:
                changed_fields[field] = {
                    "old": old_value,
                    "new": new_value
                }
                update_data[field] = new_value
    
    # Update fields
    if update_data:
        await db.users.update_one({"id": user_id}, {"$set": update_data})
    
    # Логирование обновления пользователя
    if changed_fields:
        log_audit(
            "4",  # Редактирование пользователя
            user_id=current_user.id,
            username=current_user.username,
            details={
                "username": old_user.username,
                "target_full_name": old_user.full_name
            }
        )
    
    # Return updated user
    updated_doc = await db.users.find_one({"id": user_id})
    return UserResponse(**updated_doc)


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: User = Depends(get_current_user)):
    """Delete user and reassign their data to admin (requires users_manage permission)"""
    await require_permission(current_user, 'users_manage')
    
    # Check if user exists
    user_doc = await db.users.find_one({"id": user_id})
    if not user_doc:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    user = User(**user_doc)
    
    # Cannot delete self
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Вы не можете удалить свою учетную запись")
    
    # Find admin user to reassign data
    admin_user = await db.users.find_one({"is_admin": True})
    if not admin_user:
        raise HTTPException(status_code=500, detail="Вы не можете удалить единственного администратора")
    
    admin_id = admin_user['id']
    
    # Reassign data to admin
    await db.hosts.update_many({"created_by": user_id}, {"$set": {"created_by": admin_id}})
    await db.categories.update_many({"created_by": user_id}, {"$set": {"created_by": admin_id}})
    await db.systems.update_many({"created_by": user_id}, {"$set": {"created_by": admin_id}})
    await db.scripts.update_many({"created_by": user_id}, {"$set": {"created_by": admin_id}})
    await db.projects.update_many({"created_by": user_id}, {"$set": {"created_by": admin_id}})
    
    # Delete user
    await db.users.delete_one({"id": user_id})
    
    # Delete user role associations
    await db.user_roles.delete_many({"user_id": user_id})
    
    # Delete project access records
    await db.project_access.delete_many({"user_id": user_id})
    
    # Логирование удаления пользователя
    log_audit(
        "5",  # Удаление пользователя
        user_id=current_user.id,
        username=current_user.username,
        details={
            "deleted_username": user.username,
            "deleted_full_name": user.full_name,
            "data_reassigned_to": admin_id
        }
    )
    
    return {"message": "User deleted and data reassigned to admin"}


@router.put("/users/{user_id}/password")
async def change_user_password(user_id: str, password_data: PasswordResetRequest, current_user: User = Depends(get_current_user)):
    """Change user password (requires users_manage permission)"""
    await require_permission(current_user, 'users_manage')
    
    # Find user
    user_doc = await db.users.find_one({"id": user_id})
    if not user_doc:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    user = User(**user_doc)
    
    # Update password
    new_password_hash = hash_password(password_data.new_password)
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"password_hash": new_password_hash}}
    )
    
    # Логирование смены пароля
    log_audit(
        "4",  # Смена пароля
        user_id=current_user.id,
        username=current_user.username,
        details={
            "target_username": user.username
        }
    )
    
    return {"message": "Password updated successfully"}


@router.get("/users/{user_id}/roles")
async def get_user_roles(user_id: str, current_user: User = Depends(get_current_user)):
    """Get user's roles (requires users_view permission)"""
    await require_permission(current_user, 'users_view')
    
    # Get user role associations
    user_roles = await db.user_roles.find({"user_id": user_id}).to_list(length=None)
    role_ids = [ur['role_id'] for ur in user_roles]
    
    # Get role details
    roles = await db.roles.find({"id": {"$in": role_ids}}).to_list(length=None) if role_ids else []
    
    return [Role(**role) for role in roles]


@router.put("/users/{user_id}/roles")
async def update_user_roles(user_id: str, role_ids: List[str], current_user: User = Depends(get_current_user)):
    """Update user's roles (requires users_manage permission)"""
    await require_permission(current_user, 'users_manage')
    
    # Verify user exists
    user_doc = await db.users.find_one({"id": user_id})
    if not user_doc:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    # Verify all roles exist
    for role_id in role_ids:
        role = await db.roles.find_one({"id": role_id})
        if not role:
            raise HTTPException(status_code=404, detail=f"Роль '{role_id}' не найдена")
    
    # Delete existing role associations
    await db.user_roles.delete_many({"user_id": user_id})
    
    # Create new associations
    for role_id in role_ids:
        doc = {
            "user_id": user_id,
            "role_id": role_id
        }
        await db.user_roles.insert_one(doc)
    
    # Логирование изменения ролей пользователя
    log_audit(
        "7",  # Изменение ролей пользователя
        user_id=current_user.id,
        username=current_user.username,
        details={
            "target_username": user_doc.get('username')
        }
    )
    
    return {"message": "User roles updated", "role_ids": role_ids}


# ============================================================================
# Role Management
# ============================================================================

@router.get("/roles", response_model=List[Role])
async def get_roles(current_user: User = Depends(get_current_user)):
    """Get all roles"""
    await require_permission(current_user, 'users_view')
    
    roles = await db.roles.find().to_list(length=None)
    return [Role(**role) for role in roles]


@router.post("/roles", response_model=Role)
async def create_role(role_input: RoleCreate, current_user: User = Depends(get_current_user)):
    """Create new role (requires users_manage permission)"""
    await require_permission(current_user, 'users_manage')
    
    # Check if role name already exists
    existing = await db.roles.find_one({"name": role_input.name})
    if existing:
        raise HTTPException(status_code=400, detail="Роль с таким название уже существует")
    
    # Create role
    role = Role(
        name=role_input.name,
        description=role_input.description,
        permissions=role_input.permissions,
        created_by=current_user.id
    )
    
    doc = prepare_for_mongo(role.model_dump())
    await db.roles.insert_one(doc)
    
    # Логирование создания роли
    log_audit(
        "6", # Создание роли
        user_id=current_user.id,
        username=current_user.username,
        details={
            "role_name": role.name
        }
    )
    
    return role


@router.put("/roles/{role_id}", response_model=Role)
async def update_role(role_id: str, role_update: RoleUpdate, current_user: User = Depends(get_current_user)):
    """Update role (requires users_manage permission)"""
    await require_permission(current_user, 'users_manage')
    
    # Find role
    role_doc = await db.roles.find_one({"id": role_id})
    if not role_doc:
        raise HTTPException(status_code=404, detail="Роль не найдена")
    
    # Build update data
    update_data = {}
    if role_update.name is not None:
        # Check if new name already exists
        existing = await db.roles.find_one({"name": role_update.name, "id": {"$ne": role_id}})
        if existing:
            raise HTTPException(status_code=400, detail="Роль с таким именем уже существует")
        update_data["name"] = role_update.name
    
    if role_update.description is not None:
        update_data["description"] = role_update.description
    
    if role_update.permissions is not None:
        update_data["permissions"] = role_update.permissions
    
    # Update role
    if update_data:
        await db.roles.update_one({"id": role_id}, {"$set": update_data})
    
    # Get updated role
    updated_role = await db.roles.find_one({"id": role_id})
    
    # Логирование обновления роли
    log_audit(
        "26",  # Редактирование роли
        user_id=current_user.id,
        username=current_user.username,
        details={
            "role_id": role_id,
            "role_name": updated_role.get('name'),
            "updated_by": current_user.username
        }
    )
    
    return Role(**updated_role)


@router.delete("/roles/{role_id}")
async def delete_role(role_id: str, current_user: User = Depends(get_current_user)):
    """Delete role (requires users_manage permission)"""
    await require_permission(current_user, 'users_manage')
    
    # Find role
    role_doc = await db.roles.find_one({"id": role_id})
    if not role_doc:
        raise HTTPException(status_code=404, detail="Роль не найдена")
    
    # Check if role is assigned to any users
    user_roles = await db.user_roles.find_one({"role_id": role_id})
    if user_roles:
        raise HTTPException(
            status_code=400,
            detail="Существуют пользователи, которым назначена эта роль, поэтому удаление отменено"
        )
    
    # Delete role
    await db.roles.delete_one({"id": role_id})
    
    # Логирование удаления роли
    log_audit(
        "8",  # Удаление роли
        user_id=current_user.id,
        username=current_user.username,
        details={
            "role_name": role_doc.get('name')
        }
    )
    
    return {"message": "Role deleted successfully"}
