"""
services/helpers.py
Helper functions for data transformation and parsing
"""

from datetime import datetime, timezone, date, time
from typing import Optional, List, Dict, Any


def prepare_for_mongo(data: dict) -> dict:
    """
    Prepare data for MongoDB storage by converting datetime objects to ISO strings
    """
    prepared = data.copy()
    
    # Convert datetime fields to ISO format
    datetime_fields = [
        "created_at", "updated_at", "executed_at", "next_run_at", 
        "last_run_at", "started_at", "finished_at", "completed_at"
    ]
    
    for field in datetime_fields:
        if isinstance(prepared.get(field), datetime):
            prepared[field] = prepared[field].isoformat()
    
    # Convert run_times list
    if isinstance(prepared.get("run_times"), list):
        prepared["run_times"] = [
            value.isoformat() if isinstance(value, datetime) else value
            for value in prepared["run_times"]
        ]
    
    # Convert recurrence_start_date
    if isinstance(prepared.get("recurrence_start_date"), date):
        prepared["recurrence_start_date"] = prepared["recurrence_start_date"].isoformat()
    
    return prepared


def parse_from_mongo(item: dict) -> dict:
    """
    Parse data from MongoDB by converting ISO strings back to datetime objects
    """
    parsed = item.copy()
    
    # Convert ISO strings to datetime
    datetime_fields = [
        "created_at", "updated_at", "executed_at", "next_run_at", 
        "last_run_at", "started_at", "finished_at", "completed_at"
    ]
    
    for field in datetime_fields:
        if isinstance(parsed.get(field), str):
            try:
                parsed[field] = datetime.fromisoformat(parsed[field])
            except (ValueError, TypeError):
                pass
    
    # Convert run_times list
    if isinstance(parsed.get("run_times"), list):
        parsed["run_times"] = [
            datetime.fromisoformat(value) if isinstance(value, str) else value
            for value in parsed["run_times"]
        ]
    
    # Convert recurrence_start_date
    if isinstance(parsed.get("recurrence_start_date"), str):
        try:
            parsed["recurrence_start_date"] = datetime.fromisoformat(parsed["recurrence_start_date"]).date()
        except (ValueError, TypeError):
            pass
    
    return parsed


def _parse_datetime_param(value: Optional[str], *, end_of_day: bool = False) -> Optional[datetime]:
    """
    Parse datetime parameter from query string (ISO format or date only)
    
    Args:
        value: ISO datetime string or date string (YYYY-MM-DD)
        end_of_day: If True and only date provided, set time to 23:59:59
    
    Returns:
        datetime object or None if not parseable
    """
    if not value:
        return None
    
    try:
        # Try full ISO datetime first
        dt = datetime.fromisoformat(value)
        return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt
    except (ValueError, TypeError):
        pass
    
    try:
        # Try date only (YYYY-MM-DD)
        date_obj = datetime.strptime(value, "%Y-%m-%d").date()
        time_obj = time(23, 59, 59) if end_of_day else time(0, 0, 0)
        return datetime.combine(date_obj, time_obj, tzinfo=timezone.utc)
    except (ValueError, TypeError):
        pass
    
    return None


def _parse_time_of_day(value: str) -> time:
    """
    Parse time of day from HH:MM format
    
    Args:
        value: Time string in HH:MM format
    
    Returns:
        time object
    """
    try:
        hours, minutes = map(int, value.split(":"))
        return time(hour=hours, minute=minutes)
    except (ValueError, AttributeError):
        raise ValueError(f"Invalid time format: {value}. Expected HH:MM")


def _normalize_run_times(run_times: List[datetime]) -> List[datetime]:
    """
    Normalize run times - remove duplicates, sort, ensure UTC
    """
    if not run_times:
        return []
    
    normalized = []
    seen = set()
    
    for dt in sorted(run_times):
        # Ensure UTC timezone
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        else:
            dt = dt.astimezone(timezone.utc)
        
        # Remove duplicates by ISO representation
        iso_repr = dt.isoformat()
        if iso_repr not in seen:
            seen.add(iso_repr)
            normalized.append(dt)
    
    return normalized
