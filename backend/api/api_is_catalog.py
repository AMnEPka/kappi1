"""
IS Catalog API: schema (admin) and CRUD for information systems catalog.
"""

from fastapi import APIRouter, HTTPException, Depends  # pyright: ignore[reportMissingImports]
from typing import List, Dict, Any, Optional

from config.config_init import db
from models.is_catalog_models import (
    ISCatalogSchema,
    ISCatalogSchemaField,
    ISCatalogSchemaUpdate,
    ISCatalogItem,
    ISCatalogItemCreate,
    ISCatalogItemUpdate,
)
from models.auth_models import User
from services.services_auth import get_current_user, has_permission, require_permission
from utils.db_utils import prepare_for_mongo

router = APIRouter(prefix="/is-catalog", tags=["is-catalog"])

SCHEMA_ID = "default"

# Default schema fields (Название, Дата создания, Владелец, URL, Контакты)
DEFAULT_SCHEMA_FIELDS = [
    ISCatalogSchemaField(key="name", label="Название", order=0),
    ISCatalogSchemaField(key="created_at", label="Дата создания", order=1),
    ISCatalogSchemaField(key="owner", label="Владелец", order=2),
    ISCatalogSchemaField(key="url", label="URL", order=3),
    ISCatalogSchemaField(key="contacts", label="Контакты", order=4),
]


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
    fields = schema_doc.get("fields") or []
    sorted_fields = sorted(fields, key=lambda x: x.get("order", 0))
    return [f.get("key") for f in sorted_fields if f.get("key")]


def _item_response(doc: dict, schema_doc: dict) -> dict:
    """Build response dict for one IS. All fields are returned as-is (text); no datetime parsing."""
    keys = _get_schema_field_keys(schema_doc)
    out = {
        "id": doc.get("id"),
        "host_ids": doc.get("host_ids", []),
        "created_at": doc.get("created_at") if doc.get("created_at") is not None else "",
        "created_by": doc.get("created_by"),
    }
    for k in keys:
        val = doc.get(k)
        out[k] = val if val is not None else ""
    return out


def _filter_data_to_schema(data: dict, schema_doc: dict) -> dict:
    """Keep only keys that exist in schema; values as string."""
    keys = _get_schema_field_keys(schema_doc)
    return {k: (str(data[k]).strip() if data.get(k) is not None else "") for k in keys if k in data}


# ============================================================================
# Schema (admin)
# ============================================================================

@router.get("/schema", response_model=ISCatalogSchema)
async def get_schema(current_user: User = Depends(get_current_user)):
    """Get current IS catalog field schema (any authenticated user with catalog view)."""
    await require_permission(current_user, "is_catalog_view")
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
# CRUD IS catalog items
# ============================================================================

@router.get("", response_model=List[Dict[str, Any]])
async def list_is_catalog(
    skip: int = 0,
    limit: int = 1000,
    current_user: User = Depends(get_current_user),
):
    """List all information systems (with pagination)."""
    limit = max(1, min(limit, 1000))
    skip = max(0, skip)

    await require_permission(current_user, "is_catalog_view")
    schema_doc = await db.is_catalog_schema.find_one({"id": SCHEMA_ID}, {"_id": 0})
    if not schema_doc:
        raise HTTPException(status_code=404, detail="Схема не найдена")

    cursor = db.is_catalog.find({}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit)
    items = await cursor.to_list(limit)
    return [_item_response(doc, schema_doc) for doc in items]


@router.post("", response_model=Dict[str, Any])
async def create_is_catalog_item(
    body: Dict[str, Any], current_user: User = Depends(get_current_user)
):
    """Create new IS. Body: optional host_ids + any schema field keys."""
    await require_permission(current_user, "is_catalog_edit")
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
    return _item_response(prepared, schema_doc)


@router.get("/{item_id}", response_model=Dict[str, Any])
async def get_is_catalog_item(
    item_id: str, current_user: User = Depends(get_current_user)
):
    """Get one IS by id."""
    await require_permission(current_user, "is_catalog_view")
    schema_doc = await db.is_catalog_schema.find_one({"id": SCHEMA_ID}, {"_id": 0})
    if not schema_doc:
        raise HTTPException(status_code=404, detail="Схема не найдена")

    doc = await db.is_catalog.find_one({"id": item_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="ИС не найдена")
    return _item_response(doc, schema_doc)


@router.put("/{item_id}", response_model=Dict[str, Any])
async def update_is_catalog_item(
    item_id: str, body: Dict[str, Any], current_user: User = Depends(get_current_user)
):
    """Update IS. Body: optional host_ids + any schema field keys."""
    await require_permission(current_user, "is_catalog_edit")
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
        return _item_response(doc, schema_doc)

    await db.is_catalog.update_one({"id": item_id}, {"$set": prepare_for_mongo(update)})
    updated = await db.is_catalog.find_one({"id": item_id}, {"_id": 0})
    return _item_response(updated, schema_doc)


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
