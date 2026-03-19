"""
API for configuration integrity checking (afick).
"""

import asyncio
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from typing import List

from config.config_init import db, encrypt_password
from config.config_settings import (
    CONFIG_INTEGRITY_SCHEDULE_TZ,
    CONFIG_INTEGRITY_SCHEDULE_HOUR,
    CONFIG_INTEGRITY_SCHEDULE_MINUTE,
)
from models.auth_models import User
from models.config_integrity_models import (
    ConfigIntegrityHost,
    ConfigIntegrityHostCreate,
    ConfigIntegrityHostImport,
    ConfigIntegrityActionRequest,
    ConfigIntegrityScheduleUpdate,
    SCHEDULE_DOC_ID,
)
from services.services_auth import get_current_user, require_permission
from services.services_config_integrity import (
    initialize_host,
    check_host,
    compute_next_config_integrity_run_at_iso,
)
from utils.db_utils import prepare_for_mongo, parse_from_mongo
from utils.audit_utils import log_audit

router = APIRouter(prefix="/config-integrity", tags=["config-integrity"])


def _encrypt_credentials(data: dict) -> dict:
    if data.get("password"):
        data["password"] = encrypt_password(data["password"])
    if data.get("ssh_key"):
        data["ssh_key"] = encrypt_password(data["ssh_key"])
    return data


@router.get("/schedule")
async def get_config_integrity_schedule(current_user: User = Depends(get_current_user)):
    await require_permission(current_user, "config_integrity_view")
    doc = await db.config_integrity_schedule.find_one({"id": SCHEDULE_DOC_ID}, {"_id": 0})
    if not doc:
        return {
            "enabled": False,
            "interval": "daily",
            "next_run_at": None,
            "schedule_timezone": CONFIG_INTEGRITY_SCHEDULE_TZ,
            "schedule_wall_time": f"{CONFIG_INTEGRITY_SCHEDULE_HOUR:02d}:{CONFIG_INTEGRITY_SCHEDULE_MINUTE:02d}",
        }
    return {
        "enabled": bool(doc.get("enabled")),
        "interval": doc.get("interval") or "daily",
        "next_run_at": doc.get("next_run_at"),
        "schedule_timezone": CONFIG_INTEGRITY_SCHEDULE_TZ,
        "schedule_wall_time": f"{CONFIG_INTEGRITY_SCHEDULE_HOUR:02d}:{CONFIG_INTEGRITY_SCHEDULE_MINUTE:02d}",
    }


@router.put("/schedule")
async def put_config_integrity_schedule(
    body: ConfigIntegrityScheduleUpdate,
    current_user: User = Depends(get_current_user),
):
    await require_permission(current_user, "config_integrity_manage")
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    next_run_at = (
        compute_next_config_integrity_run_at_iso(body.interval, now)
        if body.enabled
        else None
    )
    payload = {
        "id": SCHEDULE_DOC_ID,
        "enabled": body.enabled,
        "interval": body.interval,
        "next_run_at": next_run_at,
        "updated_at": now_iso,
        "updated_by": current_user.id,
    }
    await db.config_integrity_schedule.update_one(
        {"id": SCHEDULE_DOC_ID},
        {"$set": payload},
        upsert=True,
    )
    log_audit(
        "config_integrity_schedule_updated",
        user_id=current_user.id,
        username=current_user.username,
        details={"enabled": body.enabled, "interval": body.interval},
    )
    return {
        "enabled": body.enabled,
        "interval": body.interval,
        "next_run_at": next_run_at,
        "schedule_timezone": CONFIG_INTEGRITY_SCHEDULE_TZ,
        "schedule_wall_time": f"{CONFIG_INTEGRITY_SCHEDULE_HOUR:02d}:{CONFIG_INTEGRITY_SCHEDULE_MINUTE:02d}",
    }


@router.get("/hosts")
async def list_hosts(current_user: User = Depends(get_current_user)):
    await require_permission(current_user, "config_integrity_view")
    docs = await db.config_integrity_hosts.find(
        {}, {"_id": 0, "password": 0, "ssh_key": 0}
    ).sort("created_at", -1).to_list(1000)
    return [parse_from_mongo(d) for d in docs]


@router.post("/hosts")
async def create_host(
    body: ConfigIntegrityHostCreate,
    current_user: User = Depends(get_current_user),
):
    await require_permission(current_user, "config_integrity_manage")
    resolved_ip = body.get_ip_address()
    if not resolved_ip:
        raise HTTPException(status_code=400, detail="Укажите ip_address или hostname")
    host = ConfigIntegrityHost(
        name=body.name,
        ip_address=resolved_ip,
        port=body.port,
        username=body.username,
        auth_type=body.auth_type,
        password=body.password,
        ssh_key=body.ssh_key,
        created_by=current_user.id,
    )
    doc = _encrypt_credentials(prepare_for_mongo(host.model_dump()))
    await db.config_integrity_hosts.insert_one(doc)
    doc.pop("_id", None)
    doc.pop("password", None)
    doc.pop("ssh_key", None)
    log_audit("config_integrity_host_created", user_id=current_user.id, username=current_user.username,
              details={"host_name": host.name, "ip": host.ip_address})
    return parse_from_mongo(doc)


@router.post("/hosts/import")
async def import_hosts(
    body: ConfigIntegrityHostImport,
    current_user: User = Depends(get_current_user),
):
    await require_permission(current_user, "config_integrity_manage")
    created = []
    for item in body.hosts:
        resolved_ip = item.get_ip_address()
        if not resolved_ip:
            raise HTTPException(status_code=400, detail=f"Хост '{item.name}': укажите ip_address или hostname")
        host = ConfigIntegrityHost(
            name=item.name,
            ip_address=resolved_ip,
            port=item.port,
            username=item.username,
            auth_type=item.auth_type,
            password=item.password,
            ssh_key=item.ssh_key,
            created_by=current_user.id,
        )
        doc = _encrypt_credentials(prepare_for_mongo(host.model_dump()))
        await db.config_integrity_hosts.insert_one(doc)
        doc.pop("_id", None)
        doc.pop("password", None)
        doc.pop("ssh_key", None)
        created.append(parse_from_mongo(doc))
    log_audit("config_integrity_hosts_imported", user_id=current_user.id, username=current_user.username,
              details={"count": len(created)})
    return created


@router.delete("/hosts/{host_id}")
async def delete_host(host_id: str, current_user: User = Depends(get_current_user)):
    await require_permission(current_user, "config_integrity_manage")
    result = await db.config_integrity_hosts.delete_one({"id": host_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Хост не найден")
    log_audit("config_integrity_host_deleted", user_id=current_user.id, username=current_user.username, details={"host_id": host_id})
    return {"ok": True}


@router.get("/hosts/{host_id}/afick-config")
async def get_afick_config(host_id: str, current_user: User = Depends(get_current_user)):
    await require_permission(current_user, "config_integrity_view")
    doc = await db.config_integrity_hosts.find_one({"id": host_id}, {"_id": 0, "afick_config_content": 1, "name": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Хост не найден")
    return {"name": doc.get("name"), "content": doc.get("afick_config_content")}


@router.post("/hosts/initialize")
async def initialize_hosts(
    body: ConfigIntegrityActionRequest,
    current_user: User = Depends(get_current_user),
):
    """Initialize afick on selected hosts (SSH: check afick, run afick -i, read config)."""
    await require_permission(current_user, "config_integrity_manage")
    docs = await db.config_integrity_hosts.find(
        {"id": {"$in": body.host_ids}}
    ).to_list(len(body.host_ids))
    if not docs:
        raise HTTPException(status_code=404, detail="Хосты не найдены")

    tasks = [initialize_host(d) for d in docs]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    output = []
    for r in results:
        if isinstance(r, Exception):
            output.append({"success": False, "error": str(r)})
        else:
            output.append(r)
    log_audit("config_integrity_init", user_id=current_user.id, username=current_user.username,
              details={"host_ids": body.host_ids, "results_count": len(output)})
    return output


@router.post("/hosts/check")
async def check_hosts(
    body: ConfigIntegrityActionRequest,
    current_user: User = Depends(get_current_user),
):
    """Run afick -k on selected monitored hosts."""
    await require_permission(current_user, "config_integrity_manage")
    docs = await db.config_integrity_hosts.find(
        {"id": {"$in": body.host_ids}, "is_monitored": True}
    ).to_list(len(body.host_ids))
    if not docs:
        raise HTTPException(status_code=404, detail="Мониторируемые хосты не найдены")

    tasks = [check_host(d) for d in docs]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    output = []
    for r in results:
        if isinstance(r, Exception):
            output.append({"success": False, "error": str(r)})
        else:
            output.append(r)
    log_audit("config_integrity_check", user_id=current_user.id, username=current_user.username,
              details={"host_ids": body.host_ids, "results_count": len(output)})
    return output
