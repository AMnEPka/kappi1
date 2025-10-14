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
import { Server, FileCode, Play, History, Plus, Edit, Trash2, Terminal } from "lucide-react";

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
        {hosts.map((host) => (
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
        ))}
      </div>
    </div>
  );
};

// Scripts Page
const ScriptsPage = () => {
  const [scripts, setScripts] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingScript, setEditingScript] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    content: ""
  });

  useEffect(() => {
    fetchScripts();
  }, []);

  const fetchScripts = async () => {
    try {
      const response = await axios.get(`${API}/scripts`);
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
      toast.error("Ошибка сохранения скрипта");
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
      name: "",
      description: "",
      content: ""
    });
    setEditingScript(null);
  };

  const openEditDialog = (script) => {
    setEditingScript(script);
    setFormData({
      name: script.name,
      description: script.description || "",
      content: script.content
    });
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Скрипты</h1>
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
                Создайте bash скрипт для выполнения на удаленных хостах
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Название</Label>
                <Input
                  data-testid="script-name-input"
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
                  placeholder="echo 'Hello World'\nls -la"
                  rows={12}
                  className="font-mono text-sm"
                  required
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {scripts.map((script) => (
          <Card key={script.id} data-testid={`script-card-${script.id}`}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
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
        ))}
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
        {executions.map((execution) => (
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
        ))}
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
          </Routes>
        </Layout>
      </BrowserRouter>
    </div>
  );
}

export default App;