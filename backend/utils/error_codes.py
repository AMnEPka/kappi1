"""
utils/error_codes.py
Error codes and descriptions for script execution errors
This file mirrors the frontend errorCodes.js for consistency
"""

from typing import Optional

ERROR_CODES = {
    11: {
        "category": "Подключение",
        "error": "Нет сетевого доступа",
        "description": "Недоступен сервер или порт"
    },
    12: {
        "category": "Аутентификация",
        "error": "Неверные учётные данные",
        "description": "Ошибка при входе (логин/пароль/SSH-ключ)"
    },
    13: {
        "category": "Авторизация",
        "error": "Недостаточно прав (sudo)",
        "description": "Нет полномочий на выполнение команды"
    },
    14: {
        "category": "Авторизация",
        "error": "Отказано в доступе к файлу",
        "description": "Генерал permission denied"
    },
    21: {
        "category": "Файловая система",
        "error": "Файл не найден",
        "description": "Нет такого файла или директории"
    },
    22: {
        "category": "Файловая система",
        "error": "Не хватает прав на файл",
        "description": "Недостаточные права доступа к файлу"
    },
    23: {
        "category": "Файловая система",
        "error": "Файл повреждён",
        "description": "Файл недоступен или в неправильном формате"
    },
    31: {
        "category": "Процессы/команды",
        "error": "Команда не найдена",
        "description": "Нет такой команды в системе"
    },
    32: {
        "category": "Сервисы",
        "error": "Служба не найдена",
        "description": "Нет такой системной службы"
    },
    33: {
        "category": "Сервисы",
        "error": "Служба остановлена",
        "description": "Служба недоступна/не запущена"
    },
    34: {
        "category": "Процессы",
        "error": "Таймаут выполнения",
        "description": "Команда превысила время выполнения"
    },
    41: {
        "category": "Конфигурация",
        "error": "Строка не найдена",
        "description": "Искомая строка отсутствует в файле"
    },
    42: {
        "category": "Конфигурация",
        "error": "Строка закомментирована",
        "description": "Строка есть, но отключена (закомментирована)"
    },
    43: {
        "category": "Конфигурация",
        "error": "Неверный формат",
        "description": "Синтаксическая ошибка в конфигурации"
    },
    44: {
        "category": "Конфигурация",
        "error": "Неверное значение",
        "description": "Значение параметра не совпадает с эталонным"
    },
    50: {
        "category": "Критическая",
        "error": "Неизвестная ошибка",
        "description": "Непредвиденная ошибка в скрипте-обработчике"
    },
    51: {
        "category": "Критическая",
        "error": "Отсутствует переменная",
        "description": "Нет обязательной переменной окружения"
    },
    52: {
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
        'network': 11,  # Нет сетевого доступа
        'login': 12,    # Неверные учётные данные
        'sudo': 13,     # Недостаточно прав (sudo)
        'admin': 13,    # Недостаточно прав (admin access on Windows)
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
    
    # Command not found patterns - CHECK FIRST (before file not found)
    # Exit code 127 typically means "command not found"
    if exit_code == 127:
        return 31  # Команда не найдена
    
    command_not_found_patterns = [
        "command not found",
        "команда не найдена",
        "not recognized as",
        "не является внутренней или внешней командой",
        ": not found",  # bash: command: not found
    ]
    for pattern in command_not_found_patterns:
        if pattern in combined:
            return 31  # Команда не найдена
    
    # File not found patterns - CHECK AFTER command not found
    # Use more specific patterns to avoid false positives
    file_not_found_patterns = [
        "no such file or directory",
        "нет такого файла или каталога",
        "cannot access",
        "не удаётся получить доступ",
        "file not found",  # More specific than just "not found"
    ]
    for pattern in file_not_found_patterns:
        if pattern in combined:
            return 21  # Файл не найден
    
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
                return 13  # Недостаточно прав (sudo)
            return 22  # Не хватает прав на файл
    
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
            return 32  # Служба не найдена
    
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
            return 33  # Служба остановлена
    
    # Timeout patterns
    timeout_patterns = [
        "timed out",
        "timeout",
        "connection timed out",
        "превышено время ожидания",
    ]
    for pattern in timeout_patterns:
        if pattern in combined:
            return 34  # Таймаут выполнения
    
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
            return 23  # Файл повреждён
    
    # Generic error - couldn't determine specific cause
    return None


def is_check_failure_code(error_code: int) -> bool:
    """
    Determine if error code indicates a check failure (not technical error).
    
    Check failures (4x codes) should have status "Не пройдена"
    Technical errors (1x, 2x, 3x, 5x) should have status "Ошибка"
    
    Args:
        error_code: Error code number
        
    Returns:
        True if this is a check failure (40-49), False for technical errors
    """
    return 40 <= error_code < 50
