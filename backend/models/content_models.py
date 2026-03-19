"""
models/content_models.py
Pydantic models for categories, systems, hosts, and scripts
"""

from pydantic import BaseModel, Field, ConfigDict # pyright: ignore[reportMissingImports]
from typing import List, Optional, Literal
from datetime import datetime, timezone
import uuid


class Category(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    icon: str = "📁"
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None


class CategoryCreate(BaseModel):
    name: str
    icon: str = "📁"
    description: Optional[str] = None


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    description: Optional[str] = None


class System(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    category_id: str
    name: str
    description: Optional[str] = None
    os_type: str = "linux"  # "linux" or "windows"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None


class SystemCreate(BaseModel):
    category_id: str
    name: str
    description: Optional[str] = None
    os_type: str = "linux"


class SystemUpdate(BaseModel):
    category_id: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    os_type: Optional[str] = None


class Host(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    hostname: str
    port: int = 22
    username: str
    auth_type: str  # "password" or "key"
    password: Optional[str] = None
    ssh_key: Optional[str] = None
    connection_type: str = "ssh"  # "ssh" for Linux, "winrm" for Windows, "k8s" for Kubernetes
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None


class HostCreate(BaseModel):
    name: str
    hostname: str
    port: int = 22
    username: str
    auth_type: str
    password: Optional[str] = None
    ssh_key: Optional[str] = None
    connection_type: str = "ssh"


class HostUpdate(BaseModel):
    name: Optional[str] = None
    hostname: Optional[str] = None
    port: Optional[int] = None
    username: Optional[str] = None
    auth_type: Optional[str] = None
    password: Optional[str] = None
    ssh_key: Optional[str] = None
    connection_type: Optional[str] = None


class CheckGroup(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None


class CheckGroupCreate(BaseModel):
    name: str


class CheckGroupUpdate(BaseModel):
    name: Optional[str] = None


class ProcessorScriptVersion(BaseModel):
    """Модель версии скрипта-обработчика"""
    model_config = ConfigDict(extra="ignore")
    
    content: str  # Содержимое скрипта
    version_number: int  # Номер версии
    comment: Optional[str] = None  # Комментарий к версии
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None


ScriptNonComplianceCriticality = Literal[
    "Нет",
    "Низкая",
    "Средняя",
    "Высокая",
    "Высокая (Стоп-фактор)",
]


class Script(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    system_id: str  # ОБЯЗАТЕЛЬНАЯ связь с системой
    name: str
    description: Optional[str] = None
    content: str  # Команда (короткая, 1-2 строки)
    processor_script: Optional[str] = None  # Скрипт-обработчик результатов (для обратной совместимости)
    # Версионирование processor_script
    processor_script_version: Optional[ProcessorScriptVersion] = None  # Текущая версия
    processor_script_versions: List[ProcessorScriptVersion] = Field(default_factory=list)  # История версий
    has_reference_files: bool = False  # Есть ли эталонные файлы
    test_methodology: Optional[str] = None  # Описание методики испытания
    success_criteria: Optional[str] = None  # Критерий успешного прохождения испытания
    non_compliance_criticality_ope: ScriptNonComplianceCriticality = "Нет"
    non_compliance_criticality_pe: ScriptNonComplianceCriticality = "Нет"
    order: int = 0  # Порядок отображения
    group_ids: List[str] = Field(default_factory=list)  # Список ID групп проверок
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None


class ScriptCreate(BaseModel):
    system_id: str
    name: str
    description: Optional[str] = None
    content: str
    processor_script: Optional[str] = None
    processor_script_comment: Optional[str] = None  # Комментарий к первой версии
    has_reference_files: bool = False
    test_methodology: Optional[str] = None
    success_criteria: Optional[str] = None
    non_compliance_criticality_ope: ScriptNonComplianceCriticality = "Нет"
    non_compliance_criticality_pe: ScriptNonComplianceCriticality = "Нет"
    order: int = 0
    group_ids: List[str] = Field(default_factory=list)


class ScriptUpdate(BaseModel):
    system_id: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    content: Optional[str] = None
    processor_script: Optional[str] = None  # Для обратной совместимости
    processor_script_comment: Optional[str] = None  # Комментарий к новой версии
    create_new_version: Optional[bool] = False  # Создать новую версию или обновить текущую
    has_reference_files: Optional[bool] = None
    test_methodology: Optional[str] = None
    success_criteria: Optional[str] = None
    non_compliance_criticality_ope: Optional[ScriptNonComplianceCriticality] = None
    non_compliance_criticality_pe: Optional[ScriptNonComplianceCriticality] = None
    order: Optional[int] = None
    group_ids: Optional[List[str]] = None
