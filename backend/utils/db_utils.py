"""Database utility functions for MongoDB serialization"""

import base64
from datetime import datetime
from typing import Dict, Any, List, Optional


def prepare_for_mongo(data: dict) -> dict:
    """Prepare data for MongoDB storage
    
    Converts datetime objects to ISO format strings for storage.
    Handles both individual datetime fields and lists of datetimes.
    Also handles nested datetimes in processor_script_version and processor_script_versions.
    
    Args:
        data: Dictionary containing data to be stored in MongoDB
        
    Returns:
        Dictionary with datetime objects converted to ISO strings
    """
    prepared = data.copy()
    for field in ["created_at", "updated_at", "executed_at", "next_run_at", "last_run_at", "started_at", "finished_at"]:
        if isinstance(prepared.get(field), datetime):
            prepared[field] = prepared[field].isoformat()
    if isinstance(prepared.get("run_times"), list):
        prepared["run_times"] = [
            value.isoformat() if isinstance(value, datetime) else value
            for value in prepared["run_times"]
        ]
    
    # Обработка вложенных datetime в processor_script_version
    if 'processor_script_version' in prepared and isinstance(prepared['processor_script_version'], dict):
        version = prepared['processor_script_version'].copy()
        if 'created_at' in version and isinstance(version['created_at'], datetime):
            version['created_at'] = version['created_at'].isoformat()
        prepared['processor_script_version'] = version
    
    # Обработка вложенных datetime в processor_script_versions (список версий)
    if 'processor_script_versions' in prepared and isinstance(prepared['processor_script_versions'], list):
        versions = []
        for version in prepared['processor_script_versions']:
            if isinstance(version, dict):
                version_copy = version.copy()
                if 'created_at' in version_copy and isinstance(version_copy['created_at'], datetime):
                    version_copy['created_at'] = version_copy['created_at'].isoformat()
                versions.append(version_copy)
            else:
                versions.append(version)
        prepared['processor_script_versions'] = versions
    
    return prepared


def parse_from_mongo(item: dict) -> dict:
    """Parse data from MongoDB
    
    Converts ISO format strings back to datetime objects.
    Handles both individual datetime fields and lists of datetimes.
    Also handles nested datetime strings in processor_script_version and processor_script_versions.
    
    Args:
        item: Dictionary retrieved from MongoDB
        
    Returns:
        Dictionary with ISO strings converted to datetime objects
    """
    parsed = item.copy()
    for field in ["created_at", "updated_at", "executed_at", "next_run_at", "last_run_at", "started_at", "finished_at"]:
        if isinstance(parsed.get(field), str):
            parsed[field] = datetime.fromisoformat(parsed[field])
    if isinstance(parsed.get("run_times"), list):
        parsed["run_times"] = [
            datetime.fromisoformat(value) if isinstance(value, str) else value
            for value in parsed["run_times"]
        ]
    
    # Обработка вложенных datetime строк в processor_script_version
    if 'processor_script_version' in parsed and isinstance(parsed['processor_script_version'], dict):
        version = parsed['processor_script_version'].copy()
        if 'created_at' in version and isinstance(version['created_at'], str):
            version['created_at'] = datetime.fromisoformat(version['created_at'])
        parsed['processor_script_version'] = version
    
    # Обработка вложенных datetime строк в processor_script_versions (список версий)
    if 'processor_script_versions' in parsed and isinstance(parsed['processor_script_versions'], list):
        versions = []
        for version in parsed['processor_script_versions']:
            if isinstance(version, dict):
                version_copy = version.copy()
                if 'created_at' in version_copy and isinstance(version_copy['created_at'], str):
                    version_copy['created_at'] = datetime.fromisoformat(version_copy['created_at'])
                versions.append(version_copy)
            else:
                versions.append(version)
        parsed['processor_script_versions'] = versions
    
    return parsed


def encode_script_content(content: Optional[str]) -> Optional[str]:
    """Encode script content to Base64 for safe storage
    
    Args:
        content: Script content string to encode
        
    Returns:
        Base64 encoded string, or None if input is None
    """
    if content is None:
        return None
    return base64.b64encode(content.encode('utf-8')).decode('utf-8')


def decode_script_content(encoded_content: Optional[str]) -> Optional[str]:
    """Decode script content from Base64
    
    Args:
        encoded_content: Base64 encoded string to decode
        
    Returns:
        Decoded string, or None if input is None or empty
        
    Raises:
        ValueError: If the content is not valid Base64
    """
    if not encoded_content:
        return None
    
    # Try to decode - if it fails, assume it's already decoded (backward compatibility)
    try:
        return base64.b64decode(encoded_content.encode('utf-8')).decode('utf-8')
    except (ValueError, UnicodeDecodeError):
        # If decoding fails, assume it's already in plain text (for backward compatibility)
        return encoded_content


def sanitize_script_content(content: str) -> str:
    """Remove any syntax highlighting markers that might have been accidentally saved.
    
    These markers are used only for frontend display and should never be in stored data.
    """
    import re
    if not content:
        return content
    
    # Remove markers like ___COMMENT___0___, ___STRING_SINGLE___11___, etc.
    marker_patterns = [
        r'___COMMENT___\d+___',
        r'___STRING_SINGLE___\d+___',
        r'___STRING_DOUBLE___\d+___',
        r'___VARIABLE___\d+___',
        r'___KEYWORD___\d+___',
        r'___OPERATOR___\d+___',
        r'___NUMBER___\d+___',
    ]
    
    sanitized = content
    for pattern in marker_patterns:
        sanitized = re.sub(pattern, '', sanitized)
    
    return sanitized


def encode_script_for_storage(data: dict) -> dict:
    """Encode script content and processor_script fields for MongoDB storage
    
    Args:
        data: Dictionary containing script data
        
    Returns:
        Dictionary with content and processor_script Base64 encoded
    """
    encoded = data.copy()
    
    # Sanitize before encoding to remove any accidental markers
    if 'content' in encoded and encoded['content']:
        encoded['content'] = sanitize_script_content(encoded['content'])
        encoded['content'] = encode_script_content(encoded['content'])
    
    # Обработка processor_script (для обратной совместимости)
    if 'processor_script' in encoded and encoded['processor_script']:
        encoded['processor_script'] = sanitize_script_content(encoded['processor_script'])
        encoded['processor_script'] = encode_script_content(encoded['processor_script'])
    
    # Обработка версий processor_script
    if 'processor_script_version' in encoded and encoded['processor_script_version']:
        version = encoded['processor_script_version']
        if isinstance(version, dict) and 'content' in version:
            version = version.copy()
            version['content'] = sanitize_script_content(version.get('content'))
            version['content'] = encode_script_content(version['content'])
            encoded['processor_script_version'] = version
    
    if 'processor_script_versions' in encoded and encoded['processor_script_versions']:
        versions = []
        for version in encoded['processor_script_versions']:
            if isinstance(version, dict) and 'content' in version:
                version_copy = version.copy()
                version_copy['content'] = sanitize_script_content(version_copy.get('content'))
                version_copy['content'] = encode_script_content(version_copy['content'])
                versions.append(version_copy)
            else:
                versions.append(version)
        encoded['processor_script_versions'] = versions
    
    return encoded


def decode_script_from_storage(data: dict) -> dict:
    """Decode script content and processor_script fields from MongoDB
    
    Args:
        data: Dictionary containing script data from MongoDB
        
    Returns:
        Dictionary with content and processor_script decoded from Base64
        Также обеспечивает обратную совместимость: если есть processor_script_version,
        то processor_script берется из него
    """
    decoded = data.copy()
    if 'content' in decoded:
        decoded['content'] = decode_script_content(decoded.get('content'))
    
    # Обработка версий processor_script
    if 'processor_script_version' in decoded and decoded['processor_script_version']:
        version = decoded['processor_script_version']
        if isinstance(version, dict) and 'content' in version:
            version = version.copy()
            version['content'] = decode_script_content(version.get('content'))
            decoded['processor_script_version'] = version
            # Для обратной совместимости: устанавливаем processor_script из текущей версии
            if 'processor_script' not in decoded or not decoded.get('processor_script'):
                decoded['processor_script'] = version.get('content')
    
    if 'processor_script_versions' in decoded and decoded['processor_script_versions']:
        versions = []
        for version in decoded['processor_script_versions']:
            if isinstance(version, dict) and 'content' in version:
                version_copy = version.copy()
                version_copy['content'] = decode_script_content(version_copy.get('content'))
                versions.append(version_copy)
            else:
                versions.append(version)
        decoded['processor_script_versions'] = versions
    
    # Обработка processor_script для обратной совместимости (старые скрипты без версий)
    if 'processor_script' in decoded:
        decoded['processor_script'] = decode_script_content(decoded.get('processor_script'))
    
    return decoded


def prepare_processor_script_version_update(
    script_data: dict,
    new_content: Optional[str],
    comment: Optional[str],
    create_new_version: bool,
    user_id: str
) -> dict:
    """Подготовка обновления версии processor_script
    
    Args:
        script_data: Текущие данные скрипта из БД
        new_content: Новое содержимое скрипта (если None, версия не меняется)
        comment: Комментарий к новой версии
        create_new_version: Создать новую версию или обновить текущую
        user_id: ID пользователя, создающего версию
        
    Returns:
        Словарь с обновленными данными для сохранения в БД
    """
    from datetime import datetime, timezone
    
    # Если нового содержимого нет, ничего не меняем
    if new_content is None:
        return {}
    
    # Декодируем текущие данные для работы
    decoded_data = decode_script_from_storage(script_data.copy())
    
    current_version = decoded_data.get('processor_script_version')
    versions_history = decoded_data.get('processor_script_versions', [])
    
    # Если нет текущей версии, создаем первую
    if not current_version:
        new_version = {
            'content': new_content,
            'version_number': 1,
            'comment': comment or 'Первая версия',
            'created_at': datetime.now(timezone.utc),
            'created_by': user_id
        }
        return {
            'processor_script_version': new_version,
            'processor_script_versions': []
        }
    
    # Проверяем, изменилось ли содержимое
    current_content = current_version.get('content', '')
    if current_content == new_content:
        # Содержимое не изменилось, не создаем новую версию
        return {}
    
    # Если нужно создать новую версию
    if create_new_version:
        # Сохраняем текущую версию в историю
        new_history = [current_version.copy()] + versions_history
        
        # Находим максимальный номер версии из всех версий (текущей + истории)
        all_version_numbers = []
        if current_version:
            all_version_numbers.append(current_version.get('version_number', 0))
        for hist_version in versions_history:
            all_version_numbers.append(hist_version.get('version_number', 0))
        
        # Создаем новую версию с номером = максимальный + 1
        max_version_number = max(all_version_numbers) if all_version_numbers else 0
        new_version_number = max_version_number + 1
        
        new_version = {
            'content': new_content,
            'version_number': new_version_number,
            'comment': comment or f'Версия {new_version_number}',
            'created_at': datetime.now(timezone.utc),
            'created_by': user_id
        }
        
        return {
            'processor_script_version': new_version,
            'processor_script_versions': new_history
        }
    else:
        # Обновляем текущую версию без создания новой
        updated_version = current_version.copy()
        updated_version['content'] = new_content
        if comment:
            updated_version['comment'] = comment
        updated_version['created_at'] = datetime.now(timezone.utc)
        updated_version['created_by'] = user_id
        
        return {
            'processor_script_version': updated_version
        }
