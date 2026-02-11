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
import re
from contextlib import contextmanager
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
import os

from config.config_init import logger, decrypt_password, db
from models.models_init import Host, ExecutionResult, Execution, Script, System
from utils.error_codes import get_error_description, extract_error_code_from_output, get_error_code_for_check_type, detect_command_error, is_check_failure_code
from utils.db_utils import prepare_for_mongo
from utils.ssh_logger import log_ssh_connection, log_ssh_command, log_ssh_check, log_processor_script

# SSH connection settings from environment
SSH_CONNECT_TIMEOUT = int(os.environ.get('SSH_CONNECT_TIMEOUT', '10'))
SSH_COMMAND_TIMEOUT = int(os.environ.get('SSH_COMMAND_TIMEOUT', '60'))
SSH_RETRY_ATTEMPTS = int(os.environ.get('SSH_RETRY_ATTEMPTS', '3'))
WINRM_TIMEOUT = int(os.environ.get('WINRM_TIMEOUT', '30'))
# pywinrm requires read_timeout_sec > operation_timeout_sec (both non-zero)
WINRM_READ_TIMEOUT = int(os.environ.get('WINRM_READ_TIMEOUT', str(WINRM_TIMEOUT + 15)))


def _load_private_key(key_data: str):
    """
    Load private key from string, trying different key formats.
    SSH keys are stored encrypted, so decrypt first.
    """
    from io import StringIO
    
    # Decrypt the SSH key
    decrypted_key = decrypt_password(key_data)
    
    # Try different key formats
    key_file = StringIO(decrypted_key)
    try:
        return paramiko.RSAKey.from_private_key(key_file)
    except:
        pass
    
    key_file = StringIO(decrypted_key)
    try:
        return paramiko.DSSKey.from_private_key(key_file)
    except:
        pass
    
    key_file = StringIO(decrypted_key)
    try:
        return paramiko.ECDSAKey.from_private_key(key_file)
    except:
        pass
    
    key_file = StringIO(decrypted_key)
    return paramiko.Ed25519Key.from_private_key(key_file)


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
            if not host.ssh_key:
                raise ValueError("SSH key not provided for key-based authentication")
            pkey = _load_private_key(host.ssh_key)
            ssh.connect(
                hostname=host.hostname,
                port=host.port,
                username=host.username,
                pkey=pkey,
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
        logger.info(f"Attempting network connection to {host.hostname}:{host.port}")
        sock = socket.create_connection((host.hostname, host.port), timeout=5)
        sock.close()
        logger.info(f"Network connection successful to {host.hostname}:{host.port}")
        return True, "Сетевой доступ получен"
    except socket.timeout:
        logger.warning(f"Network connection timeout to {host.hostname}:{host.port}")
        return False, "Нет сетевого доступа: Недоступен сервер или порт"
    except socket.error as e:
        logger.warning(f"Network connection error to {host.hostname}:{host.port}: {str(e)}")
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
            log_ssh_connection(host, "login", success=True)
            return True, "SSH login OK"
    except paramiko.AuthenticationException as e:
        error_msg = "Неверные учётные данные"
        log_ssh_connection(host, "login", success=False, error=str(e))
        return False, error_msg
    except paramiko.SSHException as e:
        error_msg = f"Ошибка SSH: {str(e)}"
        log_ssh_connection(host, "login", success=False, error=str(e))
        return False, error_msg
    except Exception as e:
        error_msg = "Неверные учётные данные: Ошибка при входе (логин/пароль/SSH-ключ)"
        log_ssh_connection(host, "login", success=False, error=str(e))
        return False, error_msg


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
    command = "sudo -n id"
    try:
        with ssh_connection(host) as ssh:
            # Check sudo without password
            stdin, stdout, stderr = ssh.exec_command(command, timeout=SSH_COMMAND_TIMEOUT)
            exit_code = stdout.channel.recv_exit_status()
            
            # Читаем вывод до получения exit_code
            stdout_text = stdout.read().decode('utf-8', errors='ignore')
            stderr_text = stderr.read().decode('utf-8', errors='ignore')
            
            success = exit_code == 0
            log_ssh_check(
                host=host,
                check_type="sudo",
                command=command,
                stdout=stdout_text,
                stderr=stderr_text,
                exit_code=exit_code,
                success=success
            )
            
            if exit_code == 0:
                return True, "Sudo access OK (no password required)"
            else:
                return False, "Недостаточно прав (sudo): Нет полномочий на выполнение команды"
    except paramiko.AuthenticationException as e:
        log_ssh_check(
            host=host,
            check_type="sudo",
            command=command,
            stderr=str(e),
            success=False
        )
        return False, "Недостаточно прав (sudo): Ошибка аутентификации"
    except Exception as e:
        log_ssh_check(
            host=host,
            check_type="sudo",
            command=command,
            stderr=str(e),
            success=False
        )
        return False, "Недостаточно прав (sudo): Нет полномочий на выполнение команды"


def _create_winrm_session(host: Host) -> winrm.Session:
    """Create WinRM session with configured timeout.
    Username for domain auth must be DOMAIN\\user (e.g. test\\user). Same as PowerShell Get-Credential 'test\\user'.
    """
    endpoint = f"http://{host.hostname}:{host.port}"
    if not endpoint.rstrip("/").endswith("/wsman"):
        endpoint = endpoint.rstrip("/") + "/wsman"
    logger.info(f"WinRM session: endpoint={endpoint}, user={((host.username or '').strip())[:20]}...")
    password = decrypt_password(host.password) if host.password else ""
    # Ensure username is passed as-is (DOMAIN\user); avoid stripping backslash
    username = (host.username or "").strip()
    # read_timeout_sec must exceed operation_timeout_sec (pywinrm requirement)
    read_timeout = max(WINRM_READ_TIMEOUT, WINRM_TIMEOUT + 1)
    return winrm.Session(
        endpoint,
        auth=(username, password),
        transport="ntlm",
        read_timeout_sec=read_timeout,
        operation_timeout_sec=WINRM_TIMEOUT,
        server_cert_validation="ignore",
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
        logger.info(f"WinRM login: creating session for {host.hostname}")
        session = _create_winrm_session(host)
        logger.info(f"WinRM login: running echo test on {host.hostname}")
        r = session.run_cmd("echo test")
        logger.info(f"WinRM login: run_cmd status_code={r.status_code} for {host.hostname}")
        if r.status_code == 0:
            return True, "WinRM login OK"
        else:
            err = (r.std_err or b"").decode("utf-8", errors="ignore") or str(r.status_code)
            return False, f"Неверные учётные данные: {err}"
    except Exception as e:
        logger.warning(f"WinRM login exception for {host.hostname}: {e}")
        return False, f"Неверные учётные данные: {getattr(e, 'message', str(e))}"


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
            
            # Логируем команду и результат
            log_ssh_command(
                host=host,
                command=command,
                stdout=output,
                stderr=error,
                exit_code=exit_code,
                success=(exit_code == 0)
            )
            
            return exit_code == 0, output, error
    except paramiko.AuthenticationException as e:
        error_msg = f"Authentication failed: {str(e)}"
        log_ssh_command(
            host=host,
            command=command,
            stderr=error_msg,
            success=False
        )
        return False, "", error_msg
    except paramiko.SSHException as e:
        error_msg = f"SSH error: {str(e)}"
        log_ssh_command(
            host=host,
            command=command,
            stderr=error_msg,
            success=False
        )
        return False, "", error_msg
    except Exception as e:
        error_msg = str(e)
        log_ssh_command(
            host=host,
            command=command,
            stderr=error_msg,
            success=False
        )
        return False, "", error_msg


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


def _execute_profile_linux(host: Host, script_content: str) -> Tuple[bool, str, str, int]:
    """
    Execute IB profile script on Linux: write content to temp file and run via sudo bash.
    Returns: (success, stdout, stderr, exit_code)
    """
    import base64
    import uuid as _uuid
    if not script_content:
        return True, "", "", 0
    try:
        content_b64 = base64.b64encode(script_content.encode("utf-8")).decode("ascii").replace("\n", "")
        tmp_name = f"/tmp/ib_profile_{_uuid.uuid4().hex[:12]}.sh"
        # Write via base64 decode, chmod, sudo bash, then rm; capture exit code
        cmd = (
            f"echo '{content_b64}' | base64 -d > {tmp_name} && "
            f"chmod +x {tmp_name} && "
            f"sudo -n bash {tmp_name}; rc=$?; rm -f {tmp_name}; exit $rc"
        )
        success, output, error = _ssh_connect_and_execute(host, cmd)
        exit_code = 0 if success else 1
        if not success and not error and output:
            error = output
        return success, output or "", error or "", exit_code
    except Exception as e:
        return False, "", str(e), 1


def _execute_profile_windows(host: Host, script_content: str) -> Tuple[bool, str, str, int]:
    """
    Execute IB profile script on Windows via WinRM PowerShell.
    Returns: (success, stdout, stderr, exit_code)
    """
    try:
        session = _create_winrm_session(host)
        r = session.run_ps(script_content or "")
        success = r.status_code == 0
        out = r.std_out
        err = r.std_err or b""
        if isinstance(out, bytes):
            out = out.decode("utf-8", errors="ignore")
        if isinstance(err, bytes):
            err = err.decode("utf-8", errors="ignore")
        return success, out or "", err or "", r.status_code
    except Exception as e:
        return False, "", str(e), 1


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


async def execute_check_with_processor(host: Host, command: str, processor_script: Optional[str] = None, 
                                        reference_data: Optional[str] = None, script_id: Optional[str] = None, 
                                        script_name: Optional[str] = None) -> ExecutionResult:
    """
    Execute check command and process results with optional reference data.
    
    Two-stage process:
    1. Execute command on remote host - detect technical errors (file not found, permission denied, etc.)
    2. Run processor script locally - analyze output for check pass/fail
    
    Status mapping:
    - "Ошибка" - Technical errors (1x, 2x, 3x, 5x codes)
    - "Не пройдена" - Check failures (4x codes) - config issues found
    - "Пройдена" - Check passed
    - "Оператор" - Manual review required
    """
    import subprocess
    # re is imported at module level, use it directly
    
    # Step 1: Execute the main command on remote host
    main_result = await execute_command(host, command)
    
    if not processor_script:
        # No processor - return as is
        return main_result
    
    # Step 1.5: Check for critical technical errors in command execution
    # Only block processor script execution for critical errors (command not found, permission denied, etc.)
    # For expected failures (like "group not found"), let the processor script handle it
    if not main_result.success:
        # Try to detect specific error from command output
        # Get exit code from the error message if available
        exit_code = 1  # Default
        
        # Detect error type from stderr/output
        cmd_error_code = detect_command_error(
            exit_code=exit_code,
            stdout=main_result.output or "",
            stderr=main_result.error or ""
        )
        
        # Only block processor execution for critical errors (not for expected failures)
        # Critical errors: command not found (31), permission denied (13, 22), file not found for critical files (21)
        # Expected failures: group not found, user not found, etc. - let processor script handle these
        if cmd_error_code and cmd_error_code in [11, 12, 13, 21, 22, 31, 32, 33, 34]:
            # Critical technical error - don't run processor script
            error_info = get_error_description(cmd_error_code)
            error_description = f"{error_info['category']}: {error_info['error']} - {error_info['description']}"
            
            result_output = main_result.output
            
            return ExecutionResult(
                host_id=host.id,
                host_name=host.name,
                success=False,
                output=result_output,
                error=main_result.error,
                check_status="Ошибка",
                error_code=cmd_error_code,
                error_description=error_description
            )
        
        # For other errors (including expected failures like "group not found"),
        # continue to processor script - it will handle the output appropriately
        # This allows scripts to check for "group not found" and treat it as success
    
    # Step 2: Run processor script LOCALLY with main command output as input
    try:
        # Normalize line endings: CRLF -> LF (fixes Windows/Linux compatibility issues)
        # This is critical when scripts are created on Windows but run on Linux
        normalized_script = processor_script.replace('\r\n', '\n').replace('\r', '\n')
        normalized_output = (main_result.output or '').replace('\r\n', '\n').replace('\r', '\n')
        normalized_reference = (reference_data or '').replace('\r\n', '\n').replace('\r', '\n')
        
        # Detailed logging for debugging
        script_preview = normalized_script[:500] + ('...' if len(normalized_script) > 500 else '')
        script_lines = normalized_script.split('\n')
        logger.info(f"Processor script preview (first 500 chars): {repr(script_preview)}")
        logger.info(f"Processor script total length: {len(normalized_script)} chars, {len(script_lines)} lines")
        logger.info(f"CHECK_OUTPUT size: {len(normalized_output)} chars, {len(normalized_output.split(chr(10)))} lines")
        logger.info(f"ETALON_INPUT size: {len(normalized_reference)} chars, {len(normalized_reference.split(chr(10)))} lines")
        logger.info(f"First 3 lines of script: {script_lines[:3]}")
        
        # Set environment variables for the local process
        env = os.environ.copy()
        env['CHECK_OUTPUT'] = normalized_output
        env['ETALON_INPUT'] = normalized_reference
        
        # Log environment variable sizes (for debugging)
        logger.info(f"Environment CHECK_OUTPUT size: {len(env.get('CHECK_OUTPUT', ''))} chars")
        logger.info(f"Environment ETALON_INPUT size: {len(env.get('ETALON_INPUT', ''))} chars")
        
        logger.info(f"Executing processor script locally for {host.name}, output size: {len(normalized_output)} bytes")
        
        # Check if bash is available
        try:
            bash_check = subprocess.run(['bash', '--version'], capture_output=True, text=True, timeout=5)
            logger.info(f"Bash version check: {bash_check.returncode}, stdout: {bash_check.stdout[:100] if bash_check.stdout else 'N/A'}")
        except Exception as e:
            logger.error(f"Failed to check bash availability: {e}")
        
        # Execute processor script locally using bash with verbose error reporting
        # Try to validate script syntax first
        syntax_check = subprocess.run(
            ['bash', '-n'],  # -n = check syntax without executing
            input=normalized_script,
            capture_output=True,
            text=True,
            timeout=5
        )
        if syntax_check.returncode != 0:
            logger.error(f"Bash syntax error in script: {syntax_check.stderr}")
            logger.error(f"Script content (first 1000 chars): {repr(normalized_script[:1000])}")
            # Log full script for debugging
            logger.error(f"Full script:\n{normalized_script}")
        
        # Execute processor script locally using bash
        # TEMPORARY: Use bash -x for debugging to see what's being executed
        # This will show all commands being executed
        logger.info("Executing script with bash -x for debugging")
        result = subprocess.run(
            ['bash', '-x', '-c', normalized_script],
            env=env,
            capture_output=True,
            text=True,
            timeout=30
        )
        
        logger.info(f"Local processor execution completed for {host.name}, return code: {result.returncode}")
        logger.info(f"STDOUT length: {len(result.stdout)} chars, STDERR length: {len(result.stderr)} chars")
        
        # Extract actual exit code from stderr if bash -x was used
        # bash -x shows "+ exit 42" in stderr, but system truncates exit codes > 255
        actual_exit_code = result.returncode
        if result.stderr:
            # Log full stderr for debugging (bash -x output goes to stderr)
            logger.warning(f"STDERR content (first 1000 chars): {repr(result.stderr[:1000])}")
            if len(result.stderr) > 1000:
                logger.warning(f"STDERR content (full):\n{result.stderr}")
            
            # Try to extract actual exit code from bash -x output
            # Look for patterns like "+ exit 42" or "exit 42"
            exit_pattern = r'\+?\s*exit\s+(\d+)'
            matches = re.findall(exit_pattern, result.stderr)
            if matches:
                # Get the last exit command (the actual one that was executed)
                last_exit = matches[-1]
                try:
                    extracted_code = int(last_exit)
                    # Check if it's a known error code (11-52 range)
                    if 11 <= extracted_code <= 52:
                        actual_exit_code = extracted_code
                        logger.info(f"Extracted actual exit code {extracted_code} from STDERR (system returned {result.returncode})")
                except ValueError:
                    pass
        
        if result.stdout:
            logger.info(f"STDOUT content: {repr(result.stdout[:500])}")
        
        # Update result.returncode with actual exit code if we extracted it
        if actual_exit_code != result.returncode:
            logger.info(f"Using extracted exit code {actual_exit_code} instead of system return code {result.returncode}")
            # Create a new result object with corrected return code
            class CorrectedResult:
                def __init__(self, original_result, corrected_returncode):
                    self.stdout = original_result.stdout
                    self.stderr = original_result.stderr
                    self.returncode = corrected_returncode
            result = CorrectedResult(result, actual_exit_code)
        
        # Check if return code is a known error code (11-52) or system error
        is_known_error_code = 11 <= result.returncode <= 52
        if result.returncode != 0 and not is_known_error_code:
            logger.warning(f"Non-zero exit code {result.returncode} - script may have failed or bash error occurred")
            # Exit codes > 128 usually indicate signal termination
            if result.returncode > 128:
                signal_num = result.returncode - 128
                logger.error(f"Script terminated by signal {signal_num} (exit code {result.returncode})")
        
        # Log processor script execution (use normalized data for logging)
        log_processor_script(
            host=host,
            script_id=script_id or "",
            script_name=script_name or "",
            processor_script=normalized_script,
            input_data=normalized_output,
            reference_data=normalized_reference,
            stdout=result.stdout,
            stderr=result.stderr,
            exit_code=result.returncode,
            success=(result.returncode == 0)
        )
        
        # Determine error code and status
        error_code = None
        error_description = None
        check_status = None
        
        output = result.stdout.strip()
        output_lower = output.lower()
        stderr = result.stderr.strip() if result.stderr else ""
        
        # FIRST: Check if returncode is a known error code (11-52)
        # This is the primary way scripts should return error codes
        if 11 <= result.returncode <= 52:
            error_code = result.returncode
            error_info = get_error_description(error_code)
            error_description = f"{error_info['category']}: {error_info['error']} - {error_info['description']}"
            
            # Determine status based on error code category
            if is_check_failure_code(error_code):
                # 4x codes (41-44) = check failures = "Не пройдена"
                check_status = "Не пройдена"
            else:
                # 1x, 2x, 3x, 5x = technical errors = "Ошибка"
                check_status = "Ошибка"
        
        else:
            # SECOND: Always check stdout for status keywords (regardless of exit code)
            # This handles cases where script uses set -e and exits with code 1
            
            # Try to extract error code from output first (before determining status)
            extracted_code = extract_error_code_from_output(result.stdout)
            if extracted_code and 11 <= extracted_code <= 52:
                error_code = extracted_code
                error_info = get_error_description(error_code)
                error_description = f"{error_info['category']}: {error_info['error']} - {error_info['description']}"
                
                # Determine status based on error code
                if is_check_failure_code(error_code):
                    check_status = "Не пройдена"
                else:
                    check_status = "Ошибка"
            elif 'пройдена' in output_lower and 'не пройдена' not in output_lower:
                check_status = 'Пройдена'
            elif 'не пройдена' in output_lower:
                check_status = 'Не пройдена'
                # Try to extract error code from output even if status is determined by keyword
                if not error_code:
                    extracted_code = extract_error_code_from_output(result.stdout)
                    if extracted_code and 11 <= extracted_code <= 52:
                        error_code = extracted_code
                        error_info = get_error_description(error_code)
                        error_description = f"{error_info['category']}: {error_info['error']} - {error_info['description']}"
                    else:
                        # If no code found but status is "Не пройдена", try to infer from context
                        # This is a fallback - ideally scripts should return error codes
                        logger.info(f"Processor script returned 'Не пройдена' without error code for {host.name}")
            elif 'оператор' in output_lower:
                check_status = 'Оператор'
            elif result.returncode == 0:
                # Exit code 0 without explicit status = passed
                check_status = 'Пройдена'
            else:
                # Non-zero exit code without status keyword
                # Check stderr for critical errors (syntax errors, etc.)
                stderr_lower = stderr.lower()
                is_critical_error = any(pattern in stderr_lower for pattern in [
                    'syntax error', 'command not found', 'no such file',
                    'permission denied', 'segmentation fault', 'killed',
                    'ошибка синтаксиса', 'команда не найдена'
                ])
                
                if is_critical_error:
                    # Real script error
                    error_code = 50
                    error_info = get_error_description(error_code)
                    error_description = f"{error_info['category']}: {error_info['error']} - {error_info['description']}"
                    check_status = "Ошибка"
                    logger.warning(f"Processor script error for {host.name}, exit code: {result.returncode}, stderr: {stderr[:200]}")
                else:
                    # Non-zero exit without critical error = check failed (e.g., grep returned 1)
                    check_status = 'Не пройдена'
                    # Try to extract error code from output
                    extracted_code = extract_error_code_from_output(result.stdout)
                    if extracted_code and 11 <= extracted_code <= 52:
                        error_code = extracted_code
                        error_info = get_error_description(error_code)
                        error_description = f"{error_info['category']}: {error_info['error']} - {error_info['description']}"
                    logger.info(f"Processor script returned exit code {result.returncode} for {host.name}, treating as check failure")
        
        # If status is "Не пройдена" but no error code was found, add a generic message
        if check_status == "Не пройдена" and not error_code:
            # Try one more time to extract from output
            extracted_code = extract_error_code_from_output(result.stdout)
            if extracted_code and 11 <= extracted_code <= 52:
                error_code = extracted_code
                error_info = get_error_description(error_code)
                error_description = f"{error_info['category']}: {error_info['error']} - {error_info['description']}"
            else:
                # Fallback: check if reference data was used
                if reference_data and reference_data.strip():
                    # If reference data was provided, it's a mismatch with reference
                    error_description = "Конфигурация: Несоответствие эталонным данным - Результат проверки не соответствует эталонным данным"
                else:
                    # No reference data - generic failure
                    error_description = "Конфигурация: Проверка не пройдена - Результат проверки не соответствует требованиям"
                logger.info(f"Processor script returned 'Не пройдена' without error code for {host.name}, reference_data used: {bool(reference_data and reference_data.strip())}")
        
        # Build result message
        status_line = check_status or 'Не определён'
        if error_description:
            status_line = f"{check_status}\n{error_description}"
        
        result_output = main_result.output
        
        # Add stderr info if there was an error (for debugging)
        if stderr and check_status == "Ошибка":
            result_output += f"\n\n=== Ошибка скрипта-обработчика ===\n{stderr}"
        
        # Extract actual_data if reference_data was provided
        # Skip extraction if error code indicates line not found (41) or commented (42)
        # In these cases, there's nothing to compare with reference data
        actual_data = None
        if reference_data and reference_data.strip() and error_code not in [41, 42]:
            # Try to extract from processor script output (if script outputs ACTUAL_DATA:)
            if 'ACTUAL_DATA:' in result.stdout:
                actual_data = result.stdout.split('ACTUAL_DATA:')[1].split('\n')[0].strip()
            else:
                # Try to extract from command output by parsing config files
                # Look for common patterns like "param = value" or "param=value"
                # re is imported at module level - use it directly
                import re as re_module  # Ensure re is available in this scope
                
                # Parse reference_data to understand what we're looking for
                # Handle formats: "user1,user2", "user1\nuser2", "user1 user2"
                ref_items = []
                if ',' in reference_data:
                    ref_items = [item.strip() for item in reference_data.split(',') if item.strip()]
                elif '\n' in reference_data:
                    ref_items = [item.strip() for item in reference_data.split('\n') if item.strip()]
                else:
                    ref_items = [item.strip() for item in reference_data.split() if item.strip()]
                
                # First, try to find uncommented lines
                uncommented_found = False
                for line in main_result.output.split('\n'):
                    line_stripped = line.strip()
                    if not line_stripped:
                        continue
                    
                    # Skip commented lines for now
                    if line_stripped.startswith('#'):
                        continue
                    
                    # Look for key=value or key = value patterns
                    if '=' in line_stripped:
                        # Extract value after =
                        match = re_module.search(r'=\s*(.+)$', line_stripped)
                        if match:
                            value = match.group(1).strip()
                            
                            # Check if this value contains any of the reference items
                            value_items = [item.strip() for item in re_module.split(r'[,\s]+', value) if item.strip()]
                            
                            # If value contains at least one reference item, it's likely the right parameter
                            if any(ref_item in value_items for ref_item in ref_items):
                                actual_data = value
                                uncommented_found = True
                                break
                            
                            # Also check if value format matches (comma-separated list)
                            if ',' in value and len(value_items) > 0:
                                if ',' in reference_data:
                                    actual_data = value
                                    uncommented_found = True
                                    break
                
                # If not found in uncommented lines, check commented lines
                if not uncommented_found:
                    for line in main_result.output.split('\n'):
                        line_stripped = line.strip()
                        if not line_stripped or not line_stripped.startswith('#'):
                            continue
                        
                        # Remove comment marker and check
                        uncommented_line = line_stripped.lstrip('#').strip()
                        if '=' in uncommented_line:
                            match = re_module.search(r'=\s*(.+)$', uncommented_line)
                            if match:
                                value = match.group(1).strip()
                                value_items = [item.strip() for item in re_module.split(r'[,\s]+', value) if item.strip()]
                                
                                if any(ref_item in value_items for ref_item in ref_items):
                                    actual_data = value
                                    break
        
        return ExecutionResult(
            host_id=host.id,
            host_name=host.name,
            success=(check_status == 'Пройдена'),
            output=result_output,
            error=result.stderr if result.stderr else None,
            check_status=check_status,
            error_code=error_code,
            error_description=error_description,
            actual_data=actual_data
        )
        
    except subprocess.TimeoutExpired:
        # Processor script timed out
        error_code = 34
        error_info = get_error_description(error_code)
        error_description = f"{error_info['category']}: {error_info['error']} - {error_info['description']}"
        
        log_processor_script(
            host=host,
            script_id=script_id or "",
            script_name=script_name or "",
            processor_script=processor_script,
            input_data=main_result.output,
            reference_data=reference_data or "",
            stderr="Таймаут выполнения скрипта-обработчика",
            success=False
        )
        
        return ExecutionResult(
            host_id=host.id,
            host_name=host.name,
            success=False,
            output=main_result.output,
            error="Таймаут выполнения скрипта-обработчика",
            check_status="Ошибка",
            error_code=error_code,
            error_description=error_description
        )
        
    except Exception as e:
        # Log processor script error
        log_processor_script(
            host=host,
            script_id=script_id or "",
            script_name=script_name or "",
            processor_script=processor_script,
            input_data=main_result.output,
            reference_data=reference_data or "",
            stderr=f"Ошибка обработчика: {str(e)}",
            success=False
        )
        
        error_code = 50
        error_info = get_error_description(error_code)
        error_description = f"{error_info['category']}: {error_info['error']} - {error_info['description']}"
        
        return ExecutionResult(
            host_id=host.id,
            host_name=host.name,
            success=False,
            output=main_result.output,
            error=f"Ошибка обработчика: {str(e)}",
            check_status="Ошибка",
            error_code=error_code,
            error_description=error_description
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
            if not host.ssh_key:
                return False, "SSH ключ не указан"
            
            # Decrypt and load SSH key
            pkey = _load_private_key(host.ssh_key)
            
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