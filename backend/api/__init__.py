"""API routes package

This package contains all REST API endpoints organized by domain.
Each module exports a router that is included in the main api_router.
"""

from fastapi import APIRouter

from .api_auth import router as auth_router
from .api_hosts import router as hosts_router
from .api_categories import router as categories_router

# Create main API router with /api prefix
api_router = APIRouter(prefix="/api")

# Include sub-routers
api_router.include_router(auth_router, tags=["auth"])
api_router.include_router(hosts_router, tags=["hosts"])
api_router.include_router(categories_router, tags=["categories"])

__all__ = ['api_router']
