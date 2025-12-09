import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import { PlusCircle, Play, Trash2, Eye, Users, UserPlus, UserMinus, User, Search, X, Edit, Server, Upload, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from '../contexts/AuthContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { api } from '../config/api';
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDialog } from "@/hooks/useDialog";
import { ConfirmationDialog } from "@/components/ui/ConfirmationDialog";

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
  const { dialogState, setDialogState, showConfirm, showAlert } = useDialog();
  const [hostsDialogOpen, setHostsDialogOpen] = useState(false);
  const [selectedProjectForHosts, setSelectedProjectForHosts] = useState(null);
  const [projectHosts, setProjectHosts] = useState([]);
  const [allHosts, setAllHosts] = useState([]);
  const [loadingHosts, setLoadingHosts] = useState(false);
  const [editingHost, setEditingHost] = useState(null);
  const [showHostForm, setShowHostForm] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const fileInputRef = useRef(null);
  const [hostFormData, setHostFormData] = useState({
    name: "",
    hostname: "",
    port: 22,
    username: "",
    auth_type: "password",
    password: "",
    ssh_key: "",
    connection_type: "ssh"
  });    

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

  const handleDeleteProject = async (projectId, projectName) => {

    console.log('Кнопка удаления нажата:', projectId, projectName);
    const confirmed = await showConfirm(
      'Удаление проекта',
      `Вы уверены, что хотите удалить проект <strong>"${projectName}"</strong>? Это действие нельзя отменить.`,
      {
        variant: "destructive",
        confirmText: "Удалить",
        cancelText: "Отмена"
      }
    );

    console.log('Диалог закрыт. Результат:', confirmed);

    if (!confirmed) {
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

  const openHostsDialog = async (project) => {
    setSelectedProjectForHosts(project);
    setHostsDialogOpen(true);
    setLoadingHosts(true);
    
    try {
      // Fetch project tasks to get host_ids
      const tasksResponse = await api.get(`/api/projects/${project.id}/tasks`);
      const tasks = tasksResponse.data;
      
      // Get unique host_ids from tasks
      const hostIds = [...new Set(tasks.map(task => task.host_id))];
      
      // Fetch all hosts
      const allHostsResponse = await api.get('/api/hosts');
      setAllHosts(allHostsResponse.data);
      
      // Get project hosts
      const projectHostsData = allHostsResponse.data.filter(host => hostIds.includes(host.id));
      setProjectHosts(projectHostsData);
    } catch (error) {
      console.error('Error fetching project hosts:', error);
      toast.error("Ошибка загрузки хостов проекта");
    } finally {
      setLoadingHosts(false);
    }
  };

  const closeHostsDialog = () => {
    setHostsDialogOpen(false);
    setSelectedProjectForHosts(null);
    setProjectHosts([]);
    setEditingHost(null);
    setShowHostForm(false);
    resetHostForm();
  };

  const resetHostForm = () => {
    setHostFormData({
      name: "",
      hostname: "",
      port: 22,
      username: "",
      auth_type: "password",
      password: "",
      ssh_key: "",
      connection_type: "ssh"
    });
    setEditingHost(null);
    setShowHostForm(false);
  };

  const openAddHostForm = () => {
    resetHostForm();
    setShowHostForm(true);
  };

  const openEditHostDialog = (host) => {
    setEditingHost(host);
    setHostFormData({
      name: host.name,
      hostname: host.hostname,
      port: host.port,
      username: host.username,
      auth_type: host.auth_type,
      password: "",
      ssh_key: host.ssh_key || "",
      connection_type: host.connection_type || "ssh"
    });
    setShowHostForm(true);
  };

  const handleFileImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setImporting(true);
    setImportDialogOpen(true);
    
    try {
      const text = await file.text();
      let hostsData;
      
      try {
        hostsData = JSON.parse(text);
      } catch (e) {
        const jsonObjects = text.trim().split('\n').filter(line => line.trim());
        hostsData = jsonObjects.map(obj => JSON.parse(obj));
      }
      
      if (!Array.isArray(hostsData)) {
        hostsData = [hostsData];
      }
      
      setImportProgress({ current: 0, total: hostsData.length });
      
      let successCount = 0;
      let errorCount = 0;
      
      const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
      
      // Get existing tasks to create tasks for imported hosts
      const tasksResponse = await api.get(`/api/projects/${selectedProjectForHosts.id}/tasks`);
      const existingTasks = tasksResponse.data;
      
      // Get system configurations from existing tasks
      const systemConfigs = {};
      if (existingTasks.length > 0) {
        const firstHostId = existingTasks[0].host_id;
        existingTasks
          .filter(task => task.host_id === firstHostId)
          .forEach(task => {
            if (!systemConfigs[task.system_id]) {
              systemConfigs[task.system_id] = {
                system_id: task.system_id,
                script_ids: task.script_ids,
                reference_data: task.reference_data || {}
              };
            }
          });
      }
      
      for (let i = 0; i < hostsData.length; i++) {
        const hostData = hostsData[i];
        try {
          const newHostResponse = await api.post('/api/hosts', {
            name: hostData.name,
            hostname: hostData.hostname,
            port: hostData.port,
            username: hostData.username,
            auth_type: hostData.auth_type,
            password: hostData.password,
            ssh_key: hostData.ssh_key,
            connection_type: hostData.connection_type,
          });
          
          const newHost = newHostResponse.data;
          
          // Add to project hosts
          setProjectHosts(prev => [...prev, newHost]);
          
          // Create tasks for this host
          if (Object.keys(systemConfigs).length > 0) {
            for (const [systemId, config] of Object.entries(systemConfigs)) {
              await api.post(`/api/projects/${selectedProjectForHosts.id}/tasks`, {
                host_id: newHost.id,
                system_id: systemId,
                script_ids: config.script_ids,
                reference_data: config.reference_data
              });
            }
          }
          
          successCount++;
        } catch (error) {
          console.error(`Ошибка импорта хоста ${hostData.name}:`, error);
          errorCount++;
        }
        
        setImportProgress({ current: i + 1, total: hostsData.length });
        
        // Задержка между хостами (кроме последнего)
        if (i < hostsData.length - 1) {
          await delay(1000);
        }
      }
      
      // Небольшая задержка перед закрытием диалога
      await delay(500);
      
      // Refresh all hosts
      const allHostsResponse = await api.get('/api/hosts');
      setAllHosts(allHostsResponse.data);
      
      setImportDialogOpen(false);
      
      await showAlert(
        "Импорт завершен", 
        `Успешно импортировано хостов: ${successCount} <br />С ошибками: ${errorCount}`
      );
      
    } catch (error) {
      console.error('Ошибка импорта файла:', error);
      setImportDialogOpen(false);
      await showAlert(
        "Ошибка импорта", 
        "Ошибка при импорте файла. Проверьте формат файла."
      );
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleHostSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingHost) {
        // Update existing host
        await api.put(`/api/hosts/${editingHost.id}`, hostFormData);
        toast.success("Хост обновлен");
        
        // Refresh hosts
        const allHostsResponse = await api.get('/api/hosts');
        setAllHosts(allHostsResponse.data);
        
        // Update project hosts if it's in the list
        const updatedHost = allHostsResponse.data.find(h => h.id === editingHost.id);
        if (updatedHost && projectHosts.find(h => h.id === editingHost.id)) {
          setProjectHosts(prev => prev.map(h => h.id === editingHost.id ? updatedHost : h));
        }
      } else {
        // Create new host and add to project
        const newHostResponse = await api.post('/api/hosts', hostFormData);
        const newHost = newHostResponse.data;
        
        toast.success("Хост добавлен");
        
        // Refresh all hosts
        const allHostsResponse = await api.get('/api/hosts');
        setAllHosts(allHostsResponse.data);
        
        // Add to project hosts
        setProjectHosts(prev => [...prev, newHost]);
        
        // Create tasks for this host (need to get systems from existing tasks)
        try {
          const tasksResponse = await api.get(`/api/projects/${selectedProjectForHosts.id}/tasks`);
          const existingTasks = tasksResponse.data;
          
          if (existingTasks.length > 0) {
            // Group tasks by host to get system configurations
            const hostTasksMap = {};
            existingTasks.forEach(task => {
              if (!hostTasksMap[task.host_id]) {
                hostTasksMap[task.host_id] = [];
              }
              hostTasksMap[task.host_id].push(task);
            });
            
            // Get system configurations from first existing host's tasks
            const firstHostId = Object.keys(hostTasksMap)[0];
            const firstHostTasks = hostTasksMap[firstHostId];
            
            // Create tasks for new host with same system configurations
            for (const task of firstHostTasks) {
              await api.post(`/api/projects/${selectedProjectForHosts.id}/tasks`, {
                host_id: newHost.id,
                system_id: task.system_id,
                script_ids: task.script_ids,
                reference_data: task.reference_data || {}
              });
            }
          }
        } catch (error) {
          console.error('Error creating tasks for new host:', error);
          // Don't fail the whole operation if task creation fails
        }
      }
      
      resetHostForm();
    } catch (error) {
      console.error('Error saving host:', error);
      toast.error(error.response?.data?.detail || "Ошибка сохранения хоста");
    }
  };

  const handleRemoveHost = async (hostId) => {
    const confirmed = await showConfirm(
      "Удаление хоста из проекта",
      "Вы уверены, что хотите удалить этот хост из проекта? Все задачи для этого хоста будут удалены.",
      {
        variant: "destructive",
        confirmText: "Удалить",
        cancelText: "Отмена"
      }
    );

    if (!confirmed) return;

    try {
      // Delete all tasks for this host
      const tasksResponse = await api.get(`/api/projects/${selectedProjectForHosts.id}/tasks`);
      const tasks = tasksResponse.data.filter(task => task.host_id === hostId);
      
      for (const task of tasks) {
        await api.delete(`/api/projects/${selectedProjectForHosts.id}/tasks/${task.id}`);
      }
      
      // Remove from project hosts list
      setProjectHosts(prev => prev.filter(h => h.id !== hostId));
      
      toast.success("Хост удален из проекта");
    } catch (error) {
      console.error('Error removing host:', error);
      toast.error("Ошибка удаления хоста из проекта");
    }
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
                  <div className="flex items-center gap-1">
                    {isProjectOwner(project) && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openHostsDialog(project)}
                          className="flex-shrink-0 text-black hover:bg-blue-500 hover:text-white"
                          title="Редактировать хосты">
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteProject(project.id, project.name)}
                          className="flex-shrink-0 text-black hover:bg-red-500">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </div>
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

      {/* Hosts Management Dialog */}
      <Dialog open={hostsDialogOpen} onOpenChange={(open) => {
        if (!open) closeHostsDialog();
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Управление хостами проекта</DialogTitle>
            <DialogDescription>
              {selectedProjectForHosts?.name}
            </DialogDescription>
          </DialogHeader>

          {loadingHosts ? (
            <div className="flex justify-center items-center py-8">
              <div className="text-gray-500">Загрузка...</div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Action Buttons */}
              <div className="flex gap-2 items-center">
                <Button
                  type="button"
                  variant="outline"
                  onClick={openAddHostForm}
                  className="flex-1"
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Добавить хост
                </Button>
                <input
                  type="file"
                  accept=".json, .txt"
                  ref={fileInputRef}
                  onChange={handleFileImport}
                  className="hidden"
                />
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-10 w-10 p-0"
                      >
                        <HelpCircle className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="w-96">
                      <pre className="text-xs whitespace-pre-wrap">
{`
•Импорт хостов реализован в формате json;
•Используйте файлы .json или .txt;
•Они должны содержать валидный массив json-файлов или json'ы одной строкой;
•Для linux порт 22 и connection_type=ssh;
•Для windows порт 5986 и connection_type=winrm; 
•Для авторизации через ssh-key auth_type=key;
•Пример:
[
  {
    "name": "Linux Server 1",
    "hostname": "192.168.1.100",
    "port": 22,
    "username": "admin",
    "auth_type": "password",
    "password": "admin123",
    "ssh_key": "",
    "connection_type": "ssh"
  }
]`}
                      </pre>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Импортировать хосты
                </Button>
              </div>

              {/* Host Form - Hidden by default */}
              {showHostForm && (
                <div className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold flex items-center">
                      <Server className="mr-2 h-4 w-4" />
                      {editingHost ? "Редактировать хост" : "Добавить новый хост"}
                    </h3>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={resetHostForm}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <form onSubmit={handleHostSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Название</Label>
                      <Input
                        placeholder="ЗАКС сервер хранения"
                        value={hostFormData.name}
                        onChange={(e) => setHostFormData({...hostFormData, name: e.target.value})}
                        required
                      />
                    </div>
                    <div>
                      <Label>Хост</Label>
                      <Input
                        placeholder="192.168.1.1 или host1.rn.ru"
                        value={hostFormData.hostname}
                        onChange={(e) => setHostFormData({...hostFormData, hostname: e.target.value})}
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Порт</Label>
                      <Input
                        type="number"
                        value={hostFormData.port}
                        onChange={(e) => setHostFormData({...hostFormData, port: parseInt(e.target.value)})}
                        required
                      />
                    </div>
                    <div>
                      <Label>Имя пользователя</Label>
                      <Input
                        value={hostFormData.username}
                        placeholder="user"
                        onChange={(e) => setHostFormData({...hostFormData, username: e.target.value})}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Тип подключения</Label>
                      <Select 
                        value={hostFormData.connection_type || 'ssh'} 
                        onValueChange={(value) => {
                          const newPort = value === 'winrm' ? 5985 : 22;
                          setHostFormData({...hostFormData, connection_type: value, port: newPort});
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ssh">SSH (Linux)</SelectItem>
                          <SelectItem value="winrm">WinRM (Windows)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Тип аутентификации</Label>
                      <Select 
                        value={hostFormData.auth_type} 
                        onValueChange={(value) => setHostFormData({...hostFormData, auth_type: value})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="password">Пароль</SelectItem>
                          <SelectItem value="key">SSH ключ</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {hostFormData.auth_type === "password" ? (
                    <div>
                      <Label>Пароль</Label>
                      <Input
                        type="password"
                        value={hostFormData.password}
                        onChange={(e) => setHostFormData({...hostFormData, password: e.target.value})}
                        placeholder={editingHost ? "Оставьте пустым, чтобы не менять" : "Введите пароль"}
                        required={!editingHost}
                      />
                    </div>
                  ) : (
                    <div>
                      <Label>SSH ключ</Label>
                      <Textarea
                        value={hostFormData.ssh_key}
                        onChange={(e) => setHostFormData({...hostFormData, ssh_key: e.target.value})}
                        placeholder="-----BEGIN RSA PRIVATE KEY-----..."
                        rows={4}
                        required
                      />
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    {editingHost && (
                      <Button type="button" variant="outline" onClick={resetHostForm}>
                        Отмена
                      </Button>
                    )}
                    <Button type="submit">
                      {editingHost ? "Сохранить изменения" : "Добавить хост"}
                    </Button>
                  </div>
                </form>
                </div>
              )}

              {/* Current Project Hosts */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center">
                  <Server className="mr-2 h-4 w-4" />
                  Хосты проекта ({projectHosts.length})
                </h3>
                {projectHosts.length === 0 ? (
                  <p className="text-sm text-gray-500">Нет хостов в проекте</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {projectHosts.map((host) => (
                      <div key={host.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium">{host.name}</p>
                            <Badge variant="outline" className="text-xs">
                              {host.connection_type === "ssh" ? "Linux" : "Windows"}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {host.auth_type === "password" ? "Пароль" : "SSH ключ"}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-500">
                            {host.username}@{host.hostname}:{host.port}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditHostDialog(host)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemoveHost(host.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Import Progress Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Импорт хостов</DialogTitle>
            <DialogDescription>
              Импортирование хостов из файла...
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Прогресс:</span>
                <span>{importProgress.current} / {importProgress.total}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                />
              </div>
            </div>
            {importing && (
              <p className="text-sm text-gray-500 text-center">
                Пожалуйста, подождите...
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        open={dialogState.open}
        onOpenChange={(open) => {
          if (!open) {
            if (dialogState.onCancel) {
              dialogState.onCancel();
            } else {
              setDialogState(prev => ({ ...prev, open: false }));
            }
          }
        }}
        title={dialogState.title}
        description={dialogState.description}
        confirmText={dialogState.confirmText}
        cancelText={dialogState.onCancel ? dialogState.cancelText : undefined}
        onConfirm={dialogState.onConfirm || (() => {})}
        onCancel={dialogState.onCancel}
        variant={dialogState.variant}
      />
    </div>
  );
}
