"""
models/audit_models.py
Pydantic models for audit logging
"""

from pydantic import BaseModel, Field, ConfigDict # pyright: ignore[reportMissingImports]
from typing import Optional, Dict, Any
from datetime import datetime, timezone
import uuid


class AuditLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    event: str
    level: str = "INFO"
    user_id: Optional[str] = None
    username: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
