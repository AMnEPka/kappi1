"""
utils/error_codes.py
Error codes and descriptions for script execution errors
This file mirrors the frontend errorCodes.js for consistency
"""

from typing import Optional

ERROR_CODES = {
    1001: {
        "category": "Подключение",
        "error": "Нет сетевого доступа",
        "description": "Недоступен сервер или порт"
    },
    1002: {
        "category": "Аутентификация",
        "error": "Неверные учётные данные",
        "description": "Ошибка при входе (логин/пароль/SSH-ключ)"
    },
    1003: {
        "category": "Авторизация",
        "error": "Недостаточно прав (sudo)",
        "description": "Нет полномочий на выполнение команды"
    },
    1004: {
        "category": "Авторизация",
        "error": "Отказано в доступе к файлу",
        "description": "Генерал permission denied"
    },
    2001: {
        "category": "Файловая система",
        "error": "Файл не найден",
        "description": "Нет такого файла или директории"
    },
    2002: {
        "category": "Файловая система",
        "error": "Не хватает прав на файл",
        "description": "Недостаточные права доступа к файлу"
    },
    2003: {
        "category": "Файловая система",
        "error": "Файл повреждён",
        "description": "Файл недоступен или в неправильном формате"
    },
    3001: {
        "category": "Процессы/команды",
        "error": "Команда не найдена",
        "description": "Нет такой команды в системе"
    },
    3002: {
        "category": "Сервисы",
        "error": "Служба не найдена",
        "description": "Нет такой системной службы"
    },
    3003: {
        "category": "Сервисы",
        "error": "Служба остановлена",
        "description": "Служба недоступна/не запущена"
    },
    3004: {
        "category": "Процессы",
        "error": "Таймаут выполнения",
        "description": "Команда превысила время выполнения"
    },
    4001: {
        "category": "Конфигурация",
        "error": "Строка не найдена",
        "description": "Искомая строка отсутствует в файле"
    },
    4002: {
        "category": "Конфигурация",
        "error": "Строка закомментирована",
        "description": "Строка есть, но отключена (закомментирована)"
    },
    4003: {
        "category": "Конфигурация",
        "error": "Неверный формат",
        "description": "Синтаксическая ошибка в конфигурации"
    },
    4004: {
        "category": "Конфигурация",
        "error": "Неверное значение",
        "description": "Параметр имеет недопустимое значение"
    },
    5000: {
        "category": "Критическая",
        "error": "Неизвестная ошибка",
        "description": "Непредвиденная ошибка в скрипте-обработчике"
    },
    5001: {
        "category": "Критическая",
        "error": "Отсутствует переменная",
        "description": "Нет обязательной переменной окружения"
    },
    5002: {
        "category": "Критическая",
        "error": "Ошибка синтаксиса",
        "description": "Ошибка в обработке данных скриптом"
    }
}


def get_error_description(error_code: int) -> dict:
    """
    Get error description by code
    
    Args:
        error_code: Error code number
        
    Returns:
        Dictionary with category, error, and description, or default if not found
    """
    code = int(error_code)
    if code in ERROR_CODES:
        return ERROR_CODES[code]
    
    # If code not found, return default error
    return {
        "category": "Неизвестно",
        "error": f"Неизвестный код ошибки: {error_code}",
        "description": "Ошибка не распознана"
    }


def extract_error_code_from_output(output: str) -> Optional[int]:
    """
    Extract error code from script output
    
    Args:
        output: Script output text
        
    Returns:
        Error code if found, None otherwise
    """
    if not output:
        return None
    
    # Look for exit code pattern
    import re
    exit_match = re.search(r'exit code:?\s*(\d+)', output, re.IGNORECASE)
    if exit_match:
        return int(exit_match.group(1))
    
    # Look for just a number at the end of output
    lines = output.strip().split('\n')
    if lines:
        last_line = lines[-1].strip()
        number_match = re.match(r'^\d+$', last_line)
        if number_match:
            return int(number_match.group(0))
    
    return None


def get_error_code_for_check_type(check_type: str) -> Optional[int]:
    """
    Get error code for pre-execution check types
    
    Args:
        check_type: Type of check ('network', 'login', 'sudo', 'admin')
        
    Returns:
        Error code if known, None otherwise
    """
    error_code_map = {
        'network': 1001,  # Нет сетевого доступа
        'login': 1002,    # Неверные учётные данные
        'sudo': 1003,     # Недостаточно прав (sudo)
        'admin': 1003,    # Недостаточно прав (admin access on Windows)
    }
    return error_code_map.get(check_type.lower())


def detect_command_error(exit_code: int, stdout: str, stderr: str) -> Optional[int]:
    """
    Detect error code from command execution result.
    Analyzes exit code and stderr/stdout to determine specific error.
    
    Args:
        exit_code: Command exit code
        stdout: Command stdout
        stderr: Command stderr
        
    Returns:
        Error code if detected, None if command succeeded
    """
    if exit_code == 0:
        return None
    
    # Combine output for analysis
    combined = f"{stdout}\n{stderr}".lower()
    
    # File not found patterns
    file_not_found_patterns = [
        "no such file or directory",
        "нет такого файла или каталога",
        "cannot access",
        "не удаётся получить доступ",
        "not found",
        "file not found",
    ]
    for pattern in file_not_found_patterns:
        if pattern in combined:
            return 2001  # Файл не найден
    
    # Permission denied patterns  
    permission_patterns = [
        "permission denied",
        "отказано в доступе",
        "access denied",
        "operation not permitted",
        "операция не позволена",
    ]
    for pattern in permission_patterns:
        if pattern in combined:
            # Check if it's sudo-related
            if "sudo" in combined or exit_code == 1 and "sudo" in stdout.lower():
                return 1003  # Недостаточно прав (sudo)
            return 2002  # Не хватает прав на файл
    
    # Command not found patterns
    command_not_found_patterns = [
        "command not found",
        "команда не найдена",
        "not recognized as",
        "не является внутренней или внешней командой",
        ": not found",
    ]
    for pattern in command_not_found_patterns:
        if pattern in combined:
            return 3001  # Команда не найдена
    
    # Service not found patterns
    service_not_found_patterns = [
        "service not found",
        "unit not found",
        "could not find unit",
        "no such unit",
        "unknown service",
        "служба не найдена",
    ]
    for pattern in service_not_found_patterns:
        if pattern in combined:
            return 3002  # Служба не найдена
    
    # Service stopped/inactive patterns
    service_stopped_patterns = [
        "inactive (dead)",
        "not running",
        "is stopped",
        "failed to start",
        "службаостановлена",
    ]
    for pattern in service_stopped_patterns:
        if pattern in combined:
            return 3003  # Служба остановлена
    
    # Timeout patterns
    timeout_patterns = [
        "timed out",
        "timeout",
        "connection timed out",
        "превышено время ожидания",
    ]
    for pattern in timeout_patterns:
        if pattern in combined:
            return 3004  # Таймаут выполнения
    
    # File corrupted / wrong format
    format_patterns = [
        "syntax error",
        "parse error",
        "invalid format",
        "malformed",
        "синтаксическая ошибка",
    ]
    for pattern in format_patterns:
        if pattern in combined:
            return 2003  # Файл повреждён
    
    # Generic error - couldn't determine specific cause
    return None


def is_check_failure_code(error_code: int) -> bool:
    """
    Determine if error code indicates a check failure (not technical error).
    
    Check failures (4xxx codes) should have status "Не пройдена"
    Technical errors (1xxx, 2xxx, 3xxx, 5xxx) should have status "Ошибка"
    
    Args:
        error_code: Error code number
        
    Returns:
        True if this is a check failure (4xxx), False for technical errors
    """
    return 4000 <= error_code < 5000
