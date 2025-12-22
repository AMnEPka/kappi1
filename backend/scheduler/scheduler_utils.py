"""Scheduler utility functions for time calculations and parsing"""

from datetime import datetime, timezone, timedelta, time
from typing import Optional, List, Dict, Any
from fastapi import HTTPException  # pyright: ignore[reportMissingImports]

from models.execution_models import SchedulerJob

# Optional: croniter for cron expression support
try:
    from croniter import croniter
    HAS_CRONITER = True
except ImportError:
    HAS_CRONITER = False


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
            raise HTTPException(status_code=400, detail=f"Неверный формат даты: {value}")
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
        raise HTTPException(status_code=400, detail=f"Неверный формат времени: {value}")
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


def next_recurring_occurrence(config: Dict[str, Any], *, reference: datetime, initial: bool = False) -> Optional[datetime]:
    """Calculate next occurrence based on schedule config with various frequencies
    
    Supports:
    - minutes: every X minutes
    - hours: every X hours  
    - daily: at specific time every day
    - weekly: at specific time on specific days of week
    - monthly: at specific time on specific day of month
    - cron: using cron expression (requires croniter)
    
    Args:
        config: Schedule configuration
        reference: Reference datetime to calculate from
        initial: If True, use start_date if available
        
    Returns:
        Next occurrence datetime or None if config is invalid
    """
    schedule_mode = config.get("schedule_mode", "simple")
    
    # Advanced mode - cron expression
    if schedule_mode == "advanced":
        cron_expr = config.get("cron_expression")
        if cron_expr:
            return next_cron_occurrence(cron_expr, reference)
        return None
    
    # Simple mode - frequency-based
    frequency = config.get("recurrence_frequency", "daily")
    start_date_str = config.get("recurrence_start_date")
    
    # Parse start date if provided
    if start_date_str:
        start_date = datetime.fromisoformat(f"{start_date_str}T00:00:00").replace(tzinfo=timezone.utc)
        if initial and reference < start_date:
            reference = start_date
    
    if frequency == "minutes":
        interval = config.get("recurrence_interval", 30)
        return next_interval_occurrence(reference, minutes=interval)
    
    elif frequency == "hours":
        interval = config.get("recurrence_interval", 1)
        return next_interval_occurrence(reference, hours=interval)
    
    elif frequency == "daily":
        time_str = config.get("recurrence_time", "09:00")
        return next_time_occurrence(reference, time_str, initial=initial, start_date_str=start_date_str)
    
    elif frequency == "weekly":
        time_str = config.get("recurrence_time", "09:00")
        days = config.get("recurrence_days", [1])  # Default Monday
        return next_weekly_occurrence(reference, time_str, days, initial=initial, start_date_str=start_date_str)
    
    elif frequency == "monthly":
        time_str = config.get("recurrence_time", "09:00")
        day_of_month = config.get("recurrence_day_of_month", 1)
        return next_monthly_occurrence(reference, time_str, day_of_month, initial=initial, start_date_str=start_date_str)
    
    # Fallback to daily
    return next_daily_occurrence(config, reference=reference, initial=initial)


def next_interval_occurrence(reference: datetime, *, minutes: int = 0, hours: int = 0) -> datetime:
    """Calculate next occurrence for interval-based schedules (every X minutes/hours)"""
    total_minutes = minutes + (hours * 60)
    if total_minutes <= 0:
        total_minutes = 30  # Default 30 minutes
    
    # Next run is reference + interval
    return reference + timedelta(minutes=total_minutes)


def next_time_occurrence(reference: datetime, time_str: str, *, initial: bool = False, start_date_str: Optional[str] = None) -> Optional[datetime]:
    """Calculate next occurrence at specific time (daily)"""
    target_time = parse_time_of_day(time_str)
    
    if start_date_str and initial:
        start_date = datetime.fromisoformat(f"{start_date_str}T00:00:00").date()
        candidate_date = start_date
    else:
        candidate_date = reference.date()
    
    candidate = datetime.combine(candidate_date, target_time)
    if candidate <= reference:
        candidate += timedelta(days=1)
    return candidate


def next_weekly_occurrence(reference: datetime, time_str: str, days: List[int], *, initial: bool = False, start_date_str: Optional[str] = None) -> Optional[datetime]:
    """Calculate next occurrence for weekly schedule
    
    Args:
        days: List of weekday numbers (0=Sunday, 1=Monday, ..., 6=Saturday)
    """
    if not days:
        days = [1]  # Default Monday
    
    target_time = parse_time_of_day(time_str)
    
    if start_date_str and initial:
        start_date = datetime.fromisoformat(f"{start_date_str}T00:00:00").date()
        candidate_date = start_date
    else:
        candidate_date = reference.date()
    
    # Convert to Python weekday (0=Monday in Python, but we use 0=Sunday like JS/cron)
    def to_python_weekday(day: int) -> int:
        return (day - 1) % 7 if day > 0 else 6
    
    python_days = [to_python_weekday(d) for d in days]
    
    # Search up to 8 days ahead (guarantees finding next occurrence)
    for offset in range(8):
        check_date = candidate_date + timedelta(days=offset)
        if check_date.weekday() in python_days:
            candidate = datetime.combine(check_date, target_time)
            if candidate > reference:
                return candidate
    
    return None


def next_monthly_occurrence(reference: datetime, time_str: str, day_of_month: int, *, initial: bool = False, start_date_str: Optional[str] = None) -> Optional[datetime]:
    """Calculate next occurrence for monthly schedule
    
    Args:
        day_of_month: Day of month (1-31) or -1 for last day
    """
    import calendar
    
    target_time = parse_time_of_day(time_str)
    
    if start_date_str and initial:
        start_date = datetime.fromisoformat(f"{start_date_str}T00:00:00").date()
        year, month = start_date.year, start_date.month
    else:
        year, month = reference.year, reference.month
    
    # Search up to 13 months ahead
    for _ in range(13):
        last_day = calendar.monthrange(year, month)[1]
        
        if day_of_month == -1 or day_of_month > last_day:
            actual_day = last_day
        else:
            actual_day = day_of_month
        
        try:
            candidate_date = reference.date().replace(year=year, month=month, day=actual_day)
            candidate = datetime.combine(candidate_date, target_time)
            if candidate > reference:
                return candidate
        except ValueError:
            pass
        
        # Move to next month
        if month == 12:
            year += 1
            month = 1
        else:
            month += 1
    
    return None


def next_cron_occurrence(cron_expression: str, reference: datetime) -> Optional[datetime]:
    """Calculate next occurrence from cron expression"""
    if not HAS_CRONITER:
        # Fallback: parse simple cron patterns manually
        return parse_simple_cron(cron_expression, reference)
    
    try:
        cron = croniter(cron_expression, reference)
        next_run = cron.get_next(datetime)
        if next_run.tzinfo is None:
            next_run = next_run.replace(tzinfo=timezone.utc)
        return next_run
    except Exception:
        return None


def parse_simple_cron(cron_expression: str, reference: datetime) -> Optional[datetime]:
    """Simple cron parser for common patterns (fallback when croniter not available)"""
    parts = cron_expression.strip().split()
    if len(parts) != 5:
        return None
    
    minute, hour, day, month, dow = parts
    
    # Handle simple cases: specific minute and hour
    try:
        if minute.isdigit() and hour.isdigit():
            target_time = time(int(hour), int(minute), tzinfo=timezone.utc)
            candidate = datetime.combine(reference.date(), target_time)
            if candidate <= reference:
                candidate += timedelta(days=1)
            return candidate
    except ValueError:
        pass
    
    # For complex cron expressions, default to next hour
    next_hour = reference.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
    return next_hour


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
    - recurring: Calculates next occurrence based on schedule_config
    
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
        return next_recurring_occurrence(job.schedule_config, reference=reference_dt, initial=initial)
    return None
