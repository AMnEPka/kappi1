import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Checkbox } from "../components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Server, ChevronLeft, ChevronRight, Check, Plus, Trash2, HelpCircle, Loader2, Upload, Edit, Copy } from "lucide-react";
import { toast } from "sonner";
import { api } from '../config/api';
import { useAuth } from '../contexts/AuthContext';

export default function ProjectWizard({ onNavigate }) {
  const [step, setStep] = useState(1);
  const [projectData, setProjectData] = useState({
    name: '',
    description: '',
    hosts: [],
    tasks: [], // { host_id, systems: [{ system_id, script_ids, reference_data: {script_id: text} }] }
    accessUserIds: [], // List of user IDs who will have access to this project
    hostsList: [] // Список хостов проекта
  });

  const [hosts, setHosts] = useState([]); // Все хосты из базы
  const [categories, setCategories] = useState([]);
  const [systems, setSystems] = useState([]);
  const [scripts, setScripts] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const { user: currentUser } = useAuth();
  const [systemCheckTemplates, setSystemCheckTemplates] = useState({});

// Замените текущий useEffect на:
useEffect(() => {
  const loadData = async () => {
    // Ждем пока пользователь авторизуется
    if (!currentUser) {
      console.log('⏳ Ждем авторизации пользователя...');
      return;
    }
    
    console.log('👤 Пользователь авторизован:', currentUser.username);
    console.log('🔑 Токен есть:', !!localStorage.getItem('token'));
    
    // Даем небольшую задержку
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Теперь загружаем данные
    await fetchData();
  };
  
  loadData();
}, [currentUser]); // Зависимость от currentUser, а не пустой массив

  // API функции для работы с хостами
  const saveHostToDatabase = async (hostData) => {
    try {
      console.log('📨 Отправка POST /api/hosts:', hostData);
      const response = await api.post('/api/hosts', hostData);
      console.log('📬 Ответ от сервера:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Ошибка в saveHostToDatabase:', error);
      console.error('🔍 Детали:', error.response?.data);
      throw error;
    }
  };

  const updateHostInDatabase = async (hostId, hostData) => {
    try {
      const response = await api.put(`/api/hosts/${hostId}`, hostData);
      return response.data;
    } catch (error) {
      console.error('Error updating host:', error);
      throw error;
    }
  };

  const deleteHostFromDatabase = async (hostId) => {
    try {
      await api.delete(`/api/hosts/${hostId}`);
    } catch (error) {
      console.error('Error deleting host:', error);
      throw error;
    }
  };

  const fetchAllHosts = async () => {
    try {
      const response = await api.get('/api/hosts');
      setHosts(response.data);
    } catch (error) {
      console.error('Error fetching hosts:', error);
      // Не показываем ошибку, если это 500 из-за отсутствия auth_type
      if (error.response?.status !== 500) {
        toast.error("Не удалось загрузить хосты");
      }
    }
  };

  // Функция для обновления шаблонов при выборе проверок
  const updateSystemCheckTemplate = (systemId, scriptIds) => {
    setSystemCheckTemplates(prev => ({
      ...prev,
      [systemId]: [...scriptIds] // Сохраняем копию массива
    }));
  };

  // Функция для получения шаблона проверок для системы
  const getSystemCheckTemplate = (systemId) => {
    return systemCheckTemplates[systemId] || [];
  };

  const fetchData = async () => {
    try {
      console.log('🔍 fetchData вызывается');
      
      // Пробуем получить хосты отдельно
      console.log('🔄 Запрашиваем хосты...');
      const hostsRes = await api.get(`/api/hosts`);
      console.log('✅ Ответ хостов:', {
        status: hostsRes.status,
        data: hostsRes.data,
        dataIsArray: Array.isArray(hostsRes.data),
        dataLength: Array.isArray(hostsRes.data) ? hostsRes.data.length : 'N/A'
      });
      
      // Сохраняем в состояние
      setHosts(hostsRes.data);
      console.log('📊 Хосты сохранены в состояние:', hostsRes.data?.length || 0);
      
      // Остальные запросы...
      const [categoriesRes, systemsRes, scriptsRes, usersRes] = await Promise.all([
        api.get(`/api/categories`),
        api.get(`/api/systems`),
        api.get(`/api/scripts`),
        api.get(`/api/users`),
      ]);
      
      setCategories(categoriesRes.data);
      setSystems(systemsRes.data);
      setScripts(scriptsRes.data);
      setUsers(usersRes.data);
      
      console.log('✨ Все данные загружены');
      
    } catch (error) {
      console.error('❌ Ошибка в fetchData:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        stack: error.stack
      });
      toast.error("Не удалось загрузить данные");
    }
  };

  const handleHostToggle = (hostId) => {
    setProjectData(prev => {
      const isSelected = prev.hosts.includes(hostId);
      let newHosts;
      let newTasks = [...prev.tasks];

      if (isSelected) {
        // Remove host
        newHosts = prev.hosts.filter(id => id !== hostId);
        // Remove tasks for this host
        newTasks = newTasks.filter(task => task.host_id !== hostId);
      } else {
        // Add host
        newHosts = [...prev.hosts, hostId];
        // Add empty task structure for this host
        newTasks.push({
          host_id: hostId,
          systems: [], // Each system will be { system_id, script_ids }
        });
      }

      return { ...prev, hosts: newHosts, tasks: newTasks };
    });
  };

  const handleAddSystemToHost = (hostId) => {
    const updatedTasks = [...(projectData.tasks || [])];
    const taskIndex = updatedTasks.findIndex(t => t.host_id === hostId);
    
    if (taskIndex !== -1) {
      const task = updatedTasks[taskIndex];
      const host = getHostById(hostId);
      
      // Находим доступные системы, которые еще не выбраны для этого хоста
      const availableSystems = systems.filter(sys => {
        // Фильтр по ОС
        const systemOsType = sys.os_type;
        const hostConnectionType = host?.connection_type;
        if (hostConnectionType === 'ssh') return systemOsType === 'linux';
        if (hostConnectionType === 'winrm') return systemOsType === 'windows';
        return true;
      }).filter(sys => !task.systems.some(existingSystem => existingSystem.system_id === sys.id));
      
      if (availableSystems.length > 0) {
        // Берем первую доступную систему
        const firstAvailableSystem = availableSystems[0];
        
        // Получаем сохраненный шаблон проверок для этой системы
        const savedScriptIds = getSystemCheckTemplate(firstAvailableSystem.id);
        
        // Получаем доступные проверки для системы
        const availableScripts = getScriptsBySystemId(firstAvailableSystem.id);
        
        // Фильтруем сохраненные проверки, оставляя только доступные
        const validSavedScriptIds = savedScriptIds.filter(scriptId => 
          availableScripts.some(script => script.id === scriptId)
        );
        
        const newSystem = {
          system_id: firstAvailableSystem.id,
          script_ids: validSavedScriptIds.length > 0 ? validSavedScriptIds : []
        };
        
        const updatedSystems = [...task.systems, newSystem];
        
        updatedTasks[taskIndex] = {
          ...task,
          systems: updatedSystems
        };
        
        setProjectData(prev => ({
          ...prev,
          tasks: updatedTasks
        }));
      }
    }
  };

  const applyTemplateToAllHosts = (systemId, scriptIds) => {
    const updatedTasks = [...(projectData.tasks || [])];
    
    updatedTasks.forEach((task, taskIndex) => {
      const updatedSystems = [...task.systems];
      
      updatedSystems.forEach((system, systemIndex) => {
        if (system.system_id === systemId) {
          const availableScripts = getScriptsBySystemId(systemId);
          const validScriptIds = scriptIds.filter(scriptId => 
            availableScripts.some(script => script.id === scriptId)
          );
          
          updatedSystems[systemIndex] = {
            ...system,
            script_ids: validScriptIds
          };
        }
      });
      
      updatedTasks[taskIndex] = {
        ...task,
        systems: updatedSystems
      };
    });
    
    setProjectData(prev => ({
      ...prev,
      tasks: updatedTasks
    }));
  };  

  const handleRemoveSystemFromHost = (hostId, systemIndex) => {
    setProjectData(prev => ({
      ...prev,
      tasks: prev.tasks.map(task =>
        task.host_id === hostId
          ? { ...task, systems: task.systems.filter((_, idx) => idx !== systemIndex) }
          : task
      ),
    }));
  };

  const handleTaskSystemChange = (hostId, systemIndex, systemId) => {
    const updatedTasks = [...(projectData.tasks || [])];
    const taskIndex = updatedTasks.findIndex(t => t.host_id === hostId);
    
    if (taskIndex !== -1) {
      const task = updatedTasks[taskIndex];
      const updatedSystems = [...task.systems];
      const system = updatedSystems[systemIndex];
      
      // Получаем сохраненный шаблон проверок для этой системы
      const savedScriptIds = getSystemCheckTemplate(systemId);
      
      // Получаем доступные проверки для новой системы
      const availableScripts = getScriptsBySystemId(systemId);
      
      // Фильтруем сохраненные проверки, оставляя только те, которые доступны для этой системы
      const validSavedScriptIds = savedScriptIds.filter(scriptId => 
        availableScripts.some(script => script.id === scriptId)
      );
      
      // Обновляем систему с сохраненными проверками, если они есть
      updatedSystems[systemIndex] = {
        ...system,
        system_id: systemId,
        script_ids: validSavedScriptIds.length > 0 ? validSavedScriptIds : []
      };
      
      updatedTasks[taskIndex] = {
        ...task,
        systems: updatedSystems
      };
      
      setProjectData(prev => ({
        ...prev,
        tasks: updatedTasks
      }));
    }
  };

  const handleTaskScriptToggle = (hostId, systemIndex, scriptId) => {
    const updatedTasks = [...(projectData.tasks || [])];
    const taskIndex = updatedTasks.findIndex(t => t.host_id === hostId);
    
    if (taskIndex !== -1) {
      const task = updatedTasks[taskIndex];
      const updatedSystems = [...task.systems];
      const system = updatedSystems[systemIndex];
      
      const isCurrentlySelected = system.script_ids.includes(scriptId);
      const updatedScriptIds = isCurrentlySelected
        ? system.script_ids.filter(id => id !== scriptId)
        : [...system.script_ids, scriptId];
      
      updatedSystems[systemIndex] = {
        ...system,
        script_ids: updatedScriptIds
      };
      
      updatedTasks[taskIndex] = {
        ...task,
        systems: updatedSystems
      };
      
      setProjectData(prev => ({
        ...prev,
        tasks: updatedTasks
      }));
      
      // Обновляем шаблон при изменении проверок
      if (system.system_id) {
        updateSystemCheckTemplate(system.system_id, updatedScriptIds);
      }
    }
  };

  const canProceedToStep2 = () => {
    return projectData.name.trim() !== '';
  };

  const canProceedToStep3 = () => {
    return projectData.hostsList && projectData.hostsList.length > 0;
  };

  const canProceedToStep4 = () => {
    return projectData.tasks.every(
      task => task.systems.length > 0 && task.systems.every(
        sys => sys.system_id && sys.script_ids.length > 0
      )
    );
  };

  const handleNext = () => {
    if (step === 1 && !canProceedToStep2()) {
      toast.error("Введите название проекта");
      return;
    }
    if (step === 2 && !canProceedToStep3()) {
      toast.error("Выберите хотя бы один хост");
      return;
    }

    // При переходе на шаг 3 инициализируем задачи
    if (step === 2) {
      const tasks = initializeTasksFromHosts(projectData.hostsList);
      setProjectData(prev => ({
        ...prev,
        tasks: tasks
      }));
    }

    if (step === 3 && !canProceedToStep4()) {
      toast.error("Для каждого хоста добавьте хотя бы одну систему и выберите проверки");
      return;
    }
    
    // Skip step 4 if no reference files needed
    if (step === 3) {
      const hasReferenceFiles = projectData.tasks.some(task =>
        task.systems.some(system =>
          system.script_ids.some(scriptId => {
            const script = scripts.find(s => s.id === scriptId);
            return script && script.has_reference_files;
          })
        )
      );
      if (!hasReferenceFiles) {
        setStep(5); // Skip to access management
        return;
      }
    }
    
    setStep(step + 1);
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleCreateProject = async () => {
    try {
      setLoading(true);

      // Create project
      const projectResponse = await api.post(`/api/projects`, {
        name: projectData.name,
        description: projectData.description,
      });

      const projectId = projectResponse.data.id;

      // Create tasks - каждая система создаёт отдельную задачу
      for (const task of projectData.tasks) {
        for (const system of task.systems) {
          await api.post(`/api/projects/${projectId}/tasks`, {
            host_id: task.host_id,
            system_id: system.system_id,
            script_ids: system.script_ids,
            reference_data: system.reference_data || {},
          });
        }
      }

      // Grant access to selected users
      for (const userId of projectData.accessUserIds) {
        try {
          await api.post(`/api/projects/${projectId}/users/${userId}`);
        } catch (error) {
          console.error(`Failed to grant access to user ${userId}:`, error);
          // Continue even if one fails
        }
      }

      toast.success("Проект создан");

      onNavigate('projects');
    } catch (error) {
      console.error('Error creating project:', error);
      toast.error("Не удалось создать проект");
    } finally {
      setLoading(false);
    }
  };

  const getHostById = (hostId) => {
    
    console.log('📂 В projectData.hostsList:', projectData.hostsList?.length || 0, 'хостов');
    console.log('📂 В глобальном hosts:', hosts.length, 'хостов');
    
    // Сначала ищем в хостах проекта
    const projectHost = projectData.hostsList?.find(h => h.id === hostId);
    if (projectHost) {
      console.log('✅ Найден в projectData.hostsList:', projectHost.name);
      return projectHost;
    }
    
    // Потом ищем в глобальных хостах
    const globalHost = hosts.find(h => h.id === hostId);
    if (globalHost) {
      console.log('✅ Найден в глобальном hosts:', globalHost.name);
      return globalHost;
    }
    
    console.log('❌ Хост не найден нигде');
    return null;
  };

  const getSystemById = (systemId) => {
    return systems.find(s => s.id === systemId);
  };

  const getCategoryById = (categoryId) => {
    return categories.find(c => c.id === categoryId);
  };

  const getScriptsBySystemId = (systemId) => {
    return scripts.filter(s => s.system_id === systemId);
  };

  const Step5AccessManagement = ({ 
    users, 
    currentUser, 
    projectData, 
    setProjectData 
  }) => {
    const [userSearchTerm, setUserSearchTerm] = useState('');
  
    const filteredUsers = useMemo(() => {
      const baseUsers = users.filter(u => 
        u.is_active && 
        u.username !== 'admin' && 
        u.id !== currentUser?.id
      );
  
      if (!userSearchTerm.trim()) {
        return baseUsers;
      }
  
      const searchTerm = userSearchTerm.toLowerCase();
      return baseUsers.filter(user =>
        user.full_name?.toLowerCase().includes(searchTerm) ||
        user.username?.toLowerCase().includes(searchTerm)
      );
    }, [users, currentUser?.id, userSearchTerm]);
  
    return (
      <Card>
        <CardHeader>
          <CardTitle>Шаг 5: Управление доступом</CardTitle>
          <CardDescription>Выберите пользователей, которые смогут выполнять этот проект</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              По умолчанию доступ к проекту есть у вас (создателя) и у администраторов. Вы можете предоставить доступ другим пользователям.
            </p>
            
            <div className="mb-4">
              <Input
                placeholder="Поиск пользователей по имени или логину..."
                value={userSearchTerm}
                onChange={(e) => setUserSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>

            {projectData.accessUserIds.length > 0 && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-700 font-medium mb-2">
                  Выбрано пользователей: {projectData.accessUserIds.length}
                </p>
                <div className="flex flex-wrap gap-1">
                  {projectData.accessUserIds.map(userId => {
                    const user = users.find(u => u.id === userId);
                    return user ? (
                      <Badge key={user.id} variant="outline" className="text-xs bg-green-100 text-green-800">
                        {user.full_name}
                      </Badge>
                    ) : null;
                  }).filter(Boolean)}
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              {/* Текущий пользователь (неснимаемый) */}
              <div className="flex items-center space-x-3 p-3 border rounded-lg bg-gray-50">
                <Checkbox
                  id="current-user"
                  checked={true}
                  disabled
                  className="opacity-50"
                />
                <div className="flex-1">
                  <Label htmlFor="current-user" className="font-medium">
                    {currentUser?.full_name} (вы)
                  </Label>
                  <p className="text-sm text-gray-500">@{currentUser?.username}</p>
                </div>
                <span className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded-md">
                  Создатель
                </span>
              </div>
  
              {/* Остальные пользователи с поиском */}
              {filteredUsers.length === 0 ? (
                <div className="text-center py-4 text-gray-500">
                  {userSearchTerm ? "Пользователи не найдены" : "Нет доступных пользователей"}
                </div>
              ) : (
                filteredUsers.map((user) => (
                  <div key={user.id} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                    <Checkbox
                      id={`user-${user.id}`}
                      checked={projectData.accessUserIds.includes(user.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setProjectData(prev => ({
                            ...prev,
                            accessUserIds: [...prev.accessUserIds, user.id]
                          }));
                        } else {
                          setProjectData(prev => ({
                            ...prev,
                            accessUserIds: prev.accessUserIds.filter(id => id !== user.id)
                          }));
                        }
                      }}
                    />
                    <div className="flex-1">
                      <Label htmlFor={`user-${user.id}`} className="cursor-pointer font-medium">
                        {user.full_name}
                        {user.is_admin && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            Админ
                          </Badge>
                        )}
                      </Label>
                      <p className="text-sm text-gray-500">@{user.username}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
  

  
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-700">
                <strong>Администраторы</strong> имеют доступ ко всем проектам по умолчанию и не отображаются в этом списке.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const Step2HostSelection = ({ 
    projectData, 
    onHostsChange // callback для обновления списка хостов проекта
  }) => {
    const [isHostDialogOpen, setIsHostDialogOpen] = useState(false);
    const [editingHost, setEditingHost] = useState(null);
    const [testingHostId, setTestingHostId] = useState(null);
    const [importDialogOpen, setImportDialogOpen] = useState(false);
    const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
    const [formData, setFormData] = useState({
      name: "",
      hostname: "",
      port: 22,
      username: "",
      auth_type: "password",
      password: "",
      ssh_key: "",
      connection_type: "ssh"
    });
  
    const fileInputRef = useRef(null);
    const [importing, setImporting] = useState(false);
  
    // Хосты текущего проекта
    const projectHosts = projectData.hostsList || [];
  
    const handleSubmitHost = async (e) => {
      e.preventDefault();
      try {
        console.log('🚀 Начинаем сохранение хоста...');
        console.log('📋 Данные формы:', formData);

        const hostToSave = {
          name: formData.name,
          hostname: formData.hostname,
          port: formData.port,
          username: formData.username,
          auth_type: formData.auth_type,
          password: formData.password,
          ssh_key: formData.ssh_key,
          connection_type: formData.connection_type
        };
    
        console.log('🔑 Хост для сохранения:', hostToSave);
        let savedHost;
        
        if (editingHost && editingHost.id) {
          // Обновление существующего хоста
          savedHost = await updateHostInDatabase(editingHost.id, hostToSave);
        } else {
          // Создание нового хоста
          savedHost = await saveHostToDatabase(hostToSave);
        }
        
        console.log('✅ Ответ от сервера:', savedHost);

        // Обновляем локальное состояние
        let updatedHosts;
        if (editingHost) {
          updatedHosts = projectHosts.map(h => h.id === savedHost.id ? savedHost : h);
        } else {
          updatedHosts = [...projectHosts, savedHost];
        }
    
        handleHostsUpdate(updatedHosts);
        
        // Обновляем список всех хостов
        await fetchAllHosts();
        
        setIsHostDialogOpen(false);
        resetForm();
        toast.success(editingHost ? "Хост обновлен" : "Хост добавлен");
      } catch (error) {
        console.error('Error saving host:', error);
        toast.error("Ошибка сохранения хоста");
      }
    };
  
    const handleDeleteHost = async (hostId) => {
      try {
        const host = projectHosts.find(h => h.id === hostId);
        if (!host) return;
  
        // Удаляем хост из базы данных
        await deleteHostFromDatabase(hostId);
        
        // Удаляем хост из списка хостов проекта
        const updatedHosts = projectHosts.filter(h => h.id !== hostId);
        onHostsChange(updatedHosts);
        
        // Обновляем список всех хостов
        await fetchAllHosts();
        
        toast.success("Хост удален");
      } catch (error) {
        console.error('❌ Ошибка сохранения хоста:', error);
        console.error('🔍 Детали ошибки:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
          statusText: error.response?.statusText
        });
        toast.error("Ошибка сохранения хоста: " + (error.response?.data || error.message));
      }
    };
  
    const handleHostsUpdate = (updatedHostsList) => {
      // Автоматически создаем задачи для новых хостов
      const updatedTasks = initializeTasksFromHosts(updatedHostsList);
      onHostsChange(updatedHostsList, updatedTasks);
    };

    const resetForm = () => {
      setFormData({
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
    };
  
    const openEditDialog = (host) => {
      setEditingHost(host);
      setFormData({
        name: host.name,
        hostname: host.hostname,
        port: host.port,
        username: host.username,
        auth_type: host.auth_type,
        password: "",
        ssh_key: host.ssh_key || "",
        connection_type: host.connection_type || "ssh"
      });
      setIsHostDialogOpen(true);
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
        
        const newHosts = [];
        
        for (let i = 0; i < hostsData.length; i++) {
          const hostData = hostsData[i];
          
          // ВАЖНО: Сохраняем хост в базу данных
          const hostToSave = {
            ...hostData,
            // Убедитесь что есть auth_type
            auth_type: hostData.auth_type || 'password'
          };
          
          try {
            // Сохраняем в базу
            const savedHost = await saveHostToDatabase(hostToSave);
            newHosts.push(savedHost);
            
            console.log(`✅ Хост ${i+1} сохранен в базу:`, savedHost.id);
            
          } catch (error) {
            console.error(`❌ Ошибка сохранения хоста ${i+1}:`, error);
            // Создаем временный хост, но помечаем его
            const tempHost = {
              ...hostData,
              id: `temp-${Date.now()}-${i}`,
              _isTemp: true,
              auth_type: hostData.auth_type || 'password'
            };
            newHosts.push(tempHost);
            toast.error(`Хост ${i+1}: не сохранен в базу`);
          }
          
          setImportProgress({ current: i + 1, total: hostsData.length });
          
          // Задержка для визуализации прогресса
          if (i < hostsData.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
        
        // Добавляем импортированные хосты к существующим хостам проекта
        const updatedHosts = [...projectHosts, ...newHosts];
        onHostsChange(updatedHosts);
        
        // Обновляем список всех хостов
        await fetchAllHosts();
        
        await new Promise(resolve => setTimeout(resolve, 500));
        setImportDialogOpen(false);
        
        toast.success(`Импортировано хостов: ${newHosts.length}`);
        
      } catch (error) {
        console.error('Ошибка импорта файла:', error);
        setImportDialogOpen(false);
        toast.error("Ошибка при импорте файла. Проверьте формат файла.");
      } finally {
        setImporting(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
  
    return (
      <Card>
        <CardHeader>
          <CardTitle>Шаг 2: Управление хостами проекта</CardTitle>
          <CardDescription>Добавьте хосты для выполнения проверок. Все добавленные хосты будут использоваться в проекте.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Панель управления хостами */}
          <div className="flex justify-between items-center mb-4">
            <div className="flex gap-2">
              {/* Скрытый input для выбора файла */}
              <input
                type="file"
                accept=".json, .txt"
                ref={fileInputRef}
                onChange={handleFileImport}
                className="hidden"
              />
              
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
              >
                <Upload className="mr-2 h-4 w-4" />
                Импорт хостов
              </Button>
  
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
            </div>
            
            <Dialog open={isHostDialogOpen} onOpenChange={(open) => {
              setIsHostDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" /> Добавить хост вручную
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingHost ? "Редактировать хост" : "Новый хост"}</DialogTitle>
                  <DialogDescription>
                    Внесите информацию о сервере
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmitHost} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Название</Label>
                      <Input
                        placeholder="ЗАКС сервер хранения"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        required
                      />
                    </div>
                    <div>
                      <Label>Хост</Label>
                      <Input
                        placeholder="192.168.1.1 или host1.rn.ru"
                        value={formData.hostname}
                        onChange={(e) => setFormData({...formData, hostname: e.target.value})}
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Порт</Label>
                      <Input
                        type="number"
                        value={formData.port}
                        onChange={(e) => setFormData({...formData, port: parseInt(e.target.value)})}
                        required
                      />
                    </div>
                    <div>
                      <Label>Имя пользователя</Label>
                      <Input
                        value={formData.username}
                        placeholder="user"
                        onChange={(e) => setFormData({...formData, username: e.target.value})}
                        required
                      />
                    </div>
                  </div>
  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Тип подключения</Label>
                      <Select 
                        value={formData.connection_type || 'ssh'} 
                        onValueChange={(value) => {
                          const newPort = value === 'winrm' ? 5985 : 22;
                          setFormData({...formData, connection_type: value, port: newPort});
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
                      <Select value={formData.auth_type} onValueChange={(value) => setFormData({...formData, auth_type: value})}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="password">Пароль</SelectItem>
                          {formData.connection_type !== 'winrm' && <SelectItem value="key">SSH ключ</SelectItem>}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
  
                  {formData.auth_type === "password" ? (
                    <div>
                      <Label>Пароль</Label>
                      <Input
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                        placeholder={editingHost ? "Оставьте пустым, чтобы не менять" : ""}
                        required={!editingHost}
                      />
                    </div>
                  ) : (
                    <div>
                      <Label>SSH приватный ключ</Label>
                      <Textarea
                        value={formData.ssh_key}
                        onChange={(e) => setFormData({...formData, ssh_key: e.target.value})}
                        placeholder="-----BEGIN RSA PRIVATE KEY-----\n..."
                        rows={6}
                        required
                      />
                    </div>
                  )}
  
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsHostDialogOpen(false)}>
                      Отмена
                    </Button>
                    <Button type="submit">
                      {editingHost ? "Обновить" : "Создать"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
  
          {/* Список хостов проекта */}
          {projectHosts.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed rounded-lg">
              <Server className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500 text-lg mb-2">Нет добавленных хостов</p>
              <p className="text-slate-400 text-sm mb-4">Добавьте хосты для этого проекта</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {projectHosts.map((host, index) => (
                <div key={host.id} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 group">
                  {/* Нумерация в желтом кружочке */}
                  <div className="flex-shrink-0 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center text-sm font-bold text-yellow-900">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium truncate">{host.name}</p>
                      <Badge variant="outline" className="text-xs">
                        {host.connection_type === "ssh" ? "Linux" : "Windows"}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {host.auth_type === "password" ? "Пароль" : "SSH ключ"}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500 truncate">
                      {host.username}@{host.hostname}:{host.port}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => openEditDialog(host)} 
                            className="h-8 w-8"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Редактировать хост</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleDeleteHost(host.id)} 
                            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Удалить хост</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              ))}
            </div>
          )}
  
          {/* Диалог прогресса импорта */}
          <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Импорт хостов из файла</DialogTitle>
                <DialogDescription>
                  Импортирование хостов из файла...
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span>Прогресс:</span>
                  <span>{importProgress.current} из {importProgress.total}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                  />
                </div>
                {importing && (
                  <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Импорт... ({Math.round((importProgress.current / importProgress.total) * 100)}%)
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    );
  };

  const renderStep1 = () => (
    <Card>
      <CardHeader>
        <CardTitle>Шаг 1: Основная информация</CardTitle>
        <CardDescription>Введите название и описание проекта</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="name">Название проекта *</Label>
          <Input
            id="name"
            value={projectData.name}
            onChange={(e) => setProjectData({ ...projectData, name: e.target.value })}
            placeholder="Например: Обновление серверов"
          />
        </div>
        <div>
          <Label htmlFor="description">Описание</Label>
          <Textarea
            id="description"
            value={projectData.description}
            onChange={(e) => setProjectData({ ...projectData, description: e.target.value })}
            placeholder="Опишите цель проекта"
            rows={4}
          />
        </div>
      </CardContent>
    </Card>
  );

  const renderStep2 = () => (
    <Step2HostSelection
      projectData={projectData}
      onHostsChange={(hostsList, tasks) => {
        const updatedData = { ...projectData, hostsList };
        if (tasks) {
          updatedData.tasks = tasks;
        }
        setProjectData(updatedData);
      }}
    />
  );

  const initializeTasksFromHosts = (hostsList) => {
    console.log('🔄 Создаем задачи для хостов:', hostsList);
    
    if (!hostsList || hostsList.length === 0) {
      console.log('⚠️ Нет хостов для создания задач');
      return [];
    }
  
    const tasks = hostsList.map(host => {
      console.log(`   - Хост: ${host.name} (${host.id})`);
      return {
        host_id: host.id,
        systems: [
          {
            system_id: "",
            script_ids: []
          }
        ]
      };
    });
    
    console.log('✅ Созданы задачи:', tasks);
    return tasks;
  };

  const handleSelectAllScripts = (hostId, systemIndex, system, availableScripts) => {
    const updatedTasks = [...(projectData.tasks || [])];
    const taskIndex = updatedTasks.findIndex(t => t.host_id === hostId);
    
    if (taskIndex !== -1) {
      const task = updatedTasks[taskIndex];
      const updatedSystems = [...task.systems];
      const currentSystem = updatedSystems[systemIndex];
      
      const allScriptIds = availableScripts.map(script => script.id);
      const isAllSelected = allScriptIds.every(id => currentSystem.script_ids.includes(id));
      
      const updatedScriptIds = isAllSelected ? [] : allScriptIds;
      
      updatedSystems[systemIndex] = {
        ...currentSystem,
        script_ids: updatedScriptIds
      };
      
      updatedTasks[taskIndex] = {
        ...task,
        systems: updatedSystems
      };
      
      setProjectData(prev => ({
        ...prev,
        tasks: updatedTasks
      }));
      
      // Обновляем шаблон
      if (currentSystem.system_id) {
        updateSystemCheckTemplate(currentSystem.system_id, updatedScriptIds);
      }
    }
  };

  const renderStep3 = () => {
    console.log('🎯 Шаг 3: renderStep3 вызван');
    console.log('📊 projectData.hostsList:', projectData.hostsList);
    console.log('📊 projectData.tasks:', projectData.tasks);
    console.log('📊 Глобальные hosts:', hosts);

    // Функция для получения хоста по ID из projectData.hostsList
    const getProjectHostById = (hostId) => {
      return projectData.hostsList?.find(host => host.id === hostId);
    };

    return (
      <Card>
        <CardHeader>
          <CardTitle>Шаг 3: Назначение проверок</CardTitle>
          <CardDescription>Для каждого хоста выберите системы и проверки</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {projectData.tasks?.map((task, taskIndex) => {
              const host = getProjectHostById(task.host_id); // <-- Используем новую функцию
              
              if (!host) {
                console.warn(`❌ Хост с ID ${task.host_id} не найден в projectData.hostsList`);
                console.log('📋 Доступные хосты:', projectData.hostsList?.map(h => ({id: h.id, name: h.name})));
                return null;
              }

              return (
                <div key={task.host_id} className="border-2 rounded-lg p-4">
                  {/* Заголовок хоста */}
                  <div className="flex items-center justify-between mb-4 p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center text-sm font-bold text-yellow-900">
                        {taskIndex + 1}
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">{host.name}</h3>
                        <p className="text-sm text-gray-500">
                          {host.username}@{host.hostname}:{host.port}
                        </p>
                      </div>
                    </div>
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${
                        host.connection_type === "ssh" 
                          ? "bg-green-100 text-green-800" 
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {host.connection_type === "ssh" ? "Linux" : "Windows"}
                    </Badge>
                  </div>

                  {/* Список систем для этого хоста */}
                  {task.systems.map((system, systemIndex) => {
                    const availableScripts = getScriptsBySystemId(system.system_id);
                    const selectedSystem = getSystemById(system.system_id);

                    return (
                      <div key={systemIndex} className="mb-6 p-4 border rounded-lg bg-gray-50">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Label className="text-base font-semibold">
                              Система {systemIndex + 1}
                            </Label>
                            {selectedSystem && (
                              <Badge variant="secondary" className="text-xs">
                                {selectedSystem.name}
                              </Badge>
                            )}
                          </div>
                          {task.systems.length > 1 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveSystemFromHost(task.host_id, systemIndex)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>

                        <div className="mb-3">
                          <Label className="text-sm font-medium">Выберите систему</Label>
                          <Select
                            value={system.system_id}
                            onValueChange={(value) => handleTaskSystemChange(task.host_id, systemIndex, value)}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Выберите систему для проверки" />
                            </SelectTrigger>
                            <SelectContent>
                              {systems
                                .filter(sys => {
                                  // Фильтруем системы по типу ОС хоста
                                  const systemOsType = sys.os_type;
                                  const hostConnectionType = host?.connection_type;
                                  
                                  if (hostConnectionType === 'ssh') {
                                    return systemOsType === 'linux';
                                  }
                                  if (hostConnectionType === 'winrm') {
                                    return systemOsType === 'windows';
                                  }
                                  return true;
                                })
                                .filter(sys => {
                                  // Исключаем системы, которые уже выбраны для этого хоста
                                  const isSystemAlreadySelected = task.systems.some(
                                    existingSystem => existingSystem.system_id === sys.id
                                  );
                                  return !isSystemAlreadySelected || sys.id === system.system_id;
                                })
                                .map((sys) => {
                                  const category = getCategoryById(sys.category_id);
                                  const isSystemAlreadySelected = task.systems.some(
                                    existingSystem => existingSystem.system_id === sys.id && existingSystem !== system
                                  );
                                  
                                  return (
                                    <SelectItem 
                                      key={sys.id} 
                                      value={sys.id}
                                      disabled={isSystemAlreadySelected && sys.id !== system.system_id}
                                      className="py-2"
                                    >
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <span className="text-sm">{category?.icon}</span>
                                          <span>
                                            {sys.name}
                                            <span className="text-xs text-gray-500 ml-2">
                                              ({sys.os_type === 'windows' ? 'Windows' : 'Linux'})
                                            </span>
                                          </span>
                                        </div>
                                        {isSystemAlreadySelected && sys.id !== system.system_id && (
                                          <Badge variant="outline" className="text-xs">
                                            Уже выбрана
                                          </Badge>
                                        )}
                                      </div>
                                    </SelectItem>
                                  );
                                })}
                            </SelectContent>
                          </Select>
                        </div>

                        {system.system_id && (
                          <div>
                            <Label className="text-sm font-medium">Проверки для системы</Label>
                            {availableScripts.length === 0 ? (
                              <p className="text-gray-500 text-sm mt-2">Нет доступных проверок для выбранной системы</p>
                            ) : (
                              <div className="space-y-2 mt-2 max-h-48 overflow-y-auto p-2 border rounded">
                                {/* Чекбокс "Выбрать все" */}
                                <div className="flex items-center space-x-2 pb-2 border-b border-gray-200">
                                  <Checkbox
                                    checked={availableScripts.every(script => 
                                      system.script_ids.includes(script.id)
                                    )}
                                    onCheckedChange={() => handleSelectAllScripts(task.host_id, systemIndex, system, availableScripts)}
                                  />
                                  <Label className="font-medium text-sm cursor-pointer">Выбрать все проверки</Label>
                                </div>

                                {/* Список проверок */}
                                {availableScripts.map((script) => (
                                  <div key={script.id} className="flex items-center space-x-2 p-1 hover:bg-gray-100 rounded">
                                    <Checkbox
                                      checked={system.script_ids.includes(script.id)}
                                      onCheckedChange={() => handleTaskScriptToggle(task.host_id, systemIndex, script.id)}
                                    />
                                    <div className="flex-1">
                                      <p className="font-medium text-sm">{script.name}</p>
                                      {script.description && (
                                        <p className="text-xs text-gray-500">{script.description}</p>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            {system.system_id && system.script_ids.length > 0 && (
                              <div className="mt-2 flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => applyTemplateToAllHosts(system.system_id, system.script_ids)}
                                  className="text-xs"
                                >
                                  <Copy className="h-3 w-3 mr-1" />
                                  Применить выбранный набор проверок ко всем хостам с "{selectedSystem.name}"
                                </Button>
                              </div>
                            )}                            
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Кнопка добавления системы */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddSystemToHost(task.host_id)}
                    className="w-full mt-2"
                    disabled={systems
                      .filter(sys => {
                        const systemOsType = sys.os_type;
                        const hostConnectionType = host?.connection_type;
                        if (hostConnectionType === 'ssh') return systemOsType === 'linux';
                        if (hostConnectionType === 'winrm') return systemOsType === 'windows';
                        return true;
                      })
                      .filter(sys => !task.systems.some(existingSystem => existingSystem.system_id === sys.id))
                      .length === 0}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Добавить ещё систему
                    {systems
                      .filter(sys => {
                        const systemOsType = sys.os_type;
                        const hostConnectionType = host?.connection_type;
                        if (hostConnectionType === 'ssh') return systemOsType === 'linux';
                        if (hostConnectionType === 'winrm') return systemOsType === 'windows';
                        return true;
                      })
                      .filter(sys => !task.systems.some(existingSystem => existingSystem.system_id === sys.id))
                      .length === 0 && (
                      <span className="text-xs ml-2">(все системы уже выбраны)</span>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderStep4 = () => {
    // Collect all scripts that have reference files
    const scriptsWithReferences = [];
    projectData.tasks.forEach(task => {
      task.systems.forEach(system => {
        system.script_ids.forEach(scriptId => {
          const script = scripts.find(s => s.id === scriptId);
          if (script && script.has_reference_files) {
            scriptsWithReferences.push({
              taskIndex: projectData.tasks.indexOf(task),
              systemIndex: task.systems.indexOf(system),
              script: script,
              hostId: task.host_id,
              systemId: system.system_id
            });
          }
        });
      });
    });

    if (scriptsWithReferences.length === 0) {
      // Skip this step if no scripts have reference files
      return null;
    }

    return (
    <Card>
      <CardHeader>
        <CardTitle>Шаг 4: Эталонные данные</CardTitle>
        <CardDescription>Введите эталонные данные для проверок (общие для всех хостов)</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {(() => {
            // Создаем мапу для группировки по script.id
            const scriptGroups = new Map();
            
            scriptsWithReferences.forEach(item => {
              if (!scriptGroups.has(item.script.id)) {
                scriptGroups.set(item.script.id, {
                  script: item.script,
                  hosts: []
                });
              }
              scriptGroups.get(item.script.id).hosts.push({
                hostId: item.hostId,
                systemId: item.systemId,
                taskIndex: item.taskIndex,
                systemIndex: item.systemIndex
              });
            });

            const groupedScripts = Array.from(scriptGroups.values());

            return groupedScripts.map((group, index) => {
              // Берем первый хост для получения текущего значения
              const firstHost = group.hosts[0];
              const currentValue = projectData.tasks[firstHost.taskIndex]
                .systems[firstHost.systemIndex].reference_data?.[group.script.id] || '';

              console.log(`🔍 Script ${group.script.name}:`, {
                hostsCount: group.hosts.length,
                currentValue: currentValue.substring(0, 50) + '...',
                hosts: group.hosts.map(h => ({
                  host: getHostById(h.hostId)?.name,
                  system: getSystemById(h.systemId)?.name
                }))
              });

              const handleFileUpload = (event) => {
                const file = event.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (e) => {
                  const content = e.target.result;
                  setProjectData(prev => {
                    const newTasks = [...prev.tasks];
                    
                    // Применяем ко всем хостам в группе
                    group.hosts.forEach(host => {
                      const task = newTasks[host.taskIndex];
                      const system = task.systems[host.systemIndex];
                      
                      if (!system.reference_data) {
                        system.reference_data = {};
                      }
                      
                      system.reference_data[group.script.id] = content;
                    });
                    
                    return { ...prev, tasks: newTasks };
                  });
                };
                reader.readAsText(file);
              };

              const handleTextChange = (e) => {
                setProjectData(prev => {
                  const newTasks = [...prev.tasks];
                  
                  // Применяем ко всем хостам в группе
                  group.hosts.forEach(host => {
                    const task = newTasks[host.taskIndex];
                    const system = task.systems[host.systemIndex];
                    
                    if (!system.reference_data) {
                      system.reference_data = {};
                    }
                    
                    system.reference_data[group.script.id] = e.target.value;
                  });
                  
                  return { ...prev, tasks: newTasks };
                });
              };

              return (
                <div key={group.script.id} className="border rounded-lg p-4">
                  <div className="mb-2">
                    <p className="font-semibold text-lg">{group.script.name}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      <strong>Применяется к {group.hosts.length} хосту(ам):</strong>{' '}
                      {group.hosts.map((host, idx) => {
                        // Используем hostsList напрямую без функции
                        const hostObj = projectData.hostsList?.find(h => h.id === host.hostId);
                        
                        return (
                          <span key={host.hostId}>
                            {hostObj?.name || `Хост ${host.hostId}`}
                            {idx < group.hosts.length - 1 ? ', ' : ''}
                          </span>
                        );
                      })}
                    </p>
                  </div>
                  
                  <div className="mb-3">
                    <input
                      type="file"
                      id={`file-upload-${group.script.id}`}
                      accept=".txt,.json,.xml,.csv,.log,.yaml,.yml,.conf,.config,.ini"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById(`file-upload-${group.script.id}`).click()}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Загрузить из файла
                    </Button>
                  </div>

                  <Textarea
                    placeholder={`Введите эталонные данные для ${group.script.name}...`}
                    value={currentValue}
                    onChange={handleTextChange}
                    rows={8}
                    className="font-mono text-sm"
                  />
                  
                  {group.hosts.length > 1 && (
                    <p className="text-xs text-blue-600 mt-2">
                      ⓘ Эти данные будут применены ко всем {group.hosts.length} хостам
                    </p>
                  )}
                </div>
              );
            });
          })()}
        </div>
      </CardContent>
    </Card>
    );
  };

  const renderStep5 = () => (
    <Step5AccessManagement
      users={users}
      currentUser={currentUser}
      projectData={projectData}
      setProjectData={setProjectData}
    />
  );

  const renderStep6 = () => (
    <Card>
      <CardHeader>
        <CardTitle>Шаг 6: Подтверждение</CardTitle>
        <CardDescription>Проверьте настройки проекта перед созданием</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <h3 className="font-bold mb-2">Название:</h3>
            <p>{projectData.name}</p>
          </div>

          {projectData.description && (
            <div>
              <h3 className="font-bold mb-2">Описание:</h3>
              <p>{projectData.description}</p>
            </div>
          )}

          <div>
            <h3 className="font-bold mb-2">Хосты и задания:</h3>
            <div className="space-y-3">
              {projectData.tasks.map((task) => {
                const host = getHostById(task.host_id);

                return (
                  <div key={task.host_id} className="border rounded p-3">
                    <p className="font-medium text-lg mb-2">{host?.name}</p>
                    
                    {task.systems.map((system, sysIdx) => {
                      const systemInfo = getSystemById(system.system_id);
                      const taskScripts = scripts.filter(s => system.script_ids.includes(s.id));
                      
                      return (
                        <div key={sysIdx} className="ml-4 mb-3 pb-2 border-b last:border-b-0">
                          <p className="text-sm font-semibold text-gray-700">
                            Система: {systemInfo?.name}
                          </p>
                          <p className="text-sm text-gray-600">
                            Проверки ({taskScripts.length}):
                          </p>
                          <ul className="list-disc list-inside text-sm text-gray-600 ml-2">
                            {taskScripts.map(script => (
                              <li key={script.id}>{script.name}</li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Создание проекта</h1>
        
        {/* Прогресс-бар с точным контролем ширины */}
        <div className="w-full flex items-center mt-4 px-4"> {/* px-4 для отступов по краям */}
          {[1, 2, 3, 4, 5, 6].map((s, index) => (
            <React.Fragment key={s}>
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  s <= step ? 'bg-yellow-400 text-white' : 'bg-gray-300 text-gray-600'
                }`}
              >
                {s < step ? <Check className="h-4 w-4" /> : s}
              </div>
              {index < 5 && (
                <div
                  className={`flex-1 h-1 ${
                    s < step ? 'bg-yellow-400' : 'bg-gray-300'
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
  
      {/* Кнопки навигации с увеличенным отступом */}
      <div className="flex justify-between mb-3"> {/* mb-8 вместо mt-6 */}
        <Button
          variant="outline"
          onClick={step === 1 ? () => onNavigate('projects') : handleBack}
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          {step === 1 ? 'Отмена' : 'Назад'}
        </Button>
  
        {step < 6 ? (
          <Button onClick={handleNext}>
            Далее
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleCreateProject} disabled={loading}>
            {loading ? 'Создание...' : 'Создать проект'}
          </Button>
        )}
      </div>
  
      {/* Контент шага */}
      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
      {step === 4 && renderStep4()}
      {step === 5 && renderStep5()}
      {step === 6 && renderStep6()}
    </div>
  );
}