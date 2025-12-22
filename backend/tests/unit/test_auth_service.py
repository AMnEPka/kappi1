"""
Unit tests for authentication and security services
Tests: JWT tokens, password hashing, user authentication
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException

from config.config_security import (
    hash_password,
    verify_password,
    create_access_token,
    decode_token,
    encrypt_password,
    decrypt_password
)
from services.services_auth import (
    get_current_user_from_token,
    get_user_permissions,
    has_permission,
    require_permission,
    can_access_project
)
from models.auth_models import User


class TestPasswordHashing:
    """Tests for password hashing functions"""
    
    @pytest.mark.unit
    def test_hash_password_creates_hash(self):
        """Test that hash_password creates a valid hash"""
        password = "TestPassword123!"
        hashed = hash_password(password)
        
        assert hashed != password
        assert len(hashed) > 0
        assert hashed.startswith("$2b$")  # bcrypt hash format
    
    @pytest.mark.unit
    def test_verify_password_correct(self):
        """Test that verify_password returns True for correct password"""
        password = "TestPassword123!"
        hashed = hash_password(password)
        
        assert verify_password(password, hashed) is True
    
    @pytest.mark.unit
    def test_verify_password_incorrect(self):
        """Test that verify_password returns False for incorrect password"""
        password = "TestPassword123!"
        wrong_password = "WrongPassword123!"
        hashed = hash_password(password)
        
        assert verify_password(wrong_password, hashed) is False
    
    @pytest.mark.unit
    def test_hash_password_different_hashes(self):
        """Test that same password produces different hashes (salt)"""
        password = "TestPassword123!"
        hash1 = hash_password(password)
        hash2 = hash_password(password)
        
        # Hashes should be different due to salt
        assert hash1 != hash2
        # But both should verify correctly
        assert verify_password(password, hash1) is True
        assert verify_password(password, hash2) is True


class TestJWTTokens:
    """Tests for JWT token creation and validation"""
    
    @pytest.mark.unit
    def test_create_access_token(self):
        """Test that create_access_token creates a valid token"""
        data = {"sub": "user-123", "username": "testuser"}
        token = create_access_token(data)
        
        assert token is not None
        assert isinstance(token, str)
        assert len(token) > 0
    
    @pytest.mark.unit
    def test_decode_token_valid(self):
        """Test that decode_token correctly decodes a valid token"""
        data = {"sub": "user-123", "username": "testuser"}
        token = create_access_token(data)
        decoded = decode_token(token)
        
        assert decoded["sub"] == "user-123"
        assert decoded["username"] == "testuser"
        assert "exp" in decoded  # Expiration should be added
    
    @pytest.mark.unit
    def test_decode_token_invalid(self):
        """Test that decode_token raises exception for invalid token"""
        invalid_token = "invalid.token.here"
        
        with pytest.raises(Exception):  # jwt.decode raises JWTError
            decode_token(invalid_token)
    
    @pytest.mark.unit
    def test_token_expiration(self):
        """Test that token includes expiration time"""
        data = {"sub": "user-123"}
        token = create_access_token(data)
        decoded = decode_token(token)
        
        assert "exp" in decoded
        exp_time = datetime.fromtimestamp(decoded["exp"], tz=timezone.utc)
        assert exp_time > datetime.now(timezone.utc)
    
    @pytest.mark.unit
    def test_token_custom_expiration(self):
        """Test that token can have custom expiration"""
        data = {"sub": "user-123"}
        expires_delta = timedelta(hours=1)
        token = create_access_token(data, expires_delta=expires_delta)
        decoded = decode_token(token)
        
        exp_time = datetime.fromtimestamp(decoded["exp"], tz=timezone.utc)
        expected_exp = datetime.now(timezone.utc) + expires_delta
        # Allow 5 seconds difference for test execution time
        assert abs((exp_time - expected_exp).total_seconds()) < 5


class TestPasswordEncryption:
    """Tests for password encryption (Fernet)"""
    
    @pytest.mark.unit
    def test_encrypt_password(self):
        """Test that encrypt_password encrypts a password"""
        password = "SecretPassword123!"
        encrypted = encrypt_password(password)
        
        assert encrypted != password
        assert len(encrypted) > 0
    
    @pytest.mark.unit
    def test_decrypt_password(self):
        """Test that decrypt_password correctly decrypts encrypted password"""
        password = "SecretPassword123!"
        encrypted = encrypt_password(password)
        decrypted = decrypt_password(encrypted)
        
        assert decrypted == password
    
    @pytest.mark.unit
    def test_encrypt_decrypt_roundtrip(self):
        """Test encrypt/decrypt roundtrip with various passwords"""
        passwords = [
            "SimplePassword",
            "Complex!@#Password123",
            "Пароль с кириллицей",
            "Password with spaces and 123 numbers"
        ]
        
        for password in passwords:
            encrypted = encrypt_password(password)
            decrypted = decrypt_password(encrypted)
            assert decrypted == password


class TestGetCurrentUserFromToken:
    """Tests for get_current_user_from_token function"""
    
    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_get_current_user_from_token_valid(self, mock_db):
        """Test getting user from valid token"""
        # Create test user
        user_data = {
            "id": "user-123",
            "username": "testuser",
            "email": "test@example.com",
            "is_active": True,
            "is_admin": False
        }
        await mock_db.users.insert_one(user_data)
        
        # Create token
        token = create_access_token({"sub": "user-123"})
        
        # Mock db dependency
        with patch('services.services_auth.db', mock_db):
            user = await get_current_user_from_token(token)
            
            assert user.id == "user-123"
            assert user.username == "testuser"
    
    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_get_current_user_from_token_invalid_token(self):
        """Test that invalid token raises HTTPException"""
        invalid_token = "invalid.token"
        
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user_from_token(invalid_token)
        
        assert exc_info.value.status_code == 401
    
    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_get_current_user_from_token_user_not_found(self, mock_db):
        """Test that non-existent user raises HTTPException"""
        token = create_access_token({"sub": "non-existent-user"})
        
        with patch('services.services_auth.db', mock_db):
            with pytest.raises(HTTPException) as exc_info:
                await get_current_user_from_token(token)
            
            assert exc_info.value.status_code == 401


class TestUserPermissions:
    """Tests for user permissions and RBAC"""
    
    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_get_user_permissions_admin(self, mock_db):
        """Test that admin user gets all permissions from PERMISSIONS dict"""
        from config.config_settings import PERMISSIONS
        
        # Create admin user
        admin_user = User(
            id="admin-1",
            username="admin",
            is_admin=True
        )
        
        # Admin should get ALL permissions from PERMISSIONS dict,
        # regardless of what roles exist in the database
        with patch('services.services_auth.db', mock_db):
            permissions = await get_user_permissions(admin_user)
            
            # Admin should have all system permissions
            for perm in PERMISSIONS.keys():
                assert perm in permissions
            
            # The count should match exactly
            assert len(permissions) == len(PERMISSIONS)
    
    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_get_user_permissions_regular_user(self, mock_db):
        """Test that regular user gets permissions from assigned roles"""
        # Create regular user
        user = User(
            id="user-1",
            username="testuser",
            is_admin=False
        )
        
        # Create roles
        await mock_db.roles.insert_many([
            {"id": "role-1", "permissions": ["perm1", "perm2"]},
            {"id": "role-2", "permissions": ["perm3"]}
        ])
        
        # Assign roles to user
        await mock_db.user_roles.insert_many([
            {"user_id": "user-1", "role_id": "role-1"},
            {"user_id": "user-1", "role_id": "role-2"}
        ])
        
        with patch('services.services_auth.db', mock_db):
            permissions = await get_user_permissions(user)
            
            assert "perm1" in permissions
            assert "perm2" in permissions
            assert "perm3" in permissions
    
    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_get_user_permissions_no_roles(self, mock_db):
        """Test that user with no roles has no permissions"""
        user = User(
            id="user-1",
            username="testuser",
            is_admin=False
        )
        
        with patch('services.services_auth.db', mock_db):
            permissions = await get_user_permissions(user)
            
            assert permissions == []
    
    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_has_permission_true(self, mock_db):
        """Test has_permission returns True when user has permission"""
        user = User(id="user-1", username="testuser", is_admin=False)
        
        await mock_db.roles.insert_one({"id": "role-1", "permissions": ["test_perm"]})
        await mock_db.user_roles.insert_one({"user_id": "user-1", "role_id": "role-1"})
        
        with patch('services.services_auth.db', mock_db):
            result = await has_permission(user, "test_perm")
            assert result is True
    
    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_has_permission_false(self, mock_db):
        """Test has_permission returns False when user lacks permission"""
        user = User(id="user-1", username="testuser", is_admin=False)
        
        with patch('services.services_auth.db', mock_db):
            result = await has_permission(user, "test_perm")
            assert result is False
    
    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_require_permission_success(self, mock_db):
        """Test require_permission doesn't raise when user has permission"""
        user = User(id="user-1", username="testuser", is_admin=False)
        
        await mock_db.roles.insert_one({"id": "role-1", "permissions": ["test_perm"]})
        await mock_db.user_roles.insert_one({"user_id": "user-1", "role_id": "role-1"})
        
        with patch('services.services_auth.db', mock_db):
            # Should not raise
            await require_permission(user, "test_perm")
    
    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_require_permission_failure(self, mock_db):
        """Test require_permission raises 403 when user lacks permission"""
        user = User(id="user-1", username="testuser", is_admin=False)
        
        with patch('services.services_auth.db', mock_db):
            with pytest.raises(HTTPException) as exc_info:
                await require_permission(user, "test_perm")
            
            assert exc_info.value.status_code == 403


class TestProjectAccess:
    """Tests for project access control"""
    
    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_can_access_project_admin(self, mock_db):
        """Test that admin can access any project"""
        admin_user = User(id="admin-1", username="admin", is_admin=True)
        
        with patch('services.services_auth.db', mock_db):
            result = await can_access_project(admin_user, "any-project-id")
            assert result is True
    
    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_can_access_project_creator(self, mock_db):
        """Test that project creator can access project"""
        user = User(id="user-1", username="testuser", is_admin=False)
        
        await mock_db.projects.insert_one({
            "id": "project-1",
            "created_by": "user-1"
        })
        
        with patch('services.services_auth.db', mock_db):
            result = await can_access_project(user, "project-1")
            assert result is True
    
    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_can_access_project_shared(self, mock_db):
        """Test that user with shared access can access project"""
        user = User(id="user-1", username="testuser", is_admin=False)
        
        await mock_db.project_access.insert_one({
            "project_id": "project-1",
            "user_id": "user-1"
        })
        
        with patch('services.services_auth.db', mock_db):
            result = await can_access_project(user, "project-1")
            assert result is True
    
    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_can_access_project_denied(self, mock_db):
        """Test that user without access cannot access project"""
        user = User(id="user-1", username="testuser", is_admin=False)
        
        with patch('services.services_auth.db', mock_db):
            result = await can_access_project(user, "project-1")
            assert result is False

