"""
Example unit test to verify test infrastructure is working
This file can be removed once real tests are written
"""
import pytest
from tests.fixtures.builders import UserBuilder, HostBuilder


@pytest.mark.unit
def test_example_unit_test():
    """Simple test to verify pytest is working"""
    assert 1 + 1 == 2


@pytest.mark.unit
def test_user_builder():
    """Test UserBuilder fixture"""
    user = UserBuilder().with_username("testuser").as_admin().build()
    assert user["username"] == "testuser"
    assert user["is_admin"] is True
    assert user["role"] == "admin"


@pytest.mark.unit
def test_host_builder():
    """Test HostBuilder fixture"""
    host = HostBuilder().with_name("test-server").as_windows().build()
    assert host["name"] == "test-server"
    assert host["connection_type"] == "winrm"
    assert host["port"] == 5985


@pytest.mark.asyncio
@pytest.mark.unit
async def test_mock_db_fixture(mock_db):
    """Test that mock_db fixture works"""
    # Insert a test document
    await mock_db.users.insert_one({"username": "test", "email": "test@test.com"})
    
    # Retrieve it
    user = await mock_db.users.find_one({"username": "test"})
    
    assert user is not None
    assert user["username"] == "test"
    assert user["email"] == "test@test.com"

