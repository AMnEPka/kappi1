"""
models/is_catalog_models.py
Pydantic models for IS Catalog: schema of fields and catalog items.
"""

from pydantic import BaseModel, Field, ConfigDict  # pyright: ignore[reportMissingImports]
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid


# ---------------------------------------------------------------------------
# Schema (field definitions, admin-managed)
# ---------------------------------------------------------------------------

# Allowed file field types: word (.doc, .docx), excel (.xls, .xlsx), pdf
FIELD_TYPE_TEXT = "text"
FIELD_TYPE_FILE = "file"
FIELD_TYPES = [FIELD_TYPE_TEXT, FIELD_TYPE_FILE]

class ISCatalogSchemaField(BaseModel):
    """Single field definition in the IS catalog schema."""
    key: str
    label: str
    order: int = 0
    field_type: str = FIELD_TYPE_TEXT  # "text" | "file"


class ISCatalogSchema(BaseModel):
    """Full schema: list of field definitions (one document per app)."""
    id: str = "default"
    fields: List[ISCatalogSchemaField] = Field(default_factory=list)


class ISCatalogSchemaUpdate(BaseModel):
    """Payload to update schema: replace full fields list."""
    fields: List[ISCatalogSchemaField]


# ---------------------------------------------------------------------------
# Catalog item (one IS record with dynamic fields + host_ids)
# ---------------------------------------------------------------------------

class ISCatalogItem(BaseModel):
    """One information system in the catalog. Dynamic fields come from schema."""
    model_config = ConfigDict(extra="allow")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    host_ids: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    # Dynamic text fields (key -> value) according to schema; stored as top-level keys
    # Pydantic with extra="allow" accepts any additional fields passed in


class ISCatalogItemCreate(BaseModel):
    """Create IS: only host_ids and dynamic field keys allowed (validated in API)."""
    model_config = ConfigDict(extra="allow")

    host_ids: List[str] = Field(default_factory=list)


class ISCatalogItemUpdate(BaseModel):
    """Update IS: host_ids and/or dynamic fields (validated in API against schema)."""
    model_config = ConfigDict(extra="allow")

    host_ids: Optional[List[str]] = None
