"""
IS Catalog API: schema (admin), file upload/download, and CRUD for information systems catalog.
"""

import os
import uuid
from pathlib import Path
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File  # pyright: ignore[reportMissingImports]
from fastapi.responses import FileResponse

from typing import List, Dict, Any, Optional

from config.config_init import db
from models.is_catalog_models import (
    ISCatalogSchema,
    ISCatalogSchemaField,
    ISCatalogSchemaUpdate,
    ISCatalogItem,
    ISCatalogItemCreate,
    ISCatalogItemUpdate,
    FIELD_TYPE_FILE,
    FIELD_TYPE_TEXT,
)
from models.auth_models import User
from services.services_auth import get_current_user, has_permission, require_permission
from utils.db_utils import prepare_for_mongo

router = APIRouter(prefix="/is-catalog", tags=["is-catalog"])

SCHEMA_ID = "default"

# Allowed file extensions and MIME types for IS catalog file fields
ALLOWED_EXTENSIONS = {".doc", ".docx", ".xls", ".xlsx", ".pdf"}
ALLOWED_MIME = {
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/pdf",
}
EXT_TO_MIME = {
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".pdf": "application/pdf",
}

# Default schema fields (Название, Дата создания, Владелец, URL, Контакты)
DEFAULT_SCHEMA_FIELDS = [
    ISCatalogSchemaField(key="name", label="Название", order=0),
    ISCatalogSchemaField(key="created_at", label="Дата создания", order=1),
    ISCatalogSchemaField(key="owner", label="Владелец", order=2),
    ISCatalogSchemaField(key="url", label="URL", order=3),
    ISCatalogSchemaField(key="contacts", label="Контакты", order=4),
]


def _get_upload_dir() -> Path:
    base = os.environ.get("IS_CATALOG_UPLOAD_DIR") or os.path.join(os.path.dirname(__file__), "..", "uploads", "is_catalog")
    path = Path(base)
    path.mkdir(parents=True, exist_ok=True)
    return path


def _get_schema_fields_with_type(schema_doc: dict) -> List[tuple]:
    """Return list of (key, field_type) from schema, ordered."""
    fields = schema_doc.get("fields") or []
    sorted_fields = sorted(fields, key=lambda x: x.get("order", 0))
    return [(f.get("key"), f.get("field_type") or FIELD_TYPE_TEXT) for f in sorted_fields if f.get("key")]


async def ensure_default_schema():
    """Create default schema document if collection is empty."""
    existing = await db.is_catalog_schema.find_one({})
    if existing:
        return
    doc = {
        "id": SCHEMA_ID,
        "fields": [f.model_dump() for f in DEFAULT_SCHEMA_FIELDS],
    }
    await db.is_catalog_schema.insert_one(doc)


def _get_schema_field_keys(schema_doc: dict) -> List[str]:
    """Return ordered list of field keys from schema document."""
    return [k for k, _ in _get_schema_fields_with_type(schema_doc)]


async def _item_response(doc: dict, schema_doc: dict) -> dict:
    """Build response dict for one IS. Text fields as-is; file fields enriched with filename, content_type."""
    keys_with_type = _get_schema_fields_with_type(schema_doc)
    out = {
        "id": doc.get("id"),
        "host_ids": doc.get("host_ids", []),
        "created_at": doc.get("created_at") if doc.get("created_at") is not None else "",
        "created_by": doc.get("created_by"),
    }
    for k, field_type in keys_with_type:
        val = doc.get(k)
        if field_type == FIELD_TYPE_FILE and val and isinstance(val, str):
            file_meta = await db.is_catalog_files.find_one({"id": val}, {"_id": 0, "filename": 1, "content_type": 1})
            if file_meta:
                out[k] = {"file_id": val, "filename": file_meta.get("filename", ""), "content_type": file_meta.get("content_type", "")}
            else:
                out[k] = {"file_id": val, "filename": "", "content_type": ""}
        else:
            out[k] = val if val is not None else ""
    return out


def _filter_data_to_schema(data: dict, schema_doc: dict) -> dict:
    """Keep only keys that exist in schema. Text as string; file as file_id string."""
    keys_with_type = _get_schema_fields_with_type(schema_doc)
    result = {}
    for k, field_type in keys_with_type:
        if k not in data:
            continue
        v = data[k]
        if field_type == FIELD_TYPE_FILE:
            if isinstance(v, dict) and v.get("file_id"):
                result[k] = str(v["file_id"]).strip()
            elif isinstance(v, str) and v.strip():
                result[k] = v.strip()
            else:
                result[k] = ""
        else:
            result[k] = str(v).strip() if v is not None else ""
    return result


# ============================================================================
# Schema (admin)
# ============================================================================

@router.get("/schema", response_model=ISCatalogSchema)
async def get_schema(current_user: User = Depends(get_current_user)):
    """Get current IS catalog field schema (any authenticated user with catalog view)."""
    await require_permission(current_user, "is_catalog_view")
    await ensure_default_schema()
    doc = await db.is_catalog_schema.find_one({"id": SCHEMA_ID}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Схема не найдена")
    fields = [ISCatalogSchemaField(**f) for f in doc.get("fields", [])]
    return ISCatalogSchema(id=doc.get("id", SCHEMA_ID), fields=fields)


@router.put("/schema", response_model=ISCatalogSchema)
async def update_schema(
    body: ISCatalogSchemaUpdate, current_user: User = Depends(get_current_user)
):
    """Update schema (admin or is_catalog_manage_schema). Add/remove/reorder fields."""
    if not current_user.is_admin and not await has_permission(current_user, "is_catalog_manage_schema"):
        raise HTTPException(status_code=403, detail="Недостаточно прав для изменения схемы")
    await ensure_default_schema()

    old_doc = await db.is_catalog_schema.find_one({"id": SCHEMA_ID})
    old_keys = set(_get_schema_field_keys(old_doc or {}))
    new_fields = [f.model_dump() for f in body.fields]
    new_keys = {f["key"] for f in new_fields}

    # Update schema document
    await db.is_catalog_schema.update_one(
        {"id": SCHEMA_ID},
        {"$set": {"fields": new_fields}},
    )

    # Add new field to all IS: set "" for keys that didn't exist
    added = new_keys - old_keys
    if added:
        updates = {k: "" for k in added}
        await db.is_catalog.update_many({}, {"$set": updates})

    # Remove deleted field from all IS
    removed = old_keys - new_keys
    if removed:
        await db.is_catalog.update_many({}, {"$unset": {k: 1 for k in removed}})

    doc = await db.is_catalog_schema.find_one({"id": SCHEMA_ID}, {"_id": 0})
    fields = [ISCatalogSchemaField(**f) for f in doc.get("fields", [])]
    return ISCatalogSchema(id=doc.get("id", SCHEMA_ID), fields=fields)


# ============================================================================
# File upload / download (must be before /{item_id})
# ============================================================================

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Upload a file for use in IS catalog file fields. Allowed: Word (.doc, .docx), Excel (.xls, .xlsx), PDF (.pdf)."""
    await require_permission(current_user, "is_catalog_edit")
    if not file.filename:
        raise HTTPException(status_code=400, detail="Имя файла отсутствует")
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Разрешены только файлы: Word (.doc, .docx), Excel (.xls, .xlsx), PDF (.pdf). Получено: {ext}",
        )
    content_type = file.content_type or EXT_TO_MIME.get(ext, "")
    if content_type and content_type not in ALLOWED_MIME:
        content_type = EXT_TO_MIME.get(ext, "application/octet-stream")
    file_id = str(uuid.uuid4())
    upload_dir = _get_upload_dir()
    stored_name = f"{file_id}{ext}"
    stored_path = upload_dir / stored_name
    try:
        contents = await file.read()
        with open(stored_path, "wb") as f:
            f.write(contents)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка сохранения файла: {e}")
    file_doc = {
        "id": file_id,
        "filename": file.filename,
        "content_type": content_type,
        "stored_path": str(stored_path),
        "uploaded_at": datetime.now(timezone.utc),
        "uploaded_by": current_user.id,
    }
    await db.is_catalog_files.insert_one(prepare_for_mongo(file_doc))
    return {"file_id": file_id, "filename": file.filename, "content_type": content_type}


@router.get("/files/{file_id}")
async def download_file(
    file_id: str,
    current_user: User = Depends(get_current_user),
):
    """Download a file from IS catalog by file_id."""
    await require_permission(current_user, "is_catalog_view")
    file_doc = await db.is_catalog_files.find_one({"id": file_id}, {"_id": 0, "filename": 1, "stored_path": 1, "content_type": 1})
    if not file_doc:
        raise HTTPException(status_code=404, detail="Файл не найден")
    path = Path(file_doc.get("stored_path", ""))
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Файл не найден на диске")
    return FileResponse(
        path,
        filename=file_doc.get("filename") or f"file_{file_id}",
        media_type=file_doc.get("content_type") or "application/octet-stream",
    )


# ============================================================================
# CRUD IS catalog items
# ============================================================================

@router.get("", response_model=List[Dict[str, Any]])
async def list_is_catalog(current_user: User = Depends(get_current_user)):
    """List all information systems (fields according to current schema)."""
    await require_permission(current_user, "is_catalog_view")
    await ensure_default_schema()
    schema_doc = await db.is_catalog_schema.find_one({"id": SCHEMA_ID}, {"_id": 0})
    if not schema_doc:
        raise HTTPException(status_code=404, detail="Схема не найдена")

    cursor = db.is_catalog.find({}, {"_id": 0}).sort("created_at", -1)
    items = await cursor.to_list(1000)
    return [await _item_response(doc, schema_doc) for doc in items]


@router.post("", response_model=Dict[str, Any])
async def create_is_catalog_item(
    body: Dict[str, Any], current_user: User = Depends(get_current_user)
):
    """Create new IS. Body: optional host_ids + any schema field keys."""
    await require_permission(current_user, "is_catalog_edit")
    await ensure_default_schema()
    schema_doc = await db.is_catalog_schema.find_one({"id": SCHEMA_ID}, {"_id": 0})
    if not schema_doc:
        raise HTTPException(status_code=404, detail="Схема не найдена")

    from datetime import datetime, timezone
    import uuid

    item_id = str(uuid.uuid4())
    host_ids = body.get("host_ids")
    if not isinstance(host_ids, list):
        host_ids = []
    host_ids = [str(h) for h in host_ids]

    data_fields = _filter_data_to_schema(body, schema_doc)
    # Ensure all schema keys exist
    for k in _get_schema_field_keys(schema_doc):
        if k not in data_fields:
            data_fields[k] = ""

    doc = {
        "id": item_id,
        "host_ids": host_ids,
        "created_at": datetime.now(timezone.utc),
        "created_by": current_user.id,
        **data_fields,
    }
    prepared = prepare_for_mongo(doc)
    await db.is_catalog.insert_one(prepared)
    return await _item_response(prepared, schema_doc)


@router.get("/{item_id}", response_model=Dict[str, Any])
async def get_is_catalog_item(
    item_id: str, current_user: User = Depends(get_current_user)
):
    """Get one IS by id."""
    await require_permission(current_user, "is_catalog_view")
    await ensure_default_schema()
    schema_doc = await db.is_catalog_schema.find_one({"id": SCHEMA_ID}, {"_id": 0})
    if not schema_doc:
        raise HTTPException(status_code=404, detail="Схема не найдена")

    doc = await db.is_catalog.find_one({"id": item_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="ИС не найдена")
    return await _item_response(doc, schema_doc)


@router.put("/{item_id}", response_model=Dict[str, Any])
async def update_is_catalog_item(
    item_id: str, body: Dict[str, Any], current_user: User = Depends(get_current_user)
):
    """Update IS. Body: optional host_ids + any schema field keys."""
    await require_permission(current_user, "is_catalog_edit")
    await ensure_default_schema()
    schema_doc = await db.is_catalog_schema.find_one({"id": SCHEMA_ID}, {"_id": 0})
    if not schema_doc:
        raise HTTPException(status_code=404, detail="Схема не найдена")

    doc = await db.is_catalog.find_one({"id": item_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="ИС не найдена")

    update = {}
    if "host_ids" in body:
        host_ids = body["host_ids"]
        if not isinstance(host_ids, list):
            host_ids = []
        update["host_ids"] = [str(h) for h in host_ids]
    data_fields = _filter_data_to_schema(body, schema_doc)
    if data_fields:
        update.update(data_fields)

    if not update:
        return await _item_response(doc, schema_doc)

    await db.is_catalog.update_one({"id": item_id}, {"$set": prepare_for_mongo(update)})
    updated = await db.is_catalog.find_one({"id": item_id}, {"_id": 0})
    return await _item_response(updated, schema_doc)


@router.delete("/{item_id}")
async def delete_is_catalog_item(
    item_id: str, current_user: User = Depends(get_current_user)
):
    """Delete IS."""
    await require_permission(current_user, "is_catalog_edit")
    result = await db.is_catalog.delete_one({"id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="ИС не найдена")
    return {"message": "ИС удалена"}
