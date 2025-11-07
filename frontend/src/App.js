import { useState, useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Link, useNavigate, useParams, useLocation } from "react-router-dom";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Server, FileCode, Play, History, Plus, Edit, Trash2, Terminal, Settings, Folder, HardDrive, Briefcase } from "lucide-react";
import AdminPage from "@/pages/AdminPage";
import ProjectsPage from "@/pages/ProjectsPage";
import ProjectWizard from "@/pages/ProjectWizard";
import ProjectExecutionPage from "@/pages/ProjectExecutionPage";
import ProjectResultsPage from "@/pages/ProjectResultsPage";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || window.location.origin.replace(':3000', ':8001').replace('127.0.0.1', 'localhost');
const API = `${BACKEND_URL}/api`;

// Hosts Page
const HostsPage = () => {
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
    ssh_key: ""
  });

  useEffect(() => {
    fetchHosts();
  }, []);

  const fetchHosts = async () => {
    try {
      const response = await axios.get(`${API}/hosts`);
      setHosts(response.data);
    } catch (error) {
      toast.error("Ошибка загрузки хостов");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingHost) {
        await axios.put(`${API}/hosts/${editingHost.id}`, formData);
        toast.success("Хост обновлен");
      } else {
        await axios.post(`${API}/hosts`, formData);
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
        await axios.delete(`${API}/hosts/${id}`);
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
      const response = await axios.post(`${API}/hosts/${hostId}/test`);
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

  const openEditDialog = (host) => {
    setEditingHost(host);
    setFormData({
      name: host.name,
      hostname: host.hostname,
      port: host.port,
      username: host.username,
      auth_type: host.auth_type,
      password: "",
      ssh_key: host.ssh_key || ""
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
                Добавьте информацию о сервере для SSH подключения
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Название</Label>
                  <Input
                    data-testid="host-name-input"
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
                    onChange={(e) => setFormData({...formData, username: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Тип аутентификации</Label>
                  <Select value={formData.auth_type} onValueChange={(value) => setFormData({...formData, auth_type: value})}>
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
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(host)} className="hover:bg-yellow-50 hover:text-yellow-600">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(host.id)} className="hover:bg-red-50 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div>Пользователь: <strong>{host.username}</strong></div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{host.auth_type === "password" ? "Пароль" : "SSH ключ"}</Badge>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full mt-2"
                    onClick={() => handleTestConnection(host.id)}
                    disabled={testingHostId === host.id}
                  >
                    {testingHostId === host.id ? "Тестирование..." : "Тест подключения"}
                  </Button>
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
      const response = await axios.get(`${API}/categories`);
      setCategories(response.data);
    } catch (error) {
      toast.error("Ошибка загрузки категорий");
    }
  };

  const fetchSystemsByCategory = async (categoryId) => {
    try {
      const response = await axios.get(`${API}/systems?category_id=${categoryId}`);
      setSystems(response.data);
    } catch (error) {
      toast.error("Ошибка загрузки систем");
    }
  };

  const fetchScripts = async () => {
    try {
      let url = `${API}/scripts`;
      if (selectedSystem && selectedSystem !== "all") {
        url += `?system_id=${selectedSystem}`;
      } else if (selectedCategory && selectedCategory !== "all") {
        url += `?category_id=${selectedCategory}`;
      }
      const response = await axios.get(url);
      setScripts(response.data);
    } catch (error) {
      toast.error("Ошибка загрузки проверок");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingScript) {
        await axios.put(`${API}/scripts/${editingScript.id}`, formData);
        toast.success("Проверка обновлена");
      } else {
        await axios.post(`${API}/scripts`, formData);
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
        await axios.delete(`${API}/scripts/${id}`);
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
      order: 0
    });
    setFormCategoryId("");
    setFormSystems([]);
    setEditingScript(null);
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
      order: script.order || 0
    });
    
    // Load category and systems for editing
    try {
      const systemRes = await axios.get(`${API}/systems/${script.system_id}`);
      const system = systemRes.data;
      setFormCategoryId(system.category_id);
      
      const systemsRes = await axios.get(`${API}/systems?category_id=${system.category_id}`);
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
      const response = await axios.get(`${API}/systems?category_id=${categoryId}`);
      setFormSystems(response.data);
    } catch (error) {
      toast.error("Ошибка загрузки систем");
    }
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
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingScript ? "Редактировать проверку" : "Новая проверка"}</DialogTitle>
              <DialogDescription>
                Создайте проверку для конкретной системы
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Категория</Label>
                <Select 
                  value={formCategoryId} 
                  onValueChange={handleCategoryChangeInForm}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите категорию..." />
                  </SelectTrigger>
                  <SelectContent>
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
                      <SelectItem key={sys.id} value={sys.id}>
                        {sys.name}
                      </SelectItem>
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
                <Label>Команда</Label>
                <Textarea
                  data-testid="script-content-input"
                  value={formData.content}
                  onChange={(e) => setFormData({...formData, content: e.target.value})}
                  placeholder="cat /etc/hostname"
                  rows={2}
                  className="font-mono text-sm"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Команда с выводом (cat, ls, и т.д.)</p>
              </div>

              <div>
                <Label>Скрипт-обработчик</Label>
                <Textarea
                  value={formData.processor_script}
                  onChange={(e) => setFormData({...formData, processor_script: e.target.value})}
                  placeholder="#!/bin/bash
# Результат команды доступен в переменной $CHECK_OUTPUT
# Пример :
if echo '$CHECK_OUTPUT' | grep -q 'нужная строка'; then
echo 'Пройдена'
else
echo 'Не пройдена'
fi

#Эталонные данные доступны в переменной $ETALON_INPUT"
                  rows={10}
                  className="font-mono text-sm"
                />
                <div className="text-xs text-gray-500 mt-1 space-y-1">
                  <p className="font-semibold">Доступ к результату команды:</p>
                  <p>• Переменная: <code className="bg-gray-100 px-1 rounded">$CHECK_OUTPUT</code></p>
                  <p className="font-semibold">Доступ к эталонным данным:</p>
                  <p>• Переменная: <code className="bg-gray-100 px-1 rounded">$ETALON_INPUT</code></p>
                  <p className="font-semibold mt-2">Вывод результатов проверки:</p>
                  <p>Скрипт должен вернуть одно из: <strong>Пройдена</strong>, <strong>Не пройдена</strong>, <strong>Ошибка</strong>, <strong>Оператор</strong></p>                  
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="has_reference_files"
                  checked={formData.has_reference_files}
                  onCheckedChange={(checked) => setFormData({...formData, has_reference_files: checked})}
                />
                <Label htmlFor="has_reference_files" className="cursor-pointer">
                  Есть эталонные файлы
                </Label>
              </div>

              <div className="flex justify-end gap-2">
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {scripts.length === 0 ? (
          <div className="col-span-full text-center py-16">
            <FileCode className="h-16 w-16 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 text-lg mb-2">Нет проверок</p>
            <p className="text-slate-400 text-sm">Создайте первую проверку этого типа</p>
          </div>
        ) : (
          scripts.map((script) => (
            <Card key={script.id} data-testid={`script-card-${script.id}`}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    {script.category_name && (
                      <div className="text-sm text-slate-500 mb-1">
                        {script.category_icon} {script.category_name} → {script.system_name}
                      </div>
                    )}
                    <CardTitle className="flex items-center gap-2">
                      <FileCode className="h-5 w-5" />
                      {script.name}
                    </CardTitle>
                    {script.description && (
                      <CardDescription>{script.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(script)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(script.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-sm">
                    <span className="text-gray-600">Команда:</span>
                    <code className="ml-2 text-xs bg-gray-100 px-2 py-1 rounded">
                      {script.content.length > 50 ? script.content.substring(0, 50) + '...' : script.content}
                    </code>
                  </div>
                  {script.processor_script && (
                    <Badge variant="outline" className="text-xs">
                      <Terminal className="h-3 w-3 mr-1" />
                      Есть обработчик
                    </Badge>
                  )}
                  {script.has_reference_files && (
                    <Badge variant="outline" className="text-xs">
                      📁 Эталонные файлы
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
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
        axios.get(`${API}/scripts`),
        axios.get(`${API}/hosts`)
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
      const response = await axios.post(`${API}/execute`, {
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
        axios.get(`${API}/executions`),
        axios.get(`${API}/hosts`)
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
  
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-3">
              <img src="/logo.png" alt="OSIB" className="h-14 w-14 object-contain" />
              <span className="text-2xl font-bold text-gray-800">Инструмент автоматизации ОСИБ</span>
            </Link>
            <div className="flex gap-2">
              <Link to="/">
                <Button variant="ghost" data-testid="nav-projects" className={navLinkClass('/')}>
                  <Briefcase className="mr-2 h-4 w-4" /> Проекты
                </Button>
              </Link>
              <Link to="/hosts">
                <Button variant="ghost" data-testid="nav-hosts" className={navLinkClass('/hosts')}>
                  <Server className="mr-2 h-4 w-4" /> Хосты
                </Button>
              </Link>
              <Link to="/scripts">
                <Button variant="ghost" data-testid="nav-scripts" className={navLinkClass('/scripts')}>
                  <FileCode className="mr-2 h-4 w-4" /> Проверки
                </Button>
              </Link>
              <Link to="/execute">
                <Button variant="ghost" data-testid="nav-execute" className={navLinkClass('/execute')}>
                  <Play className="mr-2 h-4 w-4" /> Единичный запуск
                </Button>
              </Link>
              <Link to="/history">
                <Button variant="ghost" data-testid="nav-history" className={navLinkClass('/history')}>
                  <History className="mr-2 h-4 w-4" /> История
                </Button>
              </Link>
              <div className="border-l mx-2 h-8 border-gray-200"></div>
              <Link to="/admin">
                <Button variant="ghost" data-testid="nav-admin" className={navLinkClass('/admin')}>
                  <Settings className="mr-2 h-4 w-4" /> Админ-панель
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
};

// Wrapper components for project pages with routing
const ProjectsPageWrapper = () => {
  const navigate = useNavigate();
  const handleNavigate = (page, id) => {
    if (page === 'project-wizard') {
      navigate('/projects/new');
    } else if (page === 'project-execute') {
      navigate(`/projects/${id}/execute`);
    } else if (page === 'project-results') {
      navigate(`/projects/${id}/results`);
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
      navigate(`/projects/${id || projectId}/results`);
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
        <Layout>
          <Routes>
            <Route path="/" element={<ProjectsPageWrapper />} />
            <Route path="/hosts" element={<HostsPage />} />
            <Route path="/scripts" element={<ScriptsPage />} />
            <Route path="/execute" element={<ExecutePage />} />
            <Route path="/projects/new" element={<ProjectWizardWrapper />} />
            <Route path="/projects/:projectId/execute" element={<ProjectExecutionPageWrapper />} />
            <Route path="/projects/:projectId/results" element={<ProjectResultsPageWrapper />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </div>
  );
}

export default App;