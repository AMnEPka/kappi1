"""
Database initialization script
Creates admin user and default roles
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient  # pyright: ignore[reportMissingImports]
import os
from dotenv import load_dotenv  # pyright: ignore[reportMissingImports]
from pathlib import Path
import uuid
from datetime import datetime, timezone
from passlib.context import CryptContext  # pyright: ignore[reportMissingModuleSource]

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


async def init_database():
    """Initialize database with admin user and default roles"""
    
    print("🚀 Initializing database...")

    # Check if admin already exists
    existing_admin = await db.users.find_one({"username": "admin"})
    
    if existing_admin:
        print("✅ Admin user already exists")
        admin_id = existing_admin['id']
    else:
        # Create admin user
        admin_id = str(uuid.uuid4())
        admin_user = {
            "id": admin_id,
            "username": "admin",
            "full_name": "Администратор",
            "password_hash": pwd_context.hash("admin123"),
            "is_active": True,
            "is_admin": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": None
        }
        await db.users.insert_one(admin_user)
        print("✅ Created admin user (username: admin, password: admin123)")
    
    # Check if roles exist
    existing_roles = await db.roles.count_documents({})
    
    if existing_roles > 0:
        print(f"✅ {existing_roles} roles already exist")
    else:
        # Create default roles
        roles = [
            {
                "id": str(uuid.uuid4()),
                "name": "Администратор",
                "permissions": list([
                    'categories_manage',
                    'checks_create', 'checks_edit_all', 'checks_delete_all',
                    'hosts_create', 'hosts_edit_all', 'hosts_delete_all',
                    'users_manage', 'roles_manage',
                    'results_view_all', 'results_export_all',
                    'projects_create', 'projects_execute',
                    'is_catalog_view', 'is_catalog_edit', 'is_catalog_manage_schema',
                    'ib_profiles_view', 'ib_profiles_manage', 'ib_profiles_apply',
                    'config_integrity_view', 'config_integrity_manage',
                ]),
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
        print(f"✅ Created {len(roles)} default roles")
    
    # Assign admin role to admin user (if not already assigned)
    admin_role = await db.roles.find_one({"name": "Администратор"})
    if admin_role:
        existing_assignment = await db.user_roles.find_one({
            "user_id": admin_id,
            "role_id": admin_role['id']
        })
        if not existing_assignment:
            await db.user_roles.insert_one({
                "user_id": admin_id,
                "role_id": admin_role['id']
            })
            print("✅ Assigned 'Администратор' role to admin user")
    
    # Migrate existing data - assign all to admin
    print("\n📦 Migrating existing data to admin...")
    
    # Categories
    categories_updated = await db.categories.update_many(
        {"created_by": {"$exists": False}},
        {"$set": {"created_by": admin_id}}
    )
    print(f"✅ Updated {categories_updated.modified_count} categories")
    
    # Systems
    systems_updated = await db.systems.update_many(
        {"created_by": {"$exists": False}},
        {"$set": {"created_by": admin_id}}
    )
    print(f"✅ Updated {systems_updated.modified_count} systems")
    
    # Scripts
    scripts_updated = await db.scripts.update_many(
        {"created_by": {"$exists": False}},
        {"$set": {"created_by": admin_id}}
    )
    print(f"✅ Updated {scripts_updated.modified_count} scripts")
    
    # Hosts
    hosts_updated = await db.hosts.update_many(
        {"created_by": {"$exists": False}},
        {"$set": {"created_by": admin_id}}
    )
    print(f"✅ Updated {hosts_updated.modified_count} hosts")
    
    # Projects
    projects_updated = await db.projects.update_many(
        {"created_by": {"$exists": False}},
        {"$set": {"created_by": admin_id}}
    )
    print(f"✅ Updated {projects_updated.modified_count} projects")
    
    # Executions
    executions_updated = await db.executions.update_many(
        {"executed_by": {"$exists": False}},
        {"$set": {"executed_by": admin_id}}
    )
    print(f"✅ Updated {executions_updated.modified_count} executions")
    
    print("\n✨ Database initialization complete!")


if __name__ == "__main__":
    asyncio.run(init_database())
