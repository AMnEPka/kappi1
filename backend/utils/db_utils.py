"""Database utility functions for MongoDB serialization"""

from datetime import datetime
from typing import Dict, Any, List


def prepare_for_mongo(data: dict) -> dict:
    """Prepare data for MongoDB storage
    
    Converts datetime objects to ISO format strings for storage.
    Handles both individual datetime fields and lists of datetimes.
    
    Args:
        data: Dictionary containing data to be stored in MongoDB
        
    Returns:
        Dictionary with datetime objects converted to ISO strings
    """
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
    """Parse data from MongoDB
    
    Converts ISO format strings back to datetime objects.
    Handles both individual datetime fields and lists of datetimes.
    
    Args:
        item: Dictionary retrieved from MongoDB
        
    Returns:
        Dictionary with ISO strings converted to datetime objects
    """
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
