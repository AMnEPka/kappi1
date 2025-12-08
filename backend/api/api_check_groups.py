"""Check Groups API endpoints"""

from fastapi import APIRouter, HTTPException, Depends  # pyright: ignore[reportMissingImports]
from typing import List

from config.config_init import db
from models.content_models import CheckGroup, CheckGroupCreate, CheckGroupUpdate
from models.auth_models import User
from services.services_auth import get_current_user, require_permission
from utils.db_utils import prepare_for_mongo, parse_from_mongo
from utils.audit_utils import log_audit

router = APIRouter()


@router.post("/check-groups", response_model=CheckGroup)
async def create_check_group(group_input: CheckGroupCreate, current_user: User = Depends(get_current_user)):
    """Create new check group (requires checks_create permission)"""
    await require_permission(current_user, 'checks_create')
    
    group_obj = CheckGroup(**group_input.model_dump(), created_by=current_user.id)
    doc = prepare_for_mongo(group_obj.model_dump())
    
    await db.check_groups.insert_one(doc)
    
    log_audit(
        "22",  # Создание группы проверок
        user_id=current_user.id,
        username=current_user.username,
        details={
            "group_name": group_input.name
        }
    )
    
    return group_obj


@router.get("/check-groups", response_model=List[CheckGroup])
async def get_check_groups(current_user: User = Depends(get_current_user)):
    """Get all check groups"""
    groups = await db.check_groups.find({}, {"_id": 0}).sort("name", 1).to_list(1000)
    return [CheckGroup(**parse_from_mongo(group)) for group in groups]


@router.get("/check-groups/{group_id}", response_model=CheckGroup)
async def get_check_group(group_id: str, current_user: User = Depends(get_current_user)):
    """Get check group by ID"""
    group = await db.check_groups.find_one({"id": group_id}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Группа проверок не найдена")
    return CheckGroup(**parse_from_mongo(group))


@router.put("/check-groups/{group_id}", response_model=CheckGroup)
async def update_check_group(group_id: str, group_update: CheckGroupUpdate, current_user: User = Depends(get_current_user)):
    """Update check group (requires checks_create permission)"""
    await require_permission(current_user, 'checks_create')
    
    update_data = group_update.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="Нет данных для обновления")
    
    result = await db.check_groups.update_one(
        {"id": group_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Группа проверок не найдена")
    
    updated_group = await db.check_groups.find_one({"id": group_id}, {"_id": 0})
    
    log_audit(
        "23",  # Обновление группы проверок
        user_id=current_user.id,
        username=current_user.username,
        details={
            "group_name": updated_group.get('name')
        }
    )
    
    return CheckGroup(**parse_from_mongo(updated_group))


@router.delete("/check-groups/{group_id}")
async def delete_check_group(group_id: str, current_user: User = Depends(get_current_user)):
    """Delete check group (requires checks_create permission)"""
    await require_permission(current_user, 'checks_create')
    
    group = await db.check_groups.find_one({"id": group_id})
    if not group:
        raise HTTPException(status_code=404, detail="Группа проверок не найдена")
    
    # Remove group_id from all scripts that reference it
    await db.scripts.update_many(
        {"group_ids": group_id},
        {"$pull": {"group_ids": group_id}}
    )
    
    result = await db.check_groups.delete_one({"id": group_id})
    
    log_audit(
        "24",  # Удаление группы проверок
        user_id=current_user.id,
        username=current_user.username,
        details={
            "group_name": group.get('name')
        }
    )
    
    return {"message": "Группа проверок удалена"}

