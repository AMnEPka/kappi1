"""Database utility functions for MongoDB serialization"""

import base64
from datetime import datetime
from typing import Dict, Any, List, Optional


def prepare_for_mongo(data: dict) -> dict:
    """Prepare data for MongoDB storage
    
    Converts datetime objects to ISO format strings for storage.
    Handles both individual datetime fields and lists of datetimes.
    
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
    return prepared


def parse_from_mongo(item: dict) -> dict:
    """Parse data from MongoDB
    
    Converts ISO format strings back to datetime objects.
    Handles both individual datetime fields and lists of datetimes.
    
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


def encode_script_for_storage(data: dict) -> dict:
    """Encode script content and processor_script fields for MongoDB storage
    
    Args:
        data: Dictionary containing script data
        
    Returns:
        Dictionary with content and processor_script Base64 encoded
    """
    encoded = data.copy()
    if 'content' in encoded and encoded['content']:
        encoded['content'] = encode_script_content(encoded['content'])
    if 'processor_script' in encoded and encoded['processor_script']:
        encoded['processor_script'] = encode_script_content(encoded['processor_script'])
    return encoded


def decode_script_from_storage(data: dict) -> dict:
    """Decode script content and processor_script fields from MongoDB
    
    Args:
        data: Dictionary containing script data from MongoDB
        
    Returns:
        Dictionary with content and processor_script decoded from Base64
    """
    decoded = data.copy()
    if 'content' in decoded:
        decoded['content'] = decode_script_content(decoded.get('content'))
    if 'processor_script' in decoded:
        decoded['processor_script'] = decode_script_content(decoded.get('processor_script'))
    return decoded
