"""
services/scheduler.py
Scheduler services for managing recurring jobs
"""

import asyncio
from datetime import datetime, timezone, timedelta, time as datetime_time, date
from typing import Optional, Dict, Any, Tuple
import logging

from config.config_init import logger, db, SCHEDULER_POLL_SECONDS
from models.models_init import SchedulerJob
from services.services_init import _parse_time_of_day, _normalize_run_times


def _calculate_next_run(
    job: SchedulerJob,
    *,
    reference: Optional[datetime] = None,
    initial: bool = False
) -> Optional[datetime]:
    """
    Calculate next run time for a scheduler job
    """
    if reference is None:
        reference = datetime.now(timezone.utc)
    
    config = job.schedule_config or {}
    job_type = job.job_type
    
    if job_type == "one_time":
        if job.run_times:
            next_time = min(job.run_times)
            if next_time > reference:
                return next_time
        return None
    
    elif job_type == "multi_run":
        run_times = _normalize_run_times(job.run_times or [])
        future_times = [t for t in run_times if t > reference]
        return min(future_times) if future_times else None
    
    elif job_type == "recurring":
        return _next_daily_occurrence(config, reference=reference, initial=initial)
    
    return None


def _next_daily_occurrence(
    config: Dict[str, Any],
    *,
    reference: datetime,
    initial: bool = False
) -> Optional[datetime]:
    """
    Calculate next daily occurrence based on config
    """
    try:
        recurrence_time_str = config.get("recurrence_time", "00:00")
        recurrence_time = _parse_time_of_day(recurrence_time_str)
        start_date = config.get("recurrence_start_date")
        
        if isinstance(start_date, str):
            start_date = datetime.fromisoformat(start_date).date()
        
        # Start from reference date
        current_date = reference.date()
        
        while True:
            if start_date and current_date < start_date:
                current_date = start_date
            
            # Create datetime for this date at recurrence_time
            next_run = datetime.combine(
                current_date,
                recurrence_time,
                tzinfo=timezone.utc
            )
            
            # If this time is in the future, use it
            if next_run > reference:
                return next_run
            
            # Move to next day
            current_date += timedelta(days=1)
            
            # Safety check to prevent infinite loops
            if (current_date - reference.date()).days > 365:
                return None
    
    except Exception as e:
        logger.error(f"Error calculating next daily occurrence: {e}")
        return None


async def _consume_streaming_response(streaming_response) -> Tuple[Optional[str], Optional[str]]:
    """Consume a streaming response and return combined output"""
    try:
        full_output = ""
        full_error = ""
        
        async for chunk in streaming_response.body_iterator:
            if b"ERROR" in chunk:
                full_error += chunk.decode()
            else:
                full_output += chunk.decode()
        
        return full_output if full_output else None, full_error if full_error else None
    except Exception as e:
        return None, str(e)


async def _execute_scheduler_job(job: SchedulerJob) -> Tuple[Optional[str], Optional[str]]:
    """Execute a scheduler job (fetch and run its project)"""
    try:
        project = await db.projects.find_one({"id": job.project_id})
        if not project:
            return None, "Project not found"
        
        # Here you would execute the project
        # This is a placeholder - actual implementation depends on your execute_project function
        return "Job executed", None
    except Exception as e:
        return None, str(e)


async def _update_job_after_run(job: SchedulerJob, *, run_success: bool) -> None:
    """Update job status and next run time after execution"""
    try:
        update_data = {
            "last_run_at": datetime.now(timezone.utc).isoformat(),
            "last_run_status": "success" if run_success else "failed"
        }
        
        # Calculate next run
        next_run = _calculate_next_run(job, reference=datetime.now(timezone.utc))
        if next_run:
            update_data["next_run_at"] = next_run.isoformat()
        
        # Decrement remaining runs for multi_run jobs
        if job.job_type == "multi_run" and job.remaining_runs:
            job.remaining_runs -= 1
            update_data["remaining_runs"] = job.remaining_runs
            
            if job.remaining_runs <= 0:
                update_data["status"] = "completed"
        
        await db.scheduler_jobs.update_one(
            {"id": job.id},
            {"$set": update_data}
        )
    except Exception as e:
        logger.error(f"Error updating job after run: {e}")


async def _handle_due_scheduler_job(job_doc: dict) -> None:
    """Handle a scheduler job that is due to run"""
    try:
        job = SchedulerJob(**job_doc)
        
        logger.info(f"Executing scheduler job: {job.name}")
        
        output, error = await _execute_scheduler_job(job)
        success = error is None
        
        # Save execution record
        run_record = {
            "id": __import__("uuid").uuid4().hex,
            "job_id": job.id,
            "project_id": job.project_id,
            "status": "success" if success else "failed",
            "started_at": datetime.now(timezone.utc).isoformat(),
            "finished_at": datetime.now(timezone.utc).isoformat(),
            "error": error
        }
        
        await db.scheduler_runs.insert_one(run_record)
        
        # Update job
        await _update_job_after_run(job, run_success=success)
        
    except Exception as e:
        logger.error(f"Error handling scheduler job: {e}")


async def scheduler_worker():
    """
    Main scheduler worker - polls database for jobs to execute
    Runs continuously in background
    """
    logger.info("Scheduler worker started")
    
    while True:
        try:
            # Find jobs that need to run
            now = datetime.now(timezone.utc)
            
            due_jobs = await db.scheduler_jobs.find({
                "status": {"$ne": "completed"},
                "next_run_at": {"$lte": now.isoformat()}
            }).to_list(None)
            
            for job_doc in due_jobs:
                await _handle_due_scheduler_job(job_doc)
            
            # Sleep before next poll
            await asyncio.sleep(SCHEDULER_POLL_SECONDS)
            
        except Exception as e:
            logger.error(f"Scheduler worker error: {e}")
            await asyncio.sleep(SCHEDULER_POLL_SECONDS)
