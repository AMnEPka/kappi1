from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Depends, status, Request # pyright: ignore[reportMissingImports]
from fastapi.responses import StreamingResponse, FileResponse # pyright: ignore[reportMissingImports]
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials # pyright: ignore[reportMissingImports]
from starlette.middleware.cors import CORSMiddleware # pyright: ignore[reportMissingImports]
from motor.motor_asyncio import AsyncIOMotorClient # pyright: ignore[reportMissingImports]
import asyncio, logging, json
import os
import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta, time, date
import contextlib
from openpyxl import Workbook  # pyright: ignore[reportMissingModuleSource]
from openpyxl.styles import Font, PatternFill, Border, Side, Alignment  # pyright: ignore[reportMissingModuleSource]
import tempfile
from typing import Tuple  # pyright: ignore[reportMissingModuleSource]

from config.config_init import *
from models.models_init import *
from services.services_init import *

scheduler_task: Optional[asyncio.Task] = None

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# JWT Configuration
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production-please-use-strong-random-key')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

@api_router.get("/permissions", response_model=Dict[str, Any])
async def get_permissions_list():
    """Get all available permissions with descriptions and groups"""
    return {
        "permissions": PERMISSIONS,
        "groups": PERMISSION_GROUPS
    }
def prepare_for_mongo(data: dict) -> dict:
    """Prepare data for MongoDB storage"""
    prepared = data.copy()
    for field in ["created_at", "updated_at", "executed_at", "next_run_at", "last_run_at", "started_at", "finished_at"]:
        if isinstance(prepared.get(field), datetime):
            prepared[field] = prepared[field].isoformat()
    if isinstance(prepared.get("run_times"), list):
        prepared["run_times"] = [
            value.isoformat() if isinstance(value, datetime) else value
            for value in prepared["run_times"]
        ]
    return prepared

def parse_from_mongo(item: dict) -> dict:
    """Parse data from MongoDB"""
    parsed = item.copy()
    for field in ["created_at", "updated_at", "executed_at", "next_run_at", "last_run_at", "started_at", "finished_at"]:
        if isinstance(parsed.get(field), str):
            parsed[field] = datetime.fromisoformat(parsed[field])
    if isinstance(parsed.get("run_times"), list):
        parsed["run_times"] = [
            datetime.fromisoformat(value) if isinstance(value, str) else value
            for value in parsed["run_times"]
        ]
    return parsed

async def _persist_audit_log(entry: Dict[str, Any]) -> None:
    try:
        doc = entry.copy()
        doc["id"] = str(uuid.uuid4())
        doc["created_at"] = datetime.now(timezone.utc).isoformat()
        await db.audit_logs.insert_one(doc)
    except Exception as e:
        logger.error("Failed to persist audit log: %s", str(e))

def log_audit(event: str, *, user_id: Optional[str] = None, username: Optional[str] = None,
              details: Optional[Dict[str, Any]] = None, level: int = logging.INFO) -> None:
    """Structured audit logging helper"""
    payload: Dict[str, Any] = {
        "event": event,
        "level": logging.getLevelName(level)
    }
    if user_id:
        payload["user_id"] = user_id
    if username:
        payload["username"] = username
    if details:
        payload["details"] = details
    
    logger.log(level, "[AUDIT] %s", json.dumps(payload, ensure_ascii=False, default=str))
    
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(_persist_audit_log(payload))
    except RuntimeError:
        # No running loop (e.g., during startup). Persist synchronously.
        asyncio.run(_persist_audit_log(payload))

def _parse_datetime_param(value: Optional[str], *, end_of_day: bool = False) -> Optional[datetime]:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value)
    except ValueError:
        # Support date-only input
        try:
            dt = datetime.fromisoformat(f"{value}T00:00:00")
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid date format: {value}")
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    if end_of_day:
        dt = dt + timedelta(days=1)
    return dt

def _parse_time_of_day(value: str) -> time:
    parts = value.split(":")
    if len(parts) < 2:
        raise HTTPException(status_code=400, detail=f"Invalid time format: {value}")
    hour = int(parts[0])
    minute = int(parts[1])
    return time(hour=hour, minute=minute, tzinfo=timezone.utc)

def _next_daily_occurrence(config: Dict[str, Any], *, reference: datetime, initial: bool = False) -> Optional[datetime]:
    time_str = config.get("recurrence_time")
    if not time_str:
        return None
    target_time = _parse_time_of_day(time_str)
    start_date_str = config.get("recurrence_start_date")
    start_date_value = datetime.fromisoformat(f"{start_date_str}T00:00:00").date() if start_date_str else reference.date()
    candidate_date = start_date_value if initial else reference.date()
    candidate = datetime.combine(candidate_date, target_time)
    if candidate <= reference:
        candidate += timedelta(days=1)
    return candidate

def _normalize_run_times(run_times: List[datetime]) -> List[datetime]:
    cleaned = []
    for value in run_times:
        if value.tzinfo is None:
            cleaned.append(value.replace(tzinfo=timezone.utc))
        else:
            cleaned.append(value.astimezone(timezone.utc))
    cleaned.sort()
    return cleaned

def _calculate_next_run(job: SchedulerJob, *, reference: Optional[datetime] = None, initial: bool = False) -> Optional[datetime]:
    reference_dt = reference or datetime.now(timezone.utc)
    if job.job_type == "one_time":
        return job.next_run_at
    if job.job_type == "multi_run":
        future_runs = [rt for rt in job.run_times if rt >= reference_dt]
        return future_runs[0] if future_runs else None
    if job.job_type == "recurring":
        return _next_daily_occurrence(job.schedule_config, reference=reference_dt, initial=initial)
    return None

async def _consume_streaming_response(streaming_response) -> Tuple[Optional[str], Optional[str]]:
    session_id = None
    final_status = None
    buffer = ""
    body_iterator = getattr(streaming_response, "body_iterator", None)
    if body_iterator is None:
        return session_id, final_status
    async for chunk in body_iterator:
        text = chunk.decode() if isinstance(chunk, (bytes, bytearray)) else str(chunk)
        buffer += text
        while "\n\n" in buffer:
            block, buffer = buffer.split("\n\n", 1)
            line = block.strip()
            if line.startswith("data: "):
                try:
                    payload = json.loads(line[len("data: "):])
                except json.JSONDecodeError:
                    continue
                if payload.get("type") == "complete":
                    session_id = payload.get("session_id")
                    final_status = payload.get("status")
                    print(f"🔍 DEBUG: received status from streaming = '{final_status}'")
    if hasattr(body_iterator, "aclose"):
        await body_iterator.aclose()
    return session_id, final_status

async def _update_job_after_run(job: SchedulerJob, *, run_success: bool) -> None:
    now = datetime.now(timezone.utc)
    update_fields: Dict[str, Any] = {
        "last_run_at": now.isoformat(),
        "last_run_status": "success" if run_success else "failed",
        "updated_at": now.isoformat(),
    }
    if job.job_type == "one_time":
        update_fields["status"] = "completed"
        update_fields["next_run_at"] = None
    elif job.job_type == "multi_run":
        future_runs = [rt for rt in job.run_times if rt > now]
        update_fields["run_times"] = [rt.isoformat() for rt in future_runs]
        update_fields["remaining_runs"] = len(future_runs)
        if future_runs:
            update_fields["next_run_at"] = future_runs[0].isoformat()
        else:
            update_fields["status"] = "completed"
            update_fields["next_run_at"] = None
    elif job.job_type == "recurring":
        next_run = _calculate_next_run(job, reference=now)
        update_fields["next_run_at"] = next_run.isoformat() if next_run else None
    await db.scheduler_jobs.update_one({"id": job.id}, {"$set": update_fields})

async def _execute_scheduler_job(job: SchedulerJob) -> Tuple[Optional[str], Optional[str]]:
    user_doc = await db.users.find_one({"id": job.created_by}, {"_id": 0})
    if not user_doc:
        raise RuntimeError("Creator of scheduler job not found")
    scheduler_user = User(**user_doc)
    log_audit(
        "24",
        user_id=scheduler_user.id,
        username=scheduler_user.username,
        details={"project_id": job.project_id, "scheduler_job_id": job.id}
    )
    response = await execute_project(job.project_id, current_user=scheduler_user)  # type: ignore[arg-type]
    session_id, final_status = await _consume_streaming_response(response)
    return session_id, final_status

async def _handle_due_scheduler_job(job_doc: dict) -> None:
    job = SchedulerJob(**parse_from_mongo(job_doc))
    now_iso = datetime.now(timezone.utc).isoformat()
    await db.scheduler_jobs.update_one({"id": job.id}, {"$set": {"next_run_at": None, "updated_at": now_iso}})
    run = SchedulerRun(job_id=job.id, project_id=job.project_id, launched_by_user=job.created_by)
    await db.scheduler_runs.insert_one(prepare_for_mongo(run.model_dump()))
    error_message = None
    try:
        session_id, final_status = await _execute_scheduler_job(job)
        print(f"🔍 DEBUG: final_status from execute_project = '{final_status}'")
        run_status = "success" if final_status == "completed" else "failed"
        print(f"🔍 DEBUG: setting run_status = '{run_status}'")
    except Exception as exc:
        logger.error(f"Scheduler job {job.id} failed: {str(exc)}")
        session_id = None
        run_status = "failed"
        error_message = str(exc)
    update_run = {
        "status": run_status,
        "finished_at": datetime.now(timezone.utc).isoformat(),
        "session_id": session_id
    }
    if error_message:
        update_run["error"] = error_message
    await db.scheduler_runs.update_one({"id": run.id}, {"$set": update_run})
    if job.job_type == "multi_run":
        now = datetime.now(timezone.utc)
        job.run_times = [rt for rt in job.run_times if rt > now]
    await _update_job_after_run(job, run_success=run_status == "success")

async def scheduler_worker():
    await asyncio.sleep(5)
    while True:
        try:
            now_iso = datetime.now(timezone.utc).isoformat()
            jobs = await db.scheduler_jobs.find(
                {
                    "status": "active",
                    "next_run_at": {"$ne": None, "$lte": now_iso}
                },
                {"_id": 0}
            ).to_list(20)
            for job_doc in jobs:
                await _handle_due_scheduler_job(job_doc)
        except Exception as exc:
            logger.error(f"Scheduler worker error: {str(exc)}")
        await asyncio.sleep(SCHEDULER_POLL_SECONDS)


# API Routes - Authentication
@api_router.post("/auth/login", response_model=LoginResponse)
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
            detail="Incorrect username or password"
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
            detail="Incorrect username or password"
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
        raise HTTPException(status_code=400, detail="Inactive user")
    
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
        "1",
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

@api_router.get("/auth/me")
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


# API Routes - Hosts
@api_router.post("/hosts", response_model=Host)
async def create_host(host_input: HostCreate, current_user: User = Depends(get_current_user)):
    """Create new host (requires hosts_create permission)"""
    await require_permission(current_user, 'hosts_create')
    
    host_dict = host_input.model_dump()
    
    # Encrypt password if provided
    if host_dict.get('password'):
        host_dict['password'] = encrypt_password(host_dict['password'])
    
    host_obj = Host(**host_dict, created_by=current_user.id)
    doc = prepare_for_mongo(host_obj.model_dump())
    
    await db.hosts.insert_one(doc)
    
    ip_address_value = host_obj.hostname if host_obj.hostname else "не указан"

    log_audit(
        "15",
        user_id=current_user.id,
        username=current_user.username,
        details={
            "host_id": host_obj.id, 
            "host_name": host_obj.name, 
            "ip_address": ip_address_value,
            "updated_by": current_user.username
        }
    )
    return host_obj

@api_router.get("/hosts", response_model=List[Host])
async def get_hosts(current_user: User = Depends(get_current_user)):
    """Get all hosts (filtered by permissions)"""
    # If user can edit all hosts OR can work with projects, show all hosts
    if (await has_permission(current_user, 'hosts_edit_all') or 
        await has_permission(current_user, 'projects_create') or 
        await has_permission(current_user, 'projects_execute') or
        await has_permission(current_user, 'results_view_all')):
        hosts = await db.hosts.find({}, {"_id": 0}).to_list(1000)
    else:
        # Show only own hosts
        hosts = await db.hosts.find({"created_by": current_user.id}, {"_id": 0}).to_list(1000)
    
    return [Host(**parse_from_mongo(host)) for host in hosts]

@api_router.get("/hosts/{host_id}", response_model=Host)
async def get_host(host_id: str, current_user: User = Depends(get_current_user)):
    """Get host by ID"""
    host = await db.hosts.find_one({"id": host_id}, {"_id": 0})
    if not host:
        raise HTTPException(status_code=404, detail="Хост не найден")
    
    # Check access
    if not await has_permission(current_user, 'hosts_edit_all'):
        if host.get('created_by') != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    return Host(**parse_from_mongo(host))

@api_router.post("/hosts/{host_id}/test")
async def test_host_connection(host_id: str):
    """Test SSH connection to host"""
    host_doc = await db.hosts.find_one({"id": host_id}, {"_id": 0})
    if not host_doc:
        raise HTTPException(status_code=404, detail="Хост не найден")
    
    host = Host(**parse_from_mongo(host_doc))
    
    # Try simple command
    result = await execute_command(host, "echo 'Connection test successful'")
    
    return {
        "success": result.success,
        "output": result.output,
        "error": result.error,
        "message": "Подключение успешно" if result.success else "Ошибка подключения"
    }

@api_router.put("/hosts/{host_id}", response_model=Host)
async def update_host(host_id: str, host_update: HostUpdate, current_user: User = Depends(get_current_user)):
    """Update host (requires hosts_edit_own or hosts_edit_all permission)"""
    # Check if host exists and get owner
    host_doc = await db.hosts.find_one({"id": host_id})
    if not host_doc:
        raise HTTPException(status_code=404, detail="Хост не найден")
    
    host = Host(**host_doc)
    
    # Check permissions
    is_owner = host.created_by == current_user.id
    if is_owner:
        await require_permission(current_user, 'hosts_edit_own')
    else:
        await require_permission(current_user, 'hosts_edit_all')
    
    update_data = host_update.model_dump(exclude_unset=True)
    
    # Encrypt password if provided
    if 'password' in update_data and update_data['password']:
        update_data['password'] = encrypt_password(update_data['password'])
    
    if not update_data:
        raise HTTPException(status_code=400, detail="Нет данных для обновления")
    
    result = await db.hosts.update_one(
        {"id": host_id},
        {"$set": update_data}
    )
    
    updated_host = await db.hosts.find_one({"id": host_id}, {"_id": 0})
    
    # Логирование редактирования хоста
    log_audit(
        "16",  # Редактирование хоста
        user_id=current_user.id,
        username=current_user.username,
        details={
            "host_id": host_id,
            "host_name": host.name,
            "ip_address": host.hostname
        }
    )
    
    return Host(**parse_from_mongo(updated_host))

@api_router.delete("/hosts/{host_id}")
async def delete_host(host_id: str, current_user: User = Depends(get_current_user)):
    """Delete host (requires hosts_delete_own or hosts_delete_all permission)"""
    # Check if host exists and get owner
    host = await db.hosts.find_one({"id": host_id})
    if not host:
        raise HTTPException(status_code=404, detail="Хост не найден")
    
    # Check permissions
    is_owner = host.get('created_by') == current_user.id
    if is_owner:
        await require_permission(current_user, 'hosts_delete_own')
    else:
        await require_permission(current_user, 'hosts_delete_all')
    
    result = await db.hosts.delete_one({"id": host_id})
    
    # Логирование удаления хоста
    log_audit(
        "17",  # Удаление хоста
        user_id=current_user.id,
        username=current_user.username,
        details={
            "host_name": host.get('name'),
            "hostname": host.get('hostname'),
            "deleted_by": current_user.username
        }
    )
    
    return {"message": "Хост удален"}


# API Routes - Categories
@api_router.post("/categories", response_model=Category)
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

@api_router.get("/categories", response_model=List[Category])
async def get_categories(current_user: User = Depends(get_current_user)):
    """Get all categories"""
    categories = await db.categories.find({}, {"_id": 0}).to_list(1000)
    return [Category(**parse_from_mongo(cat)) for cat in categories]

@api_router.get("/categories/{category_id}", response_model=Category)
async def get_category(category_id: str, current_user: User = Depends(get_current_user)):
    """Get category by ID"""
    category = await db.categories.find_one({"id": category_id}, {"_id": 0})
    if not category:
        raise HTTPException(status_code=404, detail="Категория не найдена")
    return Category(**parse_from_mongo(category))

@api_router.put("/categories/{category_id}", response_model=Category)
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

@api_router.delete("/categories/{category_id}")
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
            "category_name": category.get('name'),
            "deleted_by": current_user.username
        }
    )
    
    return {"message": "Категория удалена"}


# API Routes - Systems
@api_router.post("/categories/{category_id}/systems", response_model=System)
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
            "category_name": category.get('name'),
            "created_by": current_user.username
        }
    )
    
    return system_obj

@api_router.get("/categories/{category_id}/systems", response_model=List[System])
async def get_systems(category_id: str, current_user: User = Depends(get_current_user)):
    """Get systems for category"""
    systems = await db.systems.find({"category_id": category_id}, {"_id": 0}).to_list(1000)
    return [System(**parse_from_mongo(sys)) for sys in systems]

@api_router.get("/systems", response_model=List[System])
async def get_all_systems(category_id: Optional[str] = None, current_user: User = Depends(get_current_user)):
    """Get all systems, optionally filtered by category"""
    query = {}
    if category_id:
        query["category_id"] = category_id
    systems = await db.systems.find(query, {"_id": 0}).to_list(1000)
    return [System(**parse_from_mongo(sys)) for sys in systems]

@api_router.get("/systems/{system_id}", response_model=System)
async def get_system(system_id: str, current_user: User = Depends(get_current_user)):
    """Get system by ID"""
    system = await db.systems.find_one({"id": system_id}, {"_id": 0})
    if not system:
        raise HTTPException(status_code=404, detail="Система не найдена")
    return System(**parse_from_mongo(system))

@api_router.put("/systems/{system_id}", response_model=System)
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
    
    # If category_id is being updated, verify it exists
    if 'category_id' in update_data:
        category = await db.categories.find_one({"id": update_data['category_id']})
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

@api_router.delete("/systems/{system_id}")
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

# API Routes - Scripts
@api_router.post("/systems/{system_id}/scripts", response_model=Script)
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

@api_router.get("/scripts")
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

@api_router.get("/scripts/{script_id}", response_model=Script)
async def get_script(script_id: str, current_user: User = Depends(get_current_user)):
    """Get script by ID"""
    script = await db.scripts.find_one({"id": script_id}, {"_id": 0})
    if not script:
        raise HTTPException(status_code=404, detail="Скрипт не найден")
    
    # Check access
    if not await has_permission(current_user, 'checks_edit_all'):
        if script.get('created_by') != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    return Script(**parse_from_mongo(script))

@api_router.post("/scripts", response_model=Script)
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

@api_router.put("/scripts/{script_id}", response_model=Script)
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

@api_router.delete("/scripts/{script_id}")
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


# API Routes - Projects
@api_router.post("/projects", response_model=Project)
async def create_project(project_input: ProjectCreate, current_user: User = Depends(get_current_user)):
    """Create new project (requires projects_create permission)"""
    await require_permission(current_user, 'projects_create')
    
    project_obj = Project(**project_input.model_dump(), created_by=current_user.id)
    doc = prepare_for_mongo(project_obj.model_dump())
    
    await db.projects.insert_one(doc)
    
    log_audit(
        "21",
        user_id=current_user.id,
        username=current_user.username,
        details={"project_id": project_obj.id, "project_name": project_obj.name}
    )
    return project_obj

@api_router.get("/projects", response_model=List[Project])
async def get_projects(current_user: User = Depends(get_current_user)):
    """Get all accessible projects"""
    if current_user.is_admin or await has_permission(current_user, 'results_view_all'):
        # Admin or curator sees all projects
        projects = await db.projects.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    else:
        # Get projects created by user
        my_projects = await db.projects.find({"created_by": current_user.id}, {"_id": 0}).to_list(1000)
        
        # Get projects with explicit access
        access_records = await db.project_access.find({"user_id": current_user.id}).to_list(1000)
        project_ids = [rec['project_id'] for rec in access_records]
        accessible_projects = await db.projects.find({"id": {"$in": project_ids}}, {"_id": 0}).to_list(1000) if project_ids else []
        
        # Combine and deduplicate
        all_projects = {p['id']: p for p in my_projects + accessible_projects}
        projects = list(all_projects.values())
        projects.sort(key=lambda x: x.get('created_at', ''), reverse=True)
    
    # Enrich projects with creator username & fullname
    for project in projects:
        if project.get('created_by'):
            creator = await db.users.find_one({"id": project['created_by']}, {"_id": 0, "username": 1, "full_name": 1})
            if creator:
                project['creator_username'] = creator.get('username', 'Unknown')
                project['creator_full_name'] = creator.get('full_name', 'Unknown')          
    
    return [Project(**parse_from_mongo(proj)) for proj in projects]

@api_router.get("/projects/{project_id}", response_model=Project)
async def get_project(project_id: str, current_user: User = Depends(get_current_user)):
    """Get project by ID"""
    if not await can_access_project(current_user, project_id):
        raise HTTPException(status_code=403, detail="Access denied to this project")
    
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")
    return Project(**parse_from_mongo(project))

@api_router.put("/projects/{project_id}", response_model=Project)
async def update_project(project_id: str, project_update: ProjectUpdate, current_user: User = Depends(get_current_user)):
    """Update project (only creator or admin)"""
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")
    
    if project.get('created_by') != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Only project creator or admin can update")
    
    update_data = project_update.model_dump(exclude_unset=True)
    
    if not update_data:
        raise HTTPException(status_code=400, detail="Нет данных для обновления")
    
    result = await db.projects.update_one(
        {"id": project_id},
        {"$set": update_data}
    )
    
    updated_project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    return Project(**parse_from_mongo(updated_project))

@api_router.delete("/projects/{project_id}")
async def delete_project(project_id: str, current_user: User = Depends(get_current_user)):
    """Delete project (only creator or admin)"""
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")
    
    if project.get('created_by') != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Only project creator or admin can delete")
    
    # Delete associated tasks
    await db.project_tasks.delete_many({"project_id": project_id})
    
    # Delete project access records
    await db.project_access.delete_many({"project_id": project_id})
    
    # Delete associated executions
    await db.executions.delete_many({"project_id": project_id})
    
    # Delete project
    result = await db.projects.delete_one({"id": project_id})
    return {"message": "Проект удален"}


# Scheduler API
@api_router.get("/scheduler/jobs", response_model=List[SchedulerJob])
async def list_scheduler_jobs(current_user: User = Depends(get_current_user)):
    query = {} if current_user.is_admin else {"created_by": current_user.id}
    jobs = await db.scheduler_jobs.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [SchedulerJob(**parse_from_mongo(job)) for job in jobs]

async def _ensure_project_access(current_user: User, project_id: str):
    if not (await can_access_project(current_user, project_id)):
        raise HTTPException(status_code=403, detail="Access denied to this project")

@api_router.post("/scheduler/jobs", response_model=SchedulerJob)
async def create_scheduler_job(job_input: SchedulerJobCreate, current_user: User = Depends(get_current_user)):
    await require_permission(current_user, 'projects_execute')
    await _ensure_project_access(current_user, job_input.project_id)
    
    job = SchedulerJob(
        name=job_input.name,
        project_id=job_input.project_id,
        job_type=job_input.job_type,
        created_by=current_user.id,
    )
    now = datetime.now(timezone.utc)
    if job.job_type == "one_time":
        if not job_input.run_at:
            raise HTTPException(status_code=400, detail="Укажите время запуска")
        job.next_run_at = job_input.run_at if job_input.run_at.tzinfo else job_input.run_at.replace(tzinfo=timezone.utc)
    elif job.job_type == "multi_run":
        if not job_input.run_times:
            raise HTTPException(status_code=400, detail="Укажите список запусков")
        job.run_times = _normalize_run_times(job_input.run_times)
        if not job.run_times:
            raise HTTPException(status_code=400, detail="Нет валидных дат запусков")
        job.remaining_runs = len(job.run_times)
        job.next_run_at = job.run_times[0]
    elif job.job_type == "recurring":
        if not job_input.recurrence_time:
            raise HTTPException(status_code=400, detail="Укажите время повторения")
        start_date = job_input.recurrence_start_date or now.date()
        job.schedule_config = {
            "recurrence_time": job_input.recurrence_time,
            "recurrence_start_date": start_date.isoformat()
        }
        job.next_run_at = _next_daily_occurrence(job.schedule_config, reference=now, initial=True)
    else:
        raise HTTPException(status_code=400, detail="Неверный тип задания")
    doc = prepare_for_mongo(job.model_dump())
    await db.scheduler_jobs.insert_one(doc)
    return job

async def _get_scheduler_job(job_id: str, current_user: User) -> SchedulerJob:
    job_doc = await db.scheduler_jobs.find_one({"id": job_id}, {"_id": 0})
    if not job_doc:
        raise HTTPException(status_code=404, detail="Задание не найдено")
    if not current_user.is_admin and job_doc.get("created_by") != current_user.id:
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    return SchedulerJob(**parse_from_mongo(job_doc))

@api_router.put("/scheduler/jobs/{job_id}", response_model=SchedulerJob)
async def update_scheduler_job(job_id: str, job_update: SchedulerJobUpdate, current_user: User = Depends(get_current_user)):
    await require_permission(current_user, 'projects_execute')
    job = await _get_scheduler_job(job_id, current_user)
    changed = False
    now = datetime.now(timezone.utc)
    if job_update.name:
        job.name = job_update.name
        changed = True
    if job.job_type == "one_time" and job_update.run_at:
        job.next_run_at = job_update.run_at if job_update.run_at.tzinfo else job_update.run_at.replace(tzinfo=timezone.utc)
        job.status = "active"
        changed = True
    if job.job_type == "multi_run" and job_update.run_times:
        job.run_times = _normalize_run_times(job_update.run_times)
        job.remaining_runs = len(job.run_times)
        job.next_run_at = job.run_times[0] if job.run_times else None
        job.status = "active" if job.run_times else "completed"
        changed = True
    if job.job_type == "recurring":
        recurrence_changed = False
        if job_update.recurrence_time:
            job.schedule_config["recurrence_time"] = job_update.recurrence_time
            recurrence_changed = True
        if job_update.recurrence_start_date:
            job.schedule_config["recurrence_start_date"] = job_update.recurrence_start_date.isoformat()
            recurrence_changed = True
        if recurrence_changed:
            job.next_run_at = _next_daily_occurrence(job.schedule_config, reference=now, initial=True)
            changed = True
    if job_update.status in {"active", "paused"}:
        job.status = job_update.status
        if job.status == "active" and job.job_type == "recurring":
            job.next_run_at = job.next_run_at or _next_daily_occurrence(job.schedule_config, reference=now, initial=True)
        changed = True
    job.updated_at = now
    if not changed:
        return job
    await db.scheduler_jobs.update_one(
        {"id": job.id},
        {"$set": prepare_for_mongo(job.model_dump())}
    )
    return job

@api_router.post("/scheduler/jobs/{job_id}/pause")
async def pause_scheduler_job(job_id: str, current_user: User = Depends(get_current_user)):
    job = await _get_scheduler_job(job_id, current_user)
    await db.scheduler_jobs.update_one({"id": job.id}, {"$set": {"status": "paused", "updated_at": datetime.now(timezone.utc).isoformat()}})
    return {"message": "Задание приостановлено"}

@api_router.post("/scheduler/jobs/{job_id}/resume")
async def resume_scheduler_job(job_id: str, current_user: User = Depends(get_current_user)):
    job = await _get_scheduler_job(job_id, current_user)
    next_run = _calculate_next_run(job, initial=True)
    await db.scheduler_jobs.update_one(
        {"id": job.id},
        {"$set": {"status": "active", "next_run_at": next_run.isoformat() if next_run else None, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Задание возобновлено"}

@api_router.delete("/scheduler/jobs/{job_id}")
async def delete_scheduler_job(job_id: str, current_user: User = Depends(get_current_user)):
    job = await _get_scheduler_job(job_id, current_user)
    await db.scheduler_jobs.delete_one({"id": job.id})
    await db.scheduler_runs.delete_many({"job_id": job.id})
    return {"message": "Задание удалено"}

@api_router.get("/scheduler/jobs/{job_id}/runs", response_model=List[SchedulerRun])
async def get_scheduler_runs(job_id: str, current_user: User = Depends(get_current_user)):
    job = await _get_scheduler_job(job_id, current_user)
    runs = await db.scheduler_runs.find({"job_id": job.id}, {"_id": 0}).sort("started_at", -1).limit(50).to_list(50)
    return [SchedulerRun(**parse_from_mongo(run)) for run in runs]


# API Routes - Project Tasks
@api_router.post("/projects/{project_id}/tasks", response_model=ProjectTask)
async def create_project_task(project_id: str, task_input: ProjectTaskCreate, current_user: User = Depends(get_current_user)):
    """Create task in project (requires access to project)"""
    # Check project access
    if not await can_access_project(current_user, project_id):
        raise HTTPException(status_code=403, detail="Access denied to this project")
    
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")
    
    task_obj = ProjectTask(project_id=project_id, **task_input.model_dump())
    doc = prepare_for_mongo(task_obj.model_dump())
    
    await db.project_tasks.insert_one(doc)
    return task_obj

@api_router.get("/projects/{project_id}/tasks", response_model=List[ProjectTask])
async def get_project_tasks(project_id: str, current_user: User = Depends(get_current_user)):
    """Get all tasks for a project (requires access to project)"""
    if not await can_access_project(current_user, project_id):
        raise HTTPException(status_code=403, detail="Access denied to this project")
    
    tasks = await db.project_tasks.find({"project_id": project_id}, {"_id": 0}).to_list(1000)
    return [ProjectTask(**parse_from_mongo(task)) for task in tasks]

@api_router.get("/projects/{project_id}/tasks/bulk", response_model=List[ProjectTask])
async def get_project_tasks_bulk(project_id: str, current_user: User = Depends(get_current_user)):
    """Get all tasks for a project with all details (requires access to project)"""
    if not await can_access_project(current_user, project_id):
        raise HTTPException(status_code=403, detail="Access denied to this project")
    
    tasks = await db.project_tasks.find({"project_id": project_id}, {"_id": 0}).to_list(1000)
    return [ProjectTask(**parse_from_mongo(task)) for task in tasks]

@api_router.put("/projects/{project_id}/tasks/{task_id}", response_model=ProjectTask)
async def update_project_task(project_id: str, task_id: str, task_update: ProjectTaskUpdate, current_user: User = Depends(get_current_user)):
    """Update task in project (requires access to project)"""
    if not await can_access_project(current_user, project_id):
        raise HTTPException(status_code=403, detail="Access denied to this project")
    
    task = await db.project_tasks.find_one({"id": task_id, "project_id": project_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Задание не найдено")
    
    update_data = {k: v for k, v in task_update.dict().items() if v is not None}
    if update_data:
        await db.project_tasks.update_one(
            {"id": task_id, "project_id": project_id},
            {"$set": update_data}
        )
    
    updated_task = await db.project_tasks.find_one({"id": task_id}, {"_id": 0})
    return ProjectTask(**parse_from_mongo(updated_task))

@api_router.delete("/projects/{project_id}/tasks/{task_id}")
async def delete_project_task(project_id: str, task_id: str, current_user: User = Depends(get_current_user)):
    """Delete task from project (requires access to project)"""
    if not await can_access_project(current_user, project_id):
        raise HTTPException(status_code=403, detail="Access denied to this project")
    
    result = await db.project_tasks.delete_one({"id": task_id, "project_id": project_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Задание не найдено")
    return {"message": "Задание удалено"}


# Project Execution with Real-time Updates (SSE)
@api_router.get("/projects/{project_id}/execute")
async def execute_project(project_id: str, current_user: User = Depends(get_current_user)):
    """Execute project with real-time updates via Server-Sent Events (requires projects_execute permission and access to project)"""
    
    # Check permission
    if not await has_permission(current_user, 'projects_execute'):
        raise HTTPException(status_code=403, detail="Permission denied: projects_execute")
    
    # Check project access
    if not await can_access_project(current_user, project_id):
        raise HTTPException(status_code=403, detail="Access denied to this project")
    
    log_audit(
        "23",
        user_id=current_user.id,
        username=current_user.username,
        details={"project_id": project_id}
    )
    
    async def event_generator():
        try:
            # Store user_id for executions
            user_id = current_user.id
            
            # Get project
            project = await db.projects.find_one({"id": project_id}, {"_id": 0})
            if not project:
                yield f"data: {json.dumps({'type': 'error', 'message': 'Проект не найден'})}\n\n"
                return
            
            # Create unique session ID for this execution
            session_id = str(uuid.uuid4())
            
            # Don't update project status - projects are reusable templates now
            yield f"data: {json.dumps({'type': 'status', 'message': 'Начало выполнения проекта', 'session_id': session_id})}\n\n"
            
            # Get all tasks for this project
            tasks_cursor = db.project_tasks.find({"project_id": project_id}, {"_id": 0})
            tasks = await tasks_cursor.to_list(1000)
            
            if not tasks:
                yield f"data: {json.dumps({'type': 'error', 'message': 'Нет заданий для выполнения'})}\n\n"
                return
            
            total_tasks = len(tasks)
            completed_tasks = 0
            failed_tasks = 0
            
            yield f"data: {json.dumps({'type': 'info', 'message': f'Всего заданий: {total_tasks}'})}\n\n"
            
            # Process each task (each task = one host with multiple scripts)
            for task in tasks:
                task_obj = ProjectTask(**parse_from_mongo(task))
                
                # Get host
                host_doc = await db.hosts.find_one({"id": task_obj.host_id}, {"_id": 0})
                if not host_doc:
                    yield f"data: {json.dumps({'type': 'error', 'message': f'Хост не найден: {task_obj.host_id}'})}\n\n"
                    failed_tasks += 1
                    continue
                
                host = Host(**parse_from_mongo(host_doc))
                
                # Get system
                system_doc = await db.systems.find_one({"id": task_obj.system_id}, {"_id": 0})
                if not system_doc:
                    yield f"data: {json.dumps({'type': 'error', 'message': f'Система не найдена: {task_obj.system_id}'})}\n\n"
                    failed_tasks += 1
                    continue
                
                system = System(**parse_from_mongo(system_doc))
                
                # Get scripts
                scripts_cursor = db.scripts.find({"id": {"$in": task_obj.script_ids}}, {"_id": 0})
                scripts = [Script(**parse_from_mongo(s)) for s in await scripts_cursor.to_list(1000)]
                
                if not scripts:
                    yield f"data: {json.dumps({'type': 'error', 'message': 'Скрипты не найдены для задания'})}\n\n"
                    failed_tasks += 1
                    continue
                
                # Update task status
                await db.project_tasks.update_one(
                    {"id": task_obj.id},
                    {"$set": {"status": "running"}}
                )
                
                yield f"data: {json.dumps({'type': 'task_start', 'host_name': host.name, 'host_address': host.hostname, 'system_name': system.name, 'scripts_count': len(scripts)})}\n\n"
                
                # Perform preliminary checks
                loop = asyncio.get_event_loop()
                
                # 1. Check network access
                network_ok, network_msg = await loop.run_in_executor(None, _check_network_access, host)
                yield f"data: {json.dumps({'type': 'check_network', 'host_name': host.name, 'success': network_ok, 'message': network_msg})}\n\n"
                
                if not network_ok:
                    # Mark all scripts as failed with network error
                    for script in scripts:
                        execution = Execution(
                            project_id=project_id,
                            project_task_id=task_obj.id,
                            execution_session_id=session_id,
                            host_id=host.id,
                            system_id=system.id,
                            script_id=script.id,
                            script_name=script.name,
                            success=False,
                            output="",
                            error=network_msg,
                            check_status="Ошибка",
                            executed_by=user_id
                        )
                        exec_doc = prepare_for_mongo(execution.model_dump())
                        await db.executions.insert_one(exec_doc)
                    
                    await db.project_tasks.update_one(
                        {"id": task_obj.id},
                        {"$set": {"status": "failed"}}
                    )
                    failed_tasks += 1
                    yield f"data: {json.dumps({'type': 'task_error', 'host_name': host.name, 'error': network_msg})}\n\n"
                    continue
                
                # 2. Check login and sudo (combined for SSH to avoid multiple connections)
                if host.connection_type == "winrm":
                    # For WinRM, check login first
                    login_ok, login_msg = await loop.run_in_executor(None, _check_winrm_login, host)
                    yield f"data: {json.dumps({'type': 'check_login', 'host_name': host.name, 'success': login_ok, 'message': login_msg})}\n\n"
                    
                    if not login_ok:
                        # Mark all scripts as failed with login error
                        for script in scripts:
                            execution = Execution(
                                project_id=project_id,
                                project_task_id=task_obj.id,
                                execution_session_id=session_id,
                                host_id=host.id,
                                system_id=system.id,
                                script_id=script.id,
                                script_name=script.name,
                                success=False,
                                output="",
                                error=login_msg,
                                check_status="Ошибка",
                            executed_by=user_id
                            )
                            exec_doc = prepare_for_mongo(execution.model_dump())
                            await db.executions.insert_one(exec_doc)
                        
                        await db.project_tasks.update_one(
                            {"id": task_obj.id},
                            {"$set": {"status": "failed"}}
                        )
                        failed_tasks += 1
                        yield f"data: {json.dumps({'type': 'task_error', 'host_name': host.name, 'error': login_msg})}\n\n"
                        continue
                    
                    # Then check admin access
                    sudo_ok, sudo_msg = await loop.run_in_executor(None, _check_admin_access, host)
                    yield f"data: {json.dumps({'type': 'check_sudo', 'host_name': host.name, 'success': sudo_ok, 'message': sudo_msg})}\n\n"
                else:
                    # For SSH, check both login and sudo in one connection
                    login_ok, login_msg, sudo_ok, sudo_msg = await loop.run_in_executor(None, _check_ssh_login_and_sudo, host)
                    yield f"data: {json.dumps({'type': 'check_login', 'host_name': host.name, 'success': login_ok, 'message': login_msg})}\n\n"
                    
                    if not login_ok:
                        # Mark all scripts as failed with login error
                        for script in scripts:
                            execution = Execution(
                                project_id=project_id,
                                project_task_id=task_obj.id,
                                execution_session_id=session_id,
                                host_id=host.id,
                                system_id=system.id,
                                script_id=script.id,
                                script_name=script.name,
                                success=False,
                                output="",
                                error=login_msg,
                                check_status="Ошибка",
                            executed_by=user_id
                            )
                            exec_doc = prepare_for_mongo(execution.model_dump())
                            await db.executions.insert_one(exec_doc)
                        
                        await db.project_tasks.update_one(
                            {"id": task_obj.id},
                            {"$set": {"status": "failed"}}
                        )
                        failed_tasks += 1
                        yield f"data: {json.dumps({'type': 'task_error', 'host_name': host.name, 'error': login_msg})}\n\n"
                        continue
                    
                    # Send sudo check result
                    yield f"data: {json.dumps({'type': 'check_sudo', 'host_name': host.name, 'success': sudo_ok, 'message': sudo_msg})}\n\n"
                
                if not sudo_ok:
                    # Mark all scripts as failed with sudo error
                    for script in scripts:
                        execution = Execution(
                            project_id=project_id,
                            project_task_id=task_obj.id,
                            execution_session_id=session_id,
                            host_id=host.id,
                            system_id=system.id,
                            script_id=script.id,
                            script_name=script.name,
                            success=False,
                            output="",
                            error=sudo_msg,
                            check_status="Ошибка",
                            executed_by=user_id
                        )
                        exec_doc = prepare_for_mongo(execution.model_dump())
                        await db.executions.insert_one(exec_doc)
                    
                    await db.project_tasks.update_one(
                        {"id": task_obj.id},
                        {"$set": {"status": "failed"}}
                    )
                    failed_tasks += 1
                    yield f"data: {json.dumps({'type': 'task_error', 'host_name': host.name, 'error': sudo_msg})}\n\n"
                    continue
                
                # All checks passed, proceed with script execution
                task_success = True
                task_results = []
                scripts_completed = 0
                
                try:
                    # Execute scripts sequentially on the same host with one connection
                    for idx, script in enumerate(scripts, 1):
                        # Get reference data for this script
                        reference_data = task_obj.reference_data.get(script.id, '') if task_obj.reference_data else ''
                        
                        # Use processor if available
                        result = await execute_check_with_processor(host, script.content, script.processor_script, reference_data)
                        
                        scripts_completed += 1
                        yield f"data: {json.dumps({'type': 'script_progress', 'host_name': host.name, 'completed': scripts_completed, 'total': len(scripts)})}\n\n"
                        
                        # Save execution result with session_id
                        execution = Execution(
                            project_id=project_id,
                            project_task_id=task_obj.id,
                            execution_session_id=session_id,  # NEW: Link to session
                            host_id=host.id,
                            system_id=system.id,
                            script_id=script.id,
                            script_name=script.name,
                            success=result.success,
                            output=result.output,
                            error=result.error,
                            check_status=result.check_status,
                            executed_by=user_id
                        )
                        
                        exec_doc = prepare_for_mongo(execution.model_dump())
                        await db.executions.insert_one(exec_doc)
                        
                        task_results.append(execution)
                        
                        if not result.success:
                            task_success = False
                    
                    # Update task status - host is successful if all preliminary checks passed
                    await db.project_tasks.update_one(
                        {"id": task_obj.id},
                        {"$set": {"status": "completed"}}
                    )
                    
                    # Host completed successfully (passed preliminary checks)
                    completed_tasks += 1
                    yield f"data: {json.dumps({'type': 'task_complete', 'host_name': host.name, 'success': True})}\n\n"
                
                except Exception as e:
                    failed_tasks += 1
                    await db.project_tasks.update_one(
                        {"id": task_obj.id},
                        {"$set": {"status": "failed"}}
                    )
                    yield f"data: {json.dumps({'type': 'task_error', 'host_name': host.name, 'error': str(e)})}\n\n"
            
            # Send completion event (don't update project status - project is reusable)
            # completed_tasks = hosts that passed all preliminary checks
            successful_hosts = completed_tasks
            final_status = "completed" if failed_tasks == 0 else "failed"
            yield f"data: {json.dumps({'type': 'complete', 'status': final_status, 'completed': completed_tasks, 'failed': failed_tasks, 'total': total_tasks, 'successful_hosts': successful_hosts, 'session_id': session_id})}\n\n"
        
        except Exception as e:
            logger.error(f"Error during project execution: {str(e)}")
            yield f"data: {json.dumps({'type': 'error', 'message': f'Ошибка: {str(e)}'})}\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@api_router.get("/audit/logs", response_model=List[AuditLog])
async def get_audit_logs(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    event_types: Optional[str] = None,
    limit: int = 200,
    current_user: User = Depends(get_current_user)
):
    """Fetch audit logs with optional filters (admin only)"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Access denied")
    
    query: Dict[str, Any] = {}
    created_filter: Dict[str, Any] = {}
    
    start_dt = _parse_datetime_param(start_date) if start_date else None
    end_dt = _parse_datetime_param(end_date, end_of_day=True) if end_date else None
    
    if start_dt:
        created_filter["$gte"] = start_dt.isoformat()
    if end_dt:
        created_filter["$lte"] = end_dt.isoformat()
    if created_filter:
        query["created_at"] = created_filter
    
    if event_types:
        events = [event.strip() for event in event_types.split(",") if event.strip()]
        if events:
            query["event"] = {"$in": events}
    
    limit = max(1, min(limit, 500))
    
    logs = await db.audit_logs.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return [AuditLog(**parse_from_mongo(log)) for log in logs]


# Get project execution results
@api_router.get("/projects/{project_id}/executions", response_model=List[Execution])
async def get_project_executions(project_id: str, current_user: User = Depends(get_current_user)):
    """Get all execution results for a project"""
    if not await has_permission(current_user, 'results_view_all'):
        if not await can_access_project(current_user, project_id):
            raise HTTPException(status_code=403, detail="Access denied to this project")
    
    executions = await db.executions.find(
        {"project_id": project_id},
        {"_id": 0}
    ).sort("executed_at", -1).to_list(1000)
    
    log_audit(
        "25",
        user_id=current_user.id,
        username=current_user.username,
        details={"project_id": project_id, "scope": "project"}
    )
    
    return [Execution(**parse_from_mongo(execution)) for execution in executions]

# Get execution sessions for project (list of unique session runs)
@api_router.get("/projects/{project_id}/sessions")
async def get_project_sessions(project_id: str, current_user: User = Depends(get_current_user)):
    """Get list of execution sessions for a project (requires results_view_all or project access)"""
    # Check access: user must either view all results or have access to the project
    if not await has_permission(current_user, 'results_view_all'):
        if not await can_access_project(current_user, project_id):
            raise HTTPException(status_code=403, detail="Access denied to this project")

    # Get distinct session IDs with their timestamps and check status counts
    # If check_status is not one of the expected values, count it as error
    pipeline = [
        {"$match": {"project_id": project_id, "execution_session_id": {"$ne": None}}},
        {"$group": {
            "_id": "$execution_session_id",
            "executed_at": {"$first": "$executed_at"},
            "count": {"$sum": 1},
            "passed_count": {
                "$sum": {"$cond": [{"$eq": ["$check_status", "Пройдена"]}, 1, 0]}
            },
            "failed_count": {
                "$sum": {"$cond": [{"$eq": ["$check_status", "Не пройдена"]}, 1, 0]}
            },
            "operator_count": {
                "$sum": {"$cond": [{"$eq": ["$check_status", "Оператор"]}, 1, 0]}
            },
            "explicit_error_count": {
                "$sum": {"$cond": [{"$eq": ["$check_status", "Ошибка"]}, 1, 0]}
            },
            # Count executions with null, empty, or unexpected check_status as errors
            "other_count": {
                "$sum": {
                    "$cond": [
                        {
                            "$and": [
                                {"$ne": ["$check_status", "Пройдена"]},
                                {"$ne": ["$check_status", "Не пройдена"]},
                                {"$ne": ["$check_status", "Оператор"]},
                                {"$ne": ["$check_status", "Ошибка"]}
                            ]
                        },
                        1,
                        0
                    ]
                }
            }
        }},
        {"$sort": {"executed_at": -1}}
    ]
    
    sessions = await db.executions.aggregate(pipeline).to_list(1000)
    
    return [{
        "session_id": s["_id"],
        "executed_at": s["executed_at"],
        "total_checks": s["count"],
        "passed_count": s["passed_count"],
        "failed_count": s["failed_count"],
        # Combine explicit errors and unknown statuses
        "error_count": s["explicit_error_count"] + s["other_count"],
        "operator_count": s["operator_count"]
    } for s in sessions]

# Get executions for specific session
@api_router.get("/projects/{project_id}/sessions/{session_id}/executions", response_model=List[Execution])
async def get_session_executions(project_id: str, session_id: str, current_user: User = Depends(get_current_user)):
    """Get all executions for a specific session (requires results_view_all or project access)"""
    # Check if user can view all results or has access to project
    if not await has_permission(current_user, 'results_view_all'):
        if not await can_access_project(current_user, project_id):
            raise HTTPException(status_code=403, detail="Access denied to this project")
    
    executions = await db.executions.find(
        {"project_id": project_id, "execution_session_id": session_id},
        {"_id": 0}
    ).sort("executed_at", 1).to_list(1000)
    
    log_audit(
        "project_results_viewed",
        user_id=current_user.id,
        username=current_user.username,
        details={"project_id": project_id, "session_id": session_id, "scope": "session"}
    )
    
    return [Execution(**parse_from_mongo(execution)) for execution in executions]


# API Routes - Execution (Legacy single-script execution)
@api_router.post("/execute")
async def execute_script(execute_req: ExecuteRequest, current_user: User = Depends(get_current_user)):
    """Execute script on selected hosts (legacy endpoint)"""
    # Get script
    script_doc = await db.scripts.find_one({"id": execute_req.script_id}, {"_id": 0})
    if not script_doc:
        raise HTTPException(status_code=404, detail="Скрипт не найден")
    
    script = Script(**parse_from_mongo(script_doc))
    
    # Get system for this script
    system_doc = await db.systems.find_one({"id": script.system_id}, {"_id": 0})
    if not system_doc:
        raise HTTPException(status_code=404, detail="Система не найдена")
    
    system = System(**parse_from_mongo(system_doc))
    
    # Get hosts
    hosts_cursor = db.hosts.find({"id": {"$in": execute_req.host_ids}}, {"_id": 0})
    hosts = [Host(**parse_from_mongo(h)) for h in await hosts_cursor.to_list(1000)]
    
    if not hosts:
        raise HTTPException(status_code=404, detail="Хосты не найдены")
    
    # Execute on all hosts concurrently
    tasks = [execute_check_with_processor(host, script.content, script.processor_script) for host in hosts]
    results = await asyncio.gather(*tasks)
    
    # Save execution records (one per host)
    execution_ids = []
    for host, result in zip(hosts, results):
        execution = Execution(
            host_id=host.id,
            system_id=system.id,
            script_id=script.id,
            script_name=script.name,
            success=result.success,
            output=result.output,
            error=result.error,
            check_status=result.check_status,
            executed_by=current_user.id
        )
        
        doc = prepare_for_mongo(execution.model_dump())
        await db.executions.insert_one(doc)
        execution_ids.append(execution.id)
    
    return {"execution_ids": execution_ids, "results": [r.model_dump() for r in results]}

@api_router.get("/executions", response_model=List[Execution])
async def get_executions(current_user: User = Depends(get_current_user)):
    """Get all executions (requires results_view_all or shows own executions)"""
    if await has_permission(current_user, 'results_view_all'):
        executions = await db.executions.find({}, {"_id": 0}).sort("executed_at", -1).to_list(1000)
    else:
        executions = await db.executions.find({"executed_by": current_user.id}, {"_id": 0}).sort("executed_at", -1).to_list(1000)
    
    return [Execution(**parse_from_mongo(execution)) for execution in executions]

@api_router.get("/executions/{execution_id}", response_model=Execution)
async def get_execution(execution_id: str, current_user: User = Depends(get_current_user)):
    """Get execution by ID"""
    execution = await db.executions.find_one({"id": execution_id}, {"_id": 0})
    if not execution:
        raise HTTPException(status_code=404, detail="Выполнение не найдено")
    
    # Check access
    if not await has_permission(current_user, 'results_view_all'):
        if execution.get('executed_by') != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    return Execution(**parse_from_mongo(execution))


# Excel Export Endpoint
@api_router.get("/projects/{project_id}/sessions/{session_id}/export-excel")
async def export_session_to_excel(project_id: str, session_id: str, current_user: User = Depends(get_current_user)):
    """Export session execution results to Excel file (requires results_export_all or project access)"""
    
    # Check if user can export all results or has access to project
    if not await has_permission(current_user, 'results_export_all'):
        if not await can_access_project(current_user, project_id):
            raise HTTPException(status_code=403, detail="Access denied to this project")
    
    log_audit(
        "26",
        user_id=current_user.id,
        username=current_user.username,
        details={"project_id": project_id, "session_id": session_id}
    )
    
    # Get project info
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")
    
    # Get executions for this session
    executions = await db.executions.find(
        {"project_id": project_id, "execution_session_id": session_id},
        {"_id": 0}
    ).sort("executed_at", 1).to_list(1000)
    
    if not executions:
        raise HTTPException(status_code=404, detail="Результаты выполнения не найдены")
    
    # Get scripts cache for methodology and criteria
    scripts_cache = {}
    hosts_cache = {}
    
    # Create workbook and worksheet
    wb = Workbook()
    ws = wb.active
    ws.title = "Протокол испытаний"
    
    # Define styles
    thick_border = Border(
        left=Side(style='thick'),
        right=Side(style='thick'),
        top=Side(style='thick'),
        bottom=Side(style='thick')
    )
    yellow_fill = PatternFill(start_color="FFD966", end_color="FFD966", fill_type="solid")
    header_font = Font(bold=True, size=11)
    
    # A1: Протокол
    ws['A1'] = "Протокол проведения испытаний №"
    ws['A1'].font = Font(bold=True, size=14)
    
    # A2: Информационная система
    ws['A2'] = "Информационная система ..."
    ws['A2'].font = Font(bold=True, size=12)
    
    # A4: Место проведения
    ws['A4'] = "Место проведения испытаний: удалённо"
    
    # A5: Дата
    ws['A5'] = f"Дата проведения испытаний: {date.today().strftime('%d.%m.%Y')}"
    
    # Row 8: Table headers
    headers = [
        "№ п/п",
        "Реализация требования ИБ",
        "№ п/п",
        "Описание методики испытания",
        "Критерий успешного прохождения испытания",
        "Результат испытания",
        "Комментарии",
        "Уровень критичности"
    ]
    
    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=8, column=col, value=header)
        cell.font = header_font
        cell.fill = yellow_fill
        cell.border = thick_border
        cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
    
    # Data rows starting from row 9
    row_num = 9
    for idx, execution_data in enumerate(executions, 1):
        execution = Execution(**parse_from_mongo(execution_data))
        
        # Get script info (with caching)
        if execution.script_id not in scripts_cache:
            script_doc = await db.scripts.find_one({"id": execution.script_id}, {"_id": 0})
            scripts_cache[execution.script_id] = script_doc
        script = scripts_cache.get(execution.script_id, {})
        
        # Get host info (with caching)
        if execution.host_id not in hosts_cache:
            host_doc = await db.hosts.find_one({"id": execution.host_id}, {"_id": 0})
            hosts_cache[execution.host_id] = host_doc
        host = hosts_cache.get(execution.host_id, {})
        
        # Prepare data
        test_methodology = script.get('test_methodology', '') or ''
        success_criteria = script.get('success_criteria', '') or ''
        
        # Result mapping
        result_map = {
            "Пройдена": "Пройдена",
            "Не пройдена": "Не пройдена",
            "Ошибка": "Ошибка",
            "Оператор": "Требует участия оператора"
        }
        result = result_map.get(execution.check_status, execution.check_status or "Не определён")
        
        # Level of criticality column - host and username info
        host_info = ""
        if host:
            hostname_or_ip = host.get('hostname', 'неизвестно')
            username = host.get('username', 'неизвестно')
            host_info = f"Испытания проводились на хосте {hostname_or_ip} под учетной записью {username}"
        
        # Write row data
        row_data = [
            idx,  # № п/п
            "",   # Реализация требования ИБ (пусто)
            idx,  # № п/п (дубликат)
            test_methodology,  # Описание методики
            success_criteria,  # Критерий успешного прохождения
            result,  # Результат
            "",  # Комментарии (пусто)
            host_info  # Уровень критичности
        ]
        
        for col, value in enumerate(row_data, 1):
            cell = ws.cell(row=row_num, column=col, value=value)
            cell.border = Border(
                left=Side(style='thin'),
                right=Side(style='thin'),
                top=Side(style='thin'),
                bottom=Side(style='thin')
            )
            cell.alignment = Alignment(vertical='top', wrap_text=True)
        
        row_num += 1
    
    # Set column widths
    ws.column_dimensions['A'].width = 8   # № п/п
    ws.column_dimensions['B'].width = 25  # Реализация требования ИБ
    ws.column_dimensions['C'].width = 8   # № п/п
    ws.column_dimensions['D'].width = 35  # Описание методики
    ws.column_dimensions['E'].width = 35  # Критерий успешного прохождения
    ws.column_dimensions['F'].width = 20  # Результат
    ws.column_dimensions['G'].width = 25  # Комментарии
    ws.column_dimensions['H'].width = 40  # Уровень критичности
    
    # Set row heights
    ws.row_dimensions[8].height = 40  # Header row
    
    # Save to temporary file
    with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp_file:
        wb.save(tmp_file.name)
        tmp_file_path = tmp_file.name
    
    # Generate filename
    filename = f"Протокол_испытаний_{date.today().strftime('%d%m%Y')}.xlsx"
    
    return FileResponse(
        path=tmp_file_path,
        filename=filename,
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )


# API Routes - User Management
@api_router.get("/users", response_model=List[UserResponse])
async def get_users(current_user: User = Depends(get_current_user)):
    """Get all users (requires users_manage permission)"""
    await require_permission(current_user, 'users_manage', 'users_view')
    
    users = await db.users.find().to_list(length=None)
    return [UserResponse(**user) for user in users]

@api_router.post("/users", response_model=UserResponse)
async def create_user(user_input: UserCreate, current_user: User = Depends(get_current_user)):
    """Create new user (requires users_manage permission)"""
    await require_permission(current_user, 'users_manage')
    
    # Check if username already exists
    existing = await db.users.find_one({"username": user_input.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
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
            "new_user_id": str(user.id),
            "username": user_input.username,
            "target_full_name": user_input.full_name,
            "new_is_admin": user_input.is_admin,
            "created_by": current_user.username
        }
    )
    
    return UserResponse(**user.model_dump())

@api_router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(user_id: str, user_update: UserUpdate, current_user: User = Depends(get_current_user)):
    """Update user (requires users_manage permission)"""
    await require_permission(current_user, 'users_manage')
    
    # Find user
    user_doc = await db.users.find_one({"id": user_id})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
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

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: User = Depends(get_current_user)):
    """Delete user and reassign their data to admin (requires users_manage permission)"""
    await require_permission(current_user, 'users_manage')
    
    # Cannot delete yourself
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    # Find user to delete for logging
    user_to_delete_doc = await db.users.find_one({"id": user_id})
    if not user_to_delete_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_to_delete = User(**user_to_delete_doc)
    
    # Find admin user
    admin_user = await db.users.find_one({"is_admin": True})
    if not admin_user:
        raise HTTPException(status_code=500, detail="No admin user found")
    admin_id = admin_user['id']
    
    # Подсчет данных для перепривязки (для логирования)
    stats = {
        "categories_reassigned": 0,
        "systems_reassigned": 0,
        "scripts_reassigned": 0,
        "hosts_reassigned": 0,
        "projects_reassigned": 0,
        "executions_reassigned": 0,
        "roles_removed": 0,
        "project_access_removed": 0
    }
    
    # Reassign all data to admin
    categories_result = await db.categories.update_many({"created_by": user_id}, {"$set": {"created_by": admin_id}})
    stats["categories_reassigned"] = categories_result.modified_count
    
    systems_result = await db.systems.update_many({"created_by": user_id}, {"$set": {"created_by": admin_id}})
    stats["systems_reassigned"] = systems_result.modified_count
    
    scripts_result = await db.scripts.update_many({"created_by": user_id}, {"$set": {"created_by": admin_id}})
    stats["scripts_reassigned"] = scripts_result.modified_count
    
    hosts_result = await db.hosts.update_many({"created_by": user_id}, {"$set": {"created_by": admin_id}})
    stats["hosts_reassigned"] = hosts_result.modified_count
    
    projects_result = await db.projects.update_many({"created_by": user_id}, {"$set": {"created_by": admin_id}})
    stats["projects_reassigned"] = projects_result.modified_count
    
    executions_result = await db.executions.update_many({"executed_by": user_id}, {"$set": {"executed_by": admin_id}})
    stats["executions_reassigned"] = executions_result.modified_count
    
    # Delete user roles
    roles_result = await db.user_roles.delete_many({"user_id": user_id})
    stats["roles_removed"] = roles_result.deleted_count
    
    # Delete project access
    access_result = await db.project_access.delete_many({"user_id": user_id})
    stats["project_access_removed"] = access_result.deleted_count
    
    # Delete user
    result = await db.users.delete_one({"id": user_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Логирование удаления пользователя
    log_audit(
        "5",  # Удаление пользователя
        user_id=current_user.id,
        username=current_user.username,
        details={
            "deleted_user_id": user_id,
            "username": user_to_delete.username,
            "full_name": user_to_delete.full_name,
            "is_admin": user_to_delete.is_admin,
            "reassigned_to_admin": admin_user['username'],
            "data_reassignment_stats": stats,
            "total_objects_reassigned": sum([
                stats["categories_reassigned"],
                stats["systems_reassigned"], 
                stats["scripts_reassigned"],
                stats["hosts_reassigned"],
                stats["projects_reassigned"],
                stats["executions_reassigned"]
            ])
        }
    )
    
    return {"message": "User deleted and data reassigned to admin"}

@api_router.put("/users/{user_id}/password")
async def reset_user_password(user_id: str, password_data: PasswordResetRequest, current_user: User = Depends(get_current_user)):
    """Reset user password (requires users_manage permission)"""
    await require_permission(current_user, 'users_manage')
    
    # Find user for logging
    user_doc = await db.users.find_one({"id": user_id})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    user = User(**user_doc)
    
    # Hash new password
    new_hash = hash_password(password_data.new_password)
    
    # Update password
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {"password_hash": new_hash}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Логирование сброса пароля
    log_audit(
        "4",  # Редактирование пользователя (или можно создать отдельное событие для сброса пароля)
        user_id=current_user.id,
        username=current_user.username,
        details={
            "target_username": user.username,
            "target_full_name": user.full_name,
            "changed_fields": "Был изменен пароль"
        }
    )
    
    return {"message": "Password updated successfully"}

@api_router.get("/users/{user_id}/roles")
async def get_user_roles(user_id: str, current_user: User = Depends(get_current_user)):
    """Get user's roles (requires users_manage permission)"""
    await require_permission(current_user, 'users_manage')
    
    user_roles = await db.user_roles.find({"user_id": user_id}).to_list(length=None)
    role_ids = [ur['role_id'] for ur in user_roles]
    
    roles = []
    for role_id in role_ids:
        role_doc = await db.roles.find_one({"id": role_id})
        if role_doc:
            roles.append(Role(**role_doc))
    
    return roles

@api_router.put("/users/{user_id}/roles")
async def assign_user_roles(user_id: str, role_ids: List[str], current_user: User = Depends(get_current_user)):
    """Assign roles to user (requires users_manage permission)"""
    await require_permission(current_user, 'users_manage')
    
    # Find user for logging
    user_doc = await db.users.find_one({"id": user_id})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    user = User(**user_doc)
    
    # Get current roles for comparison
    current_roles_docs = await db.user_roles.find({"user_id": user_id}).to_list(None)
    current_role_ids = [doc["role_id"] for doc in current_roles_docs]
    
    # Delete existing roles
    await db.user_roles.delete_many({"user_id": user_id})
    
    # Add new roles
    for role_id in role_ids:
        await db.user_roles.insert_one({
            "user_id": user_id,
            "role_id": role_id
        })
    
    # Логирование обновления ролей пользователя
    log_audit(
        "4",  # Редактирование пользователя
        user_id=current_user.id,
        username=current_user.username,
        details={
            "username": user.username,
            "target_full_name": user.full_name,
            "changed_fields": "Ролевая модель изменена",
            "old_roles_count": len(current_role_ids),
            "new_roles_count": len(role_ids)
        }
    )
    
    return {"message": "Roles assigned successfully"}


# API Routes - Role Management
@api_router.get("/roles", response_model=List[Role])
async def get_roles(current_user: User = Depends(get_current_user)):
    """Get all roles"""
    roles = await db.roles.find().to_list(length=None)
    return [Role(**role) for role in roles]

@api_router.post("/roles", response_model=Role)
async def create_role(role_input: RoleCreate, current_user: User = Depends(get_current_user)):
    """Create new role (requires roles_manage permission)"""
    await require_permission(current_user, 'roles_manage')
    
    # Получаем общее количество доступных прав
    total_permissions_count = len(PERMISSIONS)  # или ваш способ получения общего числа прав
    
    # Создаем роль
    role = Role(
        name=role_input.name,
        description=role_input.description,
        permissions=role_input.permissions
    )
    
    doc = prepare_for_mongo(role.model_dump())
    await db.roles.insert_one(doc)
    
    # Логирование создания роли
    log_audit(
        "6",  # Создание роли
        user_id=current_user.id,
        username=current_user.username,
        details={
            "role_id": str(role.id),
            "role_name": role_input.name,
            "permissions_count": len(role_input.permissions),
            "total_permissions": total_permissions_count,
            "permissions_ratio": f"{len(role_input.permissions)}/{total_permissions_count}",
            "created_by": current_user.username
        }
    )
    
    return Role(**role.model_dump())

@api_router.put("/roles/{role_id}", response_model=Role)
async def update_role(role_id: str, role_update: RoleUpdate, current_user: User = Depends(get_current_user)):
    """Update role (requires roles_manage permission)"""
    await require_permission(current_user, 'roles_manage')
    
    # Находим текущую роль для логирования
    current_role_doc = await db.roles.find_one({"id": role_id})
    if not current_role_doc:
        raise HTTPException(status_code=404, detail="Role not found")
    
    current_role = Role(**current_role_doc)
    
    # Получаем общее количество доступных прав
    total_permissions_count = len(PERMISSIONS)  # или ваш способ получения общего числа прав
    
    # Подготовка данных для логирования изменений
    changed_fields = {}
    update_data = {}
    
    for field, new_value in role_update.model_dump().items():
        if new_value is not None:
            old_value = getattr(current_role, field, None)
            if old_value != new_value:
                changed_fields[field] = {
                    "old": old_value,
                    "new": new_value
                }
                update_data[field] = new_value
    
    # Update fields
    if update_data:
        result = await db.roles.update_one({"id": role_id}, {"$set": update_data})
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Role not found")
    
    # Получаем обновленную роль для логирования новых прав
    updated_role_doc = await db.roles.find_one({"id": role_id})
    updated_role = Role(**updated_role_doc)
    
    # Логирование обновления роли
    log_audit(
        "7",  # Редактирование роли
        user_id=current_user.id,
        username=current_user.username,
        details={
            "role_id": role_id,
            "role_name": updated_role.name,
            "old_permissions_count": len(current_role.permissions),
            "new_permissions_count": len(updated_role.permissions),
            "total_permissions": total_permissions_count,
            "old_permissions_ratio": f"{len(current_role.permissions)}/{total_permissions_count}",
            "new_permissions_ratio": f"{len(updated_role.permissions)}/{total_permissions_count}",
            "changed_fields": list(changed_fields.keys()) if changed_fields else "Нет изменений",
            "updated_by": current_user.username
        }
    )
    
    return Role(**updated_role_doc)

@api_router.delete("/roles/{role_id}")
async def delete_role(role_id: str, current_user: User = Depends(get_current_user)):
    """Delete role (requires roles_manage permission)"""
    await require_permission(current_user, 'roles_manage')
    
    # Находим роль для логирования
    role_doc = await db.roles.find_one({"id": role_id})
    if not role_doc:
        raise HTTPException(status_code=404, detail="Role not found")
    
    role = Role(**role_doc)
    
    # Подсчет пользователей с этой ролью
    users_with_role_count = await db.user_roles.count_documents({"role_id": role_id})
    
    # Delete user-role assignments
    await db.user_roles.delete_many({"role_id": role_id})
    
    # Delete role
    result = await db.roles.delete_one({"id": role_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Role not found")
    
    # Логирование удаления роли
    log_audit(
        "8",  # Удаление роли
        user_id=current_user.id,
        username=current_user.username,
        details={
            "role_id": role_id,
            "role_name": role.name,
            "permissions_count": len(role.permissions),
            "affected_users_count": users_with_role_count,
            "deleted_by": current_user.username
        }
    )
    
    return {"message": "Role deleted successfully"}

@api_router.get("/permissions")
async def get_permissions(current_user: User = Depends(get_current_user)):
    """Get all available permissions"""
    return PERMISSIONS

# API Routes - Project Access Management
@api_router.get("/projects/{project_id}/users")
async def get_project_users(project_id: str, current_user: User = Depends(get_current_user)):
    """Get users with access to project"""
    # Check if user can access project
    if not await can_access_project(current_user, project_id):
        raise HTTPException(status_code=403, detail="Access denied to this project")
    
    # Get project access records
    access_records = await db.project_access.find({"project_id": project_id}).to_list(length=None)
    user_ids = [record['user_id'] for record in access_records]
    
    # Get users
    users = []
    for user_id in user_ids:
        user_doc = await db.users.find_one({"id": user_id})
        if user_doc:
            users.append(UserResponse(**user_doc))
    
    return users

@api_router.post("/projects/{project_id}/users/{user_id}")
async def grant_project_access(project_id: str, user_id: str, current_user: User = Depends(get_current_user)):
    """Grant user access to project"""
    # Check if current user is project creator or admin
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if project.get('created_by') != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Only project creator or admin can grant access")
    
    # Get user info for logging
    user_doc = await db.users.find_one({"id": user_id})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    user = User(**user_doc)
    
    # Check if access already exists
    existing = await db.project_access.find_one({
        "project_id": project_id,
        "user_id": user_id
    })
    
    if existing:
        return {"message": "User already has access"}
    
    # Grant access
    access = ProjectAccess(
        project_id=project_id,
        user_id=user_id,
        granted_by=current_user.id
    )
    
    doc = prepare_for_mongo(access.model_dump())
    await db.project_access.insert_one(doc)
    
    # Логирование предоставления доступа к проекту
    log_audit(
        "27",  # Предоставлен доступ к проекту
        user_id=current_user.id,
        username=current_user.username,
        details={
            "project_id": project_id,
            "project_name": project.get('name', 'Неизвестно'),
            "target_user_id": user_id,
            "target_username": user.username,
            "target_full_name": user.full_name,
            "access_granted_by": current_user.username,
            "action": "grant_project_access"
        }
    )
    
    return {"message": "Access granted successfully"}

@api_router.delete("/projects/{project_id}/users/{user_id}")
async def revoke_project_access(project_id: str, user_id: str, current_user: User = Depends(get_current_user)):
    """Revoke user access to project"""
    # Check if current user is project creator or admin
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if project.get('created_by') != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Only project creator or admin can revoke access")
    
    # Get user info for logging
    user_doc = await db.users.find_one({"id": user_id})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    user = User(**user_doc)
    
    # Revoke access
    result = await db.project_access.delete_one({
        "project_id": project_id,
        "user_id": user_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Access record not found")
    
    # Логирование отзыва доступа к проекту
    log_audit(
        "28",  # Отозван доступ к проекту
        user_id=current_user.id,
        username=current_user.username,
        details={
            "project_id": project_id,
            "project_name": project.get('name', 'Неизвестно'),
            "target_user_id": user_id,
            "target_username": user.username,
            "target_full_name": user.full_name,
            "access_revoked_by": current_user.username,
            "action": "revoke_project_access"
        }
    )
    
    return {"message": "Access revoked successfully"}
# Include the router in the main app
app.include_router(api_router)
# Минимальная рабочая CORS конфигурация
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Просто хардкодим для теста
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health():
    return {"status": "healthy"}

@app.on_event("startup")
async def startup_db_init():
    """Initialize database on startup if needed"""
    try:
        # Check if admin user exists
        existing_admin = await db.users.find_one({"username": "admin"})
        
        if not existing_admin:
            logger.info("🚀 Initializing database with admin user and roles...")
            
            # Create admin user
            admin_id = str(uuid.uuid4())
            admin_user = {
                "id": admin_id,
                "username": "admin",
                "full_name": "Администратор",
                "password_hash": hash_password("admin123"),
                "is_active": True,
                "is_admin": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "created_by": None
            }
            await db.users.insert_one(admin_user)
            logger.info("✅ Created admin user")
            
            # Create default roles
            roles = [
                {
                    "id": str(uuid.uuid4()),
                    "name": "Администратор",
                    "permissions": list(PERMISSIONS.keys()),
                    "description": "Полный доступ ко всем функциям системы",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "created_by": admin_id
                },
                {
                    "id": str(uuid.uuid4()),
                    "name": "Исполнитель",
                    "permissions": ['projects_execute'],
                    "description": "Только выполнение назначенных проектов",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "created_by": admin_id
                },
                {
                    "id": str(uuid.uuid4()),
                    "name": "Куратор",
                    "permissions": ['results_view_all', 'results_export_all'],
                    "description": "Просмотр и экспорт всех результатов",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "created_by": admin_id
                },
                {
                    "id": str(uuid.uuid4()),
                    "name": "Разработчик проверок",
                    "permissions": [
                        'checks_create', 'checks_edit_own', 'checks_delete_own',
                        'hosts_create', 'hosts_edit_own', 'hosts_delete_own'
                    ],
                    "description": "Создание и редактирование своих проверок и хостов",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "created_by": admin_id
                },
                {
                    "id": str(uuid.uuid4()),
                    "name": "Менеджер проектов",
                    "permissions": [
                        'projects_create', 'projects_execute',
                        'results_view_all', 'results_export_all'
                    ],
                    "description": "Создание и выполнение проектов, просмотр результатов",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "created_by": admin_id
                }
            ]
            await db.roles.insert_many(roles)
            logger.info(f"✅ Created {len(roles)} default roles")
            
            # Migrate existing data - assign to admin
            categories_updated = await db.categories.update_many(
                {"created_by": {"$exists": False}},
                {"$set": {"created_by": admin_id}}
            )
            systems_updated = await db.systems.update_many(
                {"created_by": {"$exists": False}},
                {"$set": {"created_by": admin_id}}
            )
            scripts_updated = await db.scripts.update_many(
                {"created_by": {"$exists": False}},
                {"$set": {"created_by": admin_id}}
            )
            hosts_updated = await db.hosts.update_many(
                {"created_by": {"$exists": False}},
                {"$set": {"created_by": admin_id}}
            )
            projects_updated = await db.projects.update_many(
                {"created_by": {"$exists": False}},
                {"$set": {"created_by": admin_id}}
            )
            executions_updated = await db.executions.update_many(
                {"executed_by": {"$exists": False}},
                {"$set": {"executed_by": admin_id}}
            )
            
            logger.info(f"✅ Migrated existing data: {categories_updated.modified_count} categories, "
                       f"{systems_updated.modified_count} systems, {scripts_updated.modified_count} scripts, "
                       f"{hosts_updated.modified_count} hosts, {projects_updated.modified_count} projects, "
                       f"{executions_updated.modified_count} executions")
            
            logger.info("✨ Database initialization complete!")
        else:
            logger.info("✅ Database already initialized")
        global scheduler_task
        if scheduler_task is None:
            scheduler_task = asyncio.create_task(scheduler_worker())
    except Exception as e:
        logger.error(f"❌ Database initialization failed: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
    global scheduler_task
    if scheduler_task:
        scheduler_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await scheduler_task
        scheduler_task = None