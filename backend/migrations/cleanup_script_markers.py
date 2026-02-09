#!/usr/bin/env python3
"""
Migration script to clean up syntax highlighting markers from scripts.

These markers (like ___COMMENT___0___, ___STRING_SINGLE___11___, etc.) 
were accidentally saved in the database and need to be removed.

Run from the backend directory:
    python -m migrations.cleanup_script_markers
"""

import asyncio
import re
import base64
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

MONGODB_URL = os.environ.get("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.environ.get("DATABASE_NAME", "kapibara")

# Marker patterns to remove
MARKER_PATTERNS = [
    r'___COMMENT___\d+___',
    r'___STRING_SINGLE___\d+___',
    r'___STRING_DOUBLE___\d+___',
    r'___VARIABLE___\d+___',
    r'___KEYWORD___\d+___',
    r'___OPERATOR___\d+___',
    r'___NUMBER___\d+___',
]


def decode_base64(content: str) -> str:
    """Decode Base64 content, return as-is if not Base64"""
    if not content:
        return content
    try:
        return base64.b64decode(content.encode('utf-8')).decode('utf-8')
    except:
        return content


def encode_base64(content: str) -> str:
    """Encode content to Base64"""
    if not content:
        return content
    return base64.b64encode(content.encode('utf-8')).decode('utf-8')


def has_markers(content: str) -> bool:
    """Check if content contains any markers"""
    if not content:
        return False
    for pattern in MARKER_PATTERNS:
        if re.search(pattern, content):
            return True
    return False


def remove_markers(content: str) -> str:
    """Remove all markers from content"""
    if not content:
        return content
    
    cleaned = content
    for pattern in MARKER_PATTERNS:
        cleaned = re.sub(pattern, '', cleaned)
    return cleaned


async def cleanup_scripts():
    """Clean up all scripts in the database"""
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    
    print(f"Connecting to MongoDB: {MONGODB_URL}")
    print(f"Database: {DATABASE_NAME}")
    print()
    
    scripts_collection = db.scripts
    
    # Get all scripts
    scripts = await scripts_collection.find({}).to_list(None)
    print(f"Found {len(scripts)} scripts to check")
    print()
    
    updated_count = 0
    
    for script in scripts:
        script_id = script.get('id', 'unknown')
        script_name = script.get('name', 'unnamed')
        needs_update = False
        update_data = {}
        
        # Check and clean 'content' field
        content = script.get('content')
        if content:
            decoded_content = decode_base64(content)
            if has_markers(decoded_content):
                print(f"[{script_name}] Found markers in 'content'")
                cleaned = remove_markers(decoded_content)
                update_data['content'] = encode_base64(cleaned)
                needs_update = True
        
        # Check and clean 'processor_script' field (legacy)
        processor_script = script.get('processor_script')
        if processor_script:
            decoded_ps = decode_base64(processor_script)
            if has_markers(decoded_ps):
                print(f"[{script_name}] Found markers in 'processor_script'")
                cleaned = remove_markers(decoded_ps)
                update_data['processor_script'] = encode_base64(cleaned)
                needs_update = True
        
        # Check and clean 'processor_script_version'
        version = script.get('processor_script_version')
        if version and isinstance(version, dict) and 'content' in version:
            decoded_v = decode_base64(version.get('content', ''))
            if has_markers(decoded_v):
                print(f"[{script_name}] Found markers in 'processor_script_version'")
                cleaned = remove_markers(decoded_v)
                new_version = version.copy()
                new_version['content'] = encode_base64(cleaned)
                update_data['processor_script_version'] = new_version
                needs_update = True
        
        # Check and clean 'processor_script_versions'
        versions = script.get('processor_script_versions', [])
        if versions:
            new_versions = []
            versions_changed = False
            for v in versions:
                if isinstance(v, dict) and 'content' in v:
                    decoded_v = decode_base64(v.get('content', ''))
                    if has_markers(decoded_v):
                        print(f"[{script_name}] Found markers in version history")
                        cleaned = remove_markers(decoded_v)
                        new_v = v.copy()
                        new_v['content'] = encode_base64(cleaned)
                        new_versions.append(new_v)
                        versions_changed = True
                    else:
                        new_versions.append(v)
                else:
                    new_versions.append(v)
            
            if versions_changed:
                update_data['processor_script_versions'] = new_versions
                needs_update = True
        
        # Update if needed
        if needs_update:
            await scripts_collection.update_one(
                {'id': script_id},
                {'$set': update_data}
            )
            updated_count += 1
            print(f"  ✓ Updated script: {script_name}")
    
    print()
    print(f"=" * 50)
    print(f"Cleanup complete!")
    print(f"Scripts checked: {len(scripts)}")
    print(f"Scripts updated: {updated_count}")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(cleanup_scripts())
