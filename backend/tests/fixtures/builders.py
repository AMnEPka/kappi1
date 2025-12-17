"""
Test data builders using Factory pattern for creating test data
"""
from typing import Dict, Any, Optional


class UserBuilder:
    """Builder for creating test user data"""
    
    def __init__(self):
        self.data = {
            "username": "testuser",
            "email": "test@example.com",
            "password": "TestPass123!",
            "full_name": "Test User",
            "is_active": True,
            "is_admin": False,
            "role": "user"
        }
    
    def with_username(self, username: str):
        self.data["username"] = username
        return self
    
    def with_email(self, email: str):
        self.data["email"] = email
        return self
    
    def with_password(self, password: str):
        self.data["password"] = password
        return self
    
    def with_role(self, role: str):
        self.data["role"] = role
        return self
    
    def as_admin(self):
        self.data["is_admin"] = True
        self.data["role"] = "admin"
        return self
    
    def as_inactive(self):
        self.data["is_active"] = False
        return self
    
    def build(self) -> Dict[str, Any]:
        return self.data.copy()


class HostBuilder:
    """Builder for creating test host data"""
    
    def __init__(self):
        self.data = {
            "name": "server-01",
            "hostname": "192.168.1.100",
            "port": 22,
            "username": "admin",
            "password": "password123",
            "auth_type": "password",
            "connection_type": "ssh"
        }
    
    def with_name(self, name: str):
        self.data["name"] = name
        return self
    
    def with_hostname(self, hostname: str):
        self.data["hostname"] = hostname
        return self
    
    def with_port(self, port: int):
        self.data["port"] = port
        return self
    
    def with_username(self, username: str):
        self.data["username"] = username
        return self
    
    def as_windows(self):
        self.data["port"] = 5985
        self.data["connection_type"] = "winrm"
        return self
    
    def with_ssh_key(self):
        self.data["auth_type"] = "key"
        self.data.pop("password", None)
        return self
    
    def build(self) -> Dict[str, Any]:
        return self.data.copy()


class ScriptBuilder:
    """Builder for creating test script/check data"""
    
    def __init__(self):
        self.data = {
            "name": "Check iptables",
            "description": "Verify iptables rules",
            "commands": "sudo iptables -L -n",
            "handler_script": "#!/bin/bash\necho 'Passed'",
            "etalon_data": "Chain INPUT (policy ACCEPT)",
            "testing_methodology": "Execute iptables command",
            "success_criteria": "Output contains chain information",
            "order": 1,
            "check_groups": []
        }
    
    def with_name(self, name: str):
        self.data["name"] = name
        return self
    
    def with_commands(self, commands: str):
        self.data["commands"] = commands
        return self
    
    def with_handler_script(self, script: str):
        self.data["handler_script"] = script
        return self
    
    def with_order(self, order: int):
        self.data["order"] = order
        return self
    
    def build(self) -> Dict[str, Any]:
        return self.data.copy()


class ProjectBuilder:
    """Builder for creating test project data"""
    
    def __init__(self):
        self.data = {
            "name": "Test Project",
            "description": "Test project description",
            "hosts": [],
            "tasks": []
        }
    
    def with_name(self, name: str):
        self.data["name"] = name
        return self
    
    def with_description(self, description: str):
        self.data["description"] = description
        return self
    
    def with_hosts(self, host_ids: list):
        self.data["hosts"] = host_ids
        return self
    
    def with_tasks(self, tasks: list):
        self.data["tasks"] = tasks
        return self
    
    def build(self) -> Dict[str, Any]:
        return self.data.copy()

