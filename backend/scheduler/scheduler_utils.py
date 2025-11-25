"""Scheduler utility functions for time calculations and parsing"""

from datetime import datetime, timezone, timedelta, time
from typing import Optional, List, Dict, Any
from fastapi import HTTPException

from models.execution_models import SchedulerJob


def parse_datetime_param(value: Optional[str], *, end_of_day: bool = False) -> Optional[datetime]:
    """Parse datetime parameter from string
    
    Supports both full ISO datetime and date-only formats.
    Adds timezone if missing and optionally moves to end of day.
    
    Args:
        value: ISO format datetime or date string
        end_of_day: If True, add 1 day to move to end of specified day
        
    Returns:
        Parsed datetime with timezone or None if value is empty
        
    Raises:
        HTTPException: If datetime format is invalid
    """
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


def parse_time_of_day(value: str) -> time:
    """Parse time of day from HH:MM format
    
    Args:
        value: Time string in HH:MM format
        
    Returns:
        time object with UTC timezone
        
    Raises:
        HTTPException: If time format is invalid
    """
    parts = value.split(":")
    if len(parts) < 2:
        raise HTTPException(status_code=400, detail=f"Invalid time format: {value}")
    hour = int(parts[0])
    minute = int(parts[1])
    return time(hour=hour, minute=minute, tzinfo=timezone.utc)


def next_daily_occurrence(config: Dict[str, Any], *, reference: datetime, initial: bool = False) -> Optional[datetime]:
    """Calculate next daily occurrence based on schedule config
    
    Args:
        config: Schedule configuration with recurrence_time and optionally recurrence_start_date
        reference: Reference datetime to calculate from
        initial: If True, use start_date if available
        
    Returns:
        Next occurrence datetime or None if config is invalid
    """
    time_str = config.get("recurrence_time")
    if not time_str:
        return None
    target_time = parse_time_of_day(time_str)
    start_date_str = config.get("recurrence_start_date")
    start_date_value = datetime.fromisoformat(f"{start_date_str}T00:00:00").date() if start_date_str else reference.date()
    candidate_date = start_date_value if initial else reference.date()
    candidate = datetime.combine(candidate_date, target_time)
    if candidate <= reference:
        candidate += timedelta(days=1)
    return candidate


def normalize_run_times(run_times: List[datetime]) -> List[datetime]:
    """Normalize and sort run times to UTC
    
    Args:
        run_times: List of datetime objects
        
    Returns:
        Sorted list of datetimes in UTC timezone
    """
    cleaned = []
    for value in run_times:
        if value.tzinfo is None:
            cleaned.append(value.replace(tzinfo=timezone.utc))
        else:
            cleaned.append(value.astimezone(timezone.utc))
    cleaned.sort()
    return cleaned


def calculate_next_run(job: SchedulerJob, *, reference: Optional[datetime] = None, initial: bool = False) -> Optional[datetime]:
    """Calculate next run time for a scheduler job
    
    Handles three job types:
    - one_time: Returns existing next_run_at
    - multi_run: Returns first future run from run_times list
    - recurring: Calculates next daily occurrence
    
    Args:
        job: Scheduler job to calculate next run for
        reference: Reference datetime (defaults to now)
        initial: If True, for recurring jobs start from configured start_date
        
    Returns:
        Next run datetime or None if no future runs
    """
    reference_dt = reference or datetime.now(timezone.utc)
    if job.job_type == "one_time":
        return job.next_run_at
    if job.job_type == "multi_run":
        future_runs = [rt for rt in job.run_times if rt >= reference_dt]
        return future_runs[0] if future_runs else None
    if job.job_type == "recurring":
        return next_daily_occurrence(job.schedule_config, reference=reference_dt, initial=initial)
    return None
