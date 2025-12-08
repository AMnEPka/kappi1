"""Scripts API endpoints"""

from fastapi import APIRouter, HTTPException, Depends  # pyright: ignore[reportMissingImports]
from typing import Optional

from config.config_init import db
from models.content_models import Script, ScriptCreate, ScriptUpdate
from models.auth_models import User
from services.services_auth import get_current_user, has_permission, require_permission
from utils.db_utils import prepare_for_mongo, parse_from_mongo
from utils.audit_utils import log_audit

router = APIRouter()


@router.post("/systems/{system_id}/scripts", response_model=Script)
async def create_script(system_id: str, script_input: ScriptCreate, current_user: User = Depends(get_current_user)):
    """Create new script (requires checks_create permission)"""
    await require_permission(current_user, 'checks_create')
    
    # Verify system exists
    system = await db.systems.find_one({"id": system_id})
    if not system:
        raise HTTPException(status_code=404, detail="Система не найдена")
    
    script_obj = Script(**script_input.model_dump(), created_by=current_user.id)
    doc = prepare_for_mongo(script_obj.model_dump())
    
    await db.scripts.insert_one(doc)
    
    # Логирование создания проверки
    log_audit(
        "18",
        user_id=current_user.id,
        username=current_user.username,
        details={
            "script_name": script_obj.name,
            "system_name": system.get('name'),
            "category_name": system.get('category_name')
        }
    )
    return script_obj


@router.get("/scripts")
async def get_scripts(system_id: Optional[str] = None, category_id: Optional[str] = None, current_user: User = Depends(get_current_user)):
    """Get all scripts with filtering options (filtered by permissions)"""
    query = {}
    
    if system_id:
        query["system_id"] = system_id
    elif category_id:
        # Find all systems in this category
        systems = await db.systems.find({"category_id": category_id}, {"_id": 0}).to_list(1000)
        system_ids = [sys["id"] for sys in systems]
        query["system_id"] = {"$in": system_ids}
    
    # Filter by permissions
    # If user can edit all scripts OR can work with projects, show all scripts
    if not (await has_permission(current_user, 'checks_edit_all') or 
            await has_permission(current_user, 'projects_create') or 
            await has_permission(current_user, 'projects_execute') or
            await has_permission(current_user, 'results_view_all')):
        # Show only own scripts
        query["created_by"] = current_user.id
    
    scripts = await db.scripts.find(query, {"_id": 0}).sort("order", 1).to_list(1000)
    
    # Enrich with system and category info
    enriched_scripts = []
    for script in scripts:
        script_data = parse_from_mongo(script)
        
        # Check if script has system_id (old scripts might not have it)
        if "system_id" not in script_data or not script_data["system_id"]:
            # Skip old scripts without system_id or add default values
            script_data["system_name"] = "Не назначена"
            script_data["system_os_type"] = "linux"
            script_data["category_name"] = "Без категории"
            script_data["category_icon"] = "❓"
            enriched_scripts.append(script_data)
            continue
        
        # Get system info
        system = await db.systems.find_one({"id": script_data["system_id"]}, {"_id": 0})
        if system:
            script_data["system_name"] = system["name"]
            script_data["system_os_type"] = system["os_type"]
            
            # Get category info
            category = await db.categories.find_one({"id": system["category_id"]}, {"_id": 0})
            if category:
                script_data["category_name"] = category["name"]
                script_data["category_icon"] = category.get("icon", "📁")
        else:
            # System not found
            script_data["system_name"] = "Система удалена"
            script_data["system_os_type"] = "linux"
            script_data["category_name"] = "Без категории"
            script_data["category_icon"] = "❓"
        
        enriched_scripts.append(script_data)
    
    return enriched_scripts


@router.get("/scripts/{script_id}", response_model=Script)
async def get_script(script_id: str, current_user: User = Depends(get_current_user)):
    """Get script by ID"""
    script = await db.scripts.find_one({"id": script_id}, {"_id": 0})
    if not script:
        raise HTTPException(status_code=404, detail="Скрипт не найден")
    
    # Check access
    if not await has_permission(current_user, 'checks_edit_all'):
        if script.get('created_by') != current_user.id:
            raise HTTPException(status_code=403, detail="Нет доступа к скрипту")
    
    return Script(**parse_from_mongo(script))


@router.post("/scripts", response_model=Script)
async def create_script_alt(script_input: ScriptCreate, current_user: User = Depends(get_current_user)):
    """Create new script - alternative endpoint (requires checks_create permission)"""
    await require_permission(current_user, 'checks_create')
    
    # Verify system exists
    if script_input.system_id:
        system = await db.systems.find_one({"id": script_input.system_id})
        if not system:
            raise HTTPException(status_code=404, detail="Система не найдена")
    
    # Get category name
    category_name = ""
    if system.get('category_id'):
        category = await db.categories.find_one({"id": system['category_id']})
        if category:
            category_name = category.get('name', '')
    
    script_obj = Script(**script_input.model_dump(), created_by=current_user.id)
    doc = prepare_for_mongo(script_obj.model_dump())
    
    await db.scripts.insert_one(doc)

    log_audit(
        "18",
        user_id=current_user.id,
        username=current_user.username,
        details={
            "script_name": script_obj.name,
            "system_name": system.get('name'),
            "category_name": category_name
        }
    )

    return script_obj


@router.put("/scripts/{script_id}", response_model=Script)
async def update_script(script_id: str, script_update: ScriptUpdate, current_user: User = Depends(get_current_user)):
    """Update script (requires checks_edit_own or checks_edit_all permission)"""
    script = await db.scripts.find_one({"id": script_id})
    if not script:
        raise HTTPException(status_code=404, detail="Скрипт не найден")
    
    # Check permissions
    is_owner = script.get('created_by') == current_user.id
    if is_owner:
        await require_permission(current_user, 'checks_edit_own')
    else:
        await require_permission(current_user, 'checks_edit_all')
    
    update_data = script_update.model_dump(exclude_unset=True)
    
    if not update_data:
        raise HTTPException(status_code=400, detail="Нет данных для обновления")
    
    # Get system and category names for logging
    system_name = ""
    category_name = ""
    if script.get('system_id'):
        system = await db.systems.find_one({"id": script['system_id']})
        if system:
            system_name = system.get('name', '')
            # Get category name
            if system.get('category_id'):
                category = await db.categories.find_one({"id": system['category_id']})
                if category:
                    category_name = category.get('name', '')
    
    result = await db.scripts.update_one(
        {"id": script_id},
        {"$set": update_data}
    )
    
    updated_script = await db.scripts.find_one({"id": script_id}, {"_id": 0})
    
    log_audit(
        "19",
        user_id=current_user.id,
        username=current_user.username,
        details={
            "script_name": script.get('name'),
            "system_name": system_name,
            "category_name": category_name
        }
    )
    return Script(**parse_from_mongo(updated_script))


@router.delete("/scripts/{script_id}")
async def delete_script(script_id: str, current_user: User = Depends(get_current_user)):
    """Delete script (requires checks_delete_own or checks_delete_all permission)"""
    script = await db.scripts.find_one({"id": script_id})
    if not script:
        raise HTTPException(status_code=404, detail="Скрипт не найден")
    
    # Check permissions
    is_owner = script.get('created_by') == current_user.id
    if is_owner:
        await require_permission(current_user, 'checks_delete_own')
    else:
        await require_permission(current_user, 'checks_delete_all')
    
    # Get system and category names for logging
    system_name = ""
    category_name = ""
    if script.get('system_id'):
        system = await db.systems.find_one({"id": script['system_id']})
        if system:
            system_name = system.get('name', '')
            # Get category name
            if system.get('category_id'):
                category = await db.categories.find_one({"id": system['category_id']})
                if category:
                    category_name = category.get('name', '')
    
    result = await db.scripts.delete_one({"id": script_id})
    
    log_audit(
        "20",
        user_id=current_user.id,
        username=current_user.username,
        details={
            "script_name": script.get('name'),
            "system_name": system_name,
            "category_name": category_name
        }
    )
    
    return {"message": "Скрипт удален"}
