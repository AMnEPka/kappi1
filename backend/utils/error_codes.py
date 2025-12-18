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
        "error": "Отказано в доступе",
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
        "description": "Непредвиденная ошибка в скрипте"
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

