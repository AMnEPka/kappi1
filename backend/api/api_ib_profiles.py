"""
API for Information Security (IB) profiles: CRUD, export, apply.
"""

from fastapi import APIRouter, HTTPException, Depends  # pyright: ignore[reportMissingImports]
from fastapi.responses import PlainTextResponse, StreamingResponse
from typing import List, Optional
from datetime import datetime, timezone
import uuid
import json

from pydantic import BaseModel  # pyright: ignore[reportMissingImports]

from config.config_init import db, logger
from models.ib_profile_models import (
    IBProfile,
    IBProfileCreate,
    IBProfileUpdate,
    IBProfileListEntry,
    IBProfileApplication,
    IBProfileApplySession,
    PROFILE_STATUSES,
)
from models.auth_models import User
from services.services_auth import get_current_user, require_permission, get_current_user_from_token, has_permission
from services.services_ib_profiles_apply import run_apply_session_events
from services.services_sse_tickets import validate_sse_ticket
from utils.db_utils import prepare_for_mongo, parse_from_mongo
from utils.audit_utils import log_audit

router = APIRouter(prefix="/ib-profiles", tags=["ib-profiles"])


def _os_from_connection_type(connection_type: Optional[str]) -> str:
    """Map connection_type to OS group key for profile mapping."""
    if connection_type == "winrm":
        return "windows"
    return "linux"  # ssh, k8s, default


# ============================================================================
# List / Get
# ============================================================================

@router.get("", response_model=List[IBProfileListEntry])
async def list_profiles(
    category_id: Optional[str] = None,
    system_id: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 1000,
    current_user: User = Depends(get_current_user),
):
    """Список профилей ИБ с фильтрами по категории, системе и поиском по версии (с пагинацией)."""
    limit = max(1, min(limit, 1000))
    skip = max(0, skip)
    await require_permission(current_user, "ib_profiles_view")

    query = {}
    if category_id:
        query["category_id"] = category_id
    if system_id:
        query["system_id"] = system_id
    if search and search.strip():
        query["$or"] = [
            {"version": {"$regex": search.strip(), "$options": "i"}},
        ]

    cursor = db.ib_profiles.find(query, {"_id": 0}).sort("updated_at", -1).skip(skip).limit(limit)
    docs = await cursor.to_list(limit)

    # Batch-fetch имён категорий и систем (вместо N+1 запросов)
    cat_ids = list({d.get("category_id") for d in docs if d.get("category_id")})
    sys_ids = list({d.get("system_id") for d in docs if d.get("system_id")})
    cat_map: dict[str, str] = {}
    sys_map: dict[str, str] = {}
    if cat_ids:
        cat_docs = await db.categories.find({"id": {"$in": cat_ids}}, {"_id": 0, "id": 1, "name": 1}).to_list(len(cat_ids))
        cat_map = {c["id"]: c.get("name", c["id"]) for c in cat_docs}
    if sys_ids:
        sys_docs = await db.systems.find({"id": {"$in": sys_ids}}, {"_id": 0, "id": 1, "name": 1}).to_list(len(sys_ids))
        sys_map = {s["id"]: s.get("name", s["id"]) for s in sys_docs}

    result = []
    for doc in docs:
        d = parse_from_mongo(doc)
        result.append(
            IBProfileListEntry(
                id=d["id"],
                category_id=d["category_id"],
                category_name=cat_map.get(d["category_id"], d["category_id"]),
                system_id=d["system_id"],
                system_name=sys_map.get(d["system_id"], d["system_id"]),
                version=d["version"],
                status=d.get("status", "draft"),
                created_at=d.get("created_at"),
                updated_at=d.get("updated_at"),
                created_by=d.get("created_by"),
            )
        )
    return result


@router.get("/{profile_id}", response_model=IBProfile)
async def get_profile(
    profile_id: str,
    current_user: User = Depends(get_current_user),
):
    """Получить один профиль по id."""
    await require_permission(current_user, "ib_profiles_view")

    doc = await db.ib_profiles.find_one({"id": profile_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Профиль не найден")
    return IBProfile(**parse_from_mongo(doc))


# ============================================================================
# Create / Update / Delete (Admin)
# ============================================================================

@router.post("", response_model=IBProfile)
async def create_profile(
    body: IBProfileCreate,
    current_user: User = Depends(get_current_user),
):
    """Создать профиль ИБ (требуется право ib_profiles_manage)."""
    await require_permission(current_user, "ib_profiles_manage")

    if body.status and body.status not in PROFILE_STATUSES:
        raise HTTPException(status_code=400, detail=f"Статус должен быть один из: {PROFILE_STATUSES}")

    category = await db.categories.find_one({"id": body.category_id})
    if not category:
        raise HTTPException(status_code=404, detail="Категория не найдена")
    system = await db.systems.find_one({"id": body.system_id})
    if not system:
        raise HTTPException(status_code=404, detail="Система не найдена")
    if system.get("category_id") != body.category_id:
        raise HTTPException(status_code=400, detail="Система не принадлежит выбранной категории")

    profile = IBProfile(
        category_id=body.category_id,
        system_id=body.system_id,
        version=body.version.strip() or "1",
        content=body.content or "",
        status=body.status or "draft",
        created_by=current_user.id,
    )
    doc = prepare_for_mongo(profile.model_dump())
    await db.ib_profiles.insert_one(doc)

    log_audit(
        "ib_profile_create",
        user_id=current_user.id,
        username=current_user.username,
        details={"profile_id": profile.id, "version": profile.version},
    )
    return profile


@router.put("/{profile_id}", response_model=IBProfile)
async def update_profile(
    profile_id: str,
    body: IBProfileUpdate,
    current_user: User = Depends(get_current_user),
):
    """Обновить профиль. При update_in_place=False старая версия архивируется и создаётся новая запись; при True — обновляется текущая."""
    await require_permission(current_user, "ib_profiles_manage")

    existing = await db.ib_profiles.find_one({"id": profile_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Профиль не найден")

    if body.status and body.status not in PROFILE_STATUSES:
        raise HTTPException(status_code=400, detail=f"Статус должен быть один из: {PROFILE_STATUSES}")

    if body.update_in_place:
        update_data = body.model_dump(exclude_unset=True)
        update_data.pop("update_in_place", None)
        if not update_data:
            return IBProfile(**parse_from_mongo(existing))
        update_data["updated_at"] = datetime.now(timezone.utc)
        await db.ib_profiles.update_one({"id": profile_id}, {"$set": prepare_for_mongo(update_data)})
        updated = await db.ib_profiles.find_one({"id": profile_id}, {"_id": 0})
        log_audit(
            "ib_profile_update",
            user_id=current_user.id,
            username=current_user.username,
            details={"profile_id": profile_id},
        )
        return IBProfile(**parse_from_mongo(updated))
    else:
        # Архивировать текущий, создать новую версию (новая запись с новым id)
        await db.ib_profiles.update_one(
            {"id": profile_id},
            {"$set": {"status": "archived", "updated_at": datetime.now(timezone.utc)}}
        )
        new_id = str(uuid.uuid4())
        new_version = (body.version or existing.get("version", "1")).strip() or "1"
        now = datetime.now(timezone.utc)
        new_doc = {
            "id": new_id,
            "category_id": existing["category_id"],
            "system_id": existing["system_id"],
            "version": new_version,
            "content": body.content if body.content is not None else existing.get("content", ""),
            "status": body.status or "draft",
            "created_at": now,
            "updated_at": now,
            "created_by": current_user.id,
        }
        await db.ib_profiles.insert_one(prepare_for_mongo(new_doc))
        log_audit(
            "ib_profile_new_version",
            user_id=current_user.id,
            username=current_user.username,
            details={"old_id": profile_id, "new_id": new_id, "version": new_version},
        )
        return IBProfile(**parse_from_mongo(new_doc))


@router.delete("/{profile_id}")
async def delete_profile(
    profile_id: str,
    current_user: User = Depends(get_current_user),
):
    """Удалить профиль ИБ."""
    await require_permission(current_user, "ib_profiles_manage")

    result = await db.ib_profiles.delete_one({"id": profile_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Профиль не найден")

    log_audit(
        "ib_profile_delete",
        user_id=current_user.id,
        username=current_user.username,
        details={"profile_id": profile_id},
    )
    return {"message": "Профиль удалён"}


# ============================================================================
# Export
# ============================================================================

@router.get("/{profile_id}/export", response_class=PlainTextResponse)
async def export_profile(
    profile_id: str,
    current_user: User = Depends(get_current_user),
):
    """Экспорт содержимого профиля как текст."""
    await require_permission(current_user, "ib_profiles_view")

    doc = await db.ib_profiles.find_one({"id": profile_id}, {"_id": 0, "content": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Профиль не найден")
    return PlainTextResponse(content=doc.get("content", ""))


# ============================================================================
# Apply (physical run: start session + SSE stream)
# ============================================================================

class ApplyProfilesRequest(BaseModel):
    """Тело запроса применения профилей: хосты и привязка профиля по ОС."""
    host_ids: List[str]
    profile_by_os: dict  # {"linux": "profile_id", "windows": "profile_id"}


async def _validate_apply_payload_async(host_ids: List[str], profile_by_os: dict):
    if not host_ids:
        raise HTTPException(status_code=400, detail="Укажите хотя бы один хост")
    profile_by_os = profile_by_os or {}
    hosts = await db.hosts.find({"id": {"$in": host_ids}}, {"_id": 0}).to_list(len(host_ids) + 1)
    host_ids_found = {h["id"] for h in hosts}
    missing = set(host_ids) - host_ids_found
    if missing:
        raise HTTPException(status_code=400, detail=f"Хосты не найдены: {list(missing)}")
    unassigned = []
    for h in hosts:
        os_key = _os_from_connection_type(h.get("connection_type"))
        if not profile_by_os.get(os_key):
            unassigned.append(h["id"])
    if unassigned:
        raise HTTPException(
            status_code=400,
            detail=f"Не для всех хостов выбран профиль. Хосты без профиля: {unassigned}.",
        )
    for h in hosts:
        os_key = _os_from_connection_type(h.get("connection_type"))
        profile_id = profile_by_os.get(os_key)
        profile_doc = await db.ib_profiles.find_one({"id": profile_id}, {"_id": 0})
        if not profile_doc:
            raise HTTPException(status_code=400, detail=f"Профиль {profile_id} не найден")


@router.post("/apply/start")
async def apply_profiles_start(
    body: ApplyProfilesRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Запустить сессию применения профилей ИБ. Возвращает session_id для подключения к SSE-потоку.
    """
    await require_permission(current_user, "ib_profiles_apply")
    await _validate_apply_payload_async(body.host_ids, body.profile_by_os or {})

    session = IBProfileApplySession(
        host_ids=body.host_ids,
        profile_by_os=body.profile_by_os or {},
        created_by=current_user.id,
    )
    doc = prepare_for_mongo(session.model_dump())
    await db.ib_profile_apply_sessions.insert_one(doc)

    log_audit(
        "ib_profiles_apply_start",
        user_id=current_user.id,
        username=current_user.username,
        details={"session_id": session.session_id, "host_count": len(body.host_ids)},
    )
    return {"session_id": session.session_id}


@router.get("/apply/{session_id}/stream")
async def apply_profiles_stream(
    session_id: str,
    ticket: Optional[str] = None,
    token: Optional[str] = None,
):
    """SSE-поток выполнения применения профилей (аутентификация через SSE ticket или legacy token)."""
    # Authenticate via SSE ticket (preferred) or legacy JWT token (fallback)
    if ticket:
        current_user = await validate_sse_ticket(ticket)
    elif token:
        logger.warning("Apply stream using legacy token query param (deprecated)")
        try:
            current_user = await get_current_user_from_token(token)
        except Exception as e:
            logger.error(f"Apply stream auth failed: {e}")
            raise HTTPException(status_code=401, detail="Ошибка авторизации")
    else:
        raise HTTPException(status_code=401, detail="Требуется ticket для SSE-подключения")
    if not await has_permission(current_user, "ib_profiles_apply"):
        raise HTTPException(status_code=403, detail="Нет прав на применение профилей ИБ")

    async def event_generator():
        try:
            async for event in run_apply_session_events(
                session_id, current_user.id, current_user.username or ""
            ):
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
        except Exception as e:
            logger.exception(f"Apply stream error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': 'Внутренняя ошибка выполнения'})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ============================================================================
# Apply (legacy: log-only, no execution)
# ============================================================================

@router.post("/apply")
async def apply_profiles(
    body: ApplyProfilesRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Зарегистрировать применение профилей ИБ на хосты.
    profile_by_os: для каждой группы ОС (linux, windows) указан id профиля.
    Все хосты должны иметь назначенный профиль (по connection_type: ssh->linux, winrm->windows).
    """
    await require_permission(current_user, "ib_profiles_apply")

    if not body.host_ids:
        raise HTTPException(status_code=400, detail="Укажите хотя бы один хост")

    profile_by_os = body.profile_by_os or {}
    linux_profile = profile_by_os.get("linux")
    windows_profile = profile_by_os.get("windows")

    hosts = await db.hosts.find({"id": {"$in": body.host_ids}}, {"_id": 0, "id": 1, "connection_type": 1}).to_list(len(body.host_ids) + 1)
    host_ids_found = {h["id"] for h in hosts}
    missing = set(body.host_ids) - host_ids_found
    if missing:
        raise HTTPException(status_code=400, detail=f"Хосты не найдены: {list(missing)}")

    unassigned = []
    applications = []  # (host_id, profile_id, profile_version)
    for h in hosts:
        hid = h["id"]
        os_key = _os_from_connection_type(h.get("connection_type"))
        profile_id = profile_by_os.get(os_key)
        if not profile_id:
            unassigned.append(hid)
            continue
        profile_doc = await db.ib_profiles.find_one({"id": profile_id}, {"_id": 0, "version": 1})
        if not profile_doc:
            raise HTTPException(status_code=400, detail=f"Профиль {profile_id} не найден")
        applications.append((hid, profile_id, profile_doc.get("version", "")))

    if unassigned:
        raise HTTPException(
            status_code=400,
            detail=f"Не для всех хостов выбран профиль. Хосты без профиля: {unassigned}. Укажите profile_by_os для linux и/или windows.",
        )

    now = datetime.now(timezone.utc)
    for host_id, profile_id, profile_version in applications:
        log_entry = {
            "id": str(uuid.uuid4()),
            "profile_id": profile_id,
            "profile_version": profile_version,
            "host_ids": [host_id],
            "applied_at": now,
            "applied_by": current_user.id,
            "username": current_user.username,
            "details": None,
        }
        await db.ib_profile_applications.insert_one(prepare_for_mongo(log_entry))

    log_audit(
        "ib_profiles_apply",
        user_id=current_user.id,
        username=current_user.username,
        details={"host_count": len(body.host_ids), "applications": len(applications)},
    )
    return {"message": "Профили применены", "hosts_count": len(body.host_ids), "applications_logged": len(applications)}
