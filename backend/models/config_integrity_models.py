"""
models/config_integrity_models.py
Pydantic models for configuration integrity checking via afick
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone
import uuid


class ConfigIntegrityHost(BaseModel):
    """Host tracked for configuration integrity via afick."""
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    ip_address: str
    port: int = 22
    username: str
    auth_type: str = "password"
    password: Optional[str] = None
    ssh_key: Optional[str] = None
    is_monitored: bool = False
    monitored_files_count: Optional[int] = None
    changed_files_count: Optional[int] = None
    config_hash: Optional[str] = None
    afick_config_content: Optional[str] = None
    last_check_at: Optional[datetime] = None
    initialized_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str = ""


class ConfigIntegrityHostCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str
    ip_address: Optional[str] = None
    hostname: Optional[str] = None
    port: int = 22
    username: str
    auth_type: str = "password"
    password: Optional[str] = None
    ssh_key: Optional[str] = None

    def get_ip_address(self) -> str:
        """Return ip_address, falling back to hostname for compatibility with hosts JSON format."""
        return self.ip_address or self.hostname or ""


class ConfigIntegrityHostImport(BaseModel):
    hosts: List[ConfigIntegrityHostCreate]


class ConfigIntegrityActionRequest(BaseModel):
    host_ids: List[str]
