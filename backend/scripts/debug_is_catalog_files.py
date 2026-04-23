"""One-off diagnostics for IS catalog file storage state."""

import asyncio
import json
import os

from motor.motor_asyncio import AsyncIOMotorClient


async def main():
    mongo_url = os.environ.get("MONGO_URL", "mongodb://mongodb:27017")
    db_name = os.environ.get("DB_NAME", "ssh_runner_db")
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    fid = "ed080484-cd7a-47e3-86fd-84c552d6a7ba"
    doc = await db.is_catalog_files.find_one({"id": fid}, {"_id": 0})
    print("TARGET_DOC:", json.dumps(doc, default=str, ensure_ascii=False, indent=2))

    total = await db.is_catalog_files.count_documents({})
    on_disk = await db.is_catalog_files.count_documents({"storage_backend": "disk"})
    on_gridfs = await db.is_catalog_files.count_documents({"storage_backend": "gridfs"})
    empty_backend = await db.is_catalog_files.count_documents(
        {"$or": [{"storage_backend": {"$exists": False}}, {"storage_backend": None}, {"storage_backend": ""}]}
    )
    with_gridfs_id = await db.is_catalog_files.count_documents({"gridfs_id": {"$exists": True, "$ne": None}})
    print(
        "STATS:",
        json.dumps(
            {
                "total": total,
                "disk": on_disk,
                "gridfs": on_gridfs,
                "empty_backend": empty_backend,
                "with_gridfs_id": with_gridfs_id,
            },
            ensure_ascii=False,
        ),
    )

    names = sorted(await db.list_collection_names())
    bucket_files = "is_catalog_files.files" in names
    bucket_chunks = "is_catalog_files.chunks" in names
    print("COLLECTIONS:", names)
    print("BUCKET: files_present=", bucket_files, " chunks_present=", bucket_chunks)
    if bucket_files:
        cnt = await db["is_catalog_files.files"].count_documents({})
        sample = await db["is_catalog_files.files"].find({}, {"_id": 1, "filename": 1, "metadata": 1}).to_list(5)
        print("GRIDFS_FILES_COUNT:", cnt)
        print("GRIDFS_SAMPLE:", json.dumps(sample, default=str, ensure_ascii=False, indent=2))

    client.close()


if __name__ == "__main__":
    asyncio.run(main())
