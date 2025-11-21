import os
print("MONGO_URL:", os.environ.get("MONGO_URL"))
print("DB_NAME:", os.environ.get("DB_NAME"))

print("1️⃣ Testing config.settings...")
try:
    from config.config_settings import logger, MONGO_URL, SCHEDULER_POLL_SECONDS
    print("✅ config.settings OK")
except Exception as e:
    print(f"❌ config.settings FAILED: {e}")
    exit(1)

print("\n2️⃣ Testing config.database...")
try:
    from config.config_database import db, connect_to_mongo
    print("✅ config.database OK")
except Exception as e:
    print(f"❌ config.database FAILED: {e}")
    exit(1)

print("\n3️⃣ Testing config.security...")
try:
    from config.config_security import hash_password, create_access_token
    print("✅ config.security OK")
except Exception as e:
    print(f"❌ config.security FAILED: {e}")
    exit(1)

print("\n4️⃣ Testing models...")
try:
    from models import User, Category, Host, Script, Project
    print("✅ models OK")
except Exception as e:
    print(f"❌ models FAILED: {e}")
    exit(1)

print("\n5️⃣ Testing main...")
try:
    import server
    print("✅ main OK")
except Exception as e:
    print(f"❌ main FAILED: {e}")
    exit(1)

print("\n✅ ALL IMPORTS OK!")

