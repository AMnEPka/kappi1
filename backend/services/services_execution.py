"""
services/execution.py
Command execution services for SSH and WinRM
"""

import asyncio
import socket
import paramiko
import winrm  # pyright: ignore[reportMissingImports]
from typing import Tuple, Optional
import logging

from config.config_init import logger, decrypt_password, db
from models.models_init import Host, ExecutionResult


def _check_network_access(host: Host) -> Tuple[bool, str]:
    """Check if host is reachable"""
    try:
        socket.create_connection((host.hostname, host.port), timeout=5)
        return True, "Network access OK"
    except socket.timeout:
        return False, f"Connection timeout to {host.hostname}:{host.port}"
    except socket.error as e:
        return False, f"Network error: {str(e)}"


def _check_ssh_login(host: Host) -> Tuple[bool, str]:
    """Check SSH login credentials"""
    try:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        if host.auth_type == "password":
            password = decrypt_password(host.password) if host.password else ""
            ssh.connect(
                hostname=host.hostname,
                port=host.port,
                username=host.username,
                password=password,
                timeout=10
            )
        else:  # key-based
            ssh.connect(
                hostname=host.hostname,
                port=host.port,
                username=host.username,
                key_filename=host.ssh_key,
                timeout=10
            )
        
        ssh.close()
        return True, "SSH login OK"
    except Exception as e:
        return False, f"SSH login failed: {str(e)}"


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


def _check_sudo_access_linux(host: Host) -> Tuple[bool, str]:
    """Check sudo access on Linux host"""
    try:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        if host.auth_type == "password":
            password = decrypt_password(host.password) if host.password else ""
            ssh.connect(
                hostname=host.hostname,
                port=host.port,
                username=host.username,
                password=password,
                timeout=10
            )
        else:
            ssh.connect(
                hostname=host.hostname,
                port=host.port,
                username=host.username,
                key_filename=host.ssh_key,
                timeout=10
            )
        
        # Check sudo without password
        stdin, stdout, stderr = ssh.exec_command("sudo -n id")
        exit_code = stdout.channel.recv_exit_status()
        
        ssh.close()
        
        if exit_code == 0:
            return True, "Sudo access OK (no password required)"
        else:
            return False, "Sudo access requires password"
    except Exception as e:
        return False, f"Sudo check failed: {str(e)}"


def _check_admin_access(host: Host) -> Tuple[bool, str]:
    """Check admin access on Windows host"""
    try:
        session = winrm.Session(
            f"http://{host.hostname}:{host.port}",
            auth=(host.username, decrypt_password(host.password) if host.password else "")
        )
        # Run simple command to verify access
        r = session.run_cmd("whoami")
        if r.status_code == 0:
            return True, "Admin access OK"
        else:
            return False, "Admin access check failed"
    except Exception as e:
        return False, f"Admin access check failed: {str(e)}"


def _check_winrm_login(host: Host) -> Tuple[bool, str]:
    """Check WinRM login credentials"""
    try:
        session = winrm.Session(
            f"http://{host.hostname}:{host.port}",
            auth=(host.username, decrypt_password(host.password) if host.password else "")
        )
        r = session.run_cmd("echo test")
        if r.status_code == 0:
            return True, "WinRM login OK"
        else:
            return False, "WinRM login failed"
    except Exception as e:
        return False, f"WinRM login failed: {str(e)}"


def _ssh_connect_and_execute(host: Host, command: str) -> Tuple[bool, str, str]:
    """
    Connect to host via SSH and execute command
    
    Returns: (success, output, error)
    """
    try:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        if host.auth_type == "password":
            password = decrypt_password(host.password) if host.password else ""
            ssh.connect(
                hostname=host.hostname,
                port=host.port,
                username=host.username,
                password=password,
                timeout=30
            )
        else:
            ssh.connect(
                hostname=host.hostname,
                port=host.port,
                username=host.username,
                key_filename=host.ssh_key,
                timeout=30
            )
        
        stdin, stdout, stderr = ssh.exec_command(command, timeout=60)
        exit_code = stdout.channel.recv_exit_status()
        
        output = stdout.read().decode('utf-8', errors='ignore')
        error = stderr.read().decode('utf-8', errors='ignore') if exit_code != 0 else ""
        
        ssh.close()
        
        return exit_code == 0, output, error
    except Exception as e:
        return False, "", str(e)


def _winrm_connect_and_execute(host: Host, command: str) -> Tuple[bool, str, str]:
    """
    Connect to host via WinRM and execute command
    
    Returns: (success, output, error)
    """
    try:
        session = winrm.Session(
            f"http://{host.hostname}:{host.port}",
            auth=(host.username, decrypt_password(host.password) if host.password else "")
        )
        
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
            'success': result.returncode == 0
        })()
        
        # Parse processor output to determine check result
        output = processor_result.output.strip()
        check_status = None
        
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
        result_output = f"=== Результат команды ===\n{main_result.output}\n\n=== Вывод обработчика ===\n{output}\n\n=== Статус проверки ===\n{check_status or 'Не определён'}"
        
        return ExecutionResult(
            host_id=host.id,
            host_name=host.name,
            success=(check_status == 'Пройдена'),
            output=result_output,
            error=processor_result.error if processor_result.error else None,
            check_status=check_status
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