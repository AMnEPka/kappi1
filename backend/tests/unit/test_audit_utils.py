"""
Unit tests for audit logging utilities
Tests: Audit log creation and persistence
"""
import pytest
from unittest.mock import patch, AsyncMock
from datetime import datetime, timezone

from utils.audit_utils import log_audit, _persist_audit_log


class TestAuditLogging:
    """Tests for audit logging functions"""
    
    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_persist_audit_log(self, mock_db):
        """Test that audit log is persisted to database"""
        entry = {
            "event": "test_event",
            "user_id": "user-1",
            "username": "testuser",
            "details": {"action": "test"}
        }
        
        await _persist_audit_log(entry)
        
        # Verify log was saved
        logs = await mock_db.audit_logs.find({}).to_list(None)
        assert len(logs) == 1
        assert logs[0]["event"] == "test_event"
        assert logs[0]["user_id"] == "user-1"
        assert "id" in logs[0]
        assert "created_at" in logs[0]
    
    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_persist_audit_log_creates_id(self, mock_db):
        """Test that audit log gets unique ID"""
        entry = {"event": "test_event"}
        
        await _persist_audit_log(entry)
        
        logs = await mock_db.audit_logs.find({}).to_list(None)
        assert logs[0]["id"] is not None
        assert isinstance(logs[0]["id"], str)
        assert len(logs[0]["id"]) > 0
    
    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_persist_audit_log_adds_timestamp(self, mock_db):
        """Test that audit log gets timestamp"""
        entry = {"event": "test_event"}
        
        await _persist_audit_log(entry)
        
        logs = await mock_db.audit_logs.find({}).to_list(None)
        assert "created_at" in logs[0]
        assert isinstance(logs[0]["created_at"], str)  # ISO format
    
    @pytest.mark.unit
    def test_log_audit_basic(self, mock_db):
        """Test basic audit logging"""
        with patch('utils.audit_utils.db', mock_db):
            log_audit("test_event", user_id="user-1", username="testuser")
            
            # Note: log_audit is async in nature, but we can't easily test it synchronously
            # This test verifies the function doesn't raise errors
    
    @pytest.mark.unit
    def test_log_audit_with_details(self, mock_db):
        """Test audit logging with details"""
        with patch('utils.audit_utils.db', mock_db):
            details = {
                "action": "create",
                "resource": "host",
                "resource_id": "host-1"
            }
            log_audit(
                "resource_created",
                user_id="user-1",
                username="testuser",
                details=details
            )
    
    @pytest.mark.unit
    def test_log_audit_without_user(self, mock_db):
        """Test audit logging without user information"""
        with patch('utils.audit_utils.db', mock_db):
            log_audit("system_event", details={"message": "System started"})
    
    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_audit_log_structure(self, mock_db):
        """Test that audit log has correct structure"""
        entry = {
            "event": "login_success",
            "user_id": "user-1",
            "username": "testuser",
            "details": {
                "ip_address": "192.168.1.100",
                "user_agent": "Mozilla/5.0"
            },
            "level": "INFO"
        }
        
        await _persist_audit_log(entry)
        
        logs = await mock_db.audit_logs.find({}).to_list(None)
        log = logs[0]
        
        assert log["event"] == "login_success"
        assert log["user_id"] == "user-1"
        assert log["username"] == "testuser"
        assert log["details"]["ip_address"] == "192.168.1.100"
        assert log["level"] == "INFO"
        assert "id" in log
        assert "created_at" in log

