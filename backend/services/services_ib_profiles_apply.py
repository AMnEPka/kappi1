"""
services/services_ib_profiles_apply.py
Run IB profile application on hosts: checks + execute script via SSH/WinRM, yield SSE events.
"""

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import AsyncGenerator, Dict, Any, Optional, List
import uuid

from config.config_init import db, logger
from models.content_models import Host
from models.ib_profile_models import IBProfileApplySession, IBProfileApplication
from services.services_execution import (
    _check_network_access,
    _check_ssh_login_and_sudo,
    _check_winrm_login,
    _check_admin_access,
    _execute_profile_linux,
    _execute_profile_windows,
)
from utils.db_utils import prepare_for_mongo, parse_from_mongo

# Max chars to store and to send in output_preview
OUTPUT_PREVIEW_MAX = 2000
OUTPUT_STORAGE_MAX = 50000


def _os_from_connection_type(connection_type: Optional[str]) -> str:
    if connection_type == "winrm":
        return "windows"
    return "linux"


def _truncate(s: Optional[str], max_len: int) -> str:
    if not s:
        return ""
    return s[:max_len] + ("..." if len(s) > max_len else "")


async def run_apply_session_events(
    session_id: str,
    user_id: str,
    username: str,
) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Load apply session, run checks and profile execution per host, yield SSE event dicts.
    Persists each host result to ib_profile_applications.
    """
    session_doc = await db.ib_profile_apply_sessions.find_one({"session_id": session_id})
    if not session_doc:
        yield {"type": "error", "message": "Сессия применения не найдена"}
        return

    host_ids = session_doc.get("host_ids") or []
    profile_by_os = session_doc.get("profile_by_os") or {}

    if not host_ids:
        yield {"type": "error", "message": "Нет хостов в сессии"}
        return

    yield {"type": "status", "message": "Начало применения профилей ИБ", "session_id": session_id}
    yield {"type": "info", "message": f"Всего хостов: {len(host_ids)}"}

    total = len(host_ids)
    completed = 0
    failed = 0
    loop = asyncio.get_event_loop()

    for idx, host_id in enumerate(host_ids):
        host_doc = await db.hosts.find_one({"id": host_id}, {"_id": 0})
        if not host_doc:
            yield {"type": "task_error", "host_name": host_id, "error": "Хост не найден"}
            yield {"type": "script_progress", "host_name": host_id, "completed": idx + 1, "total": total}
            failed += 1
            continue

        host = Host(**parse_from_mongo(host_doc))
        os_key = _os_from_connection_type(host.connection_type)
        profile_id = profile_by_os.get(os_key)
        if not profile_id:
            yield {"type": "task_error", "host_name": host.name, "error": f"Профиль для ОС {os_key} не выбран"}
            yield {"type": "script_progress", "host_name": host.name, "completed": idx + 1, "total": total}
            failed += 1
            continue

        profile_doc = await db.ib_profiles.find_one({"id": profile_id}, {"_id": 0, "content": 1, "version": 1})
        if not profile_doc:
            yield {"type": "task_error", "host_name": host.name, "error": "Профиль не найден"}
            yield {"type": "script_progress", "host_name": host.name, "completed": idx + 1, "total": total}
            failed += 1
            continue

        profile_content = profile_doc.get("content") or ""
        profile_version = profile_doc.get("version") or ""

        yield {
            "type": "task_start",
            "host_name": host.name,
            "host_address": host.hostname,
            "scripts_count": 1,
        }

        # 1. Network
        network_ok, network_msg = await loop.run_in_executor(None, _check_network_access, host)
        yield {"type": "check_network", "host_name": host.name, "success": network_ok, "message": network_msg}

        if not network_ok:
            await _persist_application(
                session_id=session_id,
                profile_id=profile_id,
                profile_version=profile_version,
                host_id=host.id,
                host_name=host.name,
                user_id=user_id,
                username=username,
                status="failed",
                stderr=network_msg,
            )
            failed += 1
            yield {"type": "task_error", "host_name": host.name, "error": network_msg}
            yield {"type": "script_progress", "host_name": host.name, "completed": idx + 1, "total": total}
            continue

        # 2. Login + Sudo/Admin
        if host.connection_type == "winrm":
            login_ok, login_msg = await loop.run_in_executor(None, _check_winrm_login, host)
            yield {"type": "check_login", "host_name": host.name, "success": login_ok, "message": login_msg}
            if not login_ok:
                await _persist_application(
                    session_id=session_id, profile_id=profile_id, profile_version=profile_version,
                    host_id=host.id, host_name=host.name, user_id=user_id, username=username,
                    status="failed", stderr=login_msg,
                )
                failed += 1
                yield {"type": "task_error", "host_name": host.name, "error": login_msg}
                yield {"type": "script_progress", "host_name": host.name, "completed": idx + 1, "total": total}
                continue
            sudo_ok, sudo_msg = await loop.run_in_executor(None, _check_admin_access, host)
            yield {"type": "check_sudo", "host_name": host.name, "success": sudo_ok, "message": sudo_msg}
        else:
            login_ok, login_msg, sudo_ok, sudo_msg = await loop.run_in_executor(
                None, _check_ssh_login_and_sudo, host
            )
            yield {"type": "check_login", "host_name": host.name, "success": login_ok, "message": login_msg}
            if not login_ok:
                await _persist_application(
                    session_id=session_id, profile_id=profile_id, profile_version=profile_version,
                    host_id=host.id, host_name=host.name, user_id=user_id, username=username,
                    status="failed", stderr=login_msg,
                )
                failed += 1
                yield {"type": "task_error", "host_name": host.name, "error": login_msg}
                yield {"type": "script_progress", "host_name": host.name, "completed": idx + 1, "total": total}
                continue
            yield {"type": "check_sudo", "host_name": host.name, "success": sudo_ok, "message": sudo_msg}

        if not sudo_ok:
            await _persist_application(
                session_id=session_id, profile_id=profile_id, profile_version=profile_version,
                host_id=host.id, host_name=host.name, user_id=user_id, username=username,
                status="failed", stderr=sudo_msg,
            )
            failed += 1
            yield {"type": "task_error", "host_name": host.name, "error": sudo_msg}
            yield {"type": "script_progress", "host_name": host.name, "completed": idx + 1, "total": total}
            continue

        # 3. Execute profile
        started_at = datetime.now(timezone.utc)
        if host.connection_type == "winrm":
            success, stdout, stderr, exit_code = await loop.run_in_executor(
                None, _execute_profile_windows, host, profile_content
            )
        else:
            success, stdout, stderr, exit_code = await loop.run_in_executor(
                None, _execute_profile_linux, host, profile_content
            )
        finished_at = datetime.now(timezone.utc)

        stdout_stored = _truncate(stdout, OUTPUT_STORAGE_MAX)
        stderr_stored = _truncate(stderr, OUTPUT_STORAGE_MAX)
        output_preview = _truncate(stdout or stderr, OUTPUT_PREVIEW_MAX)

        await _persist_application(
            session_id=session_id,
            profile_id=profile_id,
            profile_version=profile_version,
            host_id=host.id,
            host_name=host.name,
            user_id=user_id,
            username=username,
            status="success" if success else "failed",
            exit_code=exit_code,
            stdout=stdout_stored,
            stderr=stderr_stored,
            started_at=started_at,
            finished_at=finished_at,
        )

        yield {
            "type": "task_complete",
            "host_name": host.name,
            "success": success,
            "exit_code": exit_code,
            "output_preview": output_preview,
            "error": stderr if not success else None,
        }
        yield {"type": "script_progress", "host_name": host.name, "completed": idx + 1, "total": total}

        if success:
            completed += 1
        else:
            failed += 1

    yield {
        "type": "complete",
        "status": "completed" if failed == 0 else "failed",
        "completed": completed,
        "failed": failed,
        "total": total,
        "session_id": session_id,
    }


async def _persist_application(
    session_id: str,
    profile_id: str,
    profile_version: str,
    host_id: str,
    host_name: str,
    user_id: str,
    username: str,
    status: str,
    exit_code: Optional[int] = None,
    stdout: Optional[str] = None,
    stderr: Optional[str] = None,
    started_at: Optional[datetime] = None,
    finished_at: Optional[datetime] = None,
) -> None:
    now = datetime.now(timezone.utc)
    doc = {
        "id": str(uuid.uuid4()),
        "session_id": session_id,
        "profile_id": profile_id,
        "profile_version": profile_version,
        "host_ids": [host_id],
        "applied_at": now,
        "applied_by": user_id,
        "username": username,
        "details": None,
        "status": status,
        "exit_code": exit_code,
        "stdout": stdout,
        "stderr": stderr,
        "started_at": started_at,
        "finished_at": finished_at,
    }
    await db.ib_profile_applications.insert_one(prepare_for_mongo(doc))
