"""Projects API endpoints

This module contains endpoints for:
- Project CRUD operations
- Project tasks management
- Project access management
- Project execution (see execute_project function)
"""

from fastapi import APIRouter, HTTPException, Depends  # pyright: ignore[reportMissingImports]
from typing import List
from datetime import datetime
import traceback

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
async def get_projects(
    skip: int = 0,
    limit: int = 1000,
    current_user: User = Depends(get_current_user),
):
    """Get all accessible projects (with pagination)"""
    limit = max(1, min(limit, 1000))
    skip = max(0, skip)

    if current_user.is_admin or await has_permission(current_user, 'results_view_all'):
        # Admin or curator sees all projects
        projects = await db.projects.find({}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    else:
        # Get projects created by user + shared projects (pagination applied after merge)
        my_projects = await db.projects.find({"created_by": current_user.id}, {"_id": 0}).to_list(5000)
        
        # Get projects with explicit access
        access_records = await db.project_access.find({"user_id": current_user.id}).to_list(5000)
        project_ids = [rec['project_id'] for rec in access_records]
        accessible_projects = await db.projects.find({"id": {"$in": project_ids}}, {"_id": 0}).to_list(5000) if project_ids else []
        
        # Combine, deduplicate, sort, and apply pagination
        all_projects = {p['id']: p for p in my_projects + accessible_projects}
        projects = sorted(all_projects.values(), key=lambda x: x.get('created_at', ''), reverse=True)
        projects = projects[skip:skip + limit]
    
    # Batch-fetch имён создателей (вместо N+1 запросов по одному на проект)
    creator_ids = list({p['created_by'] for p in projects if p.get('created_by')})
    creator_map: dict[str, dict] = {}
    if creator_ids:
        creator_docs = await db.users.find(
            {"id": {"$in": creator_ids}},
            {"_id": 0, "id": 1, "username": 1, "full_name": 1},
        ).to_list(len(creator_ids))
        creator_map = {c["id"]: c for c in creator_docs}

    for project in projects:
        creator = creator_map.get(project.get('created_by', ''))
        if creator:
            project['creator_username'] = creator.get('username', 'Unknown')
            project['creator_full_name'] = creator.get('full_name', 'Unknown')
    
    return [Project(**parse_from_mongo(proj)) for proj in projects]


@router.get("/projects/{project_id}", response_model=Project)
async def get_project(project_id: str, current_user: User = Depends(get_current_user)):
    """Get project by ID"""
    # Сначала проверяем глобальное право на просмотр всех результатов
    if current_user.is_admin or await has_permission(current_user, 'results_view_all'):
        # Пользователь может видеть все проекты - пропускаем проверку can_access_project
        project = await db.projects.find_one({"id": project_id}, {"_id": 0})
        if not project:
            raise HTTPException(status_code=404, detail="Проект не найден")
        return Project(**parse_from_mongo(project))
    
    # Если нет глобального права - проверяем доступ к конкретному проекту
    if not await can_access_project(current_user, project_id):
        raise HTTPException(status_code=403, detail="У вас нет доступа к этому проекту")
    
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
        raise HTTPException(status_code=403, detail="Только пользователь с доступом к этому проекту может редактировать его")
    
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
    """Delete project (only creator or admin). Cascade: executions, scheduler jobs/runs, tasks, access."""
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")
    
    if project.get('created_by') != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Только пользователь с доступом к этому проекту может удалить его")
    
    # Cascade delete: remove all data linked to this project
    await db.executions.delete_many({"project_id": project_id})
    job_ids = [doc["id"] for doc in await db.scheduler_jobs.find({"project_id": project_id}, {"id": 1}).to_list(1000)]
    if job_ids:
        await db.scheduler_runs.delete_many({"job_id": {"$in": job_ids}})
        await db.scheduler_jobs.delete_many({"project_id": project_id})
    await db.project_tasks.delete_many({"project_id": project_id})
    await db.project_access.delete_many({"project_id": project_id})
   
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
        raise HTTPException(status_code=403, detail="Нет доступа к проекту")
    
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
        raise HTTPException(status_code=403, detail="Нет доступа к проекту")
    
    tasks = await db.project_tasks.find({"project_id": project_id}, {"_id": 0}).to_list(1000)
    return [ProjectTask(**parse_from_mongo(task)) for task in tasks]

@router.get("/projects/{project_id}/tasks/bulk", response_model=List[ProjectTask])
async def get_project_tasks_bulk(project_id: str, current_user: User = Depends(get_current_user)):
    """Get all tasks for a project with all details (requires access to project)"""
    if not await can_access_project(current_user, project_id):
        raise HTTPException(status_code=403, detail="Нет доступа к проекту")
    
    tasks = await db.project_tasks.find({"project_id": project_id}, {"_id": 0}).to_list(1000)
    return [ProjectTask(**parse_from_mongo(task)) for task in tasks]

@router.put("/projects/{project_id}/tasks/{task_id}", response_model=ProjectTask)
async def update_project_task(project_id: str, task_id: str, task_update: ProjectTaskUpdate, current_user: User = Depends(get_current_user)):
    """Update task in project (requires access to project)"""
    if not await can_access_project(current_user, project_id):
        raise HTTPException(status_code=403, detail="Нет доступа к проекту")
    
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
        raise HTTPException(status_code=403, detail="Нет доступа к проекту")
    
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
    try:
        # 1. Найти проект
        project = await db.projects.find_one({"id": project_id})
        
        if not project:
            raise HTTPException(status_code=404, detail="Проект не найден")
        
        # 2. Проверить права доступа
        has_access = False
        
        # Проверка: является ли пользователь создателем
        if project.get('created_by') == current_user.id:
            has_access = True
        # Проверка: является ли пользователь администратором
        elif current_user.is_admin:
            has_access = True
        # Проверка: есть ли доступ в таблице project_access
        else:
            try:
                access_record = await db.project_access.find_one({
                    "project_id": project_id,
                    "user_id": current_user.id
                })
                has_access = access_record is not None
            except Exception as e:
                has_access = False
        
        if not has_access:
            raise HTTPException(
                status_code=403, 
                detail="Нет доступа к проекту"
            )
        
        # 3. Получить все записи о доступе к проекту
        try:
            access_records = await db.project_access.find({"project_id": project_id}).to_list(1000)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Ошибка при получении записей доступа: {str(e)}")
        
        if not access_records:
            return {"users": []}
        
        # 4. Собрать ID всех пользователей с доступом
        user_ids = []
        for rec in access_records:
            if 'user_id' in rec:
                user_ids.append(rec['user_id'])
        
        if not user_ids:
            return {"users": []}
        
        # 5. Получить информацию о пользователях
        try:
            users = []
            for user_id in user_ids:
                user = await db.users.find_one(
                    {"id": user_id},
                    {"_id": 0, "id": 1, "username": 1, "full_name": 1, "email": 1}
                )
                if user:
                    users.append(user)
            
            # 6. Добавить информацию о роли
            project_creator_id = project.get('created_by')
            for user in users:
                if user['id'] == project_creator_id:
                    user['role'] = 'creator'
                else:
                    user['role'] = 'member'
            
            return {"users": users}
            
        except Exception as e:
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Ошибка при получении данных пользователей: {str(e)}")
        
    except HTTPException as he:
        raise he
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Внутренняя ошибка сервера: {type(e).__name__}")

@router.post("/projects/{project_id}/users/{user_id}")
async def grant_project_access(project_id: str, user_id: str, current_user: User = Depends(get_current_user)):
    """Grant user access to project"""
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")
    
    # Only project creator or admin can grant access
    if project.get('created_by') != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Нет доступа к проекту")
    
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
        "granted_at": prepare_for_mongo({"granted_at": datetime.now()})["granted_at"]
    }
    await db.project_access.insert_one(access_doc)
    
    log_audit(
        "27", # предоставлен доступ к проекту
        user_id=current_user.id,
        username=current_user.username,
        details={
            "project_name": project.get('name'),
            "target_username": target_user.get('username'),
            "target_fio": target_user.get('full_name')
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
        raise HTTPException(status_code=403, detail="Нет доступа к проекту")
    
    # Revoke access
    result = await db.project_access.delete_one({"project_id": project_id, "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Ошибка предоставления доступа")
    
    # Get target user for logging
    target_user = await db.users.find_one({"id": user_id})
    
    log_audit(
        "28",
        user_id=current_user.id,
        username=current_user.username,
        details={
            "project_name": project.get('name'),
            "target_username": target_user.get('username')
        }
    )
    
    return {"message": "Access revoked"}
