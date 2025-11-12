"""
Temporary file with updated endpoint code - will be integrated into server.py
"""

# Systems endpoints with auth
systems_code = """
# API Routes - Systems
@api_router.post("/categories/{category_id}/systems", response_model=System)
async def create_system(category_id: str, system_input: SystemCreate, current_user: User = Depends(get_current_user)):
    '''Create new system (requires categories_manage permission)'''
    await require_permission(current_user, 'categories_manage')
    
    system_obj = System(**system_input.model_dump(), created_by=current_user.id)
    doc = prepare_for_mongo(system_obj.model_dump())
    await db.systems.insert_one(doc)
    return system_obj

@api_router.get("/categories/{category_id}/systems", response_model=List[System])
async def get_systems(category_id: str, current_user: User = Depends(get_current_user)):
    '''Get systems for category'''
    systems = await db.systems.find({"category_id": category_id}, {"_id": 0}).to_list(1000)
    return [System(**parse_from_mongo(sys)) for sys in systems]

@api_router.put("/systems/{system_id}", response_model=System)
async def update_system(system_id: str, system_update: SystemUpdate, current_user: User = Depends(get_current_user)):
    '''Update system (requires categories_manage permission)'''
    await require_permission(current_user, 'categories_manage')
    
    update_data = system_update.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="Нет данных для обновления")
    
    result = await db.systems.update_one({"id": system_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Система не найдена")
    
    updated_sys = await db.systems.find_one({"id": system_id}, {"_id": 0})
    return System(**parse_from_mongo(updated_sys))

@api_router.delete("/systems/{system_id}")
async def delete_system(system_id: str, current_user: User = Depends(get_current_user)):
    '''Delete system (requires categories_manage permission)'''
    await require_permission(current_user, 'categories_manage')
    
    await db.scripts.delete_many({"system_id": system_id})
    result = await db.systems.delete_one({"id": system_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Система не найдена")
    return {"message": "Система удалена"}
"""

# Scripts endpoints with auth
scripts_code = """
# API Routes - Scripts (Проверки)
@api_router.post("/systems/{system_id}/scripts", response_model=Script)
async def create_script(system_id: str, script_input: ScriptCreate, current_user: User = Depends(get_current_user)):
    '''Create new script (requires checks_create permission)'''
    await require_permission(current_user, 'checks_create')
    
    script_obj = Script(**script_input.model_dump(), created_by=current_user.id)
    doc = prepare_for_mongo(script_obj.model_dump())
    await db.scripts.insert_one(doc)
    return script_obj

@api_router.get("/systems/{system_id}/scripts", response_model=List[Script])
async def get_scripts(system_id: str, current_user: User = Depends(get_current_user)):
    '''Get scripts for system (filtered by permissions)'''
    # If user can edit all checks, show all
    if await has_permission(current_user, 'checks_edit_all'):
        scripts = await db.scripts.find({"system_id": system_id}, {"_id": 0}).to_list(1000)
    else:
        # Show only own scripts
        scripts = await db.scripts.find({"system_id": system_id, "created_by": current_user.id}, {"_id": 0}).to_list(1000)
    
    return [Script(**parse_from_mongo(script)) for script in scripts]

@api_router.get("/scripts/{script_id}", response_model=Script)
async def get_script(script_id: str, current_user: User = Depends(get_current_user)):
    '''Get script by ID'''
    script = await db.scripts.find_one({"id": script_id}, {"_id": 0})
    if not script:
        raise HTTPException(status_code=404, detail="Проверка не найдена")
    
    # Check access
    if not await has_permission(current_user, 'checks_edit_all'):
        if script.get('created_by') != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    return Script(**parse_from_mongo(script))

@api_router.put("/scripts/{script_id}", response_model=Script)
async def update_script(script_id: str, script_update: ScriptUpdate, current_user: User = Depends(get_current_user)):
    '''Update script (requires checks_edit_own or checks_edit_all permission)'''
    script = await db.scripts.find_one({"id": script_id})
    if not script:
        raise HTTPException(status_code=404, detail="Проверка не найдена")
    
    is_owner = script.get('created_by') == current_user.id
    if is_owner:
        await require_permission(current_user, 'checks_edit_own')
    else:
        await require_permission(current_user, 'checks_edit_all')
    
    update_data = script_update.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="Нет данных для обновления")
    
    result = await db.scripts.update_one({"id": script_id}, {"$set": update_data})
    updated_script = await db.scripts.find_one({"id": script_id}, {"_id": 0})
    return Script(**parse_from_mongo(updated_script))

@api_router.delete("/scripts/{script_id}")
async def delete_script(script_id: str, current_user: User = Depends(get_current_user)):
    '''Delete script (requires checks_delete_own or checks_delete_all permission)'''
    script = await db.scripts.find_one({"id": script_id})
    if not script:
        raise HTTPException(status_code=404, detail="Проверка не найдена")
    
    is_owner = script.get('created_by') == current_user.id
    if is_owner:
        await require_permission(current_user, 'checks_delete_own')
    else:
        await require_permission(current_user, 'checks_delete_all')
    
    result = await db.scripts.delete_one({"id": script_id})
    return {"message": "Проверка удалена"}
"""

# Projects endpoints with auth
projects_code = """
# API Routes - Projects
@api_router.post("/projects", response_model=Project)
async def create_project(project_input: ProjectCreate, current_user: User = Depends(get_current_user)):
    '''Create new project (requires projects_create permission)'''
    await require_permission(current_user, 'projects_create')
    
    project_obj = Project(**project_input.model_dump(), created_by=current_user.id)
    doc = prepare_for_mongo(project_obj.model_dump())
    await db.projects.insert_one(doc)
    return project_obj

@api_router.get("/projects", response_model=List[Project])
async def get_projects(current_user: User = Depends(get_current_user)):
    '''Get all accessible projects'''
    if current_user.is_admin or await has_permission(current_user, 'results_view_all'):
        # Admin or curator sees all projects
        projects = await db.projects.find({}, {"_id": 0}).to_list(1000)
    else:
        # Get projects created by user
        my_projects = await db.projects.find({"created_by": current_user.id}, {"_id": 0}).to_list(1000)
        
        # Get projects with explicit access
        access_records = await db.project_access.find({"user_id": current_user.id}).to_list(1000)
        project_ids = [rec['project_id'] for rec in access_records]
        accessible_projects = await db.projects.find({"id": {"$in": project_ids}}, {"_id": 0}).to_list(1000)
        
        # Combine and deduplicate
        all_projects = {p['id']: p for p in my_projects + accessible_projects}
        projects = list(all_projects.values())
    
    return [Project(**parse_from_mongo(proj)) for proj in projects]

@api_router.get("/projects/{project_id}", response_model=Project)
async def get_project(project_id: str, current_user: User = Depends(get_current_user)):
    '''Get project by ID'''
    if not await can_access_project(current_user, project_id):
        raise HTTPException(status_code=403, detail="Access denied to this project")
    
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")
    return Project(**parse_from_mongo(project))

@api_router.put("/projects/{project_id}", response_model=Project)
async def update_project(project_id: str, project_update: ProjectUpdate, current_user: User = Depends(get_current_user)):
    '''Update project (only creator or admin)'''
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")
    
    if project.get('created_by') != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Only project creator or admin can update")
    
    update_data = project_update.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="Нет данных для обновления")
    
    result = await db.projects.update_one({"id": project_id}, {"$set": update_data})
    updated_proj = await db.projects.find_one({"id": project_id}, {"_id": 0})
    return Project(**parse_from_mongo(updated_proj))

@api_router.delete("/projects/{project_id}")
async def delete_project(project_id: str, current_user: User = Depends(get_current_user)):
    '''Delete project (only creator or admin)'''
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")
    
    if project.get('created_by') != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Only project creator or admin can delete")
    
    # Delete project tasks
    await db.project_tasks.delete_many({"project_id": project_id})
    # Delete project access records
    await db.project_access.delete_many({"project_id": project_id})
    # Delete project
    result = await db.projects.delete_one({"id": project_id})
    return {"message": "Проект удален"}
"""

print("Endpoint code templates ready for integration")
