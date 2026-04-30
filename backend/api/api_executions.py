"""
API endpoints for project execution and execution results.
Handles SSE streaming, legacy execution, sessions, and execution queries.
"""

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from typing import List, Optional
import asyncio
import json

from config.config_init import db, logger
from models.models_init import (
    User, Host, System, Script, Execution, ExecuteRequest
)
from services.services_init import (
    get_current_user, get_current_user_from_token,
    has_permission, can_access_project,
    execute_check_with_processor
)
from services.services_project_execution import run_project_execution_events
from utils.db_utils import prepare_for_mongo, parse_from_mongo, decode_script_from_storage
from utils.audit_utils import log_audit

router = APIRouter()


@router.get("/projects/{project_id}/execute")
async def execute_project(project_id: str, token: Optional[str] = None, skip_audit_log: bool = False):
    """
    Execute project with real-time updates via Server-Sent Events.

    Requires projects_execute permission and access to the project.
    """
    logger.info(f"Execute endpoint called for project_id: {project_id}, token present: {bool(token)}")

    # Get current user from token parameter (for SSE which doesn't support headers)
    if not token:
        logger.warning(f"Execute endpoint called without token for project_id: {project_id}")
        raise HTTPException(status_code=401, detail="Token required for SSE connection")

    try:
        current_user = await get_current_user_from_token(token)
        logger.info(f"User authenticated: {current_user.username} (id: {current_user.id})")
    except Exception as e:
        logger.error(f"Failed to authenticate user from token: {e}")
        raise

    # Check permission
    if not await has_permission(current_user, 'projects_execute'):
        raise HTTPException(status_code=403, detail="Вам запрещено производить запуски проектов")

    # Check project access
    if not await can_access_project(current_user, project_id):
        raise HTTPException(status_code=403, detail="У вас нет доступа к текущему проекту")

    project_doc = await db.projects.find_one({"id": project_id})
    project_name = project_doc.get('name') if project_doc else "Неизвестный проект"

    if not skip_audit_log:
        log_audit(
            "23",  # Код события: запуск проекта
            user_id=current_user.id,
            username=current_user.username,
            details={"project_name": project_name}
        )

    async def event_generator():
        async for event in run_project_execution_events(project_id, current_user):
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.get("/projects/{project_id}/execution-failed")
async def log_failed_execution(project_id: str, current_user: User = Depends(get_current_user)):
    """Log failed project execution attempts"""
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")

    project_name = project.get('name', 'Неизвестный проект')

    log_audit(
        "34",  # Неуспешный запуск проекта
        user_id=current_user.id,
        username=current_user.username,
        details={
            "project_id": project_id,
            "project_name": project_name,
            "failure_reason": "SSH connection failed"
        }
    )

    return {"message": "Failure logged"}


@router.get("/projects/{project_id}/executions", response_model=List[Execution])
async def get_project_executions(project_id: str, current_user: User = Depends(get_current_user)):
    """Get all execution results for a project"""
    if not await has_permission(current_user, 'results_view_all'):
        if not await can_access_project(current_user, project_id):
            raise HTTPException(status_code=403, detail="У вас нет доступа к этому проекту")

    executions = await db.executions.find(
        {"project_id": project_id},
        {"_id": 0}
    ).sort("executed_at", -1).to_list(1000)

    log_audit(
        "25",  # просмотр результатов проекта
        user_id=current_user.id,
        username=current_user.username,
        details={"project_name": project_id}
    )

    return [Execution(**parse_from_mongo(execution)) for execution in executions]


@router.get("/projects/{project_id}/sessions")
async def get_project_sessions(project_id: str, current_user: User = Depends(get_current_user)):
    """Get list of execution sessions for a project (requires results_view_all or project access)"""
    # Check access: user must either view all results or have access to the project
    if not await has_permission(current_user, 'results_view_all'):
        if not await can_access_project(current_user, project_id):
            raise HTTPException(status_code=403, detail="У вас нет доступа к этому проекту")

    # Get distinct session IDs with their timestamps and check status counts
    pipeline = [
        {"$match": {"project_id": project_id, "execution_session_id": {"$ne": None}}},
        {"$group": {
            "_id": "$execution_session_id",
            "executed_at": {"$first": "$executed_at"},
            "count": {"$sum": 1},
            "passed_count": {
                "$sum": {"$cond": [{"$eq": ["$check_status", "Пройдена"]}, 1, 0]}
            },
            "failed_count": {
                "$sum": {"$cond": [{"$eq": ["$check_status", "Не пройдена"]}, 1, 0]}
            },
            "operator_count": {
                "$sum": {"$cond": [{"$eq": ["$check_status", "Оператор"]}, 1, 0]}
            },
            "explicit_error_count": {
                "$sum": {"$cond": [{"$eq": ["$check_status", "Ошибка"]}, 1, 0]}
            },
            # Count executions with null, empty, or unexpected check_status as errors
            "other_count": {
                "$sum": {
                    "$cond": [
                        {
                            "$and": [
                                {"$ne": ["$check_status", "Пройдена"]},
                                {"$ne": ["$check_status", "Не пройдена"]},
                                {"$ne": ["$check_status", "Оператор"]},
                                {"$ne": ["$check_status", "Ошибка"]}
                            ]
                        },
                        1,
                        0
                    ]
                }
            }
        }},
        {"$sort": {"executed_at": -1}}
    ]

    sessions = await db.executions.aggregate(pipeline).to_list(1000)
    offline_ids = set()
    async for doc in db.offline_sessions.find({"project_id": project_id}, {"execution_session_id": 1}):
        offline_ids.add(doc.get("execution_session_id"))
    return [{
        "session_id": s["_id"],
        "executed_at": s["executed_at"],
        "total_checks": s["count"],
        "passed_count": s["passed_count"],
        "failed_count": s["failed_count"],
        "error_count": s["explicit_error_count"] + s["other_count"],
        "operator_count": s["operator_count"],
        "is_offline": s["_id"] in offline_ids,
    } for s in sessions]


@router.get("/projects/{project_id}/sessions/{session_id}/executions", response_model=List[Execution])
async def get_session_executions(project_id: str, session_id: str, current_user: User = Depends(get_current_user)):
    """Get all executions for a specific session (requires results_view_all or project access)"""
    # Check if user can view all results or has access to project
    if not await has_permission(current_user, 'results_view_all'):
        if not await can_access_project(current_user, project_id):
            raise HTTPException(status_code=403, detail="У вас нет доступа к этому проекту")

    executions = await db.executions.find(
        {"project_id": project_id, "execution_session_id": session_id},
        {"_id": 0}
    ).sort("executed_at", 1).to_list(1000)

    return [Execution(**parse_from_mongo(execution)) for execution in executions]


@router.post("/execute")
async def execute_script(execute_req: ExecuteRequest, current_user: User = Depends(get_current_user)):
    """Execute script on selected hosts (legacy endpoint)"""
    # Get script
    script_doc = await db.scripts.find_one({"id": execute_req.script_id}, {"_id": 0})
    if not script_doc:
        raise HTTPException(status_code=404, detail="Скрипт не найден")

    script_data = parse_from_mongo(script_doc)
    # Decode script content and processor_script from Base64
    script_data = decode_script_from_storage(script_data)
    script = Script(**script_data)

    # Get system for this script
    system_doc = await db.systems.find_one({"id": script.system_id}, {"_id": 0})
    if not system_doc:
        raise HTTPException(status_code=404, detail="Система не найдена")

    system = System(**parse_from_mongo(system_doc))

    # Get hosts
    hosts_cursor = db.hosts.find({"id": {"$in": execute_req.host_ids}}, {"_id": 0})
    hosts = [Host(**parse_from_mongo(h)) for h in await hosts_cursor.to_list(1000)]

    if not hosts:
        raise HTTPException(status_code=404, detail="Хосты не найдены")

    # Execute on all hosts concurrently
    tasks = [
        execute_check_with_processor(host, script.content, script.processor_script, None, script.id, script.name)
        for host in hosts
    ]
    results = await asyncio.gather(*tasks)

    # Save execution records (one per host)
    execution_ids = []
    for host, result in zip(hosts, results):
        execution = Execution(
            host_id=host.id,
            system_id=system.id,
            script_id=script.id,
            script_name=script.name,
            success=result.success,
            output=result.output,
            error=result.error,
            check_status=result.check_status,
            error_code=result.error_code,
            error_description=result.error_description,
            executed_by=current_user.id
        )

        doc = prepare_for_mongo(execution.model_dump())
        await db.executions.insert_one(doc)
        execution_ids.append(execution.id)

    return {"execution_ids": execution_ids, "results": [r.model_dump() for r in results]}


@router.get("/executions", response_model=List[Execution])
async def get_executions(current_user: User = Depends(get_current_user)):
    """Get all executions (requires results_view_all or shows own executions)"""
    if await has_permission(current_user, 'results_view_all'):
        executions = await db.executions.find({}, {"_id": 0}).sort("executed_at", -1).to_list(1000)
    else:
        executions = await db.executions.find(
            {"executed_by": current_user.id},
            {"_id": 0}
        ).sort("executed_at", -1).to_list(1000)

    return [Execution(**parse_from_mongo(execution)) for execution in executions]


@router.get("/executions/{execution_id}", response_model=Execution)
async def get_execution(execution_id: str, current_user: User = Depends(get_current_user)):
    """Get execution by ID"""
    execution = await db.executions.find_one({"id": execution_id}, {"_id": 0})
    if not execution:
        raise HTTPException(status_code=404, detail="Выполнение не найдено")

    # Check access
    if not await has_permission(current_user, 'results_view_all'):
        if execution.get('executed_by') != current_user.id:
            raise HTTPException(status_code=403, detail="Доступ запрещен")

    return Execution(**parse_from_mongo(execution))
