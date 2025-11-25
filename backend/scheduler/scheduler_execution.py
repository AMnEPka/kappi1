"""Scheduler execution functions for running scheduled jobs"""

import json
from datetime import datetime, timezone
from typing import Tuple, Optional, Dict, Any

from config.config_init import db, logger
from models.execution_models import SchedulerJob, SchedulerRun
from models.auth_models import User
from utils.db_utils import prepare_for_mongo, parse_from_mongo
from utils.audit_utils import log_audit
from .scheduler_utils import calculate_next_run


async def consume_streaming_response(streaming_response) -> Tuple[Optional[str], Optional[str]]:
    """Consume SSE streaming response and extract session_id and status
    
    Args:
        streaming_response: FastAPI StreamingResponse object
        
    Returns:
        Tuple of (session_id, final_status)
    """
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


async def update_job_after_run(job: SchedulerJob, *, run_success: bool) -> None:
    """Update scheduler job after execution
    
    Updates last_run_at, last_run_status, and calculates next_run_at.
    For one_time jobs, marks as completed.
    For multi_run jobs, removes completed run and updates remaining_runs.
    For recurring jobs, calculates next daily occurrence.
    
    Args:
        job: Scheduler job that was executed
        run_success: Whether the execution was successful
    """
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
        next_run = calculate_next_run(job, reference=now)
        update_fields["next_run_at"] = next_run.isoformat() if next_run else None
    await db.scheduler_jobs.update_one({"id": job.id}, {"$set": update_fields})


async def execute_scheduler_job(job: SchedulerJob) -> Tuple[Optional[str], Optional[str]]:
    """Execute a scheduler job by running its associated project
    
    Args:
        job: Scheduler job to execute
        
    Returns:
        Tuple of (session_id, final_status)
        
    Raises:
        RuntimeError: If job creator user not found
    """
    # Import here to avoid circular dependency
    from server import execute_project
    
    user_doc = await db.users.find_one({"id": job.created_by}, {"_id": 0})
    if not user_doc:
        raise RuntimeError("Creator of scheduler job not found")
    scheduler_user = User(**user_doc)

    # Получаем имя проекта
    project_doc = await db.projects.find_one({"id": job.project_id})
    project_name = project_doc.get('name') if project_doc else "Неизвестный проект"    
    
    log_audit(
        "24",
        user_id=scheduler_user.id,
        username=scheduler_user.username,
        details={
            "project_name": project_name, 
            "scheduler_job_name": job.name}
    )
    
    response = await execute_project(job.project_id, current_user=scheduler_user, skip_audit_log=True)  
    session_id, final_status = await consume_streaming_response(response)
    return session_id, final_status


async def handle_due_scheduler_job(job_doc: dict) -> None:
    """Handle a scheduler job that is due for execution
    
    Creates a scheduler run record, executes the job, and updates status.
    
    Args:
        job_doc: Scheduler job document from database
    """
    job = SchedulerJob(**parse_from_mongo(job_doc))
    now_iso = datetime.now(timezone.utc).isoformat()
    await db.scheduler_jobs.update_one({"id": job.id}, {"$set": {"next_run_at": None, "updated_at": now_iso}})
    run = SchedulerRun(job_id=job.id, project_id=job.project_id, launched_by_user=job.created_by)
    await db.scheduler_runs.insert_one(prepare_for_mongo(run.model_dump()))
    error_message = None
    try:
        session_id, final_status = await execute_scheduler_job(job)
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
    await update_job_after_run(job, run_success=run_status == "success")
