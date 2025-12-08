##  models/ 


### ✅ 1. **auth_models.py** 
**Классы:**
- `User`, `UserCreate`, `UserUpdate`, `UserResponse`
- `LoginRequest`, `LoginResponse`
- `Role`, `RoleCreate`, `RoleUpdate`, `UserRole`
- `PasswordResetRequest`

**Используется для:** Аутентификация, авторизация, управление пользователями и ролями

---

### ✅ 2. **content_models.py** 
**Классы:**
- `Category`, `CategoryCreate`, `CategoryUpdate`
- `System`, `SystemCreate`, `SystemUpdate`
- `Host`, `HostCreate`, `HostUpdate`
- `Script`, `ScriptCreate`, `ScriptUpdate`

**Используется для:** Управление категориями, системами, хостами и скриптами

---

### ✅ 3. **project_models.py** 
**Классы:**
- `Project`, `ProjectCreate`, `ProjectUpdate`
- `ProjectTask`, `ProjectTaskCreate`, `ProjectTaskUpdate`
- `ProjectAccess`

**Используется для:** Управление проектами, задачами и доступом

---

### ✅ 4. **execution_models.py** 
**Классы:**
- `ExecutionResult`, `Execution`
- `SchedulerJob`, `SchedulerJobCreate`, `SchedulerJobUpdate`
- `SchedulerRun`
- `ExecuteProjectRequest`, `ExecuteRequest`

**Используется для:** Выполнение команд, результаты, планирование

---

### ✅ 5. **audit_models.py** 
**Классы:**
- `AuditLog`

**Используется для:** Логирование действий пользователей

---

### ✅ 6. **__init__.py** 
**Назначение:** Централизованный импорт всех моделей
