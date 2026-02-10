"""
Main FastAPI application server.
Contains app initialization, middleware setup, startup/shutdown events.
All API endpoints are now organized in the api/ package.
"""

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
import asyncio
import os
import uuid
import contextlib
from typing import Optional, Dict, Any
from datetime import datetime, timezone

from config.config_init import db, logger, hash_password, PERMISSIONS
from api import api_router

scheduler_task: Optional[asyncio.Task] = None

# Create the main app
app = FastAPI(
    title="SSH Script Runner API",
    description="API for executing scripts on remote hosts via SSH/WinRM",
    version="1.0.0"
)

# Include API router (all endpoints from api/ package)
app.include_router(api_router)

# Setup rate limiting
from config.config_rate_limit import setup_rate_limiting
setup_rate_limiting(app)

# CORS configuration
# TODO: In production, replace with specific origins from CORS_ORIGINS env variable
CORS_ORIGINS = os.environ.get('CORS_ORIGINS', '*').split(',')
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    """Health check endpoint with database status"""
    from config.config_init import check_db_health
    
    db_health = await check_db_health()
    overall_status = "healthy" if db_health["status"] == "healthy" else "degraded"
    
    return {
        "status": overall_status,
        "database": db_health,
        "version": "1.0.0"
    }


@app.on_event("startup")
async def startup_db_init():
    """Initialize database on startup if needed"""
    from config.config_init import ensure_indexes
    from scheduler.scheduler_worker import scheduler_worker
    import logging
    
    # Setup filtered access logging for health checks
    access_logger = logging.getLogger("uvicorn.access")
    
    class HealthCheckFilter(logging.Filter):
        """Filter to suppress /api/health requests from access logs"""
        def filter(self, record: logging.LogRecord) -> bool:
            message = record.getMessage()
            if "/api/health" in message:
                return False  # Suppress this log
            return True
    
    # Add filter to access logger
    access_logger.addFilter(HealthCheckFilter())
    
    try:
        # Ensure MongoDB indexes are created
        await ensure_indexes()

        # Ensure IS catalog default schema exists
        from api.api_is_catalog import ensure_default_schema
        await ensure_default_schema()

        # Check if admin user exists
        existing_admin = await db.users.find_one({"username": "admin"})
        
        if not existing_admin:
            logger.info("🚀 Initializing database with admin user and roles...")
            
            # Create admin user
            admin_id = str(uuid.uuid4())
            admin_user = {
                "id": admin_id,
                "username": "admin",
                "full_name": "Администратор",
                "password_hash": hash_password("admin123"),
                "is_active": True,
                "is_admin": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "created_by": None
            }
            await db.users.insert_one(admin_user)
            logger.info("✅ Created admin user")
            
            # Create default roles
            roles = [
                {
                    "id": str(uuid.uuid4()),
                    "name": "Администратор",
                    "permissions": list(PERMISSIONS.keys()),
                    "description": "Полный доступ ко всем функциям системы",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "created_by": admin_id
                },
                {
                    "id": str(uuid.uuid4()),
                    "name": "Исполнитель",
                    "permissions": ['projects_execute'],
                    "description": "Только выполнение назначенных проектов",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "created_by": admin_id
                },
                {
                    "id": str(uuid.uuid4()),
                    "name": "Куратор",
                    "permissions": ['results_view_all', 'results_export_all'],
                    "description": "Просмотр и экспорт всех результатов",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "created_by": admin_id
                },
                {
                    "id": str(uuid.uuid4()),
                    "name": "Разработчик проверок",
                    "permissions": [
                        'checks_create', 'checks_edit_own', 'checks_delete_own',
                        'hosts_create', 'hosts_edit_own', 'hosts_delete_own'
                    ],
                    "description": "Создание и редактирование своих проверок и хостов",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "created_by": admin_id
                },
                {
                    "id": str(uuid.uuid4()),
                    "name": "Менеджер проектов",
                    "permissions": [
                        'projects_create', 'projects_execute',
                        'results_view_all', 'results_export_all'
                    ],
                    "description": "Создание и выполнение проектов, просмотр результатов",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "created_by": admin_id
                }
            ]
            await db.roles.insert_many(roles)
            logger.info(f"✅ Created {len(roles)} default roles")
            
            # Migrate existing data - assign to admin
            categories_updated = await db.categories.update_many(
                {"created_by": {"$exists": False}},
                {"$set": {"created_by": admin_id}}
            )
            systems_updated = await db.systems.update_many(
                {"created_by": {"$exists": False}},
                {"$set": {"created_by": admin_id}}
            )
            scripts_updated = await db.scripts.update_many(
                {"created_by": {"$exists": False}},
                {"$set": {"created_by": admin_id}}
            )
            hosts_updated = await db.hosts.update_many(
                {"created_by": {"$exists": False}},
                {"$set": {"created_by": admin_id}}
            )
            projects_updated = await db.projects.update_many(
                {"created_by": {"$exists": False}},
                {"$set": {"created_by": admin_id}}
            )
            executions_updated = await db.executions.update_many(
                {"executed_by": {"$exists": False}},
                {"$set": {"executed_by": admin_id}}
            )
            
            logger.info(f"✅ Migrated existing data: {categories_updated.modified_count} categories, "
                       f"{systems_updated.modified_count} systems, {scripts_updated.modified_count} scripts, "
                       f"{hosts_updated.modified_count} hosts, {projects_updated.modified_count} projects, "
                       f"{executions_updated.modified_count} executions")
            
            logger.info("✨ Database initialization complete!")
        else:
            logger.info("✅ Database already initialized")
        
        # Start scheduler worker
        global scheduler_task
        if scheduler_task is None:
            scheduler_task = asyncio.create_task(scheduler_worker())
            
    except Exception as e:
        logger.error(f"❌ Database initialization failed: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    """Cleanup on shutdown"""
    from config.config_init import client
    
    client.close()
    
    global scheduler_task
    if scheduler_task:
        scheduler_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await scheduler_task
        scheduler_task = None
