"""
config/database.py
MongoDB connection configuration with connection pooling and timeouts
"""

from motor.motor_asyncio import AsyncIOMotorClient  # pyright: ignore[reportMissingImports]
import os
import logging

logger = logging.getLogger("ssh_runner")

# MongoDB Configuration from environment
mongo_url = os.environ['MONGO_URL']
db_name = os.environ.get('DB_NAME', 'ssh_runner_db')

# Connection pool and timeout settings
MONGO_MAX_POOL_SIZE = int(os.environ.get('MONGO_MAX_POOL_SIZE', '50'))
MONGO_MIN_POOL_SIZE = int(os.environ.get('MONGO_MIN_POOL_SIZE', '10'))
MONGO_SERVER_SELECTION_TIMEOUT_MS = int(os.environ.get('MONGO_SERVER_SELECTION_TIMEOUT_MS', '5000'))
MONGO_CONNECT_TIMEOUT_MS = int(os.environ.get('MONGO_CONNECT_TIMEOUT_MS', '10000'))
MONGO_SOCKET_TIMEOUT_MS = int(os.environ.get('MONGO_SOCKET_TIMEOUT_MS', '30000'))

# Create MongoDB client with optimized settings
client = AsyncIOMotorClient(
    mongo_url,
    maxPoolSize=MONGO_MAX_POOL_SIZE,
    minPoolSize=MONGO_MIN_POOL_SIZE,
    serverSelectionTimeoutMS=MONGO_SERVER_SELECTION_TIMEOUT_MS,
    connectTimeoutMS=MONGO_CONNECT_TIMEOUT_MS,
    socketTimeoutMS=MONGO_SOCKET_TIMEOUT_MS,
    retryWrites=True,
    retryReads=True,
)

db = client[db_name]

logger.info(f"MongoDB client configured: pool_size={MONGO_MIN_POOL_SIZE}-{MONGO_MAX_POOL_SIZE}, "
            f"connect_timeout={MONGO_CONNECT_TIMEOUT_MS}ms, socket_timeout={MONGO_SOCKET_TIMEOUT_MS}ms")


async def ensure_indexes():
    """
    Create database indexes for optimized queries.
    Should be called on application startup.
    """
    try:
        # Users collection
        await db.users.create_index("username", unique=True)
        await db.users.create_index("created_by")
        
        # Hosts collection
        await db.hosts.create_index("created_by")
        await db.hosts.create_index("hostname")
        
        # Projects collection
        await db.projects.create_index("created_by")
        await db.projects.create_index("name")
        
        # Project tasks collection
        await db.project_tasks.create_index("project_id")
        await db.project_tasks.create_index([("project_id", 1), ("host_id", 1)])
        
        # Executions collection - most queried
        await db.executions.create_index([("project_id", 1), ("execution_session_id", 1)])
        await db.executions.create_index("execution_session_id")
        await db.executions.create_index([("executed_at", -1)])
        await db.executions.create_index("executed_by")
        
        # Audit logs collection
        await db.audit_logs.create_index([("created_at", -1)])
        await db.audit_logs.create_index("event")
        await db.audit_logs.create_index("user_id")
        
        # Scheduler jobs collection
        await db.scheduler_jobs.create_index("is_active")
        await db.scheduler_jobs.create_index("next_run")
        
        # Roles and user_roles collections
        await db.roles.create_index("name", unique=True)
        await db.user_roles.create_index([("user_id", 1), ("role_id", 1)], unique=True)
        
        # Refresh tokens collection
        await db.refresh_tokens.create_index("token_id", unique=True)
        await db.refresh_tokens.create_index("user_id")
        await db.refresh_tokens.create_index("expires_at", expireAfterSeconds=0)  # TTL index - auto-delete expired
        
        # Categories and systems
        await db.categories.create_index("name")
        await db.systems.create_index("category_id")
        await db.scripts.create_index("system_id")
        
        logger.info("✅ MongoDB indexes created successfully")
    except Exception as e:
        logger.error(f"❌ Failed to create MongoDB indexes: {e}")
        raise


async def check_db_health() -> dict:
    """Check database health status"""
    try:
        await db.command("ping")
        return {"status": "healthy", "message": "MongoDB is responsive"}
    except Exception as e:
        # Log detailed error server-side, but do not expose internal details to clients
        logger.exception("MongoDB health check failed")
        return {
            "status": "unhealthy",
            "message": "MongoDB is not reachable"
        }