"""
API endpoints for audit logs.
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional, Dict, Any

from config.config_init import db
from models.models_init import User, AuditLog
from services.services_init import get_current_user
from utils.db_utils import parse_from_mongo
from scheduler.scheduler_utils import parse_datetime_param as _parse_datetime_param

router = APIRouter()


@router.get("/audit/logs", response_model=List[AuditLog])
async def get_audit_logs(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    event_types: Optional[str] = None,
    excluded_event_types: Optional[str] = None,
    limit: int = 200,
    current_user: User = Depends(get_current_user)
):
    """Fetch audit logs with optional filters (admin only)"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Доступ запрещен")
    
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
    
    # Handle event type filtering
    if event_types:
        events = [event.strip() for event in event_types.split(",") if event.strip()]
        if events:
            query["event"] = {"$in": events}
    elif excluded_event_types:
        # Only apply exclusion if no specific events are selected
        excluded_events = [event.strip() for event in excluded_event_types.split(",") if event.strip()]
        if excluded_events:
            query["event"] = {"$nin": excluded_events}
    
    limit = max(1, min(limit, 500))
    
    logs = await db.audit_logs.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return [AuditLog(**parse_from_mongo(log)) for log in logs]

