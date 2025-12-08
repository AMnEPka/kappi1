// src/hooks/usePermissions.js
import { useAuth } from '@/contexts/AuthContext';

/**
 * Хук для проверки прав доступа
 * Использование: const { canEditScript } = usePermissions();
 */
export const usePermissions = () => {
  const { user, isAdmin, hasPermission } = useAuth();
  
  const canCreateScript = () => {
    if (!user) return false;
    if (isAdmin) return true;
    return hasPermission('checks_create');
  };

  const canEditScript = (script) => {
    if (!user) return false;
    if (isAdmin) return true;
    if (hasPermission('checks_edit_all')) return true;
    return script.created_by === user.id && hasPermission('checks_edit_own');
  };

  const canDeleteScript = (script) => {
    if (!user) return false;
    if (isAdmin) return true;
    if (hasPermission('checks_delete_all')) return true;
    return script.created_by === user.id && hasPermission('checks_delete_own');
  };

  const canCreateHost = () => {
    if (!user) return false;
    if (isAdmin) return true;
    return hasPermission('hosts_create');
  };

  const canEditHost = (host) => {
    if (!user) return false;
    if (isAdmin) return true;
    if (hasPermission('hosts_edit_all')) return true;
    return host.created_by === user.id && hasPermission('hosts_edit_own');
  };

  const canDeleteHost = (host) => {
    if (!user) return false;
    if (isAdmin) return true;
    if (hasPermission('hosts_delete_all')) return true;
    return host.created_by === user.id && hasPermission('hosts_delete_own');
  };

  const canManageCategories = () => {
    if (!user) return false;
    if (isAdmin) return true;
    return hasPermission('categories_manage');
  };

  const canManageUsers = () => {
    if (!user) return false;
    if (isAdmin) return true;
    return hasPermission('users_manage');
  };

  const canViewUsers = () => {
    if (!user) return false;
    if (isAdmin) return true;
    return hasPermission('users_view');
  };

  const canManageRoles = () => {
    if (!user) return false;
    if (isAdmin) return true;
    return hasPermission('roles_manage');
  };

  const canCreateProject = () => {
    if (!user) return false;
    if (isAdmin) return true;
    return hasPermission('projects_create');
  };

  const canExecuteProject = () => {
    if (!user) return false;
    if (isAdmin) return true;
    return hasPermission('projects_execute');
  };

  const canViewAllResults = () => {
    if (!user) return false;
    if (isAdmin) return true;
    return hasPermission('results_view_all');
  };

  const canExportAllResults = () => {
    if (!user) return false;
    if (isAdmin) return true;
    return hasPermission('results_export_all');
  };

  const canAccessScheduler = () => {
    if (!user) return false;
    if (isAdmin) return true;
    return hasPermission('scheduler_access');
  };

  const canAccessLogs = () => {
    if (!user) return false;
    if (isAdmin) return true;
    return hasPermission('logs_access');
  };

  return {
    // Scripts
    canCreateScript,
    canEditScript,
    canDeleteScript,
    
    // Hosts
    canCreateHost,
    canEditHost,
    canDeleteHost,
    
    // Categories
    canManageCategories,
    
    // Users
    canManageUsers,
    canViewUsers,
    
    // Roles
    canManageRoles,
    
    // Projects
    canCreateProject,
    canExecuteProject,
    
    // Results
    canViewAllResults,
    canExportAllResults,
    
    // System
    canAccessScheduler,
    canAccessLogs,
    
    // User info
    user,
    isAdmin
  };
};