"""
models/ib_profile_models.py
Pydantic models for Information Security (IB) profiles and application log.
"""

from pydantic import BaseModel, Field, ConfigDict  # pyright: ignore[reportMissingImports]
from typing import List, Optional
from datetime import datetime, timezone
import uuid


PROFILE_STATUS_DRAFT = "draft"
PROFILE_STATUS_ACTIVE = "active"
PROFILE_STATUS_ARCHIVED = "archived"
PROFILE_STATUSES = [PROFILE_STATUS_DRAFT, PROFILE_STATUS_ACTIVE, PROFILE_STATUS_ARCHIVED]


class IBProfile(BaseModel):
    """Профиль информационной безопасности."""
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    category_id: str
    system_id: str
    version: str  # текстовое поле, например "2", "3.1"
    content: str = ""  # содержимое скрипта/профиля
    status: str = PROFILE_STATUS_DRAFT  # draft, active, archived
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None


class IBProfileCreate(BaseModel):
    category_id: str
    system_id: str
    version: str
    content: str = ""
    status: str = PROFILE_STATUS_DRAFT


class IBProfileUpdate(BaseModel):
    version: Optional[str] = None
    content: Optional[str] = None
    status: Optional[str] = None
    update_in_place: Optional[bool] = False  # True = обновить текущую версию, False = новая версия (+0.1 не делаем автоматически, версию задаёт админ)


class IBProfileListEntry(BaseModel):
    """Элемент списка с именами категории и системы."""
    model_config = ConfigDict(extra="ignore")

    id: str
    category_id: str
    category_name: str
    system_id: str
    system_name: str
    version: str
    status: str
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str] = None


class IBProfileApplication(BaseModel):
    """Лог применения профиля ИБ на хосты (с результатом выполнения)."""
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: Optional[str] = None  # группа записей по одной сессии применения
    profile_id: str
    profile_version: str
    host_ids: List[str] = Field(default_factory=list)
    applied_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    applied_by: Optional[str] = None
    username: Optional[str] = None
    details: Optional[dict] = None
    # Результат выполнения по хосту
    status: Optional[str] = None  # success, failed
    exit_code: Optional[int] = None
    stdout: Optional[str] = None
    stderr: Optional[str] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None


class IBProfileApplySession(BaseModel):
    """Сессия запуска применения профилей (payload для SSE-стрима)."""
    model_config = ConfigDict(extra="ignore")

    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    host_ids: List[str] = Field(default_factory=list)
    profile_by_os: dict = Field(default_factory=dict)  # {"linux": "profile_id", "windows": "profile_id"}
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
