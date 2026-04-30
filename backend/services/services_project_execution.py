"""
Project execution runner.

This module intentionally preserves the existing sequential execution behavior.
It provides a service-level event generator so the API layer can stay thin and
future parallel execution can be introduced behind the same event contract.
"""

import asyncio
import uuid
from typing import Any, AsyncGenerator, Dict

from config.config_init import db, logger
from models.models_init import Host, System, Script, ProjectTask, Execution, User
from services.services_execution import (
    execute_check_with_processor,
    _check_network_access,
    _check_ssh_login_and_sudo,
    _check_winrm_login,
    _check_admin_access,
    save_failed_executions,
)
from utils.db_utils import prepare_for_mongo, parse_from_mongo, decode_script_from_storage
from utils.error_codes import get_error_code_for_check_type, get_error_description
from utils.ssh_logger import clear_ssh_logs


async def run_project_execution_events(
    project_id: str,
    current_user: User,
) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Execute a project and yield SSE-compatible event payloads.

    Stage 1 refactor only: the execution order and emitted payloads match the
    former API-local generator. Host tasks and scripts are still sequential.
    """
    try:
        # Store user_id for executions
        user_id = current_user.id

        # Get project
        project = await db.projects.find_one({"id": project_id}, {"_id": 0})
        if not project:
            yield {"type": "error", "message": "Проект не найден"}
            return

        # Clear SSH logs before starting new execution
        clear_ssh_logs()

        # Create unique session ID for this execution
        session_id = str(uuid.uuid4())

        # Don't update project status - projects are reusable templates now
        yield {"type": "status", "message": "Начало выполнения проекта", "session_id": session_id}

        # Get all tasks for this project
        tasks_cursor = db.project_tasks.find({"project_id": project_id}, {"_id": 0})
        tasks = await tasks_cursor.to_list(1000)

        if not tasks:
            yield {"type": "error", "message": "Нет заданий для выполнения"}
            return

        total_tasks = len(tasks)
        completed_tasks = 0
        failed_tasks = 0

        yield {"type": "info", "message": f"Всего заданий: {total_tasks}"}

        # Process each task (each task = one host with multiple scripts)
        for task in tasks:
            task_obj = ProjectTask(**parse_from_mongo(task))

            # Get host
            host_doc = await db.hosts.find_one({"id": task_obj.host_id}, {"_id": 0})
            if not host_doc:
                yield {"type": "error", "message": f"Хост не найден: {task_obj.host_id}"}
                failed_tasks += 1
                continue

            host = Host(**parse_from_mongo(host_doc))

            # Get system
            system_doc = await db.systems.find_one({"id": task_obj.system_id}, {"_id": 0})
            if not system_doc:
                yield {"type": "error", "message": f"Система не найдена: {task_obj.system_id}"}
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
                yield {"type": "error", "message": "Скрипты не найдены для задания"}
                failed_tasks += 1
                continue

            # Update task status
            await db.project_tasks.update_one(
                {"id": task_obj.id},
                {"$set": {"status": "running"}}
            )

            yield {
                "type": "task_start",
                "host_name": host.name,
                "host_address": host.hostname,
                "system_name": system.name,
                "scripts_count": len(scripts),
            }

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
                network_error_code = get_error_code_for_check_type("network")
                if network_error_code:
                    network_error_info = get_error_description(network_error_code)

            yield {
                "type": "check_network",
                "host_name": host.name,
                "success": network_ok,
                "message": network_msg,
                "error_code": network_error_code,
                "error_info": network_error_info,
            }

            if not network_ok:
                await save_failed_executions(
                    scripts=scripts,
                    project_id=project_id,
                    task_id=task_obj.id,
                    session_id=session_id,
                    host=host,
                    system=system,
                    error_msg=network_msg,
                    check_type="network",
                    user_id=user_id,
                )

                await db.project_tasks.update_one(
                    {"id": task_obj.id},
                    {"$set": {"status": "failed"}}
                )
                failed_tasks += 1
                yield {
                    "type": "task_error",
                    "host_name": host.name,
                    "error": network_msg,
                    "error_code": network_error_code,
                    "error_info": network_error_info,
                }
                continue

            # 2. Check login and sudo (combined for SSH to avoid multiple connections)
            if host.connection_type == "winrm":
                # For WinRM, check login first
                logger.info(f"Starting WinRM login check for host: {host.name} ({host.hostname}:{host.port})")
                try:
                    login_ok, login_msg = await loop.run_in_executor(None, _check_winrm_login, host)
                except Exception as e:
                    logger.exception(f"WinRM login check failed with exception for {host.name}: {e}")
                    login_ok, login_msg = False, f"Ошибка проверки входа: {getattr(e, 'message', str(e))}"
                logger.info(
                    f"WinRM login check result for {host.name}: "
                    f"ok={login_ok}, msg={str(login_msg)[:80] if login_msg else ''}"
                )

                # Get error code for login check
                login_error_code = None
                login_error_info = None
                if not login_ok:
                    login_error_code = get_error_code_for_check_type("login")
                    if login_error_code:
                        login_error_info = get_error_description(login_error_code)

                yield {
                    "type": "check_login",
                    "host_name": host.name,
                    "success": login_ok,
                    "message": login_msg,
                    "error_code": login_error_code,
                    "error_info": login_error_info,
                }

                if not login_ok:
                    await save_failed_executions(
                        scripts=scripts,
                        project_id=project_id,
                        task_id=task_obj.id,
                        session_id=session_id,
                        host=host,
                        system=system,
                        error_msg=login_msg,
                        check_type="login",
                        user_id=user_id,
                    )

                    await db.project_tasks.update_one(
                        {"id": task_obj.id},
                        {"$set": {"status": "failed"}}
                    )
                    failed_tasks += 1
                    yield {
                        "type": "task_error",
                        "host_name": host.name,
                        "error": login_msg,
                        "error_code": login_error_code,
                        "error_info": login_error_info,
                    }
                    continue

                # Then check admin access
                sudo_ok, sudo_msg = await loop.run_in_executor(None, _check_admin_access, host)

                # Get error code for admin check
                sudo_error_code = None
                sudo_error_info = None
                if not sudo_ok:
                    sudo_error_code = get_error_code_for_check_type("admin")
                    if sudo_error_code:
                        sudo_error_info = get_error_description(sudo_error_code)

                yield {
                    "type": "check_sudo",
                    "host_name": host.name,
                    "success": sudo_ok,
                    "message": sudo_msg,
                    "error_code": sudo_error_code,
                    "error_info": sudo_error_info,
                }
            else:
                # For SSH, check both login and sudo in one connection
                login_ok, login_msg, sudo_ok, sudo_msg = await loop.run_in_executor(
                    None,
                    _check_ssh_login_and_sudo,
                    host,
                )

                # Get error code for login check
                login_error_code = None
                login_error_info = None
                if not login_ok:
                    login_error_code = get_error_code_for_check_type("login")
                    if login_error_code:
                        login_error_info = get_error_description(login_error_code)

                yield {
                    "type": "check_login",
                    "host_name": host.name,
                    "success": login_ok,
                    "message": login_msg,
                    "error_code": login_error_code,
                    "error_info": login_error_info,
                }

                if not login_ok:
                    await save_failed_executions(
                        scripts=scripts,
                        project_id=project_id,
                        task_id=task_obj.id,
                        session_id=session_id,
                        host=host,
                        system=system,
                        error_msg=login_msg,
                        check_type="login",
                        user_id=user_id,
                    )

                    await db.project_tasks.update_one(
                        {"id": task_obj.id},
                        {"$set": {"status": "failed"}}
                    )
                    failed_tasks += 1
                    yield {
                        "type": "task_error",
                        "host_name": host.name,
                        "error": login_msg,
                        "error_code": login_error_code,
                        "error_info": login_error_info,
                    }
                    continue

                # Send sudo check result with error code
                sudo_error_code = None
                sudo_error_info = None
                if not sudo_ok:
                    sudo_error_code = get_error_code_for_check_type("sudo")
                    if sudo_error_code:
                        sudo_error_info = get_error_description(sudo_error_code)

                yield {
                    "type": "check_sudo",
                    "host_name": host.name,
                    "success": sudo_ok,
                    "message": sudo_msg,
                    "error_code": sudo_error_code,
                    "error_info": sudo_error_info,
                }

            if not sudo_ok:
                check_type = "admin" if host.connection_type == "winrm" else "sudo"
                await save_failed_executions(
                    scripts=scripts,
                    project_id=project_id,
                    task_id=task_obj.id,
                    session_id=session_id,
                    host=host,
                    system=system,
                    error_msg=sudo_msg,
                    check_type=check_type,
                    user_id=user_id,
                )

                await db.project_tasks.update_one(
                    {"id": task_obj.id},
                    {"$set": {"status": "failed"}}
                )
                failed_tasks += 1
                yield {
                    "type": "task_error",
                    "host_name": host.name,
                    "error": sudo_msg,
                    "error_code": sudo_error_code,
                    "error_info": sudo_error_info,
                }
                continue

            # All checks passed, proceed with script execution
            scripts_completed = 0

            try:
                # Execute scripts sequentially on the same host with one connection
                for script in scripts:
                    # Get reference data for this script
                    reference_data = task_obj.reference_data.get(script.id, "") if task_obj.reference_data else ""

                    # Use processor if available
                    result = await execute_check_with_processor(
                        host,
                        script.content,
                        script.processor_script,
                        reference_data,
                        script_id=script.id,
                        script_name=script.name,
                    )

                    scripts_completed += 1
                    yield {
                        "type": "script_progress",
                        "host_name": host.name,
                        "completed": scripts_completed,
                        "total": len(scripts),
                    }

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
                        reference_data=reference_data if reference_data and reference_data.strip() else None,
                        actual_data=result.actual_data,
                        executed_by=user_id,
                    )

                    exec_doc = prepare_for_mongo(execution.model_dump())
                    await db.executions.insert_one(exec_doc)

                # Update task status - host is successful if all preliminary checks passed
                await db.project_tasks.update_one(
                    {"id": task_obj.id},
                    {"$set": {"status": "completed"}}
                )

                # Host completed successfully (passed preliminary checks)
                completed_tasks += 1
                yield {"type": "task_complete", "host_name": host.name, "success": True}

            except Exception as e:
                failed_tasks += 1
                await db.project_tasks.update_one(
                    {"id": task_obj.id},
                    {"$set": {"status": "failed"}}
                )
                # Log detailed error server-side, send generic error to client
                logger.error(f"Error during task execution on host '{host.name}' for task '{task_obj.id}': {e}")
                yield {"type": "task_error", "host_name": host.name, "error": "Internal error during task execution"}

        # Send completion event (don't update project status - project is reusable)
        successful_hosts = completed_tasks
        final_status = "completed" if failed_tasks == 0 else "failed"
        yield {
            "type": "complete",
            "status": final_status,
            "completed": completed_tasks,
            "failed": failed_tasks,
            "total": total_tasks,
            "successful_hosts": successful_hosts,
            "session_id": session_id,
        }

    except Exception as e:
        logger.error(f"Error during project execution: {e}")
        # Send a generic error message without exposing internal exception details
        yield {
            "type": "error",
            "message": "Произошла внутренняя ошибка при выполнении проекта. Обратитесь к администратору.",
        }
