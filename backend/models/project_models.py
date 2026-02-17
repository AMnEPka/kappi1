"""
models/project_models.py
Pydantic models for projects, tasks, and access control
"""

from pydantic import BaseModel, Field, ConfigDict # pyright: ignore[reportMissingImports]
from typing import List, Optional, Dict
from datetime import datetime, timezone
import uuid


class Project(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    status: str = "draft"  # draft, running, completed, failed
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_by: Optional[str] = None
    creator_username: Optional[str] = None
    creator_full_name: Optional[str] = None


class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None


class ProjectTask(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    project_id: str
    host_id: str
    system_id: str
    script_ids: List[str]
    reference_data: Optional[dict] = Field(default_factory=dict)  # script_id -> reference text
    status: str = "pending"  # pending, running, completed, failed
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ProjectTaskCreate(BaseModel):
    host_id: str
    system_id: str
    script_ids: List[str]
    reference_data: Optional[dict] = Field(default_factory=dict)


class ProjectTaskUpdate(BaseModel):
    system_id: Optional[str] = None
    script_ids: Optional[List[str]] = None
    reference_data: Optional[dict] = None
    status: Optional[str] = None


class ProjectAccess(BaseModel):
    """Access control for projects"""
    model_config = ConfigDict(extra="ignore")
    
    project_id: str
    user_id: str
    granted_by: str
    granted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
