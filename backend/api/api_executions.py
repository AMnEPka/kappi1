"""
API endpoints for project execution and execution results.
Handles SSE streaming, legacy execution, sessions, and execution queries.
"""

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from typing import List, Optional, Dict, Any
import asyncio
import json
import uuid

from config.config_init import db, logger
from models.models_init import (
    User, Host, System, Script, ProjectTask, Execution, ExecuteRequest
)
from services.services_init import (
    get_current_user, get_current_user_from_token,
    has_permission, can_access_project,
    execute_check_with_processor,
    _check_network_access, _check_ssh_login_and_sudo,
    _check_winrm_login, _check_admin_access,
    save_failed_executions
)
from utils.db_utils import prepare_for_mongo, parse_from_mongo, decode_script_from_storage
from utils.audit_utils import log_audit
from utils.ssh_logger import clear_ssh_logs
from utils.error_codes import get_error_code_for_check_type, get_error_description

router = APIRouter()


@router.get("/projects/{project_id}/execute")
async def execute_project(project_id: str, token: Optional[str] = None, skip_audit_log: bool = False):
    """Execute project with real-time updates via Server-Sent Events (requires projects_execute permission and access to project)"""
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
        try:
            # Store user_id for executions
            user_id = current_user.id
            
            # Get project
            project = await db.projects.find_one({"id": project_id}, {"_id": 0})
            if not project:
                yield f"data: {json.dumps({'type': 'error', 'message': 'Проект не найден'})}\n\n"
                return
            
            # Clear SSH logs before starting new execution
            clear_ssh_logs()
            
            # Create unique session ID for this execution
            session_id = str(uuid.uuid4())
            
            # Don't update project status - projects are reusable templates now
            yield f"data: {json.dumps({'type': 'status', 'message': 'Начало выполнения проекта', 'session_id': session_id})}\n\n"
            
            # Get all tasks for this project
            tasks_cursor = db.project_tasks.find({"project_id": project_id}, {"_id": 0})
            tasks = await tasks_cursor.to_list(1000)
            
            if not tasks:
                yield f"data: {json.dumps({'type': 'error', 'message': 'Нет заданий для выполнения'})}\n\n"
                return
            
            total_tasks = len(tasks)
            completed_tasks = 0
            failed_tasks = 0
            
            yield f"data: {json.dumps({'type': 'info', 'message': f'Всего заданий: {total_tasks}'})}\n\n"
            
            # Process each task (each task = one host with multiple scripts)
            for task in tasks:
                task_obj = ProjectTask(**parse_from_mongo(task))
                
                # Get host
                host_doc = await db.hosts.find_one({"id": task_obj.host_id}, {"_id": 0})
                if not host_doc:
                    yield f"data: {json.dumps({'type': 'error', 'message': f'Хост не найден: {task_obj.host_id}'})}\n\n"
                    failed_tasks += 1
                    continue
                
                host = Host(**parse_from_mongo(host_doc))
                
                # Get system
                system_doc = await db.systems.find_one({"id": task_obj.system_id}, {"_id": 0})
                if not system_doc:
                    yield f"data: {json.dumps({'type': 'error', 'message': f'Система не найдена: {task_obj.system_id}'})}\n\n"
                    failed_tasks += 1
                    continue
                
                system = System(**parse_from_mongo(system_doc))
                
                # Get scripts
                scripts_cursor = db.scripts.find({"id": {"$in": task_obj.script_ids}}, {"_id": 0})
                scripts_data = [parse_from_mongo(s) for s in await scripts_cursor.to_list(1000)]
                # Decode script content and processor_script from Base64
                scripts_data = [decode_script_from_storage(s) for s in scripts_data]
                scripts = [Script(**s) for s in scripts_data]
                
                if not scripts:
                    yield f"data: {json.dumps({'type': 'error', 'message': 'Скрипты не найдены для задания'})}\n\n"
                    failed_tasks += 1
                    continue
                
                # Update task status
                await db.project_tasks.update_one(
                    {"id": task_obj.id},
                    {"$set": {"status": "running"}}
                )
                
                yield f"data: {json.dumps({'type': 'task_start', 'host_name': host.name, 'host_address': host.hostname, 'system_name': system.name, 'scripts_count': len(scripts)})}\n\n"
                
                # Perform preliminary checks
                loop = asyncio.get_event_loop()
                
                # 1. Check network access
                logger.info(f"Checking network access for host: {host.name} ({host.hostname}:{host.port})")
                network_ok, network_msg = await loop.run_in_executor(None, _check_network_access, host)
                logger.info(f"Network check result for {host.name}: {network_ok}, message: {network_msg}")
                
                # Get error code for network check
                network_error_code = None
                network_error_info = None
                if not network_ok:
                    network_error_code = get_error_code_for_check_type('network')
                    if network_error_code:
                        network_error_info = get_error_description(network_error_code)
                
                yield f"data: {json.dumps({'type': 'check_network', 'host_name': host.name, 'success': network_ok, 'message': network_msg, 'error_code': network_error_code, 'error_info': network_error_info})}\n\n"
                
                if not network_ok:
                    await save_failed_executions(
                        scripts=scripts,
                        project_id=project_id,
                        task_id=task_obj.id,
                        session_id=session_id,
                        host=host,
                        system=system,
                        error_msg=network_msg,
                        check_type='network',
                        user_id=user_id
                    )
                    
                    await db.project_tasks.update_one(
                        {"id": task_obj.id},
                        {"$set": {"status": "failed"}}
                    )
                    failed_tasks += 1
                    yield f"data: {json.dumps({'type': 'task_error', 'host_name': host.name, 'error': network_msg, 'error_code': network_error_code, 'error_info': network_error_info})}\n\n"
                    continue
                
                # 2. Check login and sudo (combined for SSH to avoid multiple connections)
                if host.connection_type == "winrm":
                    # For WinRM, check login first
                    login_ok, login_msg = await loop.run_in_executor(None, _check_winrm_login, host)
                    
                    # Get error code for login check
                    login_error_code = None
                    login_error_info = None
                    if not login_ok:
                        login_error_code = get_error_code_for_check_type('login')
                        if login_error_code:
                            login_error_info = get_error_description(login_error_code)
                    
                    yield f"data: {json.dumps({'type': 'check_login', 'host_name': host.name, 'success': login_ok, 'message': login_msg, 'error_code': login_error_code, 'error_info': login_error_info})}\n\n"
                    
                    if not login_ok:
                        await save_failed_executions(
                            scripts=scripts,
                            project_id=project_id,
                            task_id=task_obj.id,
                            session_id=session_id,
                            host=host,
                            system=system,
                            error_msg=login_msg,
                            check_type='login',
                            user_id=user_id
                        )
                        
                        await db.project_tasks.update_one(
                            {"id": task_obj.id},
                            {"$set": {"status": "failed"}}
                        )
                        failed_tasks += 1
                        yield f"data: {json.dumps({'type': 'task_error', 'host_name': host.name, 'error': login_msg, 'error_code': login_error_code, 'error_info': login_error_info})}\n\n"
                        continue
                    
                    # Then check admin access
                    sudo_ok, sudo_msg = await loop.run_in_executor(None, _check_admin_access, host)
                    
                    # Get error code for admin check
                    sudo_error_code = None
                    sudo_error_info = None
                    if not sudo_ok:
                        sudo_error_code = get_error_code_for_check_type('admin')
                        if sudo_error_code:
                            sudo_error_info = get_error_description(sudo_error_code)
                    
                    yield f"data: {json.dumps({'type': 'check_sudo', 'host_name': host.name, 'success': sudo_ok, 'message': sudo_msg, 'error_code': sudo_error_code, 'error_info': sudo_error_info})}\n\n"
                else:
                    # For SSH, check both login and sudo in one connection
                    login_ok, login_msg, sudo_ok, sudo_msg = await loop.run_in_executor(None, _check_ssh_login_and_sudo, host)
                    
                    # Get error code for login check
                    login_error_code = None
                    login_error_info = None
                    if not login_ok:
                        login_error_code = get_error_code_for_check_type('login')
                        if login_error_code:
                            login_error_info = get_error_description(login_error_code)
                    
                    yield f"data: {json.dumps({'type': 'check_login', 'host_name': host.name, 'success': login_ok, 'message': login_msg, 'error_code': login_error_code, 'error_info': login_error_info})}\n\n"
                    
                    if not login_ok:
                        await save_failed_executions(
                            scripts=scripts,
                            project_id=project_id,
                            task_id=task_obj.id,
                            session_id=session_id,
                            host=host,
                            system=system,
                            error_msg=login_msg,
                            check_type='login',
                            user_id=user_id
                        )
                        
                        await db.project_tasks.update_one(
                            {"id": task_obj.id},
                            {"$set": {"status": "failed"}}
                        )
                        failed_tasks += 1
                        yield f"data: {json.dumps({'type': 'task_error', 'host_name': host.name, 'error': login_msg, 'error_code': login_error_code, 'error_info': login_error_info})}\n\n"
                        continue
                    
                    # Send sudo check result with error code
                    sudo_error_code = None
                    sudo_error_info = None
                    if not sudo_ok:
                        sudo_error_code = get_error_code_for_check_type('sudo')
                        if sudo_error_code:
                            sudo_error_info = get_error_description(sudo_error_code)
                    
                    yield f"data: {json.dumps({'type': 'check_sudo', 'host_name': host.name, 'success': sudo_ok, 'message': sudo_msg, 'error_code': sudo_error_code, 'error_info': sudo_error_info})}\n\n"
                
                if not sudo_ok:
                    check_type = 'admin' if host.connection_type == 'winrm' else 'sudo'
                    await save_failed_executions(
                        scripts=scripts,
                        project_id=project_id,
                        task_id=task_obj.id,
                        session_id=session_id,
                        host=host,
                        system=system,
                        error_msg=sudo_msg,
                        check_type=check_type,
                        user_id=user_id
                    )
                    
                    await db.project_tasks.update_one(
                        {"id": task_obj.id},
                        {"$set": {"status": "failed"}}
                    )
                    failed_tasks += 1
                    yield f"data: {json.dumps({'type': 'task_error', 'host_name': host.name, 'error': sudo_msg, 'error_code': sudo_error_code, 'error_info': sudo_error_info})}\n\n"
                    continue
                
                # All checks passed, proceed with script execution
                task_success = True
                task_results = []
                scripts_completed = 0
                
                try:
                    # Execute scripts sequentially on the same host with one connection
                    for idx, script in enumerate(scripts, 1):
                        # Get reference data for this script
                        reference_data = task_obj.reference_data.get(script.id, '') if task_obj.reference_data else ''
                        
                        # Use processor if available
                        result = await execute_check_with_processor(
                            host, script.content, script.processor_script, reference_data,
                            script_id=script.id, script_name=script.name
                        )
                        
                        scripts_completed += 1
                        yield f"data: {json.dumps({'type': 'script_progress', 'host_name': host.name, 'completed': scripts_completed, 'total': len(scripts)})}\n\n"
                        
                        # Save execution result with session_id
                        execution = Execution(
                            project_id=project_id,
                            project_task_id=task_obj.id,
                            execution_session_id=session_id,
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
                            executed_by=user_id
                        )
                        
                        exec_doc = prepare_for_mongo(execution.model_dump())
                        await db.executions.insert_one(exec_doc)
                        
                        task_results.append(execution)
                        
                        if not result.success:
                            task_success = False
                    
                    # Update task status - host is successful if all preliminary checks passed
                    await db.project_tasks.update_one(
                        {"id": task_obj.id},
                        {"$set": {"status": "completed"}}
                    )
                    
                    # Host completed successfully (passed preliminary checks)
                    completed_tasks += 1
                    yield f"data: {json.dumps({'type': 'task_complete', 'host_name': host.name, 'success': True})}\n\n"
                
                except Exception as e:
                    failed_tasks += 1
                    await db.project_tasks.update_one(
                        {"id": task_obj.id},
                        {"$set": {"status": "failed"}}
                    )
                    # Log detailed error server-side, send generic error to client
                    logger.error(f"Error during task execution on host '{host.name}' for task '{task_obj.id}': {e}")
                    yield f"data: {json.dumps({'type': 'task_error', 'host_name': host.name, 'error': 'Internal error during task execution'})}\n\n"
            
            # Send completion event (don't update project status - project is reusable)
            successful_hosts = completed_tasks
            final_status = "completed" if failed_tasks == 0 else "failed"
            yield f"data: {json.dumps({'type': 'complete', 'status': final_status, 'completed': completed_tasks, 'failed': failed_tasks, 'total': total_tasks, 'successful_hosts': successful_hosts, 'session_id': session_id})}\n\n"
        
        except Exception as e:
            logger.error(f"Error during project execution: {e}")
            # Send a generic error message without exposing internal exception details
            yield f"data: {json.dumps({'type': 'error', 'message': 'Произошла внутренняя ошибка при выполнении проекта. Обратитесь к администратору.'})}\n\n"
    
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
    
    return [{
        "session_id": s["_id"],
        "executed_at": s["executed_at"],
        "total_checks": s["count"],
        "passed_count": s["passed_count"],
        "failed_count": s["failed_count"],
        # Combine explicit errors and unknown statuses
        "error_count": s["explicit_error_count"] + s["other_count"],
        "operator_count": s["operator_count"]
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
    tasks = [execute_check_with_processor(host, script.content, script.processor_script, None, script.id, script.name) for host in hosts]
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
        executions = await db.executions.find({"executed_by": current_user.id}, {"_id": 0}).sort("executed_at", -1).to_list(1000)
    
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

