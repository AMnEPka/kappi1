"""API routes package

This package contains all REST API endpoints organized by domain.
"""

from fastapi import APIRouter

from .api_auth import router as auth_router

# Main API router that combines all sub-routers
api_router = APIRouter(prefix="/api")

# Include all sub-routers
api_router.include_router(auth_router, tags=["auth"])

__all__ = ['api_router']
