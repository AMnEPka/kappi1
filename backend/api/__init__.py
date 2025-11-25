"""API routes package

This package contains all REST API endpoints organized by domain.
Each module exports a router that is included in the main api_router.
"""

from fastapi import APIRouter

from .api_auth import router as auth_router

# Create main API router
api_router = APIRouter()

# Include sub-routers
api_router.include_router(auth_router, tags=["auth"])

__all__ = ['api_router']
