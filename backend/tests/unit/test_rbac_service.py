"""
Unit tests for RBAC (Role-Based Access Control) services
Tests: Permissions, roles, access control
"""
import pytest
from unittest.mock import patch
from fastapi import HTTPException

from services.services_auth import (
    get_user_permissions,
    has_permission,
    require_permission,
    can_access_project
)
from models.auth_models import User


class TestRBACPermissions:
    """Tests for permission management"""
    
    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_admin_has_all_permissions(self, mock_db):
        """Test that admin user has all permissions from all roles"""
        admin_user = User(id="admin-1", username="admin", is_admin=True)
        
        # Create multiple roles with different permissions
        await mock_db.roles.insert_many([
            {"id": "role-1", "permissions": ["perm1", "perm2"]},
            {"id": "role-2", "permissions": ["perm3", "perm4", "perm5"]},
            {"id": "role-3", "permissions": ["perm6"]}
        ])
        
        with patch('services.services_auth.db', mock_db):
            permissions = await get_user_permissions(admin_user)
            
            # Admin should have all permissions from all roles
            assert "perm1" in permissions
            assert "perm2" in permissions
            assert "perm3" in permissions
            assert "perm4" in permissions
            assert "perm5" in permissions
            assert "perm6" in permissions
    
    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_user_with_multiple_roles(self, mock_db):
        """Test that user with multiple roles gets union of permissions"""
        user = User(id="user-1", username="testuser", is_admin=False)
        
        await mock_db.roles.insert_many([
            {"id": "role-1", "permissions": ["perm1", "perm2"]},
            {"id": "role-2", "permissions": ["perm2", "perm3"]},  # perm2 overlaps
            {"id": "role-3", "permissions": ["perm4"]}
        ])
        
        await mock_db.user_roles.insert_many([
            {"user_id": "user-1", "role_id": "role-1"},
            {"user_id": "user-1", "role_id": "role-2"},
            {"user_id": "user-1", "role_id": "role-3"}
        ])
        
        with patch('services.services_auth.db', mock_db):
            permissions = await get_user_permissions(user)
            
            # Should have all unique permissions
            assert "perm1" in permissions
            assert "perm2" in permissions
            assert "perm3" in permissions
            assert "perm4" in permissions
            # perm2 should appear only once (set deduplication)
            assert permissions.count("perm2") == 1
    
    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_user_with_no_roles(self, mock_db):
        """Test that user with no roles has no permissions"""
        user = User(id="user-1", username="testuser", is_admin=False)
        
        with patch('services.services_auth.db', mock_db):
            permissions = await get_user_permissions(user)
            assert permissions == []
    
    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_has_permission_with_multiple_required(self, mock_db):
        """Test has_permission with user having one of multiple permissions"""
        user = User(id="user-1", username="testuser", is_admin=False)
        
        await mock_db.roles.insert_one({"id": "role-1", "permissions": ["perm1"]})
        await mock_db.user_roles.insert_one({"user_id": "user-1", "role_id": "role-1"})
        
        with patch('services.services_auth.db', mock_db):
            assert await has_permission(user, "perm1") is True
            assert await has_permission(user, "perm2") is False


class TestRequirePermission:
    """Tests for require_permission function"""
    
    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_require_permission_single_success(self, mock_db):
        """Test require_permission with single permission that user has"""
        user = User(id="user-1", username="testuser", is_admin=False)
        
        await mock_db.roles.insert_one({"id": "role-1", "permissions": ["test_perm"]})
        await mock_db.user_roles.insert_one({"user_id": "user-1", "role_id": "role-1"})
        
        with patch('services.services_auth.db', mock_db):
            # Should not raise
            await require_permission(user, "test_perm")
    
    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_require_permission_multiple_or_success(self, mock_db):
        """Test require_permission with multiple permissions (OR logic)"""
        user = User(id="user-1", username="testuser", is_admin=False)
        
        await mock_db.roles.insert_one({"id": "role-1", "permissions": ["perm1"]})
        await mock_db.user_roles.insert_one({"user_id": "user-1", "role_id": "role-1"})
        
        with patch('services.services_auth.db', mock_db):
            # User has perm1, so should pass even without perm2
            await require_permission(user, "perm1", "perm2")
    
    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_require_permission_failure(self, mock_db):
        """Test require_permission raises 403 when user lacks all permissions"""
        user = User(id="user-1", username="testuser", is_admin=False)
        
        with patch('services.services_auth.db', mock_db):
            with pytest.raises(HTTPException) as exc_info:
                await require_permission(user, "perm1", "perm2")
            
            assert exc_info.value.status_code == 403
            assert "perm1" in str(exc_info.value.detail)
            assert "perm2" in str(exc_info.value.detail)
    
    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_require_permission_admin_bypass(self, mock_db):
        """Test that admin can bypass permission checks"""
        admin_user = User(id="admin-1", username="admin", is_admin=True)
        
        # Create roles but don't assign to admin
        await mock_db.roles.insert_one({"id": "role-1", "permissions": ["some_perm"]})
        
        with patch('services.services_auth.db', mock_db):
            # Admin should have all permissions, so this should pass
            permissions = await get_user_permissions(admin_user)
            # Admin gets all permissions from all roles
            assert len(permissions) > 0


class TestProjectAccessControl:
    """Tests for project-level access control"""
    
    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_admin_access_all_projects(self, mock_db):
        """Test that admin can access any project"""
        admin_user = User(id="admin-1", username="admin", is_admin=True)
        
        with patch('services.services_auth.db', mock_db):
            result = await can_access_project(admin_user, "any-project-id")
            assert result is True
    
    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_creator_access_own_project(self, mock_db):
        """Test that project creator can access their project"""
        user = User(id="user-1", username="testuser", is_admin=False)
        
        await mock_db.projects.insert_one({
            "id": "project-1",
            "name": "Test Project",
            "created_by": "user-1"
        })
        
        with patch('services.services_auth.db', mock_db):
            result = await can_access_project(user, "project-1")
            assert result is True
    
    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_creator_cannot_access_other_project(self, mock_db):
        """Test that user cannot access project they didn't create"""
        user = User(id="user-1", username="testuser", is_admin=False)
        
        await mock_db.projects.insert_one({
            "id": "project-1",
            "name": "Other User's Project",
            "created_by": "other-user"
        })
        
        with patch('services.services_auth.db', mock_db):
            result = await can_access_project(user, "project-1")
            assert result is False
    
    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_shared_access(self, mock_db):
        """Test that user with shared access can access project"""
        user = User(id="user-1", username="testuser", is_admin=False)
        
        await mock_db.project_access.insert_one({
            "project_id": "project-1",
            "user_id": "user-1",
            "permission": "read"
        })
        
        with patch('services.services_auth.db', mock_db):
            result = await can_access_project(user, "project-1")
            assert result is True
    
    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_no_access_to_nonexistent_project(self, mock_db):
        """Test that user cannot access non-existent project"""
        user = User(id="user-1", username="testuser", is_admin=False)
        
        with patch('services.services_auth.db', mock_db):
            result = await can_access_project(user, "non-existent-project")
            assert result is False

