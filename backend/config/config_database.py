from motor.motor_asyncio import AsyncIOMotorClient  # pyright: ignore[reportMissingImports]
import os

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]