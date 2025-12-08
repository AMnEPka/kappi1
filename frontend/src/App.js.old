import { useState, useEffect } from "react";
//import "@/App.css";
import { BrowserRouter, Routes, Route, Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Server, FileCode, Play, History, Plus, Edit, Trash2, Terminal, Settings, Folder, HardDrive, Briefcase, LogOut, User, Shield } from "lucide-react";
import AdminPage from "@/pages/AdminPage";
import ProjectsPage from "@/pages/ProjectsPage";
import ProjectWizard from "@/pages/ProjectWizard";
import ProjectExecutionPage from "@/pages/ProjectExecutionPage";
import ProjectResultsPage from "@/pages/ProjectResultsPage";
import LoginPage from "@/pages/LoginPage";
import UsersPage from "@/pages/UsersPage";
import RolesPage from "@/pages/RolesPage";
import { Menu, HelpCircle, EthernetPort, Loader2, Calendar, FileText } from 'lucide-react'; 
import { api } from './config/api';
import LogsPage from "@/pages/LogsPage";
import SchedulerPage from "@/pages/SchedulerPage";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";

// Hosts Page
const HostsPage = () => {
  const { hasPermission, isAdmin, user } = useAuth();
  const [hosts, setHosts] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingHost, setEditingHost] = useState(null);
  const [testingHostId, setTestingHostId] = useState(null);
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

  useEffect(() => {
    fetchHosts();
  }, []);

  const fetchHosts = async () => {
    // Check if token exists before making request
    const token = localStorage.getItem('token');
    if (!token) {
      return; // Don't fetch if not authenticated
    }
    
    try {
      const response = await api.get(`/api/hosts`);
      setHosts(response.data);
    } catch (error) {
      console.error('Error fetching hosts:', error);
      toast.error("Ошибка загрузки хостов");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingHost) {
        await api.put(`/api/hosts/${editingHost.id}`, formData);
        toast.success("Хост обновлен");
      } else {
        await api.post(`/api/hosts`, formData);
        toast.success("Хост добавлен");
      }
      setIsDialogOpen(false);
      resetForm();
      fetchHosts();
    } catch (error) {
      toast.error("Ошибка сохранения хоста");
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Удалить хост?")) {
      try {
        await api.delete(`/api/hosts/${id}`);
        toast.success("Хост удален");
        fetchHosts();
      } catch (error) {
        toast.error("Ошибка удаления хоста");
      }
    }
  };

  const handleTestConnection = async (hostId) => {
    setTestingHostId(hostId);
    try {
      const response = await api.post(`/api/hosts/${hostId}/test`);
      if (response.data.success) {
        toast.success(`✅ ${response.data.message}\n${response.data.output}`);
      } else {
        toast.error(`❌ ${response.data.message}\n${response.data.error}`);
      }
    } catch (error) {
      toast.error(`Ошибка тестирования: ${error.response?.data?.detail || error.message}`);
    } finally {
      setTestingHostId(null);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      hostname: "",
      port: 22,
      username: "",
      auth_type: "password",
      password: "",
      ssh_key: ""
    });
    setEditingHost(null);
  };

  const canEditHost = (host) => {
    if (isAdmin) return true;
    if (hasPermission('hosts_edit_all')) return true;
    if (host.created_by === user?.id && hasPermission('hosts_edit_own')) return true;
    return false;
  };

  const canDeleteHost = (host) => {
    if (isAdmin) return true;
    if (hasPermission('hosts_delete_all')) return true;
    if (host.created_by === user?.id && hasPermission('hosts_delete_own')) return true;
    return false;
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
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Хосты</h1>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button data-testid="add-host-btn">
              <Plus className="mr-2 h-4 w-4" /> Добавить хост
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingHost ? "Редактировать хост" : "Новый хост"}</DialogTitle>
              <DialogDescription>
                Внесите информацию о сервере
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Название</Label>
                  <Input
                    data-testid="host-name-input"
                    placeholder="ЗАКС сервер хранения"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label>Хост</Label>
                  <Input
                    data-testid="host-hostname-input"
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
                      <SelectItem value="k8s" disabled>Kubernetes (скоро)</SelectItem>
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
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Отмена
                </Button>
                <Button type="submit" data-testid="save-host-btn">
                  {editingHost ? "Обновить" : "Создать"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {hosts.length === 0 ? (
          <div className="col-span-full text-center py-16">
            <Server className="h-16 w-16 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 text-lg mb-2">Нет добавленных хостов</p>
            <p className="text-slate-400 text-sm">Добавьте первый хост для начала работы</p>
          </div>
        ) : (
          hosts.map((host) => (
            <Card key={host.id} data-testid={`host-card-${host.id}`}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Server className="h-5 w-5" />
                      {host.name}
                    </CardTitle>
                    <CardDescription>{host.hostname}:{host.port}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleTestConnection(host.id)}
                            disabled={testingHostId === host.id}
                            className="hover:bg-blue-50 hover:text-blue-600"
                          >
                            {testingHostId === host.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <EthernetPort className="h-4 w-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Тест подключения</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    {canEditHost(host) && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => openEditDialog(host)} 
                              className="hover:bg-yellow-50 hover:text-yellow-600"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Редактировать хост</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {canDeleteHost(host) && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleDelete(host.id)} 
                              className="hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Удалить хост</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div>Пользователь: <strong>{host.username}</strong></div>
                  <div className="flex items-center gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="outline">
                          {host.connection_type === "ssh" ? "Linux" : "Windows"}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{"Тип ОС на хосте"}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="outline">
                          {host.auth_type === "password" ? "Пароль" : "SSH ключ"}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{"Тип аутентификации"}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

// Scripts Page
const ScriptsPage = () => {
  const { hasPermission, isAdmin, user } = useAuth();
  const [scripts, setScripts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [systems, setSystems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedSystem, setSelectedSystem] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingScript, setEditingScript] = useState(null);
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formSystems, setFormSystems] = useState([]);
  const [formData, setFormData] = useState({
    system_id: "",
    name: "",
    description: "",
    content: "",
    processor_script: "",
    has_reference_files: false,
    test_methodology: "",
    success_criteria: "",
    order: 0
  });

  useEffect(() => {
    fetchCategories();
    fetchScripts();
  }, []);

  useEffect(() => {
    if (selectedCategory && selectedCategory !== "all") {
      fetchSystemsByCategory(selectedCategory);
    } else {
      setSystems([]);
      setSelectedSystem("all");
    }
  }, [selectedCategory]);

  useEffect(() => {
    fetchScripts();
  }, [selectedSystem]);

  const fetchCategories = async () => {
    try {
      const response = await api.get(`/api/categories`);
      setCategories(response.data);
    } catch (error) {
      toast.error("Ошибка загрузки категорий");
    }
  };

  const fetchSystemsByCategory = async (categoryId) => {
    try {
      const response = await api.get(`/api/systems?category_id=${categoryId}`);
      setSystems(response.data);
    } catch (error) {
      toast.error("Ошибка загрузки систем");
    }
  };

  const fetchScripts = async () => {
    try {
      let url = `/api/scripts`;
      if (selectedSystem && selectedSystem !== "all") {
        url += `?system_id=${selectedSystem}`;
      } else if (selectedCategory && selectedCategory !== "all") {
        url += `?category_id=${selectedCategory}`;
      }
      const response = await api.get(url);
      setScripts(response.data);
    } catch (error) {
      toast.error("Ошибка загрузки проверок");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingScript) {
        await api.put(`/api/scripts/${editingScript.id}`, formData);
        toast.success("Проверка обновлена");
      } else {
        await api.post(`/api/scripts`, formData);
        toast.success("Проверка создана");
      }
      setIsDialogOpen(false);
      resetForm();
      fetchScripts();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Ошибка сохранения проверки");
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Удалить проверку?")) {
      try {
        await api.delete(`/api/scripts/${id}`);
        toast.success("Проверка удалена");
        fetchScripts();
      } catch (error) {
        toast.error("Ошибка удаления проверки");
      }
    }
  };

  const resetForm = () => {
    setFormData({
      system_id: "",
      name: "",
      description: "",
      content: "",
      processor_script: "",
      has_reference_files: false,
      test_methodology: "",
      success_criteria: "",
      order: 0
    });
    setFormCategoryId("");
    setFormSystems([]);
    setEditingScript(null);
  };

  const canEditScript = (script) => {
    if (isAdmin) return true;
    if (hasPermission('checks_edit_all')) return true;
    if (script.created_by === user?.id && hasPermission('checks_edit_own')) return true;
    return false;
  };

  const canDeleteScript = (script) => {
    if (isAdmin) return true;
    if (hasPermission('checks_delete_all')) return true;
    if (script.created_by === user?.id && hasPermission('checks_delete_own')) return true;
    return false;
  };

  const openEditDialog = async (script) => {
    setEditingScript(script);
    setFormData({
      system_id: script.system_id,
      name: script.name,
      description: script.description || "",
      content: script.content,
      processor_script: script.processor_script || "",
      has_reference_files: script.has_reference_files || false,
      test_methodology: script.test_methodology || "",
      success_criteria: script.success_criteria || "",
      order: script.order || 0
    });
    
    // Load category and systems for editing
    try {
      const systemRes = await api.get(`/api/systems/${script.system_id}`);
      const system = systemRes.data;
      setFormCategoryId(system.category_id);
      
      const systemsRes = await api.get(`/api/systems?category_id=${system.category_id}`);
      setFormSystems(systemsRes.data);
    } catch (error) {
      console.error("Error loading system info:", error);
    }
    
    setIsDialogOpen(true);
  };

  const handleCategoryChangeInForm = async (categoryId) => {
    setFormCategoryId(categoryId);
    setFormData({...formData, system_id: ""});
    
    try {
      const response = await api.get(`/api/systems?category_id=${categoryId}`);
      setFormSystems(response.data);
    } catch (error) {
      toast.error("Ошибка загрузки систем");
    }
  };

  // placeholder selection
  const getPlaceholder = () => {
    const category = categories.find(cat => cat.id === formCategoryId);
    
    if (!category) {
      return "Выберите категорию для отображения примера...";
    }

    if (category.name.toLowerCase().includes('linux')) {
      return `#!/bin/bash
  # Результат команды доступен в переменной $CHECK_OUTPUT
  # Эталонные данные доступны в переменной $env:ETALON_INPUT  
  if echo "$CHECK_OUTPUT" | grep -q "нужная строка"; then
    echo "Пройдена"
  else
    echo "Не пройдена"
  fi`;
    }

    if (category.name.toLowerCase().includes('windows')) {
      return `#!/bin/bash
  # Скрипт-обработчик даже для Windows пишем на BASH
  # Результат команды доступен в переменной $CHECK_OUTPUT
  # Эталонные данные доступны в переменной $env:ETALON_INPUT  
  if echo "$CHECK_OUTPUT" | grep -q "нужная строка"; then
    echo "Пройдена"
  else
    echo "Не пройдена"
  fi`;
    }

    // Общий пример для других категорий
    return `#!/bin/bash
  # Результат команды доступен в переменной $CHECK_OUTPUT
  # Эталонные данные доступны в переменной $env:ETALON_INPUT  
  # Пример обработки:
  if [ "$CHECK_OUTPUT" = "ожидаемое значение" ]; then
    echo "Пройдена"
  else
    echo "Не пройдена"
  fi`;
  };
  // Функция для получения тултипа в зависимости от категории
  const getTooltipContent = () => {
    const category = categories.find(cat => cat.id === formCategoryId);
    
    if (!category) {
      return (
        <div>
          <p>Выберите категорию для отображения подсказки</p>
        </div>
      );
    }

    if (category.name.toLowerCase().includes('linux')) {
      return (
        <div>
          <p className="font-semibold">Скрипт-обработчик для Linux-систем</p>
          <p>Используйте bash</p>
          <p><strong>Доступные переменные:</strong></p>
          <ul className="list-disc list-inside text-xs mt-1">
            <li><code>$CHECK_OUTPUT</code> - вывод команды</li>
            <li><code>$ETALON_INPUT</code> - эталонные данные</li>
          </ul>
          <p className="text-xs mt-2">Примеры: grep, awk, sed, if-else</p>
          <p className="text-xs mt-2">Для корректной обработки результатов, скрипт должен вернуть одно из следующих значений:</p>
          <p className="text-xs mt-2"><strong>'Пройдена', 'Не пройдена', 'Ошибка', 'Оператор'</strong></p>
        </div>
      );
    }

    if (category.name.toLowerCase().includes('windows')) {
      return (
        <div>
          <p className="font-semibold">Скрипт-обработчик для Windows-систем</p>
          <p>Используйте bash</p>
          <p><strong>Доступные переменные:</strong></p>
          <ul className="list-disc list-inside text-xs mt-1">
            <li><code>$CHECK_OUTPUT</code> - вывод команды</li>
            <li><code>$ETALON_INPUT</code> - эталонные данные</li>
          </ul>
          <p className="text-xs mt-2">Примеры: grep, awk, sed, if-else</p>
          <p className="text-xs mt-2">Для корректной обработки результатов, скрипт должен вернуть одно из следующих значений:</p>
          <p className="text-xs mt-2"><strong>'Пройдена', 'Не пройдена', 'Ошибка', 'Оператор'</strong></p>
        </div>
      );
    }

    // Для остальных категорий
    return (
      <div>
        <p className="font-semibold">Скрипт-обработчик</p>
        <p>Настройте обработку результатов для выбранной системы</p>
        <p><strong>Доступные переменные:</strong></p>
        <ul className="list-disc list-inside text-xs mt-1">
          <li><code>$CHECK_OUTPUT</code> - вывод команды</li>
          <li><code>$ETALON_INPUT</code> - эталонные данные</li>
          <p className="text-xs mt-2">Для корректной обработки данных, скрипт должен вернуть одно из следюущих значений:</p>
          <p className="text-xs mt-2"><strong>'Пройдена', 'Не пройдена', 'Ошибка', 'Оператор'</strong></p>
        </ul>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Проверки</h1>
          <p className="text-slate-600 mt-1">Управление проверками для систем</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} data-testid="add-script-btn">
              <Plus className="mr-2 h-4 w-4" /> Добавить проверку
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingScript ? "Редактировать проверку" : "Новая проверка"}</DialogTitle>
              <DialogDescription>Создайте проверку для конкретной системы</DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Левый столбец */}
                <div className="space-y-4">
                  <div>
                    <Label>Категория</Label>
                    <Select value={formCategoryId} onValueChange={handleCategoryChangeInForm} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите категорию..." />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.icon} {cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Система</Label>
                    <Select 
                      value={formData.system_id} 
                      onValueChange={(value) => setFormData({...formData, system_id: value})}
                      required
                      disabled={!formCategoryId}
                    >
                      <SelectTrigger data-testid="script-system-select">
                        <SelectValue placeholder={formCategoryId ? "Выберите систему..." : "Сначала выберите категорию"} />
                      </SelectTrigger>
                      <SelectContent>
                        {formSystems.map((sys) => (
                          <SelectItem key={sys.id} value={sys.id}>{sys.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>Название проверки</Label>
                    <Input
                      data-testid="script-name-input"
                      placeholder="Проверка версии ядра"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div>
                    <Label>Описание</Label>
                    <Input
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      placeholder="Опционально"
                    />
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Label>Команда</Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="h-4 w-4 text-gray-500 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <div className="text-xs text-gray-500 mt-1 space-y-1">
                              <p className="font-semibold">Для Windows команда пишется на PowerShell Scripting Language</p>
                              <p className="font-semibold">Для Linux команда пишется на Bash</p>
                              <p className="font-semibold">Команда должна получать вывод в терминал - файл ('cat /etc/passwd') или другой результат ('dir c:\windows')</p>
                              <p className="font-semibold">Доступ к результату команды из скрипта-обработчика: <code className="bg-gray-100 px-1 rounded">$CHECK_OUTPUT</code></p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Textarea
                      data-testid="script-content-input"
                      value={formData.content}
                      onChange={(e) => setFormData({...formData, content: e.target.value})}
                      placeholder="cat /etc/hostname"
                      rows={2}
                      className="font-mono text-sm"
                      required
                    />                    
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="has_reference_files"
                      checked={formData.has_reference_files}
                      onCheckedChange={(checked) => setFormData({...formData, has_reference_files: checked})}
                    />
                    <div className="flex items-center gap-1">
                      <Label htmlFor="has_reference_files" className="cursor-pointer">
                        Предусмотрены эталонные файлы
                      </Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="h-3 w-3 text-gray-500 cursor-help ml-1" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <div className="text-xs text-gray-500 space-y-2">
                              <p className="font-semibold">Включите, если для этой проверки нужны эталонные файлы</p>
                              <p>Например: список доменных УЗ на хосте, список разрешенных групп</p>
                              <p className="font-semibold">Эталонные файлы будут доступны в переменной: <code className="bg-gray-100 px-1 rounded">$ETALON_INPUT</code></p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                  
                </div>

                {/* Правый столбец */}
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Label>Скрипт-обработчик</Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="icon" 
                              className="h-4 w-4 rounded-full"
                            >
                              <HelpCircle className="h-3 w-3 text-gray-500" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            {getTooltipContent()}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Textarea
                      value={formData.processor_script}
                      onChange={(e) => setFormData({...formData, processor_script: e.target.value})}
                      placeholder={getPlaceholder()}
                      rows={10}
                      className="font-mono text-sm"
                    />
                  </div>

                  <div>
                    <Label>Описание методики испытания (опционально)</Label>
                    <Textarea
                      value={formData.test_methodology}
                      onChange={(e) => setFormData({...formData, test_methodology: e.target.value})}
                      placeholder="Данные из ПМИ (для формирования отчета)"
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label>Критерий успешного прохождения испытания (опционально)</Label>
                    <Textarea
                      value={formData.success_criteria}
                      onChange={(e) => setFormData({...formData, success_criteria: e.target.value})}
                      placeholder="Данные из ПМИ (для формирования отчета)"
                      rows={3}
                    />
                  </div>
                </div>
              </div>

              {/* Кнопки в одну строку */}
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Отмена
                </Button>
                <Button type="submit" data-testid="save-script-btn">
                  {editingScript ? "Обновить" : "Создать"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <Label>Категория</Label>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Все категории" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все категории</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Система</Label>
          <Select value={selectedSystem} onValueChange={setSelectedSystem} disabled={selectedCategory === "all"}>
            <SelectTrigger>
              <SelectValue placeholder={selectedCategory !== "all" ? "Все системы категории" : "Сначала выберите категорию"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все системы</SelectItem>
              {systems.map((sys) => (
                <SelectItem key={sys.id} value={sys.id}>
                  {sys.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-x-auto">
        {scripts.length === 0 ? (
          <div className="text-center py-16">
            <FileCode className="h-16 w-16 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 text-lg mb-2">Нет проверок</p>
            <p className="text-slate-400 text-sm">Создайте первую проверку этого типа</p>
          </div>
        ) : (
      <div className="overflow-hidden">
        <table className="w-full border-collapse table-fixed">
        <colgroup>
          <col className="w-[25%]"/><col className="w-[20%]"/><col className="w-[40%]"/><col className="w-[15%]"/>
        </colgroup>
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left py-1 px-4 text-slate-600 font-medium">Название</th>
              <th className="text-left py-1 px-4 text-slate-600 font-medium">Категория</th>
              <th className="text-left py-1 px-4 text-slate-600 font-medium">Описание</th>
              <th className="text-left py-1 px-4 text-slate-600 font-medium">Действия</th>
            </tr>
          </thead>
          <tbody>
            {scripts.map((script) => (
              <tr key={script.id} className="border-b border-slate-100 hover:bg-slate-50" data-testid={`script-card-${script.id}`}>
                <td className="py-1 px-4 overflow-hidden">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-medium truncate">
                      <FileCode className="h-4 w-4 text-slate-500 flex-shrink-0" />
                      <span className="truncate">{script.name}</span>
                    </div>
                    {script.has_reference_files && (
                      <div className="text-xs text-slate-400 flex-shrink-0 ml-2" title="Предусмотрены эталонные файлы">
                        📝
                      </div>
                    )}
                  </div>
                </td>
                <td className="py-1 px-4 text-sm text-slate-600 overflow-hidden">
                  {script.category_name && (
                    <div className="truncate">
                      {script.category_icon} {script.category_name} → {script.system_name}
                    </div>
                  )}
                </td>
                <td className="py-1 px-4 text-sm text-slate-500">
                  {script.description ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="truncate cursor-help text-left">
                            {script.description}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <div className="text-sm">
                            {script.description}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="py-1 px-4">
                  <div className="flex gap-1">
                    {canEditScript(script) && (
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditDialog(script)}>
                        <Edit className="h-3 w-3" />
                      </Button>
                    )}
                    {canDeleteScript(script) && (
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDelete(script.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
        )}
      </div>
    </div>
  );
};

// Execute Page
const ExecutePage = () => {
  const navigate = useNavigate();
  const [scripts, setScripts] = useState([]);
  const [hosts, setHosts] = useState([]);
  const [selectedScript, setSelectedScript] = useState("");
  const [selectedHosts, setSelectedHosts] = useState([]);
  const [isExecuting, setIsExecuting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [scriptsRes, hostsRes] = await Promise.all([
        api.get(`/api/scripts`),
        api.get(`/api/hosts`)
      ]);
      setScripts(scriptsRes.data);
      setHosts(hostsRes.data);
    } catch (error) {
      toast.error("Ошибка загрузки данных");
    }
  };

  const handleExecute = async () => {
    if (!selectedScript || selectedHosts.length === 0) {
      toast.error("Выберите проверку и хосты");
      return;
    }

    setIsExecuting(true);
    try {
      const response = await api.post(`/api/execute`, {
        script_id: selectedScript,
        host_ids: selectedHosts
      });
      
      toast.success(`Выполнено на ${selectedHosts.length} хост(ах)`);
      
      // Navigate to history to see results
      setTimeout(() => {
        navigate('/history');
      }, 1000);
    } catch (error) {
      toast.error("Ошибка выполнения проверки");
    } finally {
      setIsExecuting(false);
    }
  };

  const toggleHost = (hostId) => {
    setSelectedHosts(prev => 
      prev.includes(hostId) 
        ? prev.filter(id => id !== hostId)
        : [...prev, hostId]
    );
  };

  const toggleAll = () => {
    if (selectedHosts.length === hosts.length && hosts.length > 0) {
      setSelectedHosts([]);
    } else {
      setSelectedHosts(hosts.map(h => h.id));
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Выполнение проверки</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Выберите проверку</CardTitle>
        </CardHeader>
        <CardContent>
          {scripts.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              Нет доступных проверок. Создайте проверку на странице "Проверки".
            </div>
          ) : (
            <>
              <Select value={selectedScript} onValueChange={setSelectedScript}>
                <SelectTrigger data-testid="select-script">
                  <SelectValue placeholder="Выберите проверку..." />
                </SelectTrigger>
                <SelectContent>
                  {scripts.map((script) => (
                    <SelectItem key={script.id} value={script.id}>
                      {script.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {selectedScript && (
                <div className="mt-4">
                  <Label>Содержимое проверки:</Label>
                  <pre className="bg-slate-900 text-slate-100 p-3 rounded text-xs overflow-x-auto mt-2">
                    {scripts.find(s => s.id === selectedScript)?.content}
                  </pre>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Выберите хосты</CardTitle>
            {hosts.length > 0 && (
              <Button variant="outline" size="sm" onClick={toggleAll} data-testid="toggle-all-hosts">
                {selectedHosts.length === hosts.length ? "Снять все" : "Выбрать все"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {hosts.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              Нет доступных хостов. Добавьте хосты на странице "Хосты".
            </div>
          ) : (
            <div className="space-y-3">
              {hosts.map((host) => (
                <div key={host.id} className="flex items-center space-x-3 p-3 border rounded hover:bg-slate-50">
                  <Checkbox
                    data-testid={`host-checkbox-${host.id}`}
                    checked={selectedHosts.includes(host.id)}
                    onCheckedChange={() => toggleHost(host.id)}
                  />
                  <div className="flex-1">
                    <div className="font-semibold">{host.name}</div>
                    <div className="text-sm text-slate-600">{host.hostname}:{host.port} ({host.os_type})</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button 
          data-testid="execute-btn"
          onClick={handleExecute} 
          disabled={isExecuting || !selectedScript || selectedHosts.length === 0}
          size="lg"
        >
          <Play className="mr-2 h-5 w-5" />
          {isExecuting ? "Выполняется..." : `Выполнить на ${selectedHosts.length} хост(ах)`}
        </Button>
      </div>
    </div>
  );
};

// History Page
const HistoryPage = () => {
  const [executions, setExecutions] = useState([]);
  const [hosts, setHosts] = useState({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [executionsRes, hostsRes] = await Promise.all([
        api.get(`/api/executions`),
        api.get(`/api/hosts`)
      ]);
      setExecutions(executionsRes.data);
      
      // Create hosts lookup map
      const hostsMap = {};
      hostsRes.data.forEach(host => {
        hostsMap[host.id] = host;
      });
      setHosts(hostsMap);
    } catch (error) {
      toast.error("Ошибка загрузки истории");
    }
  };

  // Get badge configuration by check status
  const getCheckStatusBadge = (execution) => {
    const status = execution.check_status;
    
    if (status === 'Пройдена') {
      return <Badge className="bg-green-500 hover:bg-green-600">Пройдена</Badge>;
    } else if (status === 'Не пройдена') {
      return <Badge className="bg-yellow-500 hover:bg-yellow-600">Не пройдена</Badge>;
    } else if (status === 'Ошибка' || !execution.success) {
      return <Badge className="bg-red-500 hover:bg-red-600">Ошибка</Badge>;
    } else if (status === 'Оператор') {
      return <Badge className="bg-blue-500 hover:bg-blue-600">Оператор</Badge>;
    } else if (execution.success) {
      return <Badge className="bg-green-500 hover:bg-green-600">Успех</Badge>;
    } else {
      return <Badge className="bg-red-500 hover:bg-red-600">Ошибка</Badge>;
    }
  };

  // Group executions by project or by individual script execution
  const groupedExecutions = executions.reduce((acc, execution) => {
    if (execution.project_id) {
      // Group by project
      if (!acc[execution.project_id]) {
        acc[execution.project_id] = {
          type: 'project',
          project_id: execution.project_id,
          executions: [],
          executed_at: execution.executed_at
        };
      }
      acc[execution.project_id].executions.push(execution);
    } else {
      // Individual execution (legacy)
      acc[execution.id] = {
        type: 'single',
        execution: execution
      };
    }
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">История выполнений</h1>
      
      <div className="space-y-4">
        {executions.length === 0 ? (
          <div className="text-center py-16">
            <History className="h-16 w-16 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 text-lg mb-2">История выполнений пуста</p>
            <p className="text-slate-400 text-sm">Выполните проверку для просмотра результатов</p>
          </div>
        ) : (
          Object.values(groupedExecutions).map((group) => {
            if (group.type === 'project') {
              // Project execution display
              const successCount = group.executions.filter(e => e.success).length;
              const totalCount = group.executions.length;
              
              return (
                <Card key={group.project_id} data-testid={`execution-card-${group.project_id}`}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Terminal className="h-5 w-5" />
                          Проект (ID: {group.project_id.substring(0, 8)}...)
                        </CardTitle>
                        <CardDescription>
                          {new Date(group.executed_at).toLocaleString('ru-RU')}
                        </CardDescription>
                      </div>
                      <Badge>
                        {successCount}/{totalCount} успешно
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {group.executions.map((execution) => {
                        const host = hosts[execution.host_id];
                        return (
                          <div key={execution.id} className="border rounded p-3">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <div className="font-semibold">{host?.name || execution.host_id}</div>
                                <div className="text-sm text-gray-600">{execution.script_name}</div>
                              </div>
                              {getCheckStatusBadge(execution)}
                            </div>
                            
                            {execution.output && (
                              <div>
                                <Label className="text-xs">Вывод:</Label>
                                <pre className="bg-slate-900 text-slate-100 p-2 rounded text-xs overflow-x-auto mt-1 max-h-40">
                                  {execution.output}
                                </pre>
                              </div>
                            )}
                            
                            {execution.error && (
                              <div className="mt-2">
                                <Label className="text-xs text-red-600">Ошибка:</Label>
                                <pre className="bg-red-50 text-red-800 p-2 rounded text-xs overflow-x-auto mt-1">
                                  {execution.error}
                                </pre>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            } else {
              // Single script execution display (legacy)
              const execution = group.execution;
              const host = hosts[execution.host_id];
              
              return (
                <Card key={execution.id} data-testid={`execution-card-${execution.id}`}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Terminal className="h-5 w-5" />
                          {execution.script_name}
                        </CardTitle>
                        <CardDescription>
                          {new Date(execution.executed_at).toLocaleString('ru-RU')}
                        </CardDescription>
                      </div>
                      {getCheckStatusBadge(execution)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="border rounded p-3">
                      <div className="font-semibold mb-2">{host?.name || execution.host_id}</div>
                      
                      {execution.output && (
                        <div>
                          <Label className="text-xs">Вывод:</Label>
                          <pre className="bg-slate-900 text-slate-100 p-2 rounded text-xs overflow-x-auto mt-1 max-h-40">
                            {execution.output}
                          </pre>
                        </div>
                      )}
                      
                      {execution.error && (
                        <div className="mt-2">
                          <Label className="text-xs text-red-600">Ошибка:</Label>
                          <pre className="bg-red-50 text-red-800 p-2 rounded text-xs overflow-x-auto mt-1">
                            {execution.error}
                          </pre>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            }
          })
        )}
      </div>
    </div>
  );
};

// Main Layout
const Layout = ({ children }) => {
  const location = useLocation();
  const { user, logout, hasPermission, isAdmin } = useAuth();
  const navigate = useNavigate();
  const showScheduler = isAdmin || hasPermission('projects_execute');
  
  const isActive = (path) => {
    if (path === '/hosts') return location.pathname === '/hosts';
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };
  
  const navLinkClass = (path) => {
    return isActive(path) 
      ? "bg-yellow-50 text-yellow-600 hover:bg-yellow-100 hover:text-yellow-700" 
      : "hover:bg-gray-100";
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  
  return (
<div className="m-0 p-0 w-full">
  {/* Первая строка шапки - FIXED */}
{/* Обертка для всего приложения */}
<div className="m-0 p-0 w-full min-h-screen bg-gray-50">
  {/* Первая строка шапки */}
  {/* Первая строка шапки - FIXED */}
  <nav className="fixed top-0 left-0 right-0 z-50 w-full"> {/* ← ДОБАВИЛ w-full */}
    <div className="bg-gray-50 border-b border-gray-200 w-full"> {/* ← И здесь w-full */}
      <div className="max-w-7xl mx-auto px-6 w-full"> {/* ← И здесь w-full */}
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-3">
            <img src="/logo.png" alt="OSIB" className="h-14 w-14 object-contain" />
            <span className="text-2xl font-bold text-gray-800">Инструмент автоматизации ОСИБ</span>
          </Link>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-gray-500" />
              <span className="text-gray-700 font-medium">{user?.full_name}</span>
              {user?.is_admin && (
                <Badge className="bg-yellow-400 text-white text-xs border-0">adm</Badge>
              )}
            </div>
            <Button 
              className="bg-yellow-400 hover:bg-gray-50 text-black"
              size="sm"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4 mr-1" />
              Выйти
            </Button>
          </div>
        </div>
      </div>
    </div>
  </nav>

  {/* Вторая строка шапки */}
  <div className="fixed top-16 left-0 right-0 z-40 w-full"> 
    <div className="bg-yellow-400 shadow-md rounded-b-lg header-div"> 
      <div className="max-w-7xl mx-auto px-6 w-full content-div"> 
        <div className="flex items-center justify-between h-12">
          {/* Основные пункты меню слева */}
          <div className="flex items-center gap-1">
            <Link to="/">
              <Button
                variant={isActive('/') ? "default" : "ghost"}
                data-testid="nav-projects"
                className={`h-12 px-4 font-medium ${
                  isActive('/') ? 'bg-white text-black' : 'text-black hover:bg-white'
                }`}
              >
                <Briefcase className="mr-3 h-5 w-5" /> Проекты
              </Button>
            </Link>
            <Link to="/hosts">
              <Button
                variant={isActive('/hosts') ? "default" : "ghost"}
                data-testid="nav-hosts"
                className={`h-12 px-4 font-medium ${
                  isActive('/hosts') ? 'bg-white text-black' : 'text-black hover:bg-white'
                }`}
              >
                <Server className="mr-3 h-5 w-5" /> Хосты
              </Button>
            </Link>
            <Link to="/scripts">
              <Button
                variant={isActive('/scripts') ? "default" : "ghost"}
                data-testid="nav-scripts"
                className={`h-12 px-4 font-medium ${
                  isActive('/scripts') ? 'bg-white text-black' : 'text-black hover:bg-white'
                }`}
              >
                <FileCode className="mr-3 h-5 w-5" /> Проверки
              </Button>
            </Link>
            {showScheduler && (
              <Link to="/scheduler">
                <Button
                  variant={isActive('/scheduler') ? "default" : "ghost"}
                  data-testid="nav-scheduler"
                  className={`h-12 px-4 font-medium ${
                    isActive('/scheduler') ? 'bg-white text-black' : 'text-black hover:bg-white'
                  }`}
                >
                  <Calendar className="mr-3 h-8 w-8" /> Планировщик
                </Button>
              </Link>
            )}
            {isAdmin && (
              <Link to="/logs">
                <Button
                  variant={isActive('/logs') ? "default" : "ghost"}
                  data-testid="nav-logs"
                  className={`h-12 px-4 py-3 font-medium ${
                    isActive('/logs') ? 'bg-white text-black' : 'text-black hover:bg-white'
                  }`}
                >
                  <FileText className="mr-3 h-8 w-8" /> Логи
                </Button>
              </Link>
            )}
          </div>

          {/* Выпадающее меню справа */}
          <div className="relative group">
            <button className="flex items-center justify-center text-black hover:bg-white hover:text-black h-12 w-12 rounded-md transition-colors">
              <Menu className="h-8 w-8" />
            </button>
            <div className="absolute right-0 top-full mt-1 w-56 bg-white border-2 border-gray-300 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
              <Link to="/admin">
                <div className="flex items-center px-4 py-3 text-base font-medium text-gray-800 hover:bg-gray-100 cursor-pointer">
                  <Settings className="mr-3 h-5 w-5" /> Админ-панель
                </div>
              </Link>
              <div className="border-t-2 border-gray-200 my-1"></div>
              <Link to="/users">
                <div className="flex items-center px-4 py-3 text-base font-medium text-gray-800 hover:bg-gray-100 cursor-pointer">
                  <User className="mr-3 h-5 w-5" /> Пользователи
                </div>
              </Link>
              <div className="border-t-2 border-gray-200 my-1"></div>
              <Link to="/roles">
                <div className="flex items-center px-4 py-3 text-base font-medium text-gray-800 hover:bg-gray-100 cursor-pointer">
                  <Shield className="mr-3 h-5 w-5" /> Роли
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  {/* Основной контент */}
  <div className="pt-32">
    <div className="max-w-7xl mx-auto px-6 content-div">
      {children}
    </div>
  </div>
</div>

</div>
  );
};

// Wrapper components for project pages with routing
const ProjectsPageWrapper = () => {
  const navigate = useNavigate();
  const handleNavigate = (page, id) => {
    if (page === 'project-wizard') {
      navigate('/new');
    } else if (page === 'project-execute') {
      navigate(`/${id}/execute`);
    } else if (page === 'project-results') {
      navigate(`/${id}/results`);
    } else if (page === 'projects') {
      navigate('/');
    }
  };
  return <ProjectsPage onNavigate={handleNavigate} />;
};

const ProjectWizardWrapper = () => {
  const navigate = useNavigate();
  const handleNavigate = (page) => {
    if (page === 'projects') {
      navigate('/');
    }
  };
  return <ProjectWizard onNavigate={handleNavigate} />;
};

const ProjectExecutionPageWrapper = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const handleNavigate = (page, id) => {
    if (page === 'projects') {
      navigate('/');
    } else if (page === 'project-results') {
      navigate(`/${id || projectId}/results`);
    }
  };
  return <ProjectExecutionPage projectId={projectId} onNavigate={handleNavigate} />;
};

const ProjectResultsPageWrapper = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const handleNavigate = (page) => {
    if (page === 'projects') {
      navigate('/');
    }
  };
  return <ProjectResultsPage projectId={projectId} onNavigate={handleNavigate} />;
};

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/*" element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route path="/" element={<ProjectsPageWrapper />} />
                    <Route path="/hosts" element={<HostsPage />} />
                    <Route path="/scripts" element={<ScriptsPage />} />
                    <Route path="/execute" element={<ExecutePage />} />
                    <Route path="/new" element={<ProjectWizardWrapper />} />
                    <Route path="/:projectId/execute" element={<ProjectExecutionPageWrapper />} />
                    <Route path="/:projectId/results" element={<ProjectResultsPageWrapper />} />
                    <Route path="/history" element={<HistoryPage />} />
                    <Route path="/scheduler" element={<SchedulerPage />} />
                    <Route path="/logs" element={<LogsPage />} />
                    <Route path="/admin" element={<AdminPage />} />
                    <Route path="/users" element={<UsersPage />} />
                    <Route path="/roles" element={<RolesPage />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            } />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;