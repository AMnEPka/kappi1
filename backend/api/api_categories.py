"""Categories and Systems API endpoints"""

from fastapi import APIRouter, HTTPException, Depends  # pyright: ignore[reportMissingImports]
from typing import List, Optional

from config.config_init import db
from models.content_models import Category, CategoryCreate, CategoryUpdate, System, SystemCreate, SystemUpdate
from models.auth_models import User
from services.services_auth import get_current_user, require_permission
from utils.db_utils import prepare_for_mongo, parse_from_mongo
from utils.audit_utils import log_audit

router = APIRouter()


# ============================================================================
# Categories Endpoints
# ============================================================================

@router.post("/categories", response_model=Category)
async def create_category(category_input: CategoryCreate, current_user: User = Depends(get_current_user)):
    """Create new category (requires categories_manage permission)"""
    await require_permission(current_user, 'categories_manage')
    
    category_obj = Category(**category_input.model_dump(), created_by=current_user.id)
    doc = prepare_for_mongo(category_obj.model_dump())
    
    await db.categories.insert_one(doc)
    
    # Логирование создания категории
    log_audit(
        "9",  # Создание категории
        user_id=current_user.id,
        username=current_user.username,
        details={
            "category_name": category_input.name
        }
    )
    
    return category_obj


@router.get("/categories", response_model=List[Category])
async def get_categories(current_user: User = Depends(get_current_user)):
    """Get all categories"""
    categories = await db.categories.find({}, {"_id": 0}).to_list(1000)
    return [Category(**parse_from_mongo(cat)) for cat in categories]


@router.get("/categories/{category_id}", response_model=Category)
async def get_category(category_id: str, current_user: User = Depends(get_current_user)):
    """Get category by ID"""
    category = await db.categories.find_one({"id": category_id}, {"_id": 0})
    if not category:
        raise HTTPException(status_code=404, detail="Категория не найдена")
    return Category(**parse_from_mongo(category))


@router.put("/categories/{category_id}", response_model=Category)
async def update_category(category_id: str, category_update: CategoryUpdate, current_user: User = Depends(get_current_user)):
    """Update category (requires categories_manage permission)"""
    await require_permission(current_user, 'categories_manage')
    
    # Находим текущую категорию для логирования
    current_cat = await db.categories.find_one({"id": category_id})
    if not current_cat:
        raise HTTPException(status_code=404, detail="Категория не найдена")
    
    update_data = category_update.model_dump(exclude_unset=True)
    
    if not update_data:
        raise HTTPException(status_code=400, detail="Нет данных для обновления")
    
    result = await db.categories.update_one(
        {"id": category_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Категория не найдена")
    
    # Логирование обновления категории
    log_audit(
        "10",  # Редактирование категории
        user_id=current_user.id,
        username=current_user.username,
        details={
            "category_name": current_cat.get('name')
        }
    )
    
    updated_cat = await db.categories.find_one({"id": category_id}, {"_id": 0})
    return Category(**parse_from_mongo(updated_cat))


@router.delete("/categories/{category_id}")
async def delete_category(category_id: str, current_user: User = Depends(get_current_user)):
    """Delete category (requires categories_manage permission)"""
    await require_permission(current_user, 'categories_manage')
    
    # Находим категорию для логирования
    category = await db.categories.find_one({"id": category_id})
    if not category:
        raise HTTPException(status_code=404, detail="Категория не найдена")
    
    # Проверяем связанные системы
    systems_count = await db.systems.count_documents({"category_id": category_id})
    if systems_count > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"Невозможно удалить категорию. С ней связано {systems_count} систем. Сначала удалите или переместите системы."
        )
    
    # Delete category
    result = await db.categories.delete_one({"id": category_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Категория не найдена")
    
    # Логирование удаления категории
    log_audit(
        "11",  # Удаление категории
        user_id=current_user.id,
        username=current_user.username,
        details={
            "category_name": category.get('name')
        }
    )
    
    return {"message": "Категория удалена"}


# ============================================================================
# Systems Endpoints
# ============================================================================

@router.post("/categories/{category_id}/systems", response_model=System)
async def create_system(category_id: str, system_input: SystemCreate, current_user: User = Depends(get_current_user)):
    """Create new system (requires categories_manage permission)"""
    await require_permission(current_user, 'categories_manage')
    
    # Verify category exists
    category = await db.categories.find_one({"id": category_id})
    if not category:
        raise HTTPException(status_code=404, detail="Категория не найдена")
    
    system_obj = System(**system_input.model_dump(), created_by=current_user.id)
    doc = prepare_for_mongo(system_obj.model_dump())
    
    await db.systems.insert_one(doc)
    
    # Логирование создания системы
    log_audit(
        "12",  # Создание системы
        user_id=current_user.id,
        username=current_user.username,
        details={
            "system_name": system_input.name,
            "category_name": category.get('name')
        }
    )
    
    return system_obj


@router.get("/categories/{category_id}/systems", response_model=List[System])
async def get_systems(category_id: str, current_user: User = Depends(get_current_user)):
    """Get systems for category"""
    systems = await db.systems.find({"category_id": category_id}, {"_id": 0}).to_list(1000)
    return [System(**parse_from_mongo(sys)) for sys in systems]


@router.get("/systems", response_model=List[System])
async def get_all_systems(category_id: Optional[str] = None, current_user: User = Depends(get_current_user)):
    """Get all systems, optionally filtered by category"""
    query = {}
    if category_id:
        query["category_id"] = category_id
    systems = await db.systems.find(query, {"_id": 0}).to_list(1000)
    return [System(**parse_from_mongo(sys)) for sys in systems]


@router.get("/systems/{system_id}", response_model=System)
async def get_system(system_id: str, current_user: User = Depends(get_current_user)):
    """Get system by ID"""
    system = await db.systems.find_one({"id": system_id}, {"_id": 0})
    if not system:
        raise HTTPException(status_code=404, detail="Система не найдена")
    return System(**parse_from_mongo(system))


@router.put("/systems/{system_id}", response_model=System)
async def update_system(system_id: str, system_update: SystemUpdate, current_user: User = Depends(get_current_user)):
    """Update system (requires categories_manage permission)"""
    await require_permission(current_user, 'categories_manage')
    
    update_data = system_update.model_dump(exclude_unset=True)
    
    if not update_data:
        raise HTTPException(status_code=400, detail="Нет данных для обновления")
    
    # Get current system data for logging
    current_system = await db.systems.find_one({"id": system_id})
    if not current_system:
        raise HTTPException(status_code=404, detail="Система не найдена")
    
    # If category_id is being updated, verify it exists and get the new category
    # Otherwise, get the current category for logging
    if 'category_id' in update_data:
        category = await db.categories.find_one({"id": update_data['category_id']})
        if not category:
            raise HTTPException(status_code=404, detail="Категория не найдена")
    else:
        # Get current category for logging when category_id is not being updated
        category = await db.categories.find_one({"id": current_system.get('category_id')})
        if not category:
            raise HTTPException(status_code=404, detail="Категория не найдена")
    
    result = await db.systems.update_one(
        {"id": system_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Система не найдена")
    
    # Логирование редактирования системы
    log_audit(
        "13",  # Редактирование системы
        user_id=current_user.id,
        username=current_user.username,
        details={
            "system_name": current_system.get('name'),
            "category_name": category.get('name')
        }
    )
    
    updated_system = await db.systems.find_one({"id": system_id}, {"_id": 0})
    return System(**parse_from_mongo(updated_system))


@router.delete("/systems/{system_id}")
async def delete_system(system_id: str, current_user: User = Depends(get_current_user)):
    """Delete system (requires categories_manage permission)"""
    await require_permission(current_user, 'categories_manage')

    # Check if system exists
    system = await db.systems.find_one({"id": system_id})
    if not system:
        raise HTTPException(status_code=404, detail="Система не найдена")
    
    # Check if there are related checks
    related_checks = await db.scripts.find_one({"system_id": system_id})
    if related_checks:
        raise HTTPException(
            status_code=400, 
            detail="Невозможно удалить систему: существуют связанные проверки"
        )
    
    result = await db.systems.delete_one({"id": system_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Система не найдена")
    
    # Логирование удаления системы
    log_audit(
        "14",  # Удаление системы
        user_id=current_user.id,
        username=current_user.username,
        details={
            "system_name": system.get('name')
        }
    )
    
    return {"message": "Система удалена"}
