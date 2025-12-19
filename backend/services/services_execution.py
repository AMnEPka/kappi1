"""
services/execution.py
Command execution services for SSH and WinRM
"""

import asyncio
import socket
import paramiko
import winrm  # pyright: ignore[reportMissingImports]
from typing import Tuple, Optional, List
import logging
from contextlib import contextmanager
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
import os

from config.config_init import logger, decrypt_password, db
from models.models_init import Host, ExecutionResult, Execution, Script, System
from utils.error_codes import get_error_description, extract_error_code_from_output, get_error_code_for_check_type
from utils.db_utils import prepare_for_mongo

# SSH connection settings from environment
SSH_CONNECT_TIMEOUT = int(os.environ.get('SSH_CONNECT_TIMEOUT', '10'))
SSH_COMMAND_TIMEOUT = int(os.environ.get('SSH_COMMAND_TIMEOUT', '60'))
SSH_RETRY_ATTEMPTS = int(os.environ.get('SSH_RETRY_ATTEMPTS', '3'))
WINRM_TIMEOUT = int(os.environ.get('WINRM_TIMEOUT', '30'))


@contextmanager
def ssh_connection(host: Host):
    """
    Context manager for SSH connections with automatic cleanup.
    Reuses connection for multiple commands when used properly.
    """
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        if host.auth_type == "password":
            password = decrypt_password(host.password) if host.password else ""
            ssh.connect(
                hostname=host.hostname,
                port=host.port,
                username=host.username,
                password=password,
                timeout=SSH_CONNECT_TIMEOUT,
                banner_timeout=SSH_CONNECT_TIMEOUT,
                auth_timeout=SSH_CONNECT_TIMEOUT
            )
        else:  # key-based
            ssh.connect(
                hostname=host.hostname,
                port=host.port,
                username=host.username,
                key_filename=host.ssh_key,
                timeout=SSH_CONNECT_TIMEOUT,
                banner_timeout=SSH_CONNECT_TIMEOUT,
                auth_timeout=SSH_CONNECT_TIMEOUT
            )
        yield ssh
    finally:
        try:
            ssh.close()
        except Exception:
            pass


@retry(
    stop=stop_after_attempt(SSH_RETRY_ATTEMPTS),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type((socket.error, socket.timeout, paramiko.SSHException)),
    reraise=True
)
def _check_network_access(host: Host) -> Tuple[bool, str]:
    """Check if host is reachable with retry logic"""
    try:
        sock = socket.create_connection((host.hostname, host.port), timeout=5)
        sock.close()
        return True, "Сетевой доступ получен"
    except socket.timeout:
        return False, "Нет сетевого доступа: Недоступен сервер или порт"
    except socket.error as e:
        return False, f"Нет сетевого доступа: {str(e)}"


@retry(
    stop=stop_after_attempt(SSH_RETRY_ATTEMPTS),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type((socket.error, socket.timeout)),
    reraise=True
)
def _check_ssh_login(host: Host) -> Tuple[bool, str]:
    """Check SSH login credentials with retry logic"""
    try:
        with ssh_connection(host):
            return True, "SSH login OK"
    except paramiko.AuthenticationException:
        return False, "Неверные учётные данные"
    except paramiko.SSHException as e:
        return False, f"Ошибка SSH: {str(e)}"
    except Exception as e:
        return False, "Неверные учётные данные: Ошибка при входе (логин/пароль/SSH-ключ)"


def _check_ssh_login_and_sudo(host: Host) -> Tuple[bool, str, bool, str]:
    """
    Check SSH login and sudo access
    
    Returns: (login_success, login_message, sudo_success, sudo_message)
    """
    login_ok, login_msg = _check_ssh_login(host)
    if not login_ok:
        return False, login_msg, False, "Login failed"
    
    sudo_ok, sudo_msg = _check_sudo_access_linux(host)
    return login_ok, login_msg, sudo_ok, sudo_msg


@retry(
    stop=stop_after_attempt(SSH_RETRY_ATTEMPTS),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type((socket.error, socket.timeout)),
    reraise=True
)
def _check_sudo_access_linux(host: Host) -> Tuple[bool, str]:
    """Check sudo access on Linux host with retry logic"""
    try:
        with ssh_connection(host) as ssh:
            # Check sudo without password
            stdin, stdout, stderr = ssh.exec_command("sudo -n id", timeout=SSH_COMMAND_TIMEOUT)
            exit_code = stdout.channel.recv_exit_status()
            
            if exit_code == 0:
                return True, "Sudo access OK (no password required)"
            else:
                return False, "Недостаточно прав (sudo): Нет полномочий на выполнение команды"
    except paramiko.AuthenticationException:
        return False, "Недостаточно прав (sudo): Ошибка аутентификации"
    except Exception as e:
        return False, "Недостаточно прав (sudo): Нет полномочий на выполнение команды"


def _create_winrm_session(host: Host) -> winrm.Session:
    """Create WinRM session with configured timeout"""
    return winrm.Session(
        f"http://{host.hostname}:{host.port}",
        auth=(host.username, decrypt_password(host.password) if host.password else ""),
        transport='ntlm',
        read_timeout_sec=WINRM_TIMEOUT,
        operation_timeout_sec=WINRM_TIMEOUT
    )


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    reraise=True
)
def _check_admin_access(host: Host) -> Tuple[bool, str]:
    """Check admin access on Windows host with retry logic"""
    try:
        session = _create_winrm_session(host)
        # Run simple command to verify access
        r = session.run_cmd("whoami")
        if r.status_code == 0:
            return True, "Admin access OK"
        else:
            return False, "Недостаточно прав (sudo): Нет полномочий на выполнение команды"
    except Exception as e:
        return False, "Недостаточно прав (sudo): Нет полномочий на выполнение команды"


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    reraise=True
)
def _check_winrm_login(host: Host) -> Tuple[bool, str]:
    """Check WinRM login credentials with retry logic"""
    try:
        session = _create_winrm_session(host)
        r = session.run_cmd("echo test")
        if r.status_code == 0:
            return True, "WinRM login OK"
        else:
            return False, "Неверные учётные данные: Ошибка при входе (логин/пароль/SSH-ключ)"
    except Exception as e:
        return False, "Неверные учётные данные: Ошибка при входе (логин/пароль/SSH-ключ)"


@retry(
    stop=stop_after_attempt(SSH_RETRY_ATTEMPTS),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type((socket.error, socket.timeout)),
    reraise=True
)
def _ssh_connect_and_execute(host: Host, command: str) -> Tuple[bool, str, str]:
    """
    Connect to host via SSH and execute command with retry logic.
    Uses ssh_connection context manager for automatic cleanup.
    
    Returns: (success, output, error)
    """
    try:
        with ssh_connection(host) as ssh:
            stdin, stdout, stderr = ssh.exec_command(command, timeout=SSH_COMMAND_TIMEOUT)
            exit_code = stdout.channel.recv_exit_status()
            
            output = stdout.read().decode('utf-8', errors='ignore')
            error = stderr.read().decode('utf-8', errors='ignore') if exit_code != 0 else ""
            
            return exit_code == 0, output, error
    except paramiko.AuthenticationException as e:
        return False, "", f"Authentication failed: {str(e)}"
    except paramiko.SSHException as e:
        return False, "", f"SSH error: {str(e)}"
    except Exception as e:
        return False, "", str(e)


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    reraise=True
)
def _winrm_connect_and_execute(host: Host, command: str) -> Tuple[bool, str, str]:
    """
    Connect to host via WinRM and execute command with retry logic.
    
    Returns: (success, output, error)
    """
    try:
        session = _create_winrm_session(host)
        
        r = session.run_cmd(command)
        
        success = r.status_code == 0
        output = r.std_out
        error = r.std_err if not success else ""
        
        return success, output, error
    except Exception as e:
        return False, "", str(e)


async def execute_command(host: Host, command: str) -> ExecutionResult:
    """
    Execute command on host (SSH for Linux, WinRM for Windows)
    """
    loop = asyncio.get_event_loop()
    
    try:
        if host.connection_type == "ssh":
            success, output, error = await loop.run_in_executor(
                None, _ssh_connect_and_execute, host, command
            )
        elif host.connection_type == "winrm":
            success, output, error = await loop.run_in_executor(
                None, _winrm_connect_and_execute, host, command
            )
        else:
            return ExecutionResult(
                host_id=host.id,
                host_name=host.name,
                success=False,
                output="",
                error=f"Unknown connection type: {host.connection_type}"
            )
        
        return ExecutionResult(
            host_id=host.id,
            host_name=host.name,
            success=success,
            output=output,
            error=error if not success else None
        )
    except Exception as e:
        return ExecutionResult(
            host_id=host.id,
            host_name=host.name,
            success=False,
            output="",
            error=str(e)
        )


async def execute_check_with_processor(host: Host, command: str, processor_script: Optional[str] = None, reference_data: Optional[str] = None) -> ExecutionResult:
    """Execute check command and process results with optional reference data"""
    # Step 1: Execute the main command
    main_result = await execute_command(host, command)
    
    if not processor_script:
        # No processor - return as is
        return main_result
    
    if not main_result.success:
        # Main command failed - return error
        return ExecutionResult(
            host_id=host.id,
            host_name=host.name,
            success=False,
            output=main_result.output,
            error=main_result.error
        )
    
    # Step 2: Run processor script LOCALLY with main command output as input
    try:
        loop = asyncio.get_event_loop()
        
        # Execute processor script LOCALLY on our server
        # This avoids command line length limits and doesn't require write permissions on remote hosts
        import subprocess
        import os
        
        # Set environment variables for the local process
        env = os.environ.copy()
        env['CHECK_OUTPUT'] = main_result.output
        env['ETALON_INPUT'] = reference_data or ''
        
        print(f"[DEBUG] Executing processor script locally, output size: {len(main_result.output)} bytes")
        
        # Execute processor script locally using bash
        # User should write processor scripts in bash regardless of target OS
        result = subprocess.run(
            ['bash', '-c', processor_script],
            env=env,
            capture_output=True,
            text=True,
            timeout=30
        )
        
        print(f"[DEBUG] Local processor execution completed, return code: {result.returncode}")
        
        # Create processor result from local execution
        processor_result = type('obj', (object,), {
            'output': result.stdout,
            'error': result.stderr if result.returncode != 0 else None,
            'success': result.returncode == 0,
            'returncode': result.returncode
        })()
        
        # Extract error code from exit code or output
        error_code = None
        error_description = None
        
        # First, check if returncode is an error code (>= 1000, as per error codes table)
        if processor_result.returncode >= 1000:
            error_code = processor_result.returncode
            error_info = get_error_description(error_code)
            error_description = f"{error_info['category']}: {error_info['error']} - {error_info['description']}"
        else:
            # Try to extract from output
            error_code = extract_error_code_from_output(processor_result.output)
            if error_code:
                error_info = get_error_description(error_code)
                error_description = f"{error_info['category']}: {error_info['error']} - {error_info['description']}"
        
        # Parse processor output to determine check result
        output = processor_result.output.strip()
        check_status = None
        
        # If we have an error code, set status to 'Ошибка'
        if error_code:
            check_status = 'Ошибка'
        else:
            # Look for status keywords
            for line in output.split('\n'):
                line_stripped = line.strip()
                line_lower = line_stripped.lower()
                
                if 'пройдена' in line_lower and 'не пройдена' not in line_lower:
                    check_status = 'Пройдена'
                    break
                elif 'не пройдена' in line_lower:
                    check_status = 'Не пройдена'
                    break
                elif 'оператор' in line_lower:
                    check_status = 'Оператор'
                    break            
                else:
                    check_status = 'Ошибка'
                    break

        
        # Build result message - only command output and final status
        result_output = f"=== Результат команды ===\n{main_result.output}\n\n=== Статус проверки ===\n{check_status or 'Не определён'}"
        
        return ExecutionResult(
            host_id=host.id,
            host_name=host.name,
            success=(check_status == 'Пройдена'),
            output=result_output,
            error=processor_result.error if processor_result.error else None,
            check_status=check_status,
            error_code=error_code,
            error_description=error_description
        )
        
    except Exception as e:
        return ExecutionResult(
            host_id=host.id,
            host_name=host.name,
            success=False,
            output=main_result.output,
            error=f"Ошибка обработчика: {str(e)}"
        )

# Keep for backward compatibility
def _check_ssh_login_original(host: Host) -> tuple[bool, str]:
    """Original SSH login check - kept for reference"""
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        # Connect with appropriate authentication
        if host.auth_type == "password":
            password = decrypt_password(host.password) if host.password else None
            if not password:
                return False, "Пароль не указан или не удалось расшифровать"
            ssh.connect(
                hostname=host.hostname,
                port=host.port,
                username=host.username,
                password=password,
                timeout=10,
                allow_agent=False,
                look_for_keys=False,
                banner_timeout=5,
                auth_timeout=10,
                gss_auth=False,
                gss_kex=False,
                gss_deleg_creds=False
            )
        else:  # key-based auth
            from io import StringIO
            if not host.ssh_key:
                return False, "SSH ключ не указан"
            key_file = StringIO(host.ssh_key)
            try:
                pkey = paramiko.RSAKey.from_private_key(key_file)
            except:
                key_file = StringIO(host.ssh_key)
                try:
                    pkey = paramiko.DSSKey.from_private_key(key_file)
                except:
                    key_file = StringIO(host.ssh_key)
                    try:
                        pkey = paramiko.ECDSAKey.from_private_key(key_file)
                    except:
                        key_file = StringIO(host.ssh_key)
                        pkey = paramiko.Ed25519Key.from_private_key(key_file)
            
            ssh.connect(
                hostname=host.hostname,
                port=host.port,
                username=host.username,
                pkey=pkey,
                timeout=10,
                allow_agent=False,
                look_for_keys=False,
                banner_timeout=5,
                auth_timeout=10,
                gss_auth=False,
                gss_kex=False,
                gss_deleg_creds=False
            )
        
        ssh.close()
        import time
        time.sleep(0.5)  # Small delay to ensure connection is fully closed
        return True, "Логин успешен"
    
    except paramiko.AuthenticationException:
        ssh.close()
        return False, "Ошибка аутентификации: неверный логин/пароль/ключ"
    except Exception as e:
        try:
            ssh.close()
        except:
            pass
        return False, f"Ошибка логина: {str(e)}"


# Keep for backward compatibility
async def execute_ssh_command(host: Host, command: str) -> ExecutionResult:
    """Execute command on host via SSH"""
    return await execute_command(host, command)


async def save_failed_executions(
    scripts: List[Script],
    project_id: str,
    task_id: str,
    session_id: str,
    host: Host,
    system: System,
    error_msg: str,
    check_type: str,
    user_id: str
) -> None:
    """
    Save failed execution records for all scripts when a preliminary check fails.
    
    Args:
        scripts: List of scripts that failed
        project_id: Project ID
        task_id: Project task ID
        session_id: Execution session ID
        host: Host where execution failed
        system: System being checked
        error_msg: Error message to save
        check_type: Type of check that failed ('network', 'login', 'sudo', 'admin')
        user_id: ID of user who initiated execution
    """
    # Get error code and description for the check type
    error_code = get_error_code_for_check_type(check_type)
    error_description = None
    
    if error_code:
        error_info = get_error_description(error_code)
        error_description = f"{error_info['category']}: {error_info['error']} - {error_info['description']}"
    
    # Save execution record for each script
    for script in scripts:
        execution = Execution(
            project_id=project_id,
            project_task_id=task_id,
            execution_session_id=session_id,
            host_id=host.id,
            system_id=system.id,
            script_id=script.id,
            script_name=script.name,
            success=False,
            output="",
            error=error_msg,
            check_status="Ошибка",
            error_code=error_code,
            error_description=error_description,
            executed_by=user_id
        )
        exec_doc = prepare_for_mongo(execution.model_dump())
        await db.executions.insert_one(exec_doc)        