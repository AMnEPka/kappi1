"""Projects API endpoints

This module contains endpoints for:
- Project CRUD operations
- Project tasks management
- Project access management
- Project execution (see execute_project function)
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List

from config.config_init import db
from models.project_models import Project, ProjectCreate, ProjectUpdate, ProjectTask, ProjectTaskCreate, ProjectTaskUpdate
from models.auth_models import User
from services.services_auth import get_current_user, has_permission, require_permission, can_access_project
from utils.db_utils import prepare_for_mongo, parse_from_mongo
from utils.audit_utils import log_audit

router = APIRouter()


# ============================================================================
# Projects CRUD
# ============================================================================

@router.post("/projects", response_model=Project)
async def create_project(project_input: ProjectCreate, current_user: User = Depends(get_current_user)):
    """Create new project (requires projects_create permission)"""
    await require_permission(current_user, 'projects_create')
    
    project_obj = Project(**project_input.model_dump(), created_by=current_user.id)
    doc = prepare_for_mongo(project_obj.model_dump())
    
    await db.projects.insert_one(doc)
    
    log_audit(
        "21",
        user_id=current_user.id,
        username=current_user.username,
        details={
            "project_name": project_obj.name,
            "project_description": project_obj.description
            }
    )
    return project_obj


@router.get("/projects", response_model=List[Project])
async def get_projects(current_user: User = Depends(get_current_user)):
    """Get all accessible projects"""
    if current_user.is_admin or await has_permission(current_user, 'results_view_all'):
        # Admin or curator sees all projects
        projects = await db.projects.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    else:
        # Get projects created by user
        my_projects = await db.projects.find({"created_by": current_user.id}, {"_id": 0}).to_list(1000)
        
        # Get projects with explicit access
        access_records = await db.project_access.find({"user_id": current_user.id}).to_list(1000)
        project_ids = [rec['project_id'] for rec in access_records]
        accessible_projects = await db.projects.find({"id": {"$in": project_ids}}, {"_id": 0}).to_list(1000) if project_ids else []
        
        # Combine and deduplicate
        all_projects = {p['id']: p for p in my_projects + accessible_projects}
        projects = list(all_projects.values())
        projects.sort(key=lambda x: x.get('created_at', ''), reverse=True)
    
    # Enrich projects with creator username & fullname
    for project in projects:
        if project.get('created_by'):
            creator = await db.users.find_one({"id": project['created_by']}, {"_id": 0, "username": 1, "full_name": 1})
            if creator:
                project['creator_username'] = creator.get('username', 'Unknown')
                project['creator_full_name'] = creator.get('full_name', 'Unknown')          
    
    return [Project(**parse_from_mongo(proj)) for proj in projects]


@router.get("/projects/{project_id}", response_model=Project)
async def get_project(project_id: str, current_user: User = Depends(get_current_user)):
    """Get project by ID"""
    if not await can_access_project(current_user, project_id):
        raise HTTPException(status_code=403, detail="Access denied to this project")
    
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")
    return Project(**parse_from_mongo(project))


@router.put("/projects/{project_id}", response_model=Project)
async def update_project(project_id: str, project_update: ProjectUpdate, current_user: User = Depends(get_current_user)):
    """Update project (only creator or admin)"""
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")
    
    if project.get('created_by') != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Only project creator or admin can update")
    
    update_data = project_update.model_dump(exclude_unset=True)
    
    if not update_data:
        raise HTTPException(status_code=400, detail="Нет данных для обновления")
    
    result = await db.projects.update_one(
        {"id": project_id},
        {"$set": update_data}
    )
    
    updated_project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    return Project(**parse_from_mongo(updated_project))


@router.delete("/projects/{project_id}")
async def delete_project(project_id: str, current_user: User = Depends(get_current_user)):
    """Delete project (only creator or admin)"""
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")
    
    if project.get('created_by') != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Only project creator or admin can delete")
    
    # Check if project has executions
    executions_count = await db.executions.count_documents({"project_id": project_id})
    if executions_count > 0:
        raise HTTPException(
            status_code=400, 
            detail="Невозможно удалить проект: существуют запуски проекта"
        )
   
    # Delete project
    result = await db.projects.delete_one({"id": project_id})
    
    log_audit(
        "22",  # Удаление проекта
        user_id=current_user.id,
        username=current_user.username,
        details={
            "project_name": project.get('name')
        }
    )
    
    return {"message": "Проект удален"}


# ============================================================================
# Project Tasks
# ============================================================================

@router.post("/projects/{project_id}/tasks", response_model=ProjectTask)
async def create_project_task(project_id: str, task_input: ProjectTaskCreate, current_user: User = Depends(get_current_user)):
    """Create task in project (requires access to project)"""
    # Check project access
    if not await can_access_project(current_user, project_id):
        raise HTTPException(status_code=403, detail="Access denied to this project")
    
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")
    
    task_obj = ProjectTask(project_id=project_id, **task_input.model_dump())
    doc = prepare_for_mongo(task_obj.model_dump())
    
    await db.project_tasks.insert_one(doc)
    return task_obj


@router.get("/projects/{project_id}/tasks", response_model=List[ProjectTask])
async def get_project_tasks(project_id: str, current_user: User = Depends(get_current_user)):
    """Get all tasks for a project (requires access to project)"""
    if not await can_access_project(current_user, project_id):
        raise HTTPException(status_code=403, detail="Access denied to this project")
    
    tasks = await db.project_tasks.find({"project_id": project_id}, {"_id": 0}).to_list(1000)
    return [ProjectTask(**parse_from_mongo(task)) for task in tasks]


@router.get("/projects/{project_id}/tasks/bulk", response_model=List[ProjectTask])
async def get_project_tasks_bulk(project_id: str, current_user: User = Depends(get_current_user)):
    """Get all tasks for a project with all details (requires access to project)"""
    if not await can_access_project(current_user, project_id):
        raise HTTPException(status_code=403, detail="Access denied to this project")
    
    tasks = await db.project_tasks.find({"project_id": project_id}, {"_id": 0}).to_list(1000)
    return [ProjectTask(**parse_from_mongo(task)) for task in tasks]


@router.put("/projects/{project_id}/tasks/{task_id}", response_model=ProjectTask)
async def update_project_task(project_id: str, task_id: str, task_update: ProjectTaskUpdate, current_user: User = Depends(get_current_user)):
    """Update task in project (requires access to project)"""
    if not await can_access_project(current_user, project_id):
        raise HTTPException(status_code=403, detail="Access denied to this project")
    
    task = await db.project_tasks.find_one({"id": task_id, "project_id": project_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Задание не найдено")
    
    update_data = {k: v for k, v in task_update.dict().items() if v is not None}
    if update_data:
        await db.project_tasks.update_one(
            {"id": task_id, "project_id": project_id},
            {"$set": update_data}
        )
    
    updated_task = await db.project_tasks.find_one({"id": task_id}, {"_id": 0})
    return ProjectTask(**parse_from_mongo(updated_task))


@router.delete("/projects/{project_id}/tasks/{task_id}")
async def delete_project_task(project_id: str, task_id: str, current_user: User = Depends(get_current_user)):
    """Delete task from project (requires access to project)"""
    if not await can_access_project(current_user, project_id):
        raise HTTPException(status_code=403, detail="Access denied to this project")
    
    result = await db.project_tasks.delete_one({"id": task_id, "project_id": project_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Задание не найдено")
    return {"message": "Задание удалено"}


# ============================================================================
# Project Access Management
# ============================================================================

@router.get("/projects/{project_id}/users")
async def get_project_users(project_id: str, current_user: User = Depends(get_current_user)):
    """Get users with access to project"""
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")
    
    # Only project creator or admin can view access list
    if project.get('created_by') != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get project access records
    access_records = await db.project_access.find({"project_id": project_id}).to_list(1000)
    user_ids = [rec['user_id'] for rec in access_records]
    
    # Get user details
    users = await db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "id": 1, "username": 1, "full_name": 1}).to_list(1000) if user_ids else []
    
    return {"users": users}


@router.post("/projects/{project_id}/users/{user_id}")
async def grant_project_access(project_id: str, user_id: str, current_user: User = Depends(get_current_user)):
    """Grant user access to project"""
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")
    
    # Only project creator or admin can grant access
    if project.get('created_by') != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Check if user exists
    target_user = await db.users.find_one({"id": user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    # Check if already has access
    existing = await db.project_access.find_one({"project_id": project_id, "user_id": user_id})
    if existing:
        return {"message": "User already has access"}
    
    # Grant access
    access_doc = {
        "project_id": project_id,
        "user_id": user_id,
        "granted_by": current_user.id,
        "granted_at": prepare_for_mongo({"granted_at": Project().created_at})["granted_at"]
    }
    await db.project_access.insert_one(access_doc)
    
    log_audit(
        "27",
        user_id=current_user.id,
        username=current_user.username,
        details={
            "project_name": project.get('name'),
            "target_username": target_user.get('username')
        }
    )
    
    return {"message": "Access granted"}


@router.delete("/projects/{project_id}/users/{user_id}")
async def revoke_project_access(project_id: str, user_id: str, current_user: User = Depends(get_current_user)):
    """Revoke user access to project"""
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")
    
    # Only project creator or admin can revoke access
    if project.get('created_by') != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Revoke access
    result = await db.project_access.delete_one({"project_id": project_id, "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Access record not found")
    
    # Get target user for logging
    target_user = await db.users.find_one({"id": user_id})
    
    log_audit(
        "28",
        user_id=current_user.id,
        username=current_user.username,
        details={
            "project_name": project.get('name'),
            "target_username": target_user.get('username') if target_user else user_id,
            "action": "revoke"
        }
    )
    
    return {"message": "Access revoked"}
