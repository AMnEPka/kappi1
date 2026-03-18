"""
Offline check: script generation and result upload processing.
"""

import base64
import json
import hashlib
import uuid
from datetime import datetime, timezone
from typing import List, Tuple, Optional

from config.config_init import db, logger
from models.execution_models import OfflineSession, Execution
from utils.db_utils import prepare_for_mongo, decode_script_from_storage
from services.services_execution import run_processor_on_output

# Max output size per check in generated script (1MB)
OFFLINE_OUTPUT_MAX_BYTES = 1 * 1024 * 1024


def _decode_script_content(content: str) -> str:
    """If content looks like base64 and decodes to a valid shell command, return decoded; else return as-is."""
    s = (content or "").strip()
    if not s:
        return "true"
    # Heuristic: base64 uses A-Za-z0-9+/= and often has padding; decoded should be printable
    b64_candidates = s.replace("\n", "").replace("\r", "")
    if len(b64_candidates) < 20 or not all(c.isalnum() or c in "+/=" for c in b64_candidates):
        return s
    try:
        raw = base64.b64decode(b64_candidates, validate=True)
        decoded = raw.decode("utf-8", errors="replace")
        if "\x00" in decoded or not decoded.strip():
            return s
        if all(c.isprintable() or c in "\n\r\t" for c in decoded):
            return decoded.strip()
    except Exception:
        pass
    return s


async def generate_offline_script(
    project_id: str,
    host_id: str,
    user_id: str,
) -> Tuple[str, OfflineSession, str]:
    """
    Generate bash script for offline execution on one host.
    Returns (script_content, offline_session, file_extension).
    """
    project = await db.projects.find_one({"id": project_id}, {"_id": 0, "name": 1})
    if not project:
        raise ValueError("Проект не найден")
    host_doc = await db.hosts.find_one({"id": host_id}, {"_id": 0, "name": 1})
    if not host_doc:
        raise ValueError("Хост не найден")

    tasks = await db.project_tasks.find(
        {"project_id": project_id, "host_id": host_id},
        {"_id": 0, "system_id": 1, "script_ids": 1}
    ).to_list(100)

    if not tasks:
        raise ValueError("Нет заданий для этого хоста в проекте")

    script_ids_ordered: List[str] = []
    seen: set = set()
    for t in tasks:
        for sid in t.get("script_ids") or []:
            if sid and sid not in seen:
                seen.add(sid)
                script_ids_ordered.append(sid)

    if not script_ids_ordered:
        raise ValueError("Нет проверок для выполнения")

    scripts = await db.scripts.find(
        {"id": {"$in": script_ids_ordered}},
        {"_id": 0, "id": 1, "name": 1, "content": 1}
    ).to_list(len(script_ids_ordered) + 1)
    script_map = {s["id"]: s for s in scripts}
    # Preserve order
    scripts_list = [script_map[sid] for sid in script_ids_ordered if sid in script_map]
    if not scripts_list:
        raise ValueError("Проверки не найдены")

    system_id = tasks[0].get("system_id")
    system_doc = await db.systems.find_one({"id": system_id}, {"_id": 0, "os_type": 1}) if system_id else None
    os_type = (system_doc or {}).get("os_type") or "linux"

    execution_session_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    session = OfflineSession(
        project_id=project_id,
        execution_session_id=execution_session_id,
        os_type=os_type,
        script_ids=script_ids_ordered,
        host_ids=[host_id],
        status="generated",
        created_at=now,
        created_by=user_id,
    )
    await db.offline_sessions.insert_one(prepare_for_mongo(session.model_dump()))

    project_name = project.get("name", "Проект")
    host_name = host_doc.get("name", host_id)
    ts = now.isoformat()

    if os_type == "windows":
        return _generate_powershell_script(
            session_id=execution_session_id,
            project_id=project_id,
            host_id=host_id,
            project_name=project_name,
            host_name=host_name,
            generated_at=ts,
            scripts_list=scripts_list,
        ), session, ".ps1"

    return _generate_bash_script(
        session_id=execution_session_id,
        project_id=project_id,
        host_id=host_id,
        project_name=project_name,
        host_name=host_name,
        generated_at=ts,
        scripts_list=scripts_list,
    ), session, ".sh"


def _generate_bash_script(
    session_id: str,
    project_id: str,
    host_id: str,
    project_name: str,
    host_name: str,
    generated_at: str,
    scripts_list: List[dict],
) -> str:
    results_file = f"offline_results_{session_id}.json"
    lines = [
        "#!/bin/bash",
        "# Auto-generated offline check script",
        f"# Project: {project_name}",
        f"# Host: {host_name}",
        f"# Generated: {generated_at}",
        f"# Session: {session_id}",
        "",
        f'RESULTS_FILE="{results_file}"',
        "",
        f'echo \'{{"session_id":"{session_id}","project_id":"{project_id}","host_id":"{host_id}","generated_at":"{generated_at}","checks":[\' > "$RESULTS_FILE"',
        "FIRST=1",
        "",
    ]
    for idx, script in enumerate(scripts_list):
        sid = script.get("id", "")
        name = (script.get("name") or "").replace('"', '\\"')
        content = _decode_script_content(script.get("content") or "")
        if not content.strip():
            content = "true"
        name_esc = (script.get("name") or "").replace("\\", "\\\\").replace('"', '\\"').replace("\n", " ").replace("'", "'\"'\"'")
        lines.append(f"# --- Check {idx + 1}: {name} ---")
        # Use subshell so multiline commands work; avoid { } (bash requires newline/semicolon before })
        lines.append("OUT=$(")
        for cmd_line in content.splitlines():
            lines.append("  " + cmd_line)
        lines.append("  2>&1)")
        lines.append("EXIT=$?")
        lines.append(f'if [ ${{#OUT}} -gt {OFFLINE_OUTPUT_MAX_BYTES} ]; then OUT="${{OUT:0:{OFFLINE_OUTPUT_MAX_BYTES}}}\\n... (truncated)"; fi')
        lines.append('[ $FIRST -eq 0 ] && echo "," >> "$RESULTS_FILE"')
        lines.append("FIRST=0")
        lines.append('ESC=$(printf "%s" "$OUT" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read()))" 2>/dev/null)')
        # sed: \\n in Python -> \n in output (backslash-n for newline replacement)
        lines.append(r'[ -z "$ESC" ] && ESC="\"$(printf "%s" "$OUT" | sed \'s/\\/\\\\/g;s/"/\\"/g;s/\t/\\t/g;s/\n/\\n/g\' | tr -d \'\n\')\""')
        lines.append(f'printf \'{{"script_id":"{sid}","script_name":"{name_esc}","exit_code":%s,"output":%s}}\' "$EXIT" "$ESC" >> "$RESULTS_FILE"')
        lines.append("")
    lines.append('echo "]" >> "$RESULTS_FILE"')
    lines.append('echo "}" >> "$RESULTS_FILE"')
    lines.append(f'echo "Results saved to $RESULTS_FILE"')
    return "\n".join(lines)


def _generate_powershell_script(
    session_id: str,
    project_id: str,
    host_id: str,
    project_name: str,
    host_name: str,
    generated_at: str,
    scripts_list: List[dict],
) -> str:
    results_file = f"offline_results_{session_id}.json"
    lines = [
        "# Auto-generated offline check script (PowerShell)",
        f"# Project: {project_name}",
        f"# Host: {host_name}",
        f"# Generated: {generated_at}",
        f"# Session: {session_id}",
        "",
        f"$ResultsFile = \"{results_file}\"",
        "$checks = @()",
        "",
    ]
    for idx, script in enumerate(scripts_list):
        sid = script.get("id", "")
        name = (script.get("name") or "").replace('"', '`"')
        content = _decode_script_content(script.get("content") or "")
        if not content.strip():
            content = "Write-Output ok"
        lines.append(f"# --- Check {idx + 1}: {name} ---")
        lines.append("try {")
        lines.append("  $out = Invoke-Expression -Command { " + content.replace("'", "''") + " } 2>&1 | Out-String")
        lines.append("  $exitCode = $LASTEXITCODE")
        lines.append("} catch { $out = $_.ToString(); $exitCode = 1 }")
        lines.append(f"if ($out.Length -gt {OFFLINE_OUTPUT_MAX_BYTES}) {{ $out = $out.Substring(0, {OFFLINE_OUTPUT_MAX_BYTES}) + \"`n... (truncated)\" }}")
        lines.append("$checks += @{ script_id = \"" + sid + "\"; script_name = \"" + name.replace("\\", "\\\\").replace('"', '\\"') + "\"; exit_code = $exitCode; output = $out }")
        lines.append("")
    lines.append("$obj = @{ session_id = \"" + session_id + "\"; project_id = \"" + project_id + "\"; host_id = \"" + host_id + "\"; generated_at = \"" + generated_at + "\"; checks = $checks }")
    lines.append("$obj | ConvertTo-Json -Depth 10 | Set-Content -Path $ResultsFile -Encoding UTF8")
    lines.append("Write-Host \"Results saved to $ResultsFile\"")
    return "\n".join(lines)


async def process_offline_upload(
    project_id: str,
    file_content: bytes,
    user_id: str,
    username: Optional[str] = None,
) -> dict:
    """
    Parse uploaded JSON, run processor scripts, save Execution records.
    Returns { "session_id", "executions_count", "warnings" }.
    """
    try:
        payload = json.loads(file_content.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        raise ValueError(f"Некорректный JSON: {e}")

    session_id = payload.get("session_id")
    if not session_id:
        raise ValueError("В файле отсутствует session_id")
    if payload.get("project_id") != project_id:
        raise ValueError("session_id или project_id не соответствуют проекту")

    host_id = payload.get("host_id")
    if not host_id:
        raise ValueError("В файле отсутствует host_id")

    session_doc = await db.offline_sessions.find_one({"execution_session_id": session_id})
    if not session_doc:
        raise ValueError("Сессия офлайн-проверки не найдена. Создайте скрипт заново из проекта.")
    if session_doc.get("project_id") != project_id:
        raise ValueError("Сессия не принадлежит этому проекту")
    if session_doc.get("status") == "processed":
        raise ValueError("Результаты для этой сессии уже загружены")

    host_doc = await db.hosts.find_one({"id": host_id}, {"_id": 0, "name": 1})
    host_name = (host_doc or {}).get("name", host_id)

    checks = payload.get("checks")
    if not isinstance(checks, list):
        raise ValueError("В файле отсутствует массив checks")

    tasks_for_host = await db.project_tasks.find(
        {"project_id": project_id, "host_id": host_id},
        {"_id": 0, "id": 1, "reference_data": 1, "system_id": 1, "script_ids": 1}
    ).to_list(10)
    reference_data_map: dict = {}
    script_to_task: dict = {}  # script_id -> task doc (for project_task_id and system_id per script)
    system_id = ""
    for t in tasks_for_host:
        if t.get("system_id"):
            system_id = t["system_id"]
        ref = t.get("reference_data") or {}
        for k, v in ref.items():
            reference_data_map[k] = v
        for sid in t.get("script_ids") or []:
            script_to_task[sid] = t
    task_doc = tasks_for_host[0] if tasks_for_host else None

    execution_session_id = session_id
    executed_at = datetime.now(timezone.utc)
    warnings: List[str] = []
    processed = 0

    for entry in checks:
        script_id = entry.get("script_id")
        if not script_id:
            continue
        script_doc = await db.scripts.find_one({"id": script_id}, {"_id": 0})
        if not script_doc:
            warnings.append(f"Проверка {script_id} не найдена, пропущена")
            continue
        # Decode content and processor_script from storage (base64, processor_script_version)
        script_decoded = decode_script_from_storage(script_doc)
        script_name = script_decoded.get("name", script_id)
        processor_script = script_decoded.get("processor_script")
        ref_data = reference_data_map.get(script_id) or ""
        if isinstance(ref_data, dict):
            ref_data = str(ref_data.get("text", ref_data) or "")
        ref_data = (ref_data or "").strip() or None
        task_for_script = script_to_task.get(script_id) or task_doc
        system_id_for_script = (task_for_script or {}).get("system_id") or system_id
        raw_output = entry.get("output")
        if raw_output is None:
            raw_output = ""
        raw_output = str(raw_output)

        result = await run_processor_on_output(
            host_id=host_id,
            host_name=host_name,
            raw_output=raw_output,
            processor_script=processor_script,
            reference_data=ref_data,
            script_id=script_id,
            script_name=script_name,
        )

        execution = Execution(
            project_id=project_id,
            project_task_id=task_for_script.get("id") if task_for_script else None,
            execution_session_id=execution_session_id,
            host_id=host_id,
            system_id=system_id_for_script,
            script_id=script_id,
            script_name=script_name,
            success=result.success,
            output=result.output,
            error=result.error,
            check_status=result.check_status,
            error_code=result.error_code,
            error_description=result.error_description,
            reference_data=ref_data,
            actual_data=result.actual_data,
            executed_at=executed_at,
            executed_by=user_id,
        )
        await db.executions.insert_one(prepare_for_mongo(execution.model_dump()))
        processed += 1

    file_hash = hashlib.sha256(file_content).hexdigest()
    await db.offline_sessions.update_one(
        {"execution_session_id": session_id},
        {
            "$set": {
                "status": "processed",
                "uploaded_at": executed_at.isoformat(),
                "result_file_hash": file_hash,
            }
        },
    )

    return {
        "session_id": execution_session_id,
        "executions_count": processed,
        "warnings": warnings,
    }
