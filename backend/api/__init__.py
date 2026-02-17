"""API routes package

This package contains all REST API endpoints organized by domain.
Each module exports a router that is included in the main api_router.
"""

from fastapi import APIRouter

from .api_auth import router as auth_router
from .api_hosts import router as hosts_router
from .api_categories import router as categories_router
from .api_scripts import router as scripts_router
from .api_projects import router as projects_router
from .api_users import router as users_router
from .api_scheduler import router as scheduler_router
from .api_check_groups import router as check_groups_router
from .api_executions import router as executions_router
from .api_audit import router as audit_router
from .api_export import router as export_router
from .api_ai import router as ai_router
from .api_is_catalog import router as is_catalog_router
from .api_ib_profiles import router as ib_profiles_router

# Create main API router with /api prefix
api_router = APIRouter(prefix="/api")

# Include sub-routers
api_router.include_router(auth_router, tags=["auth"])
api_router.include_router(hosts_router, tags=["hosts"])
api_router.include_router(categories_router, tags=["categories"])
api_router.include_router(scripts_router, tags=["scripts"])
api_router.include_router(projects_router, tags=["projects"])
api_router.include_router(users_router, tags=["users"])
api_router.include_router(scheduler_router, tags=["scheduler"])
api_router.include_router(check_groups_router, tags=["check-groups"])
api_router.include_router(executions_router, tags=["executions"])
api_router.include_router(audit_router, tags=["audit"])
api_router.include_router(export_router, tags=["export"])
api_router.include_router(ai_router, tags=["ai"])
api_router.include_router(is_catalog_router)
api_router.include_router(ib_profiles_router)

__all__ = ['api_router']
