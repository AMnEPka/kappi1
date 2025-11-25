"""Scheduler API endpoints"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List
from datetime import datetime, timezone

from config.config_init import db
from models.execution_models import SchedulerJob, SchedulerJobCreate, SchedulerJobUpdate, SchedulerRun
from models.auth_models import User
from services.services_auth import get_current_user, require_permission, can_access_project
from scheduler.scheduler_utils import normalize_run_times, next_daily_occurrence, calculate_next_run
from utils.db_utils import prepare_for_mongo, parse_from_mongo
from utils.audit_utils import log_audit

router = APIRouter()


# ============================================================================
# Helper Functions
# ============================================================================

async def _ensure_project_access(current_user: User, project_id: str):
    """Ensure user has access to project"""
    if not (await can_access_project(current_user, project_id)):
        raise HTTPException(status_code=403, detail="Access denied to this project")


def _get_job_type_label(job_type: str) -> str:
    """Get Russian label for job type"""
    labels = {
        "one_time": "Одиночный",
        "multi_run": "Множественный", 
        "recurring": "Ежедневный"
    }
    return labels.get(job_type, job_type)


async def _get_scheduler_job(job_id: str, current_user: User) -> SchedulerJob:
    """Get scheduler job by ID with access check"""
    job_doc = await db.scheduler_jobs.find_one({"id": job_id}, {"_id": 0})
    if not job_doc:
        raise HTTPException(status_code=404, detail="Задание не найдено")
    if not current_user.is_admin and job_doc.get("created_by") != current_user.id:
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    return SchedulerJob(**parse_from_mongo(job_doc))


# ============================================================================
# Scheduler Jobs API
# ============================================================================

@router.get("/scheduler/jobs", response_model=List[SchedulerJob])
async def list_scheduler_jobs(current_user: User = Depends(get_current_user)):
    """Get all scheduler jobs (admin sees all, others see only own)"""
    query = {} if current_user.is_admin else {"created_by": current_user.id}
    jobs = await db.scheduler_jobs.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [SchedulerJob(**parse_from_mongo(job)) for job in jobs]


@router.post("/scheduler/jobs", response_model=SchedulerJob)
async def create_scheduler_job(job_input: SchedulerJobCreate, current_user: User = Depends(get_current_user)):
    """Create new scheduler job (requires projects_execute permission)"""
    await require_permission(current_user, 'projects_execute')
    await _ensure_project_access(current_user, job_input.project_id)
    
    # Get project name for logging
    project = await db.projects.find_one({"id": job_input.project_id})
    project_name = project.get('name') if project else "Неизвестный проект"
    
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
        job.run_times = normalize_run_times(job_input.run_times)
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
        job.next_run_at = next_daily_occurrence(job.schedule_config, reference=now, initial=True)
    else:
        raise HTTPException(status_code=400, detail="Неверный тип задания")
    doc = prepare_for_mongo(job.model_dump())
    await db.scheduler_jobs.insert_one(doc)
    
    # Логирование создания задания планировщика
    log_audit(
        "29",  # Создание задания планировщика
        user_id=current_user.id,
        username=current_user.username,
        details={
            "job_name": job_input.name,
            "project_name": project_name,
            "job_type_label": _get_job_type_label(job_input.job_type)
        }
    )
    
    return job


@router.put("/scheduler/jobs/{job_id}", response_model=SchedulerJob)
async def update_scheduler_job(job_id: str, job_update: SchedulerJobUpdate, current_user: User = Depends(get_current_user)):
    """Update scheduler job (requires projects_execute permission)"""
    await require_permission(current_user, 'projects_execute')
    job = await _get_scheduler_job(job_id, current_user)
    
    # Get project name for logging
    project = await db.projects.find_one({"id": job.project_id})
    project_name = project.get('name') if project else "Неизвестный проект"

    # ДЕБАГ: вывести все поля проекта
    print("=== DEBUG PROJECT FIELDS ===")
    print(f"Project ID: {job.project_id}")
    if project:
        print("All project fields:")
        for key, value in project.items():
            print(f"  {key}: {value}")
    else:
        print("Project not found!")
    print("===========================")    
    
    changed = False
    updated_fields = []
    now = datetime.now(timezone.utc)
    
    if job_update.name:
        job.name = job_update.name
        changed = True
        updated_fields.append("название")
    
    if job.job_type == "one_time" and job_update.run_at:
        job.next_run_at = job_update.run_at if job_update.run_at.tzinfo else job_update.run_at.replace(tzinfo=timezone.utc)
        job.status = "active"
        changed = True
        updated_fields.append("время запуска")
    
    if job.job_type == "multi_run" and job_update.run_times:
        job.run_times = normalize_run_times(job_update.run_times)
        job.remaining_runs = len(job.run_times)
        job.next_run_at = job.run_times[0] if job.run_times else None
        job.status = "active" if job.run_times else "completed"
        changed = True
        updated_fields.append("расписание запусков")
    
    if job.job_type == "recurring":
        recurrence_changed = False
        if job_update.recurrence_time:
            job.schedule_config["recurrence_time"] = job_update.recurrence_time
            recurrence_changed = True
            updated_fields.append("время повторения")
        if job_update.recurrence_start_date:
            job.schedule_config["recurrence_start_date"] = job_update.recurrence_start_date.isoformat()
            recurrence_changed = True
            updated_fields.append("дата начала")
        if recurrence_changed:
            job.next_run_at = next_daily_occurrence(job.schedule_config, reference=now, initial=True)
            changed = True
    
    if job_update.status in {"active", "paused"}:
        job.status = job_update.status
        status_label = "активен" if job_update.status == "active" else "приостановлен"
        if job.status == "active" and job.job_type == "recurring":
            job.next_run_at = job.next_run_at or next_daily_occurrence(job.schedule_config, reference=now, initial=True)
        changed = True
        updated_fields.append(f"статус ({status_label})")
    
    job.updated_at = now
    
    if not changed:
        return job
    
    await db.scheduler_jobs.update_one(
        {"id": job.id},
        {"$set": prepare_for_mongo(job.model_dump())}
    )
    
    # Логирование обновления задания планировщика
    log_audit(
        "30",  # Редактирование задания планировщика
        user_id=current_user.id,
        username=current_user.username,
        details={
            "job_name": job.name,
            "project_name": project_name,
            "job_type": job.job_type,
            "job_type_label": _get_job_type_label(job.job_type),
            "updated_fields": updated_fields
        }
    )
    
    return job


@router.post("/scheduler/jobs/{job_id}/pause")
async def pause_scheduler_job(job_id: str, current_user: User = Depends(get_current_user)):
    """Pause scheduler job"""
    job = await _get_scheduler_job(job_id, current_user)
    
    # Get project name for logging
    project = await db.projects.find_one({"id": job.project_id})
    project_name = project.get('name') if project else "Неизвестный проект"
    
    await db.scheduler_jobs.update_one({"id": job.id}, {"$set": {"status": "paused", "updated_at": datetime.now(timezone.utc).isoformat()}})
    
    # Логирование приостановки задания планировщика
    log_audit(
        "31",  # Задание планировщика приостановлено
        user_id=current_user.id,
        username=current_user.username,
        details={
            "job_name": job.name,
            "project_name": project_name,
            "job_type_label": _get_job_type_label(job.job_type)
        }
    )
    
    return {"message": "Задание приостановлено"}


@router.post("/scheduler/jobs/{job_id}/resume")
async def resume_scheduler_job(job_id: str, current_user: User = Depends(get_current_user)):
    """Resume scheduler job"""
    job = await _get_scheduler_job(job_id, current_user)
    
    # Get project name for logging
    project = await db.projects.find_one({"id": job.project_id})
    project_name = project.get('name') if project else "Неизвестный проект"
    
    next_run = calculate_next_run(job, initial=True)
    await db.scheduler_jobs.update_one(
        {"id": job.id},
        {"$set": {"status": "active", "next_run_at": next_run.isoformat() if next_run else None, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Логирование возобновления задания планировщика
    log_audit(
        "32",  # Задание планировщика возобновлено
        user_id=current_user.id,
        username=current_user.username,
        details={
            "job_name": job.name,
            "project_name": project_name,
            "job_type_label": _get_job_type_label(job.job_type)
        }
    )
    
    return {"message": "Задание возобновлено"}


@router.delete("/scheduler/jobs/{job_id}")
async def delete_scheduler_job(job_id: str, current_user: User = Depends(get_current_user)):
    """Delete scheduler job"""
    job = await _get_scheduler_job(job_id, current_user)
    
    # Get project name for logging
    project = await db.projects.find_one({"id": job.project_id})
    project_name = project.get('name') if project else "Неизвестный проект"
    
    await db.scheduler_jobs.delete_one({"id": job.id})
    await db.scheduler_runs.delete_many({"job_id": job.id})
    
    # Логирование удаления задания планировщика
    log_audit(
        "33",  # Удаление задания планировщика
        user_id=current_user.id,
        username=current_user.username,
        details={
            "job_name": job.name,
            "project_name": project_name,
            "job_type_label": _get_job_type_label(job.job_type)
        }
    )
    
    return {"message": "Задание удалено"}


@router.get("/scheduler/jobs/{job_id}/runs", response_model=List[SchedulerRun])
async def get_scheduler_runs(job_id: str, current_user: User = Depends(get_current_user)):
    """Get scheduler runs for a job"""
    job = await _get_scheduler_job(job_id, current_user)
    runs = await db.scheduler_runs.find({"job_id": job.id}, {"_id": 0}).sort("started_at", -1).limit(50).to_list(50)
    return [SchedulerRun(**parse_from_mongo(run)) for run in runs]
