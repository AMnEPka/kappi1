"""
SSH Logger Utility
Логирует все SSH команды и их ответы в отдельный файл для отладки
"""

import os
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional

# Настройка пути для логов
# В Docker контейнере логи должны быть в /app/logs (см. docker-compose)
# Вне контейнера - в logs/ относительно корня проекта
try:
    if os.path.exists('/app/logs'):
        LOG_DIR = Path('/app/logs')
    else:
        ROOT_DIR = Path(__file__).parent.parent.parent
        LOG_DIR = Path(os.environ.get('SSH_LOG_DIR', ROOT_DIR / 'logs'))
    SSH_LOG_FILE = LOG_DIR / 'ssh_operations.log'

    # Создаем директорию для логов, если её нет
    LOG_DIR.mkdir(parents=True, exist_ok=True)

    # Настройка логгера для SSH операций
    ssh_logger = logging.getLogger('ssh_operations')
    ssh_logger.setLevel(logging.DEBUG)

    # Удаляем существующие обработчики, чтобы не дублировать логи
    if ssh_logger.handlers:
        ssh_logger.handlers.clear()

    # Создаем обработчик файла
    file_handler = logging.FileHandler(SSH_LOG_FILE, encoding='utf-8')
    file_handler.setLevel(logging.DEBUG)

    # Формат логов: дата/время, уровень, сообщение
    formatter = logging.Formatter(
        '%(asctime)s [%(levelname)s] %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    file_handler.setFormatter(formatter)

    ssh_logger.addHandler(file_handler)
    ssh_logger.propagate = False  # Не передаем логи в корневой логгер
    
    # Флаг успешной инициализации
    _logger_initialized = True
except Exception as e:
    # Если не удалось инициализировать логгер, используем стандартный
    import logging as std_logging
    ssh_logger = std_logging.getLogger('ssh_operations')
    ssh_logger.warning(f"Failed to initialize SSH logger: {e}. Using standard logger.")
    _logger_initialized = False
    # Инициализируем SSH_LOG_FILE как None, чтобы clear_ssh_logs могла проверить его наличие
    try:
        if os.path.exists('/app/logs'):
            LOG_DIR = Path('/app/logs')
        else:
            ROOT_DIR = Path(__file__).parent.parent.parent
            LOG_DIR = Path(os.environ.get('SSH_LOG_DIR', ROOT_DIR / 'logs'))
        SSH_LOG_FILE = LOG_DIR / 'ssh_operations.log'
    except:
        SSH_LOG_FILE = None


def log_ssh_connection(host, operation: str, success: bool = True, error: Optional[str] = None):
    """
    Логирует попытку SSH подключения
    
    Args:
        host: Объект хоста (Host)
        operation: Тип операции (например, 'login', 'sudo_check', 'command_execution')
        success: Успешность операции
        error: Сообщение об ошибке (если есть)
    """
    try:
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]
        status = "SUCCESS" if success else "FAILED"
        
        log_entry = f"""
{'='*80}
[{timestamp}] SSH CONNECTION: {operation} - {status}
Host: {host.name} ({host.hostname}:{host.port})
Username: {host.username}
Auth Type: {host.auth_type}
Connection Type: {host.connection_type}
"""
        
        if error:
            log_entry += f"Error: {error}\n"
        
        log_entry += f"{'='*80}\n"
        
        ssh_logger.info(log_entry)
    except Exception:
        # Игнорируем ошибки логирования, чтобы не ломать основную функциональность
        pass


def log_ssh_command(host, command: str, stdout: str = "", stderr: str = "", exit_code: Optional[int] = None, success: bool = True):
    """
    Логирует SSH команду и её результат
    
    Args:
        host: Объект хоста (Host)
        command: Выполненная команда
        stdout: Стандартный вывод команды
        stderr: Стандартный поток ошибок
        exit_code: Код возврата команды
        success: Успешность выполнения
    """
    try:
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]
        status = "SUCCESS" if success else "FAILED"
        
        log_entry = f"""
{'='*80}
[{timestamp}] SSH COMMAND EXECUTION - {status}
Host: {host.name} ({host.hostname}:{host.port})
Username: {host.username}

>>> COMMAND SENT:
{command}

>>> EXIT CODE: {exit_code if exit_code is not None else 'N/A'}

>>> STDOUT:
{stdout if stdout else '(empty)'}

>>> STDERR:
{stderr if stderr else '(empty)'}
{'='*80}
"""
        
        ssh_logger.info(log_entry)
    except Exception:
        # Игнорируем ошибки логирования, чтобы не ломать основную функциональность
        pass


def log_ssh_check(host, check_type: str, command: str = "", stdout: str = "", stderr: str = "", exit_code: Optional[int] = None, success: bool = True):
    """
    Логирует SSH проверку (login, sudo и т.д.)
    
    Args:
        host: Объект хоста (Host)
        check_type: Тип проверки ('login', 'sudo', 'network')
        command: Выполненная команда (если есть)
        stdout: Стандартный вывод
        stderr: Стандартный поток ошибок
        exit_code: Код возврата
        success: Успешность проверки
    """
    try:
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]
        status = "SUCCESS" if success else "FAILED"
        
        log_entry = f"""
{'='*80}
[{timestamp}] SSH CHECK: {check_type.upper()} - {status}
Host: {host.name} ({host.hostname}:{host.port})
Username: {host.username}
"""
        
        if command:
            log_entry += f"\n>>> COMMAND SENT:\n{command}\n"
        
        if exit_code is not None:
            log_entry += f"\n>>> EXIT CODE: {exit_code}\n"
        
        if stdout:
            log_entry += f"\n>>> STDOUT:\n{stdout}\n"
        
        if stderr:
            log_entry += f"\n>>> STDERR:\n{stderr}\n"
        
        log_entry += f"{'='*80}\n"
        
        ssh_logger.info(log_entry)
    except Exception:
        # Игнорируем ошибки логирования, чтобы не ломать основную функциональность
        pass


def log_processor_script(host, script_id: str = "", script_name: str = "", processor_script: str = "", 
                         input_data: str = "", reference_data: str = "", stdout: str = "", 
                         stderr: str = "", exit_code: Optional[int] = None, success: bool = True):
    """
    Логирует выполнение скрипта-обработчика
    
    Args:
        host: Объект хоста (Host)
        script_id: ID скрипта
        script_name: Имя скрипта
        processor_script: Текст скрипта-обработчика
        input_data: Входные данные (CHECK_OUTPUT)
        reference_data: Эталонные данные (ETALON_INPUT)
        stdout: Стандартный вывод скрипта
        stderr: Стандартный поток ошибок
        exit_code: Код возврата скрипта
        success: Успешность выполнения
    """
    try:
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]
        status = "SUCCESS" if success else "FAILED"
        
        # Prepare script preview (first 20 lines or first 1000 chars)
        script_preview = ""
        if processor_script:
            script_lines = processor_script.split('\n')
            preview_lines = script_lines[:20]
            script_preview = '\n'.join(preview_lines)
            if len(script_lines) > 20:
                script_preview += f"\n... (total {len(script_lines)} lines, {len(processor_script)} chars)"
        
        # Analyze exit code
        exit_code_info = f"{exit_code if exit_code is not None else 'N/A'}"
        if exit_code is not None:
            if exit_code == 0:
                exit_code_info += " (SUCCESS)"
            elif exit_code >= 1000:
                exit_code_info += f" (Custom error code)"
            elif exit_code == 127:
                exit_code_info += " (Command not found)"
            elif exit_code == 126:
                exit_code_info += " (Command not executable)"
            elif exit_code == 130:
                exit_code_info += " (Script terminated by SIGINT)"
            elif exit_code > 128:
                exit_code_info += f" (Signal {exit_code - 128})"
            else:
                exit_code_info += " (Script error)"
        
        log_entry = f"""
{'='*80}
[{timestamp}] PROCESSOR SCRIPT EXECUTION - {status}
Host: {host.name} ({host.hostname}:{host.port})
Script ID: {script_id if script_id else 'N/A'}
Script Name: {script_name if script_name else 'N/A'}

>>> PROCESSOR SCRIPT (preview):
{script_preview if script_preview else '(empty)'}

>>> INPUT DATA (CHECK_OUTPUT) - {len(input_data)} chars, {len(input_data.split(chr(10)))} lines:
{input_data if input_data else '(empty)'}

>>> REFERENCE DATA (ETALON_INPUT) - {len(reference_data)} chars, {len(reference_data.split(chr(10)))} lines:
{reference_data if reference_data else '(empty)'}

>>> EXIT CODE: {exit_code_info}

>>> STDOUT ({len(stdout)} chars):
{stdout if stdout else '(empty)'}

>>> STDERR ({len(stderr)} chars):
{stderr if stderr else '(empty)'}
{'='*80}
"""
        
        ssh_logger.info(log_entry)
    except Exception:
        # Игнорируем ошибки логирования, чтобы не ломать основную функциональность
        pass


def clear_ssh_logs():
    """
    Очищает файл логов SSH операций перед новым запуском проекта
    """
    try:
        if _logger_initialized and SSH_LOG_FILE and SSH_LOG_FILE.exists():
            # Очищаем файл, открывая его в режиме записи
            with open(SSH_LOG_FILE, 'w', encoding='utf-8') as f:
                timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]
                f.write(f"[{timestamp}] SSH LOG FILE CLEARED - Starting new project execution\n")
                f.write(f"{'='*80}\n\n")
            ssh_logger.info(f"SSH log file cleared at {timestamp}")
    except Exception:
        # Игнорируем ошибки очистки, чтобы не ломать основную функциональность
        pass
