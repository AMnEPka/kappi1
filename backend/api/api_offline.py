"""
API for offline check: generate script and upload results.
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import Response
from pydantic import BaseModel

from config.config_init import logger
from models.auth_models import User
from services.services_auth import get_current_user, require_permission, can_access_project
from services.services_offline import generate_offline_script, process_offline_upload
from utils.audit_utils import log_audit

router = APIRouter()


class OfflineGenerateRequest(BaseModel):
    host_id: str


@router.post("/projects/{project_id}/offline/generate")
async def offline_generate(
    project_id: str,
    body: OfflineGenerateRequest,
    current_user: User = Depends(get_current_user),
):
    """Generate offline script for one host. Returns .sh or .ps1 file download."""
    await require_permission(current_user, "projects_execute")
    if not await can_access_project(current_user, project_id):
        raise HTTPException(status_code=403, detail="У вас нет доступа к этому проекту")
    try:
        content, session, ext = await generate_offline_script(
            project_id=project_id,
            host_id=body.host_id,
            user_id=current_user.id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    filename = f"offline_checks_{session.execution_session_id[:8]}{ext}"
    media_type = "application/x-sh" if ext == ".sh" else "application/x-powershell"
    log_audit(
        "offline_script_generated",
        user_id=current_user.id,
        username=current_user.username,
        details={"project_id": project_id, "host_id": body.host_id, "session_id": session.execution_session_id},
    )
    return Response(
        content=content.encode("utf-8"),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/projects/{project_id}/offline/upload")
async def offline_upload(
    project_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Upload offline results JSON. Processes checks and saves Execution records."""
    await require_permission(current_user, "projects_execute")
    if not await can_access_project(current_user, project_id):
        raise HTTPException(status_code=403, detail="У вас нет доступа к этому проекту")
    if not file.filename or not file.filename.lower().endswith(".json"):
        raise HTTPException(status_code=400, detail="Загрузите файл результатов в формате .json")
    try:
        content = await file.read()
    except Exception as e:
        logger.exception("Offline upload read error: %s", e)
        raise HTTPException(status_code=400, detail="Не удалось прочитать файл")
    try:
        result = await process_offline_upload(
            project_id=project_id,
            file_content=content,
            user_id=current_user.id,
            username=current_user.username,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    log_audit(
        "offline_results_uploaded",
        user_id=current_user.id,
        username=current_user.username,
        details={"project_id": project_id, "session_id": result["session_id"], "count": result["executions_count"]},
    )
    return result


@router.get("/projects/{project_id}/offline/sessions")
async def list_offline_sessions(
    project_id: str,
    current_user: User = Depends(get_current_user),
):
    """List offline sessions for the project (for UI: show upload button / history)."""
    if not await can_access_project(current_user, project_id):
        raise HTTPException(status_code=403, detail="У вас нет доступа к этому проекту")
    from config.config_init import db
    from utils.db_utils import parse_from_mongo
    cursor = db.offline_sessions.find(
        {"project_id": project_id},
        {"_id": 0, "id": 1, "execution_session_id": 1, "status": 1, "created_at": 1, "host_ids": 1}
    ).sort("created_at", -1)
    docs = await cursor.to_list(100)
    return [parse_from_mongo(d) for d in docs]
