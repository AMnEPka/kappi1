import { useState, useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Link, useNavigate } from "react-router-dom";
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
import { Server, FileCode, Play, History, Plus, Edit, Trash2, Terminal, Settings, Folder, HardDrive } from "lucide-react";
import CategoriesPage from "@/pages/CategoriesPage";
import SystemsPage from "@/pages/SystemsPage";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Hosts Page
const HostsPage = () => {
  const [hosts, setHosts] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingHost, setEditingHost] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    hostname: "",
    port: 22,
    username: "",
    auth_type: "password",
    password: "",
    ssh_key: "",
    os_type: "linux"
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

  const resetForm = () => {
    setFormData({
      name: "",
      hostname: "",
      port: 22,
      username: "",
      auth_type: "password",
      password: "",
      ssh_key: "",
      os_type: "linux"
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
      os_type: host.os_type
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
                    placeholder="192.168.1.1 или domain.com"
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
                <div>
                  <Label>ОС</Label>
                  <Select value={formData.os_type} onValueChange={(value) => setFormData({...formData, os_type: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="linux">Linux</SelectItem>
                      <SelectItem value="windows">Windows</SelectItem>
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
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(host)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(host.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div>Пользователь: <strong>{host.username}</strong></div>
                  <div className="flex gap-2">
                    <Badge variant="outline">{host.auth_type === "password" ? "Пароль" : "SSH ключ"}</Badge>
                    <Badge variant="outline">{host.os_type === "linux" ? "Linux" : "Windows"}</Badge>
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
    order: 0
  });

  useEffect(() => {
    fetchCategories();
    fetchScripts();
  }, []);

  useEffect(() => {
    if (selectedCategory) {
      fetchSystemsByCategory(selectedCategory);
    } else {
      setSystems([]);
      setSelectedSystem("");
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
      if (selectedSystem) {
        url += `?system_id=${selectedSystem}`;
      } else if (selectedCategory) {
        url += `?category_id=${selectedCategory}`;
      }
      const response = await axios.get(url);
      setScripts(response.data);
    } catch (error) {
      toast.error("Ошибка загрузки скриптов");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingScript) {
        await axios.put(`${API}/scripts/${editingScript.id}`, formData);
        toast.success("Скрипт обновлен");
      } else {
        await axios.post(`${API}/scripts`, formData);
        toast.success("Скрипт создан");
      }
      setIsDialogOpen(false);
      resetForm();
      fetchScripts();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Ошибка сохранения скрипта");
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Удалить скрипт?")) {
      try {
        await axios.delete(`${API}/scripts/${id}`);
        toast.success("Скрипт удален");
        fetchScripts();
      } catch (error) {
        toast.error("Ошибка удаления скрипта");
      }
    }
  };

  const resetForm = () => {
    setFormData({
      system_id: "",
      name: "",
      description: "",
      content: "",
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
          <h1 className="text-3xl font-bold">Скрипты проверок</h1>
          <p className="text-slate-500 mt-1">Управление скриптами для проверки систем</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button data-testid="add-script-btn">
              <Plus className="mr-2 h-4 w-4" /> Создать скрипт
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingScript ? "Редактировать скрипт" : "Новый скрипт"}</DialogTitle>
              <DialogDescription>
                Создайте скрипт проверки для конкретной системы
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
                <Label>Команды</Label>
                <Textarea
                  data-testid="script-content-input"
                  value={formData.content}
                  onChange={(e) => setFormData({...formData, content: e.target.value})}
                  placeholder="uname -r"
                  rows={12}
                  className="font-mono text-sm"
                  required
                />
              </div>

              <div>
                <Label>Порядок отображения</Label>
                <Input
                  type="number"
                  value={formData.order}
                  onChange={(e) => setFormData({...formData, order: parseInt(e.target.value)})}
                  min="0"
                />
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
              <SelectItem value="">Все категории</SelectItem>
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
          <Select value={selectedSystem} onValueChange={setSelectedSystem} disabled={!selectedCategory}>
            <SelectTrigger>
              <SelectValue placeholder={selectedCategory ? "Все системы категории" : "Сначала выберите категорию"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Все системы</SelectItem>
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
            <p className="text-slate-500 text-lg mb-2">Нет скриптов</p>
            <p className="text-slate-400 text-sm">Создайте первый скрипт проверки</p>
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
                <pre className="bg-slate-900 text-slate-100 p-3 rounded text-xs overflow-x-auto max-h-40">
                  {script.content}
                </pre>
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
      toast.error("Выберите скрипт и хосты");
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
      toast.error("Ошибка выполнения скрипта");
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
      <h1 className="text-3xl font-bold">Выполнение скрипта</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Выберите скрипт</CardTitle>
        </CardHeader>
        <CardContent>
          {scripts.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              Нет доступных скриптов. Создайте скрипты на странице "Скрипты".
            </div>
          ) : (
            <>
              <Select value={selectedScript} onValueChange={setSelectedScript}>
                <SelectTrigger data-testid="select-script">
                  <SelectValue placeholder="Выберите скрипт..." />
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
                  <Label>Содержимое скрипта:</Label>
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

  useEffect(() => {
    fetchExecutions();
  }, []);

  const fetchExecutions = async () => {
    try {
      const response = await axios.get(`${API}/executions`);
      setExecutions(response.data);
    } catch (error) {
      toast.error("Ошибка загрузки истории");
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">История выполнений</h1>
      
      <div className="space-y-4">
        {executions.length === 0 ? (
          <div className="text-center py-16">
            <History className="h-16 w-16 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 text-lg mb-2">История выполнений пуста</p>
            <p className="text-slate-400 text-sm">Выполните скрипт для просмотра результатов</p>
          </div>
        ) : (
          executions.map((execution) => (
            <Card key={execution.id} data-testid={`execution-card-${execution.id}`}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Terminal className="h-5 w-5" />
                      {execution.script_name}
                    </CardTitle>
                    <CardDescription>
                      {new Date(execution.created_at).toLocaleString('ru-RU')}
                    </CardDescription>
                  </div>
                  <Badge>
                    {execution.results.filter(r => r.success).length}/{execution.results.length} успешно
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {execution.results.map((result, idx) => (
                    <div key={idx} className="border rounded p-3">
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-semibold">{result.host_name}</div>
                        <Badge variant={result.success ? "default" : "destructive"}>
                          {result.success ? "Успех" : "Ошибка"}
                        </Badge>
                      </div>
                      
                      {result.output && (
                        <div>
                          <Label className="text-xs">Вывод:</Label>
                          <pre className="bg-slate-900 text-slate-100 p-2 rounded text-xs overflow-x-auto mt-1 max-h-40">
                            {result.output}
                          </pre>
                        </div>
                      )}
                      
                      {result.error && (
                        <div className="mt-2">
                          <Label className="text-xs text-red-600">Ошибка:</Label>
                          <pre className="bg-red-50 text-red-800 p-2 rounded text-xs overflow-x-auto mt-1">
                            {result.error}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

// Main Layout
const Layout = ({ children }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      <nav className="bg-white border-b shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <Terminal className="h-6 w-6 text-blue-600" />
              <span className="text-xl font-bold">SSH Script Runner</span>
            </div>
            <div className="flex gap-2">
              <Link to="/">
                <Button variant="ghost" data-testid="nav-hosts">
                  <Server className="mr-2 h-4 w-4" /> Хосты
                </Button>
              </Link>
              <Link to="/scripts">
                <Button variant="ghost" data-testid="nav-scripts">
                  <FileCode className="mr-2 h-4 w-4" /> Скрипты
                </Button>
              </Link>
              <Link to="/execute">
                <Button variant="ghost" data-testid="nav-execute">
                  <Play className="mr-2 h-4 w-4" /> Выполнение
                </Button>
              </Link>
              <Link to="/history">
                <Button variant="ghost" data-testid="nav-history">
                  <History className="mr-2 h-4 w-4" /> История
                </Button>
              </Link>
              <div className="border-l mx-2 h-8"></div>
              <Link to="/admin/categories">
                <Button variant="ghost" data-testid="nav-admin">
                  <Settings className="mr-2 h-4 w-4" /> Админ
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

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<HostsPage />} />
            <Route path="/scripts" element={<ScriptsPage />} />
            <Route path="/execute" element={<ExecutePage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/admin/categories" element={<CategoriesPage />} />
            <Route path="/admin/systems" element={<SystemsPage />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </div>
  );
}

export default App;