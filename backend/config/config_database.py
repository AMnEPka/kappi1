"""
config/database.py
MongoDB database initialization and connection management
"""

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase  # pyright: ignore[reportMissingImports]
from config.settings import MONGO_URL, DB_NAME # pyright: ignore[reportMissingImports]

# ============================================================================
# DATABASE CONNECTION
# ============================================================================

client: AsyncIOMotorClient = None
db: AsyncIOMotorDatabase = None


async def connect_to_mongo():
    """Initialize MongoDB connection"""
    global client, db
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    print(f"✅ Connected to MongoDB: {DB_NAME}")


async def close_mongo_connection():
    """Close MongoDB connection"""
    global client
    if client:
        client.close()
        print("✅ Disconnected from MongoDB")


def get_db() -> AsyncIOMotorDatabase:
    """Get database instance for use in application"""
    return db
