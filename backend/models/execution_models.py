"""
models/execution_models.py
Pydantic models for script execution and scheduling
"""

from pydantic import BaseModel, Field, ConfigDict # pyright: ignore[reportMissingImports]
from typing import List, Optional, Dict, Any, Literal
from datetime import datetime, timezone, date
import uuid


class ExecutionResult(BaseModel):
    host_id: str
    host_name: str
    success: bool
    output: str
    error: Optional[str] = None
    check_status: Optional[str] = None  # Пройдена, Не пройдена, Ошибка, Оператор
    error_code: Optional[int] = None  # Exit code from script (e.g., 5000)
    error_description: Optional[str] = None  # Human-readable error description
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Execution(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    project_id: Optional[str] = None  # Link to project
    project_task_id: Optional[str] = None  # Link to task
    execution_session_id: Optional[str] = None  # Group executions by session (each project run)
    host_id: str
    system_id: str
    script_id: str
    script_name: str
    success: bool
    output: str
    error: Optional[str] = None
    check_status: Optional[str] = None  # Пройдена, Не пройдена, Ошибка, Оператор
    error_code: Optional[int] = None  # Exit code from script (e.g., 5000)
    error_description: Optional[str] = None  # Human-readable error description
    executed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    executed_by: Optional[str] = None


class SchedulerJob(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    project_id: str
    job_type: Literal["one_time", "multi_run", "recurring"]
    status: Literal["active", "paused", "completed"] = "active"
    next_run_at: Optional[datetime] = None
    run_times: List[datetime] = Field(default_factory=list)
    schedule_config: Dict[str, Any] = Field(default_factory=dict)
    remaining_runs: Optional[int] = None
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_run_at: Optional[datetime] = None
    last_run_status: Optional[str] = None


class SchedulerJobCreate(BaseModel):
    name: str
    project_id: str
    job_type: Literal["one_time", "multi_run", "recurring"]
    run_at: Optional[datetime] = None
    run_times: Optional[List[datetime]] = None
    recurrence_time: Optional[str] = None  # HH:MM format
    recurrence_start_date: Optional[date] = None  # yyyy-mm-dd


class SchedulerJobUpdate(BaseModel):
    name: Optional[str] = None
    run_at: Optional[datetime] = None
    run_times: Optional[List[datetime]] = None
    recurrence_time: Optional[str] = None
    recurrence_start_date: Optional[date] = None
    status: Optional[Literal["active", "paused"]] = None


class SchedulerRun(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    job_id: str
    project_id: str
    session_id: Optional[str] = None
    status: Literal["running", "success", "failed"] = "running"
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    finished_at: Optional[datetime] = None
    error: Optional[str] = None
    launched_by_user: Optional[str] = None


class ExecuteProjectRequest(BaseModel):
    """Request to execute a project"""
    project_id: str


class ExecuteRequest(BaseModel):
    """Legacy request to execute a single script on multiple hosts"""
    script_id: str
    host_ids: List[str]
