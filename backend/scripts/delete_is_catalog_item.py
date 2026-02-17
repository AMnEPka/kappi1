#!/usr/bin/env python3
"""
Скрипт удаления записи ИС из каталога напрямую в MongoDB.
Используйте, если запись «зависла» и не удаляется через интерфейс.

Запуск из директории backend (с настроенным .env или переменными MONGO_URL, DB_NAME):

  # Показать все записи ИС (id и название)
  python -m scripts.delete_is_catalog_item

  # Удалить запись по id
  python -m scripts.delete_is_catalog_item <id>
"""

import asyncio
import os
import sys

# Добавляем родительскую директорию в path для импорта config
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "ssh_runner_db")


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    if len(sys.argv) < 2:
        # Список всех ИС
        cursor = db.is_catalog.find({}, {"_id": 0, "id": 1, "name": 1, "host_ids": 1})
        items = await cursor.to_list(1000)
        if not items:
            print("В каталоге ИС записей нет.")
            return
        print("Записи в каталоге ИС (id, название, кол-во хостов):")
        for doc in items:
            name = doc.get("name") or "(без названия)"
            host_count = len(doc.get("host_ids") or [])
            print(f"  id={doc.get('id')}  name={name!r}  hosts={host_count}")
        print("\nЧтобы удалить, запустите: python -m scripts.delete_is_catalog_item <id>")
        return

    target_id = sys.argv[1].strip()
    result = await db.is_catalog.delete_one({"id": target_id})
    if result.deleted_count:
        print(f"Запись ИС с id={target_id!r} удалена.")
    else:
        # Попробуем найти по _id или без id (битые записи)
        count_before = await db.is_catalog.count_documents({})
        cursor = db.is_catalog.find({}, {"_id": 1, "id": 1})
        all_docs = await cursor.to_list(1000)
        for doc in all_docs:
            if doc.get("id") == target_id:
                await db.is_catalog.delete_one({"_id": doc["_id"]})
                print(f"Запись удалена по _id (id в документе: {target_id!r}).")
                return
        print(f"Запись с id={target_id!r} не найдена. Проверьте id по списку выше.")


if __name__ == "__main__":
    asyncio.run(main())
