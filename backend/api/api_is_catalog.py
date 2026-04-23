"""
IS Catalog API: schema (admin), file upload/download, and CRUD for information systems catalog.
"""

import os
import uuid
from pathlib import Path
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File  # pyright: ignore[reportMissingImports]
from fastapi.responses import FileResponse, StreamingResponse

from typing import List, Dict, Any, Optional

from bson import ObjectId  # pyright: ignore[reportMissingImports]
from bson.errors import InvalidId  # pyright: ignore[reportMissingImports]

from config.config_init import db, logger, get_is_catalog_gridfs_bucket
from config.config_settings import IS_CATALOG_FILE_STORAGE
from models.is_catalog_models import (
    ISCatalogSchema,
    ISCatalogSchemaField,
    ISCatalogSchemaUpdate,
    ISCatalogItem,
    ISCatalogItemCreate,
    ISCatalogItemUpdate,
    FIELD_TYPE_FILE,
    FIELD_TYPE_SELECT,
    FIELD_TYPE_TEXT,
)
from models.auth_models import User
from services.services_auth import get_current_user, has_permission, require_permission
from utils.db_utils import prepare_for_mongo
from utils.audit_utils import log_audit

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


def _build_candidate_upload_dirs() -> List[Path]:
    """Build candidate directories for current and legacy upload locations."""
    dirs = [_get_upload_dir()]

    # Common legacy/runtime locations in docker/local runs.
    dirs.extend(
        [
            Path("/app/backend/uploads/is_catalog"),
            Path("/app/uploads/is_catalog"),
            Path.cwd() / "uploads" / "is_catalog",
        ]
    )

    # Keep order, remove duplicates.
    unique: List[Path] = []
    seen = set()
    for p in dirs:
        key = str(p.resolve()) if p.exists() else str(p)
        if key in seen:
            continue
        seen.add(key)
        unique.append(p)
    logger.info(
        "[is-catalog:file] upload dirs context cwd=%s env.IS_CATALOG_UPLOAD_DIR=%s candidates=%s",
        str(Path.cwd()),
        os.environ.get("IS_CATALOG_UPLOAD_DIR", ""),
        [str(p) for p in unique],
    )
    return unique


def _extract_file_extension(file_doc: dict) -> str:
    """Try to infer extension from stored path or original filename."""
    stored_path = str(file_doc.get("stored_path", "")).strip()
    if stored_path:
        ext = Path(stored_path).suffix.lower()
        if ext in ALLOWED_EXTENSIONS:
            return ext
    filename = str(file_doc.get("filename", "")).strip()
    if filename:
        ext = Path(filename).suffix.lower()
        if ext in ALLOWED_EXTENSIONS:
            return ext
    return ""


def _coerce_gridfs_object_id(raw: Any) -> Optional[ObjectId]:
    """Convert stored gridfs_id field into ObjectId or return None."""
    if raw is None:
        return None
    if isinstance(raw, ObjectId):
        return raw
    try:
        return ObjectId(str(raw))
    except (InvalidId, TypeError, ValueError):
        return None


async def _store_file_in_gridfs(
    file_id: str,
    contents: bytes,
    filename: str,
    content_type: str,
    uploaded_by: str,
) -> ObjectId:
    """Upload bytes into GridFS and return the resulting ObjectId."""
    bucket = get_is_catalog_gridfs_bucket()
    metadata = {
        "file_id": file_id,
        "content_type": content_type,
        "uploaded_by": uploaded_by,
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
    }
    gridfs_oid = await bucket.upload_from_stream(
        filename or f"file_{file_id}",
        contents,
        metadata=metadata,
    )
    return gridfs_oid


async def _delete_gridfs_object(gridfs_id: Any) -> bool:
    """Delete an object from GridFS by its ObjectId. Safe to call with unknown ids."""
    oid = _coerce_gridfs_object_id(gridfs_id)
    if oid is None:
        return False
    bucket = get_is_catalog_gridfs_bucket()
    try:
        await bucket.delete(oid)
        return True
    except Exception as e:
        logger.warning("[is-catalog:file] gridfs delete failed gridfs_id=%s reason=%s", str(gridfs_id), str(e))
        return False


async def _delete_file_record(file_id: str) -> None:
    """
    Delete an is_catalog_files metadata record along with underlying binary storage
    (GridFS object and/or legacy disk file). Best-effort: missing parts do not raise.
    """
    if not file_id:
        return
    doc = await db.is_catalog_files.find_one({"id": file_id}, {"_id": 0})
    if not doc:
        return

    gridfs_id = doc.get("gridfs_id")
    if gridfs_id:
        await _delete_gridfs_object(gridfs_id)

    stored_path = str(doc.get("stored_path") or "").strip()
    if stored_path:
        try:
            p = Path(stored_path)
            if p.is_file():
                p.unlink()
        except Exception as e:
            logger.warning("[is-catalog:file] legacy disk delete failed file_id=%s path=%s reason=%s", file_id, stored_path, str(e))

    try:
        await db.is_catalog_files.delete_one({"id": file_id})
    except Exception as e:
        logger.warning("[is-catalog:file] metadata delete failed file_id=%s reason=%s", file_id, str(e))


async def _resolve_file_path(file_id: str, file_doc: dict) -> Optional[Path]:
    """
    Resolve real file path even if stored_path became stale.
    If a new location is found, update stored_path in DB.
    """
    stored_path = str(file_doc.get("stored_path", "")).strip()
    logger.info(
        "[is-catalog:file] resolve start file_id=%s stored_path=%s filename=%s content_type=%s",
        file_id,
        stored_path,
        file_doc.get("filename"),
        file_doc.get("content_type"),
    )
    if stored_path:
        direct = Path(stored_path)
        if direct.is_file():
            logger.info("[is-catalog:file] resolve success by stored_path file_id=%s path=%s", file_id, str(direct))
            return direct
        logger.warning("[is-catalog:file] stored_path missing on disk file_id=%s path=%s", file_id, str(direct))

    ext = _extract_file_extension(file_doc)
    candidate_names = []
    if ext:
        candidate_names.append(f"{file_id}{ext}")
    candidate_names.extend([f"{file_id}{suffix}" for suffix in ALLOWED_EXTENSIONS if f"{file_id}{suffix}" not in candidate_names])
    logger.info("[is-catalog:file] candidate names for file_id=%s: %s", file_id, candidate_names)

    for base_dir in _build_candidate_upload_dirs():
        for name in candidate_names:
            candidate = base_dir / name
            if candidate.is_file():
                await db.is_catalog_files.update_one({"id": file_id}, {"$set": {"stored_path": str(candidate)}})
                logger.info(
                    "[is-catalog:file] resolve success by fallback file_id=%s found=%s; stored_path updated",
                    file_id,
                    str(candidate),
                )
                return candidate

    logger.error("[is-catalog:file] resolve failed file_id=%s: file not found in any candidate location", file_id)
    return None


def _get_schema_fields_with_type(schema_doc: dict) -> List[tuple]:
    """Return list of (key, field_type, field_options) from schema, ordered."""
    fields = schema_doc.get("fields") or []
    sorted_fields = sorted(fields, key=lambda x: x.get("order", 0))
    out = []
    for f in sorted_fields:
        key = f.get("key")
        if not key:
            continue
        field_type = f.get("field_type") or FIELD_TYPE_TEXT
        field_options = f.get("field_options") or []
        if not isinstance(field_options, list):
            field_options = []
        normalized_options = [str(opt).strip() for opt in field_options if str(opt).strip()]
        out.append((key, field_type, normalized_options))
    return out


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
    return [k for k, _, _ in _get_schema_fields_with_type(schema_doc)]


async def _item_response(doc: dict, schema_doc: dict) -> dict:
    """Build response dict for one IS. Text fields as-is; file fields enriched with filename, content_type."""
    keys_with_type = _get_schema_fields_with_type(schema_doc)
    out = {
        "id": doc.get("id"),
        "host_ids": doc.get("host_ids", []),
        "created_at": doc.get("created_at") if doc.get("created_at") is not None else "",
        "created_by": doc.get("created_by"),
    }
    for k, field_type, _ in keys_with_type:
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
    for k, field_type, field_options in keys_with_type:
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
        elif field_type == FIELD_TYPE_SELECT:
            value = str(v).strip() if v is not None else ""
            result[k] = value if (not field_options or value in field_options) else ""
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
    """Upload a file for use in IS catalog file fields. Allowed: Word (.doc, .docx), Excel (.xls, .xlsx), PDF (.pdf).

    Primary backend is GridFS. In ``hybrid`` mode a disk fallback kicks in if the
    GridFS upload fails. In ``disk`` mode files are written to disk only (legacy).
    """
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
    storage_mode = IS_CATALOG_FILE_STORAGE  # "gridfs" | "disk" | "hybrid"

    logger.info(
        "[is-catalog:file] upload start file_id=%s original_filename=%s content_type=%s storage_mode=%s",
        file_id,
        file.filename,
        content_type,
        storage_mode,
    )

    try:
        contents = await file.read()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка чтения загруженного файла: {e}")

    size_bytes = len(contents)
    storage_backend: Optional[str] = None
    gridfs_oid: Optional[ObjectId] = None
    stored_path_str: Optional[str] = None

    # 1) Primary path: GridFS (unless forced to disk)
    if storage_mode in ("gridfs", "hybrid"):
        try:
            gridfs_oid = await _store_file_in_gridfs(
                file_id=file_id,
                contents=contents,
                filename=file.filename,
                content_type=content_type,
                uploaded_by=current_user.id,
            )
            storage_backend = "gridfs"
        except Exception as e:
            logger.error("[is-catalog:file] gridfs upload failed file_id=%s reason=%s", file_id, str(e))
            if storage_mode == "gridfs":
                raise HTTPException(status_code=500, detail=f"Ошибка сохранения файла в GridFS: {e}")
            # hybrid: fall through to disk fallback

    # 2) Disk path: "disk" mode explicitly, or hybrid fallback after GridFS failure
    if storage_backend is None:
        try:
            upload_dir = _get_upload_dir()
            stored_name = f"{file_id}{ext}"
            stored_path = upload_dir / stored_name
            with open(stored_path, "wb") as f:
                f.write(contents)
            stored_path_str = str(stored_path)
            storage_backend = "disk"
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Ошибка сохранения файла: {e}")

    file_doc: Dict[str, Any] = {
        "id": file_id,
        "filename": file.filename,
        "content_type": content_type,
        "uploaded_at": datetime.now(timezone.utc),
        "uploaded_by": current_user.id,
        "storage_backend": storage_backend,
        "size_bytes": size_bytes,
    }
    if gridfs_oid is not None:
        file_doc["gridfs_id"] = gridfs_oid
    if stored_path_str:
        file_doc["stored_path"] = stored_path_str

    await db.is_catalog_files.insert_one(prepare_for_mongo(file_doc))

    logger.info(
        "[is-catalog:file] upload success file_id=%s storage_backend=%s gridfs_id=%s stored_path=%s size_bytes=%s",
        file_id,
        storage_backend,
        str(gridfs_oid) if gridfs_oid is not None else "-",
        stored_path_str or "-",
        size_bytes,
    )
    log_audit(
        "is_catalog_file_upload",
        user_id=current_user.id,
        username=current_user.username,
        details={
            "file_id": file_id,
            "filename": file.filename,
            "content_type": content_type,
            "size_bytes": size_bytes,
            "storage_backend": storage_backend,
        },
    )
    return {"file_id": file_id, "filename": file.filename, "content_type": content_type}


def _content_disposition(filename: str) -> str:
    """Build a Content-Disposition header value with RFC 5987 filename*= for non-ASCII names."""
    from urllib.parse import quote as _quote
    safe_ascii = (filename or "").encode("ascii", "ignore").decode("ascii") or "file"
    quoted = _quote(filename or "file", safe="")
    return f'attachment; filename="{safe_ascii}"; filename*=UTF-8\'\'{quoted}'


async def _stream_file_from_gridfs(
    file_id: str,
    gridfs_id: Any,
    filename: str,
    content_type: str,
) -> StreamingResponse:
    """Return a StreamingResponse reading chunks from GridFS."""
    oid = _coerce_gridfs_object_id(gridfs_id)
    if oid is None:
        raise HTTPException(status_code=500, detail="Некорректный идентификатор файла в GridFS")
    bucket = get_is_catalog_gridfs_bucket()
    try:
        grid_out = await bucket.open_download_stream(oid)
    except Exception as e:
        logger.error("[is-catalog:file] gridfs open failed file_id=%s gridfs_id=%s reason=%s", file_id, str(oid), str(e))
        raise HTTPException(status_code=404, detail="Файл не найден в GridFS")

    async def _iter():
        try:
            while True:
                chunk = await grid_out.readchunk()
                if not chunk:
                    break
                yield chunk
        finally:
            try:
                # AsyncIOMotorGridOut exposes a close() coroutine
                await grid_out.close()
            except Exception:
                pass

    headers = {
        "Content-Disposition": _content_disposition(filename or f"file_{file_id}"),
    }
    length = getattr(grid_out, "length", None)
    if isinstance(length, int) and length >= 0:
        headers["Content-Length"] = str(length)

    return StreamingResponse(
        _iter(),
        media_type=content_type or "application/octet-stream",
        headers=headers,
    )


@router.get("/files/{file_id}")
async def download_file(
    file_id: str,
    current_user: User = Depends(get_current_user),
):
    """Download a file from IS catalog by file_id.

    Resolution order:
      1. GridFS (if metadata record has gridfs_id / storage_backend=gridfs).
      2. Legacy disk path (fallback for records migrated from the filesystem backend).
    """
    await require_permission(current_user, "is_catalog_view")
    logger.info("[is-catalog:file] download request file_id=%s user_id=%s", file_id, current_user.id)
    file_doc = await db.is_catalog_files.find_one(
        {"id": file_id},
        {"_id": 0, "filename": 1, "stored_path": 1, "content_type": 1, "storage_backend": 1, "gridfs_id": 1},
    )
    if not file_doc:
        logger.warning("[is-catalog:file] download fail file_id=%s reason=db-record-missing", file_id)
        raise HTTPException(status_code=404, detail="Файл не найден")

    filename = file_doc.get("filename") or f"file_{file_id}"
    content_type = file_doc.get("content_type") or "application/octet-stream"
    storage_backend = (file_doc.get("storage_backend") or "").strip().lower()
    gridfs_id = file_doc.get("gridfs_id")

    # Prefer GridFS when available
    if gridfs_id or storage_backend == "gridfs":
        try:
            response = await _stream_file_from_gridfs(file_id, gridfs_id, filename, content_type)
        except HTTPException:
            # In hybrid mode we still try disk fallback below; in gridfs-only it's a real error.
            if IS_CATALOG_FILE_STORAGE == "gridfs":
                raise
            response = None
        else:
            logger.info("[is-catalog:file] download success file_id=%s backend=gridfs", file_id)
            log_audit(
                "is_catalog_file_download",
                user_id=current_user.id,
                username=current_user.username,
                details={"file_id": file_id, "backend": "gridfs"},
            )
            return response

    # Disk fallback (legacy records or hybrid-mode recovery)
    path = await _resolve_file_path(file_id, file_doc)
    if not path:
        logger.error(
            "[is-catalog:file] download fail file_id=%s reason=file-missing storage_backend=%s gridfs_id=%s stored_path=%s",
            file_id,
            storage_backend or "-",
            str(gridfs_id) if gridfs_id else "-",
            file_doc.get("stored_path"),
        )
        raise HTTPException(status_code=404, detail="Файл не найден")

    logger.info("[is-catalog:file] download success file_id=%s backend=disk path=%s", file_id, str(path))
    log_audit(
        "is_catalog_file_download",
        user_id=current_user.id,
        username=current_user.username,
        details={"file_id": file_id, "backend": "disk"},
    )
    return FileResponse(
        path,
        filename=filename,
        media_type=content_type,
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
