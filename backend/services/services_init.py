"""
services/__init__.py
Services module initialization and centralized imports
"""

# Helpers
from services.services_helpers import (
    prepare_for_mongo,
    parse_from_mongo,
    _parse_datetime_param,
    _parse_time_of_day,
    _normalize_run_times
)

# Auth
from services.services_auth import (
    get_current_user,
    get_current_user_from_token,
    get_user_permissions,
    has_permission,
    require_permission,
    can_access_project
)

# Execution
from services.services_execution import (
    execute_command,
    execute_check_with_processor,
    _check_network_access,
    _check_ssh_login,
    _check_ssh_login_and_sudo,
    _check_winrm_login,
    _check_admin_access,
    _check_sudo_access_linux
)

# Scheduler
from services.services_scheduler import (
    scheduler_worker,
    _calculate_next_run,
    _handle_due_scheduler_job,
    _execute_scheduler_job,
    _update_job_after_run
)

# Export
from services.services_export import (
    export_executions_to_excel,
    generate_xlsx_file,
    create_execution_report
)

# CRUD
from services.services_crud import (
    get_or_create_category,
    get_or_create_system,
    get_or_create_host,
    get_or_create_script
)

# Notifications
from services.services_notifications import (
    send_notification,
    log_notification,
    send_email,
    send_slack_message,
    send_telegram_message
)

__all__ = [
    # Helpers
    "prepare_for_mongo",
    "parse_from_mongo",
    "_parse_datetime_param",
    "_parse_time_of_day",
    "_normalize_run_times",
    
    # Auth
    "get_current_user",
    "get_user_permissions",
    "has_permission",
    "require_permission",
    "can_access_project",
    
    # Execution
    "execute_command",
    "execute_check_with_processor",
    "_check_network_access",
    "_check_ssh_login",
    "_check_ssh_login_and_sudo",
    "_check_winrm_login",
    "_check_admin_access",
    "_check_sudo_access_linux",
    
    # Scheduler
    "scheduler_worker",
    "_calculate_next_run",
    "_handle_due_scheduler_job",
    "_execute_scheduler_job",
    "_update_job_after_run",
    
    # Export
    "export_executions_to_excel",
    "generate_xlsx_file",
    "create_execution_report",
    
    # CRUD
    "get_or_create_category",
    "get_or_create_system",
    "get_or_create_host",
    "get_or_create_script",
    
    # Notifications
    "send_notification",
    "log_notification",
    "send_email",
    "send_slack_message",
    "send_telegram_message"
]
