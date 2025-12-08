"""
models/__init__.py
Centralized imports for all model classes
"""

# Auth models
from models.auth_models import (
    User,
    UserCreate,
    UserUpdate,
    UserResponse,
    LoginRequest,
    LoginResponse,
    Role,
    RoleCreate,
    RoleUpdate,
    UserRole,
    PasswordResetRequest
)

# Content models
from models.content_models import (
    Category,
    CategoryCreate,
    CategoryUpdate,
    System,
    SystemCreate,
    SystemUpdate,
    Host,
    HostCreate,
    HostUpdate,
    Script,
    ScriptCreate,
    ScriptUpdate
)

# Project models
from models.project_models import (
    Project,
    ProjectCreate,
    ProjectUpdate,
    ProjectTask,
    ProjectTaskCreate,
    ProjectTaskUpdate,
    ProjectAccess
)

# Execution models
from models.execution_models import (
    ExecutionResult,
    Execution,
    SchedulerJob,
    SchedulerJobCreate,
    SchedulerJobUpdate,
    SchedulerRun,
    ExecuteProjectRequest,
    ExecuteRequest
)

# Audit models
from models.audit_models import AuditLog


__all__ = [
    # Auth models
    "User",
    "UserCreate",
    "UserUpdate",
    "UserResponse",
    "LoginRequest",
    "LoginResponse",
    "Role",
    "RoleCreate",
    "RoleUpdate",
    "UserRole",
    "PasswordResetRequest",
    
    # Content models
    "Category",
    "CategoryCreate",
    "CategoryUpdate",
    "System",
    "SystemCreate",
    "SystemUpdate",
    "Host",
    "HostCreate",
    "HostUpdate",
    "Script",
    "ScriptCreate",
    "ScriptUpdate",
    
    # Project models
    "Project",
    "ProjectCreate",
    "ProjectUpdate",
    "ProjectTask",
    "ProjectTaskCreate",
    "ProjectTaskUpdate",
    "ProjectAccess",
    
    # Execution models
    "ExecutionResult",
    "Execution",
    "SchedulerJob",
    "SchedulerJobCreate",
    "SchedulerJobUpdate",
    "SchedulerRun",
    "ExecuteProjectRequest",
    "ExecuteRequest",
    
    # Audit models
    "AuditLog"
]
