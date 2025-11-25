"""Audit logging utility functions"""

import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional

from config.config_init import db, logger


async def _persist_audit_log(entry: Dict[str, Any]) -> None:
    """Persist audit log entry to database
    
    Args:
        entry: Audit log entry dictionary
    """
    try:
        doc = entry.copy()
        doc["id"] = str(uuid.uuid4())
        doc["created_at"] = datetime.now(timezone.utc).isoformat()
        await db.audit_logs.insert_one(doc)
    except Exception as e:
        logger.error("Failed to persist audit log: %s", str(e))


def log_audit(event: str, *, user_id: Optional[str] = None, username: Optional[str] = None,
              details: Optional[Dict[str, Any]] = None, level: int = logging.INFO) -> None:
    """Structured audit logging helper
    
    Logs audit events both to the application logger and persists them to the database.
    Can be called from sync or async context.
    
    Args:
        event: Event identifier/code
        user_id: User ID associated with the event
        username: Username associated with the event
        details: Additional details about the event
        level: Logging level (default: INFO)
    """
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
