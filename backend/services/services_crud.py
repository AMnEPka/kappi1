"""
services/crud.py
Helper CRUD functions for common operations
"""

from config.config_init import db, logger
from models.models_init import Category, System, Host, Script


async def get_or_create_category(name: str, created_by: str) -> str:
    """Get existing category or create new one"""
    try:
        existing = await db.categories.find_one({"name": name})
        if existing:
            return existing["id"]
        
        import uuid
        from datetime import datetime, timezone
        
        cat_id = str(uuid.uuid4())
        category = {
            "id": cat_id,
            "name": name,
            "icon": "📁",
            "description": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": created_by
        }
        await db.categories.insert_one(category)
        return cat_id
    except Exception as e:
        logger.error(f"Error creating category: {e}")
        raise


async def get_or_create_system(
    category_id: str,
    name: str,
    os_type: str,
    created_by: str
) -> str:
    """Get existing system or create new one"""
    try:
        existing = await db.systems.find_one({
            "category_id": category_id,
            "name": name
        })
        if existing:
            return existing["id"]
        
        import uuid
        from datetime import datetime, timezone
        
        sys_id = str(uuid.uuid4())
        system = {
            "id": sys_id,
            "category_id": category_id,
            "name": name,
            "description": None,
            "os_type": os_type,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": created_by
        }
        await db.systems.insert_one(system)
        return sys_id
    except Exception as e:
        logger.error(f"Error creating system: {e}")
        raise


async def get_or_create_host(
    name: str,
    hostname: str,
    username: str,
    created_by: str
) -> str:
    """Get existing host or create new one"""
    try:
        existing = await db.hosts.find_one({"hostname": hostname})
        if existing:
            return existing["id"]
        
        import uuid
        from datetime import datetime, timezone
        
        host_id = str(uuid.uuid4())
        host = {
            "id": host_id,
            "name": name,
            "hostname": hostname,
            "port": 22,
            "username": username,
            "auth_type": "password",
            "password": None,
            "ssh_key": None,
            "connection_type": "ssh",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": created_by
        }
        await db.hosts.insert_one(host)
        return host_id
    except Exception as e:
        logger.error(f"Error creating host: {e}")
        raise


async def get_or_create_script(
    system_id: str,
    name: str,
    content: str,
    created_by: str
) -> str:
    """Get existing script or create new one"""
    try:
        existing = await db.scripts.find_one({
            "system_id": system_id,
            "name": name
        })
        if existing:
            return existing["id"]
        
        import uuid
        from datetime import datetime, timezone
        
        script_id = str(uuid.uuid4())
        script = {
            "id": script_id,
            "system_id": system_id,
            "name": name,
            "description": None,
            "content": content,
            "processor_script": None,
            "has_reference_files": False,
            "test_methodology": None,
            "success_criteria": None,
            "order": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": created_by
        }
        await db.scripts.insert_one(script)
        return script_id
    except Exception as e:
        logger.error(f"Error creating script: {e}")
        raise
