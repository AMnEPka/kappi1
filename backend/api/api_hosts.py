"""Hosts API endpoints"""

from fastapi import APIRouter, HTTPException, Depends  # pyright: ignore[reportMissingImports]
from typing import List

from config.config_init import db
from config.config_security import encrypt_password
from models.content_models import Host, HostCreate, HostUpdate
from models.auth_models import User
from services.services_auth import get_current_user, has_permission, has_any_permission, require_permission
from services.services_execution import execute_command
from utils.db_utils import prepare_for_mongo, parse_from_mongo
from utils.audit_utils import log_audit

router = APIRouter()


@router.post("/hosts", response_model=Host)
async def create_host(host_input: HostCreate, current_user: User = Depends(get_current_user)):
    """Create new host (requires hosts_create permission)"""
    await require_permission(current_user, 'hosts_create')
    
    host_dict = host_input.model_dump()
    
    # Encrypt password if provided
    if host_dict.get('password'):
        host_dict['password'] = encrypt_password(host_dict['password'])
    
    # Encrypt SSH key if provided
    if host_dict.get('ssh_key'):
        host_dict['ssh_key'] = encrypt_password(host_dict['ssh_key'])
    
    host_obj = Host(**host_dict, created_by=current_user.id)
    doc = prepare_for_mongo(host_obj.model_dump())
    
    await db.hosts.insert_one(doc)
    
    ip_address_value = host_obj.hostname if host_obj.hostname else "не указан"

    # log_audit(
    #     "15",
    #     user_id=current_user.id,
    #     username=current_user.username,
    #     details={
    #         "host_id": host_obj.id, 
    #         "host_name": host_obj.name, 
    #         "ip_address": ip_address_value,
    #         "updated_by": current_user.username
    #     }
    # )
    return host_obj


@router.get("/hosts", response_model=List[Host])
async def get_hosts(
    skip: int = 0,
    limit: int = 1000,
    current_user: User = Depends(get_current_user),
):
    """Get all hosts (filtered by permissions, with pagination)"""
    limit = max(1, min(limit, 1000))
    skip = max(0, skip)

    # If user can edit all hosts OR can work with projects, show all hosts
    if await has_any_permission(current_user, 'hosts_edit_all', 'projects_create', 'projects_execute', 'results_view_all'):
        hosts = await db.hosts.find({}, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    else:
        # Show only own hosts
        hosts = await db.hosts.find({"created_by": current_user.id}, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    
    return [Host(**parse_from_mongo(host)) for host in hosts]


@router.get("/hosts/{host_id}", response_model=Host)
async def get_host(host_id: str, current_user: User = Depends(get_current_user)):
    """Get host by ID"""
    host = await db.hosts.find_one({"id": host_id}, {"_id": 0})
    if not host:
        raise HTTPException(status_code=404, detail="Хост не найден 1")
    
    # Check access
    if not await has_permission(current_user, 'hosts_edit_all'):
        if host.get('created_by') != current_user.id:
            raise HTTPException(status_code=403, detail="Доступ запрещен")
    
    return Host(**parse_from_mongo(host))


@router.post("/hosts/{host_id}/test")
async def test_host_connection(host_id: str, current_user: User = Depends(get_current_user)):
    """Test SSH connection to host (requires hosts_edit_own or hosts_edit_all permission)"""
    await require_permission(current_user, 'hosts_edit_own', 'hosts_edit_all')
    
    host_doc = await db.hosts.find_one({"id": host_id}, {"_id": 0})
    if not host_doc:
        raise HTTPException(status_code=404, detail="Хост не найден 2")
    
    host = Host(**parse_from_mongo(host_doc))
    
    # Try simple command
    result = await execute_command(host, "echo 'Connection test successful'")
    
    return {
        "success": result.success,
        "output": result.output,
        "error": result.error,
        "message": "Подключение успешно" if result.success else "Ошибка подключения"
    }


@router.put("/hosts/{host_id}", response_model=Host)
async def update_host(host_id: str, host_update: HostUpdate, current_user: User = Depends(get_current_user)):
    """Update host (requires hosts_edit_own or hosts_edit_all permission)"""
    # Check if host exists and get owner
    host_doc = await db.hosts.find_one({"id": host_id})
    if not host_doc:
        raise HTTPException(status_code=404, detail="Хост не найден 3")
    
    host = Host(**host_doc)
    
    # Check permissions
    is_owner = host.created_by == current_user.id
    if is_owner:
        await require_permission(current_user, 'hosts_edit_own')
    else:
        await require_permission(current_user, 'hosts_edit_all')
    
    update_data = host_update.model_dump(exclude_unset=True)
    
    # Encrypt password if provided, remove from update if empty
    # (empty password means "don't change" — frontend sends "" as placeholder)
    if 'password' in update_data:
        if update_data['password']:
            update_data['password'] = encrypt_password(update_data['password'])
        else:
            del update_data['password']
    
    # Encrypt SSH key if provided, remove from update if empty
    if 'ssh_key' in update_data:
        if update_data['ssh_key']:
            update_data['ssh_key'] = encrypt_password(update_data['ssh_key'])
        else:
            del update_data['ssh_key']
    
    if not update_data:
        raise HTTPException(status_code=400, detail="Нет данных для обновления")
    
    result = await db.hosts.update_one(
        {"id": host_id},
        {"$set": update_data}
    )
    
    updated_host = await db.hosts.find_one({"id": host_id}, {"_id": 0})
    
    # Логирование редактирования хоста
    # log_audit(
    #     "16",  # Редактирование хоста
    #     user_id=current_user.id,
    #     username=current_user.username,
    #     details={
    #         "host_id": host_id,
    #         "host_name": host.name,
    #         "ip_address": host.hostname
    #     }
    # )
    
    return Host(**parse_from_mongo(updated_host))


@router.delete("/hosts/{host_id}")
async def delete_host(host_id: str, current_user: User = Depends(get_current_user)):
    """Delete host (requires hosts_delete_own or hosts_delete_all permission)"""
    # Check if host exists and get owner
    host = await db.hosts.find_one({"id": host_id})
    if not host:
        raise HTTPException(status_code=404, detail="Хост не найден 4")
    
    # Check permissions
    is_owner = host.get('created_by') == current_user.id
    if is_owner:
        await require_permission(current_user, 'hosts_delete_own')
    else:
        await require_permission(current_user, 'hosts_delete_all')
    
    result = await db.hosts.delete_one({"id": host_id})
    
    # Логирование удаления хоста
    # log_audit(
    #     "17",  # Удаление хоста
    #     user_id=current_user.id,
    #     username=current_user.username,
    #     details={
    #         "host_name": host.get('name'),
    #         "hostname": host.get('hostname'),
    #         "deleted_by": current_user.username
    #     }
    # )
    
    return {"message": "Хост удален"}
