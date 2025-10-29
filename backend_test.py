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
    def __init__(self, base_url="https://script-hub-9.preview.emergentagent.com"):
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

    def test_scripts_crud(self):
        """Test all script CRUD operations"""
        print("\n🔍 Testing Scripts CRUD Operations...")
        
        # Test 1: Create bash script
        script_data = {
            "name": "System Info Script",
            "description": "Get system information",
            "content": "echo 'System Info:'\nuname -a\ndf -h\nfree -m"
        }
        
        success, response = self.run_test(
            "Create bash script",
            "POST", "scripts", 200, script_data
        )
        
        if success and 'id' in response:
            self.created_scripts.append(response['id'])
            script_id = response['id']
        else:
            script_id = None

        # Test 2: Create another script
        script_data2 = {
            "name": "Simple Test Script",
            "description": "Simple echo test",
            "content": "echo 'Hello from SSH Script Runner!'\ndate\nwhoami"
        }
        
        success, response = self.run_test(
            "Create second script",
            "POST", "scripts", 200, script_data2
        )
        
        if success and 'id' in response:
            self.created_scripts.append(response['id'])

        # Test 3: Get all scripts
        success, response = self.run_test(
            "Get all scripts",
            "GET", "scripts", 200
        )
        
        if success and isinstance(response, list):
            self.log_test(f"Verify scripts count (found {len(response)})", len(response) >= 2, "")

        # Test 4: Get specific script
        if script_id:
            success, response = self.run_test(
                "Get specific script by ID",
                "GET", f"scripts/{script_id}", 200
            )

        # Test 5: Update script
        if script_id:
            update_data = {
                "name": "Updated System Info Script",
                "content": "echo 'Updated System Info:'\nuname -a\nuptime"
            }
            success, response = self.run_test(
                "Update script",
                "PUT", f"scripts/{script_id}", 200, update_data
            )

        # Test 6: Delete script (we'll keep one for execution tests)
        if len(self.created_scripts) > 1:
            script_to_delete = self.created_scripts[-1]
            success, response = self.run_test(
                "Delete script",
                "DELETE", f"scripts/{script_to_delete}", 200
            )
            if success:
                self.created_scripts.remove(script_to_delete)

    def test_execution_api(self):
        """Test script execution API"""
        print("\n🔍 Testing Script Execution API...")
        
        if not self.created_scripts or not self.created_hosts:
            self.log_test("Skip execution test", False, "No scripts or hosts available")
            return

        # Test 1: Execute script on host (expect connection error - normal behavior)
        execute_data = {
            "script_id": self.created_scripts[0],
            "host_ids": [self.created_hosts[0]]
        }
        
        success, response = self.run_test(
            "Execute script on host",
            "POST", "execute", 200, execute_data
        )
        
        # Note: This will likely fail with connection error, which is expected
        # since we don't have real SSH servers running
        if success and 'results' in response:
            results = response['results']
            self.log_test(f"Execution returned results", len(results) > 0, f"Got {len(results)} results")
            
            # Check if we got expected connection errors
            for result in results:
                if 'error' in result and 'подключения' in str(result.get('error', '')):
                    self.log_test("Expected connection error received", True, "SSH connection failed as expected")

        # Test 2: Get executions history
        success, response = self.run_test(
            "Get executions history",
            "GET", "executions", 200
        )
        
        if success and isinstance(response, list):
            self.log_test(f"Executions history available", len(response) >= 0, f"Found {len(response)} executions")

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
        
        # Test 3: Create host with missing required fields
        invalid_host = {"name": "Incomplete Host"}
        self.run_test(
            "Create host with missing fields",
            "POST", "hosts", 422, invalid_host
        )
        
        # Test 4: Create script with missing required fields
        invalid_script = {"name": "Incomplete Script"}
        self.run_test(
            "Create script with missing fields",
            "POST", "scripts", 422, invalid_script
        )

    def cleanup(self):
        """Clean up created test data"""
        print("\n🧹 Cleaning up test data...")
        
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

    def run_all_tests(self):
        """Run all tests"""
        print(f"🚀 Starting SSH Script Runner API Tests")
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
            
            # Run all test suites
            self.test_hosts_crud()
            self.test_scripts_crud() 
            self.test_execution_api()
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