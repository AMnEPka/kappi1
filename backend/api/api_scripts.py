"""Scripts API endpoints"""

from fastapi import APIRouter, HTTPException, Depends, Query, Request  # pyright: ignore[reportMissingImports]
from typing import Optional

from config.config_init import db
from models.content_models import Script, ScriptCreate, ScriptUpdate
from models.auth_models import User
from services.services_auth import get_current_user, has_permission, require_permission
from utils.db_utils import (
    prepare_for_mongo, 
    parse_from_mongo, 
    encode_script_for_storage, 
    decode_script_from_storage,
    prepare_processor_script_version_update
)
from datetime import datetime, timezone
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
    script_dict = script_obj.model_dump()
    
    # Если есть processor_script, создаем первую версию
    if script_dict.get('processor_script'):
        processor_script = script_dict.pop('processor_script')
        processor_comment = script_dict.pop('processor_script_comment', None) or 'Первая версия'
        script_dict['processor_script_version'] = {
            'content': processor_script,
            'version_number': 1,
            'comment': processor_comment,
            'created_at': datetime.now(timezone.utc),
            'created_by': current_user.id
        }
        script_dict['processor_script_versions'] = []
    
    # Encode script content and processor_script to Base64 before storing
    script_dict = encode_script_for_storage(script_dict)
    doc = prepare_for_mongo(script_dict)
    
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
        # Decode script content and processor_script from Base64
        script_data = decode_script_from_storage(script_data)
        
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
    
    script_data = parse_from_mongo(script)
    # Decode script content and processor_script from Base64
    script_data = decode_script_from_storage(script_data)
    return Script(**script_data)


@router.post("/scripts", response_model=Script)
async def create_script_alt(script_input: ScriptCreate, current_user: User = Depends(get_current_user)):
    """Create new script - alternative endpoint (requires checks_create permission)"""
    await require_permission(current_user, 'checks_create')
    
    # Verify system exists
    system = None
    if script_input.system_id:
        system = await db.systems.find_one({"id": script_input.system_id})
        if not system:
            raise HTTPException(status_code=404, detail="Система не найдена")
    
    # Get category name
    category_name = ""
    if system and system.get('category_id'):
        category = await db.categories.find_one({"id": system['category_id']})
        if category:
            category_name = category.get('name', '')
    
    script_obj = Script(**script_input.model_dump(), created_by=current_user.id)
    script_dict = script_obj.model_dump()
    
    # Если есть processor_script, создаем первую версию
    if script_dict.get('processor_script'):
        processor_script = script_dict.pop('processor_script')
        processor_comment = script_dict.pop('processor_script_comment', None) or 'Первая версия'
        script_dict['processor_script_version'] = {
            'content': processor_script,
            'version_number': 1,
            'comment': processor_comment,
            'created_at': datetime.now(timezone.utc),
            'created_by': current_user.id
        }
        script_dict['processor_script_versions'] = []
    
    # Encode script content and processor_script to Base64 before storing
    script_dict = encode_script_for_storage(script_dict)
    doc = prepare_for_mongo(script_dict)
    
    await db.scripts.insert_one(doc)

    log_audit(
        "18",
        user_id=current_user.id,
        username=current_user.username,
        details={
            "script_name": script_obj.name,
            "system_name": system.get('name') if system else "",
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
    
    # Обработка версионирования processor_script
    processor_script_update = {}
    new_processor_script = update_data.pop('processor_script', None)
    processor_comment = update_data.pop('processor_script_comment', None)
    create_new_version = update_data.pop('create_new_version', False)
    
    if new_processor_script is not None:
        # Подготавливаем обновление версии
        processor_script_update = prepare_processor_script_version_update(
            script_data=script,
            new_content=new_processor_script,
            comment=processor_comment,
            create_new_version=create_new_version,
            user_id=current_user.id
        )
        # Если версия не изменилась, processor_script_update будет пустым
        if processor_script_update:
            # Кодируем содержимое версий
            processor_script_update = encode_script_for_storage(processor_script_update)
            # Подготавливаем для MongoDB
            processor_script_update = prepare_for_mongo(processor_script_update)
    
    # Encode script content to Base64 before storing
    update_data = encode_script_for_storage(update_data)
    
    # Объединяем обновления
    if processor_script_update:
        update_data.update(processor_script_update)
    
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
    script_data = parse_from_mongo(updated_script)
    # Decode script content and processor_script from Base64
    script_data = decode_script_from_storage(script_data)
    return Script(**script_data)


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


@router.get("/scripts/{script_id}/processor-versions")
async def get_processor_script_versions(script_id: str, current_user: User = Depends(get_current_user)):
    """Get all versions of processor script for a script"""
    script = await db.scripts.find_one({"id": script_id}, {"_id": 0})
    if not script:
        raise HTTPException(status_code=404, detail="Скрипт не найден")
    
    # Check access
    if not await has_permission(current_user, 'checks_edit_all'):
        if script.get('created_by') != current_user.id:
            raise HTTPException(status_code=403, detail="Нет доступа к скрипту")
    
    script_data = parse_from_mongo(script)
    script_data = decode_script_from_storage(script_data)
    
    versions = []
    current_version = script_data.get('processor_script_version')
    history_versions = script_data.get('processor_script_versions', [])
    
    # Добавляем текущую версию с пометкой, что это текущая
    if current_version:
        current_version_copy = current_version.copy()
        current_version_copy['is_current'] = True
        versions.append(current_version_copy)
    
    # Добавляем историю версий
    for version in history_versions:
        version_copy = version.copy()
        version_copy['is_current'] = False
        versions.append(version_copy)
    
    # Сортируем: сначала текущая версия (если есть), затем по номеру версии (от новых к старым)
    versions.sort(key=lambda v: (not v.get('is_current', False), -v.get('version_number', 0)))
    
    # Обогащаем версии информацией о пользователях
    user_ids = set()
    for version in versions:
        if version.get('created_by'):
            user_ids.add(version['created_by'])
    
    # Получаем информацию о пользователях
    users_map = {}
    if user_ids:
        users = await db.users.find({"id": {"$in": list(user_ids)}}, {"_id": 0, "id": 1, "username": 1}).to_list(1000)
        for user in users:
            users_map[user.get('id')] = user.get('username', 'Неизвестный')
    
    # Добавляем username к версиям
    for version in versions:
        created_by_id = version.get('created_by')
        if created_by_id and created_by_id in users_map:
            version['created_by_username'] = users_map[created_by_id]
        else:
            version['created_by_username'] = None
    
    return {"versions": versions}


@router.post("/scripts/{script_id}/processor-versions/rollback")
async def rollback_processor_script_version(
    script_id: str,
    version_number: int = Query(..., description="Номер версии для отката"),
    current_user: User = Depends(get_current_user)
):
    """Rollback processor script to a specific version"""
    
    script = await db.scripts.find_one({"id": script_id}, {"_id": 0})
    if not script:
        raise HTTPException(status_code=404, detail="Скрипт не найден")
    
    # Check permissions - только администраторы могут откатывать
    await require_permission(current_user, 'checks_edit_all')
    
    script_data = parse_from_mongo(script)
    script_data = decode_script_from_storage(script_data)
    
    # Находим версию для отката
    target_version = None
    
    # Проверяем текущую версию
    if script_data.get('processor_script_version') and script_data['processor_script_version'].get('version_number') == version_number:
        raise HTTPException(status_code=400, detail="Эта версия уже является текущей")
    
    # Ищем в истории
    if script_data.get('processor_script_versions'):
        for version in script_data['processor_script_versions']:
            if version.get('version_number') == version_number:
                target_version = version
                break
    
    if not target_version:
        raise HTTPException(status_code=404, detail=f"Версия {version_number} не найдена")
    
    # Сохраняем текущую версию в историю
    current_version = script_data.get('processor_script_version')
    versions_history = script_data.get('processor_script_versions', [])
    
    if current_version:
        # Удаляем целевую версию из истории (если она там есть)
        versions_history = [v for v in versions_history if v.get('version_number') != version_number]
        # Добавляем текущую версию в историю
        versions_history.append(current_version)
    
    # Устанавливаем целевую версию как текущую
    new_current_version = target_version.copy()
    new_current_version['created_at'] = datetime.now(timezone.utc)
    new_current_version['created_by'] = current_user.id
    # Сохраняем оригинальный комментарий без изменений
    # Комментарий остается таким, каким его создал пользователь
    
    # Подготавливаем для сохранения
    update_data = {
        'processor_script_version': new_current_version,
        'processor_script_versions': versions_history
    }
    update_data = encode_script_for_storage(update_data)
    update_data = prepare_for_mongo(update_data)
    
    await db.scripts.update_one(
        {"id": script_id},
        {"$set": update_data}
    )
    
    log_audit(
        "21",  # Откат версии скрипта-обработчика
        user_id=current_user.id,
        username=current_user.username,
        details={
            "script_id": script_id,
            "script_name": script_data.get('name'),
            "version_number": version_number
        }
    )
    
    return {"message": f"Откат к версии {version_number} выполнен"}


@router.post("/scripts/validate-syntax")
async def validate_bash_syntax(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Validate bash syntax of a processor script"""
    import subprocess
    import tempfile
    import os
    
    # Получаем содержимое скрипта из body запроса
    script_content = await request.body()
    script_content = script_content.decode('utf-8')
    
    if not script_content or not script_content.strip():
        return {
            "valid": False,
            "error": "Скрипт пуст"
        }
    
    # Создаем временный файл для проверки
    with tempfile.NamedTemporaryFile(mode='w', suffix='.sh', delete=False) as f:
        f.write(script_content)
        temp_file = f.name
    
    try:
        # Запускаем bash -n для проверки синтаксиса
        result = subprocess.run(
            ['bash', '-n', temp_file],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        if result.returncode == 0:
            return {
                "valid": True,
                "message": "Синтаксис скрипта корректен"
            }
        else:
            # Извлекаем сообщение об ошибке
            error_output = result.stderr.strip() or result.stdout.strip()
            return {
                "valid": False,
                "error": error_output or "Обнаружены синтаксические ошибки"
            }
    except subprocess.TimeoutExpired:
        return {
            "valid": False,
            "error": "Превышено время ожидания проверки синтаксиса"
        }
    except FileNotFoundError:
        return {
            "valid": False,
            "error": "Bash не найден в системе. Проверка синтаксиса недоступна."
        }
    except Exception as e:
        return {
            "valid": False,
            "error": f"Ошибка при проверке синтаксиса: {str(e)}"
        }
    finally:
        # Удаляем временный файл
        try:
            os.unlink(temp_file)
        except:
            pass



