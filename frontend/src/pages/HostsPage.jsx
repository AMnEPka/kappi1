import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Server, Plus, Edit, Trash2, Loader2, EthernetPort } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { api } from '../config/api';

export default function HostsPage() {
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
