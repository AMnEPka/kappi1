import React, { useState, useEffect, useMemo } from 'react';
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { PlusCircle, Play, Trash2, Eye, Users, UserPlus, UserMinus, User, Search, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from '../contexts/AuthContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { api } from '../config/api';
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export default function ProjectsPage({ onNavigate }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [accessDialogOpen, setAccessDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [projectUsers, setProjectUsers] = useState([]);
  const [loadingAccess, setLoadingAccess] = useState(false);
  const {hasPermission, isAdmin, user} = useAuth();
  const [userSearchTerm, setUserSearchTerm] = useState('');  

  useEffect(() => {
    fetchProjects();
  }, []);

  const availableUsers = useMemo(() => {
    const filteredUsers = allUsers.filter(u => 
      // Исключаем пользователей которые уже имеют доступ
      !projectUsers.find(pu => pu.id === u.id) && 
      // Исключаем администраторов
      !u.is_admin
    );
  
    if (!userSearchTerm.trim()) {
      return filteredUsers;
    }
  
    const searchTerm = userSearchTerm.toLowerCase();
    return filteredUsers.filter(user =>
      user.full_name?.toLowerCase().includes(searchTerm) ||
      user.username?.toLowerCase().includes(searchTerm)
    );
  }, [allUsers, projectUsers, userSearchTerm]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/projects`);
      setProjects(response.data);
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast.error("Ошибка загрузки проектов");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProject = async (projectId) => {
    if (!window.confirm('Вы уверены, что хотите удалить этот проект?')) {
      return;
    }

    try {
      await api.delete(`/api/projects/${projectId}`);
      toast.success("Проект удален");
      fetchProjects();
    } catch (error) {
      console.error('Error deleting project:', error);
      toast.error("Не удалось удалить проект");
    }
  };

// В функции загрузки пользователей проекта
const fetchProjectUsers = async (projectId) => {
  try {
    // Получаем явно предоставленный доступ
    const accessResponse = await api.get(`/api/projects/${projectId}/users`);
    const explicitAccess = accessResponse.data;
    
    // Получаем создателя проекта
    const projectResponse = await api.get(`/api/projects/${projectId}`);
    const project = projectResponse.data;
    const creatorId = project.created_by;
    
    // Получаем информацию о создателе
    const creatorResponse = await api.get(`/api/users/${creatorId}`);
    const creator = creatorResponse.data;
    
    // Объединяем создателя и пользователей с явным доступом
    const allProjectUsers = [creator, ...explicitAccess];
    
    // Убираем дубликаты на случай если создатель уже в списке доступа
    const uniqueUsers = allProjectUsers.filter((user, index, self) => 
      index === self.findIndex(u => u.id === user.id)
    );
    
    setProjectUsers(uniqueUsers);
  } catch (error) {
    console.error('Error fetching project users:', error);
    setProjectUsers([]);
  }
};

  const openAccessDialog = async (project) => {
    setSelectedProject(project);
    setAccessDialogOpen(true);
    setLoadingAccess(true);
    
    try {
      // Fetch all users and project users in parallel
      const [usersRes, projectUsersRes] = await Promise.all([
        api.get(`/api/users`),
        api.get(`/api/projects/${project.id}/users`)
      ]);
      
      setAllUsers(usersRes.data.filter(u => u.is_active));
      // Ensure projectUsers is always an array (backend returns {users: [...]})
      const users = projectUsersRes.data?.users || projectUsersRes.data;
      setProjectUsers(Array.isArray(users) ? users : []);
    } catch (error) {
      console.error('Error fetching access data:', error);
      toast.error("Не удалось загрузить данные доступа");
    } finally {
      setLoadingAccess(false);
    }
  };

  const handleGrantAccess = async (userId) => {
    try {
      await api.post(`/api/projects/${selectedProject.id}/users/${userId}`);
      toast.success("Доступ предоставлен");
      
      // Refresh project users list
      const response = await api.get(`/api/projects/${selectedProject.id}/users`);
      // Ensure projectUsers is always an array (backend returns {users: [...]})
      const users = response.data?.users || response.data;
      setProjectUsers(Array.isArray(users) ? users : []);
    } catch (error) {
      console.error('Error granting access:', error);
      toast.error(error.response?.data?.detail || "Не удалось предоставить доступ");
    }
  };

  const handleRevokeAccess = async (userId) => {
    try {
      await api.delete(`/api/projects/${selectedProject.id}/users/${userId}`);
      toast.success("Доступ отозван");
      
      // Refresh project users list
      const response = await api.get(`/api/projects/${selectedProject.id}/users`);
      // Ensure projectUsers is always an array (backend returns {users: [...]})
      const users = response.data?.users || response.data;
      setProjectUsers(Array.isArray(users) ? users : []);
    } catch (error) {
      console.error('Error revoking access:', error);
      toast.error(error.response?.data?.detail || "Не удалось отозвать доступ");
    }
  };

  const isProjectOwner = (project) => {
    return project.created_by === user?.id || isAdmin;
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      draft: { label: 'Черновик', className: 'bg-gray-500' },
      running: { label: 'Выполняется', className: 'bg-blue-500 animate-pulse' },
      completed: { label: 'Завершено', className: 'bg-green-500' },
      failed: { label: 'Ошибка', className: 'bg-red-500' },
    };

    const config = statusConfig[status] || statusConfig.draft;
    return (
      <span className={`px-2 py-1 rounded text-white text-xs ${config.className}`}>
        {config.label}
      </span>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('ru-RU');
  };

  const canCreateProjects = hasPermission('projects_create');
  const canExecuteProjects = hasPermission('projects_execute');

  return (
    <div className="space-y-6">
  <div className="flex justify-between items-center">
    <div>
      <h1 className="text-3xl font-bold">Проекты</h1>
      <p className="text-gray-600 mt-1">
        Проекты агрегируют массовое исполнение проверок на разных хостах
      </p>
    </div>
    {canCreateProjects && (
      <Button onClick={() => onNavigate('project-wizard')} variant="yellow">
        <PlusCircle className="mr-2 h-4 w-4" />
        Создать проект
      </Button>
    )}
  </div>

  {loading ? (
    <div className="flex justify-center items-center h-64">
      <div className="text-gray-500">Загрузка...</div>
    </div>
  ) : projects.length === 0 ? (
    <Card>
      <CardContent className="flex flex-col items-center justify-center h-64">
        <p className="text-gray-500 mb-4">Проектов пока нет</p>
        {canCreateProjects && (
          <Button onClick={() => onNavigate('project-wizard')} variant="yellow">
            <PlusCircle className="mr-2 h-4 w-4" />
            Создать первый проект
          </Button>
        )}
        {!canCreateProjects && (
          <p className="text-gray-400 text-sm">У вас нет прав на создание проектов</p>
        )}
      </CardContent>
    </Card>
  ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((project) => (
            <Card key={project.id} className="flex flex-col h-full">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-center"> 
                  <CardTitle className="text-lg line-clamp-1 flex-1">{project.name}</CardTitle>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                          <User className="h-3 w-3 text-gray-400" />
                          <span className="text-xs text-gray-500 font-medium">
                            {project.creator_full_name || project.creator_username || 'Неизвестно'}
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Создатель проекта</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                {project.description && (
                  <CardDescription className="line-clamp-2 mt-2">
                    {project.description}
                  </CardDescription>
                )}
              </CardHeader>
              
              <CardContent className="pb-4 flex-1">
                <div className="flex justify-between items-center mb-3"> 
                  <div className="text-sm">
                    <p className="text-gray-500">Создан: <span className="font-medium">{formatDate(project.created_at)}</span></p>
                  </div>
                  {isProjectOwner(project) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteProject(project.id)}
                      className="flex-shrink-0 text-black hover:bg-red-500">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>

                <div className="flex gap-2"> 
                  {canExecuteProjects && (
                    <Button
                      size="sm"
                      onClick={() => onNavigate('project-execute', project.id)}
                      className="flex-1"
                      variant="outline_green"
                    >
                      <Play className="mr-1 h-3 w-3" />
                      Запустить
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onNavigate('project-results', project.id)}
                    className="flex-1"
                  >
                    <Eye className="mr-1 h-3 w-3" />
                    Результаты
                  </Button>
                  {isAdmin && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openAccessDialog(project)}
                      className="flex-1"
                    >
                      <Users className="mr-1 h-3 w-3" />
                      Доступ
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

{/* Access Management Dialog */}
<Dialog open={accessDialogOpen} onOpenChange={setAccessDialogOpen}>
  <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle>Управление доступом к проекту</DialogTitle>
      <DialogDescription>
        {selectedProject?.name}
      </DialogDescription>
    </DialogHeader>
    
    {loadingAccess ? (
      <div className="flex justify-center items-center py-8">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    ) : (
      <div className="space-y-6">
        {/* Current users with access */}
        <div>
          <h3 className="font-semibold mb-3 flex items-center">
            <Users className="mr-2 h-4 w-4" />
            Пользователи с доступом ({projectUsers.length})
          </h3>
          {projectUsers.length === 0 ? (
            <p className="text-sm text-gray-500">Нет пользователей с доступом (Администраторы не отображаются)</p>
          ) : (
            <div className="space-y-2">
              {projectUsers.map((projectUser) => (
                <div key={projectUser.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <div>
                      <p className="font-medium">{projectUser.full_name}</p>
                      <p className="text-sm text-gray-500">@{projectUser.username}</p>
                    </div>
                    {projectUser.id === selectedProject?.created_by && (
                      <Badge variant="outline" className="text-xs">
                        Создатель
                      </Badge>
                    )}
                  </div>
                  {projectUser.id !== selectedProject?.created_by && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRevokeAccess(projectUser.id)}
                    >
                      <UserMinus className="mr-1 h-3 w-3" />
                      Отозвать
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Available users to grant access */}
        <div>
          <h3 className="font-semibold mb-3 flex items-center">
            <UserPlus className="mr-2 h-4 w-4" />
            Предоставить доступ
          </h3>
          
          {/* Search input with clear button */}
          <div className="mb-4 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Поиск пользователей по имени или логину..."
              value={userSearchTerm}
              onChange={(e) => setUserSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10"
            />
            {userSearchTerm && (
              <button
                onClick={() => setUserSearchTerm('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {availableUsers.length === 0 ? (
            <p className="text-sm text-gray-500">
              {userSearchTerm ? "Пользователи не найдены" : "Нет пользователей для предоставления доступа"}
            </p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {availableUsers.map((availableUser) => (
                <div key={availableUser.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                  <div>
                    <p className="font-medium">{availableUser.full_name}</p>
                    <p className="text-sm text-gray-500">@{availableUser.username}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleGrantAccess(availableUser.id)}
                  >
                    <UserPlus className="mr-1 h-3 w-3" />
                    Добавить
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )}
  </DialogContent>
</Dialog>
    </div>
  );
}
