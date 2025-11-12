#!/usr/bin/env python3
"""
SSH Script Runner Backend API Test Suite - Phase 2 Project System
Tests all CRUD operations for hosts, scripts, executions, and the new Project system
"""

import requests
import sys
import json
import time
from datetime import datetime
from typing import Dict, List, Any

class SSHRunnerAPITester:
    def __init__(self, base_url="https://script-manager-3.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.created_hosts = []
        self.created_scripts = []
        self.created_categories = []
        self.created_systems = []
        self.created_projects = []
        self.created_project_tasks = []
        self.test_results = []

    def log_test(self, name: str, success: bool, details: str = ""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })

    def run_test(self, name: str, method: str, endpoint: str, expected_status: int, data: Dict = None) -> tuple:
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)
            else:
                raise ValueError(f"Unsupported method: {method}")

            success = response.status_code == expected_status
            response_data = {}
            
            try:
                response_data = response.json()
            except:
                response_data = {"raw_response": response.text}

            details = f"Status: {response.status_code}"
            if not success:
                details += f", Expected: {expected_status}, Response: {response.text[:200]}"

            self.log_test(name, success, details)
            return success, response_data

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return False, {}

    def test_hosts_crud(self):
        """Test all host CRUD operations"""
        print("\n🔍 Testing Hosts CRUD Operations...")
        
        # Test 1: Create Linux host with password
        linux_host_data = {
            "name": "Test Linux Server",
            "hostname": "192.168.1.100",
            "port": 22,
            "username": "testuser",
            "auth_type": "password",
            "password": "testpass123",
            "os_type": "linux"
        }
        
        success, response = self.run_test(
            "Create Linux host with password",
            "POST", "hosts", 200, linux_host_data
        )
        
        if success and 'id' in response:
            self.created_hosts.append(response['id'])
            linux_host_id = response['id']
        else:
            linux_host_id = None

        # Test 2: Create Windows host with SSH key
        windows_host_data = {
            "name": "Test Windows Server",
            "hostname": "192.168.1.101",
            "port": 22,
            "username": "administrator",
            "auth_type": "key",
            "ssh_key": "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----",
            "os_type": "windows"
        }
        
        success, response = self.run_test(
            "Create Windows host with SSH key",
            "POST", "hosts", 200, windows_host_data
        )
        
        if success and 'id' in response:
            self.created_hosts.append(response['id'])
            windows_host_id = response['id']
        else:
            windows_host_id = None

        # Test 3: Get all hosts
        success, response = self.run_test(
            "Get all hosts",
            "GET", "hosts", 200
        )
        
        if success and isinstance(response, list):
            self.log_test(f"Verify hosts count (found {len(response)})", len(response) >= 2, "")

        # Test 4: Get specific host
        if linux_host_id:
            success, response = self.run_test(
                "Get specific host by ID",
                "GET", f"hosts/{linux_host_id}", 200
            )

        # Test 5: Update host
        if linux_host_id:
            update_data = {"name": "Updated Linux Server", "port": 2222}
            success, response = self.run_test(
                "Update host",
                "PUT", f"hosts/{linux_host_id}", 200, update_data
            )

        # Test 6: Delete host (we'll keep one for execution tests)
        if windows_host_id:
            success, response = self.run_test(
                "Delete host",
                "DELETE", f"hosts/{windows_host_id}", 200
            )
            if success:
                self.created_hosts.remove(windows_host_id)

    def setup_test_data(self):
        """Setup categories, systems, and scripts needed for project testing"""
        print("\n🔧 Setting up test data (categories, systems, scripts)...")
        
        # Create test category
        category_data = {
            "name": "Test Category",
            "icon": "🧪",
            "description": "Category for testing"
        }
        
        success, response = self.run_test(
            "Create test category",
            "POST", "categories", 200, category_data
        )
        
        if success and 'id' in response:
            self.created_categories.append(response['id'])
            category_id = response['id']
        else:
            self.log_test("Setup failed - no category", False, "Cannot proceed without category")
            return False

        # Create test system
        system_data = {
            "category_id": category_id,
            "name": "Test Linux System",
            "description": "Linux system for testing",
            "os_type": "linux"
        }
        
        success, response = self.run_test(
            "Create test system",
            "POST", "systems", 200, system_data
        )
        
        if success and 'id' in response:
            self.created_systems.append(response['id'])
            system_id = response['id']
        else:
            self.log_test("Setup failed - no system", False, "Cannot proceed without system")
            return False

        # Create test scripts
        scripts_data = [
            {
                "system_id": system_id,
                "name": "System Info Script",
                "description": "Get system information",
                "content": "echo 'System Info Test:'; uname -a; date",
                "order": 1
            },
            {
                "system_id": system_id,
                "name": "Disk Usage Script", 
                "description": "Check disk usage",
                "content": "echo 'Disk Usage Test:'; df -h",
                "order": 2
            },
            {
                "system_id": system_id,
                "name": "Memory Info Script",
                "description": "Check memory usage", 
                "content": "echo 'Memory Test:'; free -m",
                "order": 3
            }
        ]
        
        for script_data in scripts_data:
            success, response = self.run_test(
                f"Create script: {script_data['name']}",
                "POST", "scripts", 200, script_data
            )
            
            if success and 'id' in response:
                self.created_scripts.append(response['id'])

        return len(self.created_scripts) >= 2  # Need at least 2 scripts for testing

    def test_scripts_crud(self):
        """Test all script CRUD operations"""
        print("\n🔍 Testing Scripts CRUD Operations...")
        
        if not self.created_scripts:
            self.log_test("Skip script CRUD test", False, "No scripts available from setup")
            return

        script_id = self.created_scripts[0]

        # Test 1: Get all scripts
        success, response = self.run_test(
            "Get all scripts",
            "GET", "scripts", 200
        )
        
        if success and isinstance(response, list):
            self.log_test(f"Verify scripts count (found {len(response)})", len(response) >= 2, "")

        # Test 2: Get specific script
        success, response = self.run_test(
            "Get specific script by ID",
            "GET", f"scripts/{script_id}", 200
        )

        # Test 3: Update script
        update_data = {
            "name": "Updated System Info Script",
            "content": "echo 'Updated System Info Test:'; uname -a; uptime"
        }
        success, response = self.run_test(
            "Update script",
            "PUT", f"scripts/{script_id}", 200, update_data
        )

    def test_projects_crud(self):
        """Test Project CRUD operations"""
        print("\n🔍 Testing Projects CRUD Operations...")
        
        # Test 1: Create project
        project_data = {
            "name": "Test Project Alpha",
            "description": "Test project for automated testing"
        }
        
        success, response = self.run_test(
            "Create project",
            "POST", "projects", 200, project_data
        )
        
        if success and 'id' in response:
            self.created_projects.append(response['id'])
            project_id = response['id']
            
            # Verify project defaults
            if response.get('status') == 'draft':
                self.log_test("Project created with draft status", True, "")
            else:
                self.log_test("Project created with draft status", False, f"Got status: {response.get('status')}")
        else:
            self.log_test("Project creation failed", False, "Cannot proceed with project tests")
            return

        # Test 2: Get all projects
        success, response = self.run_test(
            "Get all projects",
            "GET", "projects", 200
        )
        
        if success and isinstance(response, list):
            self.log_test(f"Projects list retrieved (found {len(response)})", len(response) >= 1, "")

        # Test 3: Get specific project
        success, response = self.run_test(
            "Get specific project by ID",
            "GET", f"projects/{project_id}", 200
        )

        # Test 4: Update project
        update_data = {
            "name": "Updated Test Project Alpha",
            "description": "Updated description for testing"
        }
        success, response = self.run_test(
            "Update project",
            "PUT", f"projects/{project_id}", 200, update_data
        )

        # Test 5: Create second project for testing
        project_data2 = {
            "name": "Test Project Beta",
            "description": "Second test project"
        }
        
        success, response = self.run_test(
            "Create second project",
            "POST", "projects", 200, project_data2
        )
        
        if success and 'id' in response:
            self.created_projects.append(response['id'])

    def test_project_cascade_delete(self):
        """Test project cascade delete functionality"""
        print("\n🔍 Testing Project Cascade Delete...")
        
        if len(self.created_projects) < 2:
            self.log_test("Skip cascade delete test", False, "Need at least 2 projects")
            return

        # Use the second project for deletion test
        project_to_delete = self.created_projects[1]
        
        # First, verify project exists and has tasks if we created any for it
        success, response = self.run_test(
            "Verify project exists before delete",
            "GET", f"projects/{project_to_delete}", 200
        )
        
        if not success:
            self.log_test("Skip cascade delete", False, "Project doesn't exist")
            return

        # Delete the project
        success, response = self.run_test(
            "Delete project (cascade delete)",
            "DELETE", f"projects/{project_to_delete}", 200
        )
        
        if success:
            self.created_projects.remove(project_to_delete)
            
            # Verify project is deleted
            self.run_test(
                "Verify project deleted",
                "GET", f"projects/{project_to_delete}", 404
            )
            
            # Verify associated tasks are deleted
            success, response = self.run_test(
                "Verify project tasks deleted",
                "GET", f"projects/{project_to_delete}/tasks", 404
            )
            
            # Verify associated executions are deleted (if any existed)
            success, response = self.run_test(
                "Verify project executions cleaned up",
                "GET", f"projects/{project_to_delete}/executions", 404
            )

                self.log_test("Project created with draft status", False, f"Got status: {response.get('status')}")
        else:
            self.log_test("Project creation failed", False, "Cannot proceed with project tests")
            return

        # Test 2: Get all projects
        success, response = self.run_test(
            "Get all projects",
            "GET", "projects", 200
        )
        
        if success and isinstance(response, list):
            self.log_test(f"Projects list retrieved (found {len(response)})", len(response) >= 1, "")

        # Test 3: Get specific project
        success, response = self.run_test(
            "Get specific project by ID",
            "GET", f"projects/{project_id}", 200
        )

        # Test 4: Update project
        update_data = {
            "name": "Updated Test Project Alpha",
            "description": "Updated description for testing"
        }
        success, response = self.run_test(
            "Update project",
            "PUT", f"projects/{project_id}", 200, update_data
        )

        # Test 5: Create second project for testing
        project_data2 = {
            "name": "Test Project Beta",
            "description": "Second test project"
        }
        
        success, response = self.run_test(
            "Create second project",
            "POST", "projects", 200, project_data2
        )
        
        if success and 'id' in response:
            self.created_projects.append(response['id'])

    def test_project_tasks(self):
        """Test Project Tasks operations"""
        print("\n🔍 Testing Project Tasks Operations...")
        
        if not self.created_projects or not self.created_hosts or not self.created_systems or len(self.created_scripts) < 2:
            self.log_test("Skip project tasks test", False, "Missing required data (projects, hosts, systems, or scripts)")
            return

        project_id = self.created_projects[0]
        host_id = self.created_hosts[0]
        system_id = self.created_systems[0]
        script_ids = self.created_scripts[:2]  # Use first 2 scripts

        # Test 1: Create project task
        task_data = {
            "host_id": host_id,
            "system_id": system_id,
            "script_ids": script_ids
        }
        
        success, response = self.run_test(
            "Create project task",
            "POST", f"projects/{project_id}/tasks", 200, task_data
        )
        
        if success and 'id' in response:
            self.created_project_tasks.append(response['id'])
            task_id = response['id']
            
            # Verify task defaults
            if response.get('status') == 'pending':
                self.log_test("Task created with pending status", True, "")
            else:
                self.log_test("Task created with pending status", False, f"Got status: {response.get('status')}")
        else:
            self.log_test("Task creation failed", False, "Cannot proceed with task tests")
            return

        # Test 2: Get all tasks for project
        success, response = self.run_test(
            "Get project tasks",
            "GET", f"projects/{project_id}/tasks", 200
        )
        
        if success and isinstance(response, list):
            self.log_test(f"Project tasks retrieved (found {len(response)})", len(response) >= 1, "")

        # Test 3: Create second task with different scripts
        if len(self.created_scripts) >= 3:
            task_data2 = {
                "host_id": host_id,
                "system_id": system_id,
                "script_ids": [self.created_scripts[2]]  # Use third script
            }
            
            success, response = self.run_test(
                "Create second project task",
                "POST", f"projects/{project_id}/tasks", 200, task_data2
            )
            
            if success and 'id' in response:
                self.created_project_tasks.append(response['id'])

        # Test 4: Delete project task
        if len(self.created_project_tasks) > 1:
            task_to_delete = self.created_project_tasks[-1]
            success, response = self.run_test(
                "Delete project task",
                "DELETE", f"projects/{project_id}/tasks/{task_to_delete}", 200
            )
            if success:
                self.created_project_tasks.remove(task_to_delete)

    def test_project_execution_sse(self):
        """Test Project Execution with SSE real-time updates"""
        print("\n🔍 Testing Project Execution with SSE...")
        
        if not self.created_projects or not self.created_project_tasks:
            self.log_test("Skip project execution test", False, "No projects or tasks available")
            return

        project_id = self.created_projects[0]

        # Test 1: Execute project via SSE endpoint
        try:
            url = f"{self.api_url}/projects/{project_id}/execute"
            headers = {
                'Accept': 'text/event-stream',
                'Cache-Control': 'no-cache'
            }
            
            response = requests.post(url, headers=headers, stream=True, timeout=30)
            
            if response.status_code == 200:
                self.log_test("Project execution SSE endpoint accessible", True, "")
                
                # Read SSE events
                events_received = []
                event_types_seen = set()
                
                for line in response.iter_lines(decode_unicode=True):
                    if line.startswith('data: '):
                        try:
                            event_data = json.loads(line[6:])  # Remove 'data: ' prefix
                            events_received.append(event_data)
                            event_types_seen.add(event_data.get('type', 'unknown'))
                            
                            # Stop after receiving completion event or error
                            if event_data.get('type') in ['complete', 'error']:
                                break
                                
                        except json.JSONDecodeError:
                            continue
                    
                    # Safety timeout - don't wait forever
                    if len(events_received) > 50:  # Reasonable limit
                        break
                
                # Verify we received expected event types
                expected_events = {'status', 'info', 'task_start'}
                received_expected = expected_events.intersection(event_types_seen)
                
                self.log_test(
                    f"SSE events received ({len(events_received)} events)",
                    len(events_received) > 0,
                    f"Event types: {list(event_types_seen)}"
                )
                
                self.log_test(
                    f"Expected SSE event types received",
                    len(received_expected) >= 2,
                    f"Got: {list(received_expected)}, Expected: {list(expected_events)}"
                )
                
                # Check if we got completion or error
                final_events = {'complete', 'error'}.intersection(event_types_seen)
                self.log_test(
                    "Project execution completed",
                    len(final_events) > 0,
                    f"Final event types: {list(final_events)}"
                )
                
            else:
                self.log_test(
                    "Project execution SSE endpoint",
                    False,
                    f"Status: {response.status_code}, Response: {response.text[:200]}"
                )
                
        except requests.exceptions.Timeout:
            self.log_test("Project execution SSE", False, "Request timeout (expected for SSH connection failures)")
        except Exception as e:
            self.log_test("Project execution SSE", False, f"Exception: {str(e)}")

    def test_project_executions_results(self):
        """Test Project Executions Results endpoint"""
        print("\n🔍 Testing Project Executions Results...")
        
        if not self.created_projects:
            self.log_test("Skip project executions test", False, "No projects available")
            return

        project_id = self.created_projects[0]

        # Test 1: Get project execution results
        success, response = self.run_test(
            "Get project execution results",
            "GET", f"projects/{project_id}/executions", 200
        )
        
        if success and isinstance(response, list):
            self.log_test(
                f"Project executions retrieved (found {len(response)})",
                True,  # Any number is fine, including 0
                f"Executions count: {len(response)}"
            )
            
            # If we have executions, verify structure
            if len(response) > 0:
                execution = response[0]
                required_fields = ['id', 'host_id', 'system_id', 'script_id', 'success', 'output']
                missing_fields = [field for field in required_fields if field not in execution]
                
                self.log_test(
                    "Execution record structure",
                    len(missing_fields) == 0,
                    f"Missing fields: {missing_fields}" if missing_fields else "All required fields present"
                )
                
                # Check project linkage
                if execution.get('project_id') == project_id:
                    self.log_test("Execution linked to project", True, "")
                else:
                    self.log_test("Execution linked to project", False, f"Expected: {project_id}, Got: {execution.get('project_id')}")

    def test_legacy_execute_endpoint(self):
        """Test Legacy Execute endpoint compatibility"""
        print("\n🔍 Testing Legacy Execute Endpoint...")
        
        if not self.created_scripts or not self.created_hosts:
            self.log_test("Skip legacy execute test", False, "No scripts or hosts available")
            return

        # Test 1: Execute script on host using legacy endpoint
        execute_data = {
            "script_id": self.created_scripts[0],
            "host_ids": [self.created_hosts[0]]
        }
        
        success, response = self.run_test(
            "Legacy execute script on host",
            "POST", "execute", 200, execute_data
        )
        
        # Note: This will likely fail with connection error, which is expected
        if success and 'results' in response:
            results = response['results']
            self.log_test(f"Legacy execution returned results", len(results) > 0, f"Got {len(results)} results")
            
            # Check if we got expected connection errors (normal in test environment)
            for result in results:
                if 'error' in result and any(keyword in str(result.get('error', '')).lower() 
                                           for keyword in ['подключения', 'connection', 'timeout', 'ssh']):
                    self.log_test("Expected connection error received", True, "SSH connection failed as expected")
                    break

        # Test 2: Verify execution was recorded with new model structure
        success, response = self.run_test(
            "Get executions after legacy execute",
            "GET", "executions", 200
        )
        
        if success and isinstance(response, list) and len(response) > 0:
            # Find the most recent execution
            recent_execution = response[0]  # Should be sorted by executed_at desc
            
            # Verify new model fields are present
            new_model_fields = ['script_name', 'system_id']
            present_fields = [field for field in new_model_fields if field in recent_execution]
            
            self.log_test(
                "Legacy execution uses new model structure",
                len(present_fields) == len(new_model_fields),
                f"Present fields: {present_fields}"
            )

    def test_error_cases(self):
        """Test error handling"""
        print("\n🔍 Testing Error Cases...")
        
        # Test 1: Get non-existent host
        self.run_test(
            "Get non-existent host",
            "GET", "hosts/non-existent-id", 404
        )
        
        # Test 2: Get non-existent script
        self.run_test(
            "Get non-existent script",
            "GET", "scripts/non-existent-id", 404
        )
        
        # Test 3: Get non-existent project
        self.run_test(
            "Get non-existent project",
            "GET", "projects/non-existent-id", 404
        )
        
        # Test 4: Execute non-existent project
        self.run_test(
            "Execute non-existent project",
            "POST", "projects/non-existent-id/execute", 404
        )
        
        # Test 5: Create project task with invalid host_id
        if self.created_projects:
            invalid_task = {
                "host_id": "invalid-host-id",
                "system_id": self.created_systems[0] if self.created_systems else "invalid-system-id",
                "script_ids": ["invalid-script-id"]
            }
            # This might return 200 but fail during execution, or return 404/422
            success, response = self.run_test(
                "Create task with invalid host_id",
                "POST", f"projects/{self.created_projects[0]}/tasks", 422, invalid_task
            )
            # If it returns 200, that's also acceptable as validation might happen during execution
            if not success and response:
                # Try with 200 status code as alternative
                success, response = self.run_test(
                    "Create task with invalid host_id (alt)",
                    "POST", f"projects/{self.created_projects[0]}/tasks", 200, invalid_task
                )
        
        # Test 6: Create host with missing required fields
        invalid_host = {"name": "Incomplete Host"}
        self.run_test(
            "Create host with missing fields",
            "POST", "hosts", 422, invalid_host
        )
        
        # Test 7: Create script with missing required fields (system_id now required)
        invalid_script = {"name": "Incomplete Script", "content": "echo test"}
        self.run_test(
            "Create script with missing system_id",
            "POST", "scripts", 422, invalid_script
        )

    def cleanup(self):
        """Clean up created test data"""
        print("\n🧹 Cleaning up test data...")
        
        # Delete created projects (this should cascade delete tasks and executions)
        for project_id in self.created_projects:
            try:
                requests.delete(f"{self.api_url}/projects/{project_id}", timeout=5)
                print(f"Deleted project: {project_id}")
            except:
                pass
        
        # Delete created hosts
        for host_id in self.created_hosts:
            try:
                requests.delete(f"{self.api_url}/hosts/{host_id}", timeout=5)
                print(f"Deleted host: {host_id}")
            except:
                pass
        
        # Delete created scripts
        for script_id in self.created_scripts:
            try:
                requests.delete(f"{self.api_url}/scripts/{script_id}", timeout=5)
                print(f"Deleted script: {script_id}")
            except:
                pass
        
        # Delete created systems
        for system_id in self.created_systems:
            try:
                requests.delete(f"{self.api_url}/systems/{system_id}", timeout=5)
                print(f"Deleted system: {system_id}")
            except:
                pass
        
        # Delete created categories
        for category_id in self.created_categories:
            try:
                requests.delete(f"{self.api_url}/categories/{category_id}", timeout=5)
                print(f"Deleted category: {category_id}")
            except:
                pass

    def run_all_tests(self):
        """Run all tests"""
        print(f"🚀 Starting SSH Script Runner API Tests - Phase 2 Project System")
        print(f"Backend URL: {self.base_url}")
        print("=" * 60)
        
        try:
            # Test basic connectivity
            success, _ = self.run_test(
                "Backend connectivity",
                "GET", "hosts", 200
            )
            
            if not success:
                print("❌ Cannot connect to backend, stopping tests")
                return False
            
            # Setup test data first
            if not self.setup_test_data():
                print("❌ Failed to setup test data, stopping tests")
                return False
            
            # Run all test suites
            self.test_hosts_crud()
            self.test_scripts_crud()
            
            # NEW: Project system tests
            self.test_projects_crud()
            self.test_project_tasks()
            self.test_project_execution_sse()
            self.test_project_executions_results()
            self.test_legacy_execute_endpoint()
            self.test_project_cascade_delete()
            
            self.test_error_cases()
            
        except KeyboardInterrupt:
            print("\n⚠️ Tests interrupted by user")
        except Exception as e:
            print(f"\n💥 Unexpected error: {str(e)}")
        finally:
            self.cleanup()
        
        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Test Summary:")
        print(f"   Tests run: {self.tests_run}")
        print(f"   Tests passed: {self.tests_passed}")
        print(f"   Success rate: {(self.tests_passed/self.tests_run*100):.1f}%" if self.tests_run > 0 else "No tests run")
        
        return self.tests_passed == self.tests_run

def main():
    tester = SSHRunnerAPITester()
    success = tester.run_all_tests()
    
    # Save detailed results
    with open('/app/backend_test_results.json', 'w', encoding='utf-8') as f:
        json.dump({
            "summary": {
                "tests_run": tester.tests_run,
                "tests_passed": tester.tests_passed,
                "success_rate": (tester.tests_passed/tester.tests_run*100) if tester.tests_run > 0 else 0,
                "timestamp": datetime.now().isoformat()
            },
            "results": tester.test_results
        }, f, indent=2, ensure_ascii=False)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())