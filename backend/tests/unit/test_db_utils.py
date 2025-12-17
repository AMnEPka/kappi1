"""
Unit tests for database utility functions
Tests: Base64 encoding/decoding, datetime handling, version management
"""
import pytest
from datetime import datetime, timezone
import base64

from utils.db_utils import (
    prepare_for_mongo,
    parse_from_mongo,
    encode_script_content,
    decode_script_content,
    encode_script_for_storage,
    decode_script_from_storage,
    prepare_processor_script_version_update
)


class TestDateTimeHandling:
    """Tests for datetime conversion in MongoDB operations"""
    
    @pytest.mark.unit
    def test_prepare_for_mongo_datetime(self):
        """Test that datetime objects are converted to ISO strings"""
        now = datetime.now(timezone.utc)
        data = {
            "id": "test-1",
            "name": "Test",
            "created_at": now
        }
        
        prepared = prepare_for_mongo(data)
        
        assert isinstance(prepared["created_at"], str)
        assert prepared["created_at"] == now.isoformat()
        assert prepared["name"] == "Test"  # Other fields unchanged
    
    @pytest.mark.unit
    def test_parse_from_mongo_datetime(self):
        """Test that ISO strings are converted back to datetime"""
        iso_string = datetime.now(timezone.utc).isoformat()
        data = {
            "id": "test-1",
            "name": "Test",
            "created_at": iso_string
        }
        
        parsed = parse_from_mongo(data)
        
        assert isinstance(parsed["created_at"], datetime)
        assert parsed["created_at"].isoformat() == iso_string
    
    @pytest.mark.unit
    def test_prepare_for_mongo_multiple_datetime_fields(self):
        """Test that multiple datetime fields are converted"""
        now = datetime.now(timezone.utc)
        data = {
            "created_at": now,
            "updated_at": now,
            "executed_at": now
        }
        
        prepared = prepare_for_mongo(data)
        
        assert isinstance(prepared["created_at"], str)
        assert isinstance(prepared["updated_at"], str)
        assert isinstance(prepared["executed_at"], str)
    
    @pytest.mark.unit
    def test_prepare_for_mongo_run_times_list(self):
        """Test that datetime list in run_times is converted"""
        times = [
            datetime.now(timezone.utc),
            datetime.now(timezone.utc)
        ]
        data = {
            "run_times": times
        }
        
        prepared = prepare_for_mongo(data)
        
        assert all(isinstance(t, str) for t in prepared["run_times"])
    
    @pytest.mark.unit
    def test_parse_from_mongo_run_times_list(self):
        """Test that ISO string list in run_times is converted back"""
        iso_times = [
            datetime.now(timezone.utc).isoformat(),
            datetime.now(timezone.utc).isoformat()
        ]
        data = {
            "run_times": iso_times
        }
        
        parsed = parse_from_mongo(data)
        
        assert all(isinstance(t, datetime) for t in parsed["run_times"])


class TestBase64Encoding:
    """Tests for Base64 encoding/decoding of script content"""
    
    @pytest.mark.unit
    def test_encode_script_content(self):
        """Test that script content is encoded to Base64"""
        content = "echo 'Hello World'"
        encoded = encode_script_content(content)
        
        assert encoded != content
        assert isinstance(encoded, str)
        # Verify it's valid Base64
        decoded = base64.b64decode(encoded).decode('utf-8')
        assert decoded == content
    
    @pytest.mark.unit
    def test_decode_script_content(self):
        """Test that Base64 encoded content is decoded"""
        content = "echo 'Hello World'"
        encoded = base64.b64encode(content.encode('utf-8')).decode('utf-8')
        
        decoded = decode_script_content(encoded)
        
        assert decoded == content
    
    @pytest.mark.unit
    def test_encode_decode_roundtrip(self):
        """Test encode/decode roundtrip"""
        contents = [
            "echo 'test'",
            "#!/bin/bash\necho 'multi line'",
            "Проверка с кириллицей",
            "Special chars: !@#$%^&*()"
        ]
        
        for content in contents:
            encoded = encode_script_content(content)
            decoded = decode_script_content(encoded)
            assert decoded == content
    
    @pytest.mark.unit
    def test_encode_script_content_none(self):
        """Test that None input returns None"""
        assert encode_script_content(None) is None
    
    @pytest.mark.unit
    def test_decode_script_content_none(self):
        """Test that None input returns None"""
        assert decode_script_content(None) is None
    
    @pytest.mark.unit
    def test_decode_script_content_empty(self):
        """Test that empty string returns None"""
        assert decode_script_content("") is None
    
    @pytest.mark.unit
    def test_decode_script_content_backward_compatibility(self):
        """Test that already decoded content is returned as-is"""
        # If content is not valid Base64, assume it's already decoded
        plain_text = "echo 'already decoded'"
        decoded = decode_script_content(plain_text)
        
        assert decoded == plain_text


class TestScriptStorageEncoding:
    """Tests for script encoding/decoding for storage"""
    
    @pytest.mark.unit
    def test_encode_script_for_storage(self):
        """Test that script content is encoded for storage"""
        data = {
            "id": "script-1",
            "content": "echo 'test'",
            "processor_script": "#!/bin/bash\necho 'processor'"
        }
        
        encoded = encode_script_for_storage(data)
        
        assert encoded["content"] != data["content"]
        assert encoded["processor_script"] != data["processor_script"]
        # Verify they're Base64 encoded
        assert base64.b64decode(encoded["content"]).decode('utf-8') == data["content"]
    
    @pytest.mark.unit
    def test_decode_script_from_storage(self):
        """Test that script content is decoded from storage"""
        content = "echo 'test'"
        processor = "#!/bin/bash\necho 'processor'"
        data = {
            "id": "script-1",
            "content": base64.b64encode(content.encode('utf-8')).decode('utf-8'),
            "processor_script": base64.b64encode(processor.encode('utf-8')).decode('utf-8')
        }
        
        decoded = decode_script_from_storage(data)
        
        assert decoded["content"] == content
        assert decoded["processor_script"] == processor


class TestProcessorScriptVersioning:
    """Tests for processor script version management"""
    
    @pytest.mark.unit
    def test_prepare_first_version(self):
        """Test creating first version of processor script"""
        script_data = {}
        new_content = "echo 'version 1'"
        user_id = "user-1"
        
        result = prepare_processor_script_version_update(
            script_data=script_data,
            new_content=new_content,
            comment="First version",
            create_new_version=False,
            user_id=user_id
        )
        
        assert "processor_script_version" in result
        assert result["processor_script_version"]["version_number"] == 1
        assert result["processor_script_version"]["content"] == new_content
        assert result["processor_script_version"]["comment"] == "First version"
        assert result["processor_script_versions"] == []
    
    @pytest.mark.unit
    def test_prepare_new_version(self):
        """Test creating new version of processor script"""
        script_data = {
            "processor_script_version": {
                "content": "echo 'version 1'",
                "version_number": 1,
                "created_at": datetime.now(timezone.utc).isoformat()
            },
            "processor_script_versions": []
        }
        new_content = "echo 'version 2'"
        user_id = "user-1"
        
        result = prepare_processor_script_version_update(
            script_data=script_data,
            new_content=new_content,
            comment="Updated version",
            create_new_version=True,
            user_id=user_id
        )
        
        assert result["processor_script_version"]["version_number"] == 2
        assert result["processor_script_version"]["content"] == new_content
        assert len(result["processor_script_versions"]) == 1
        assert result["processor_script_versions"][0]["version_number"] == 1
    
    @pytest.mark.unit
    def test_prepare_version_no_change(self):
        """Test that no change is made if content is the same"""
        script_data = {
            "processor_script_version": {
                "content": "echo 'version 1'",
                "version_number": 1
            }
        }
        new_content = "echo 'version 1'"  # Same content
        
        result = prepare_processor_script_version_update(
            script_data=script_data,
            new_content=new_content,
            comment="No change",
            create_new_version=True,
            user_id="user-1"
        )
        
        assert result == {}  # No changes
    
    @pytest.mark.unit
    def test_prepare_version_none_content(self):
        """Test that None content results in no changes"""
        script_data = {
            "processor_script_version": {
                "content": "echo 'version 1'",
                "version_number": 1
            }
        }
        
        result = prepare_processor_script_version_update(
            script_data=script_data,
            new_content=None,
            comment="No change",
            create_new_version=True,
            user_id="user-1"
        )
        
        assert result == {}  # No changes
    
    @pytest.mark.unit
    def test_prepare_version_update_current(self):
        """Test updating current version without creating new"""
        script_data = {
            "processor_script_version": {
                "content": "echo 'version 1'",
                "version_number": 1
            }
        }
        new_content = "echo 'version 1 updated'"
        
        result = prepare_processor_script_version_update(
            script_data=script_data,
            new_content=new_content,
            comment="Updated",
            create_new_version=False,
            user_id="user-1"
        )
        
        assert result["processor_script_version"]["content"] == new_content
        assert result["processor_script_version"]["version_number"] == 1  # Same version
        assert "processor_script_versions" not in result  # No history update

