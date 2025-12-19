import React, { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Server, Plus, Trash2, HelpCircle, Loader2, Upload, Edit } from "lucide-react";
import { toast } from "sonner";
import { useWizard } from './WizardContext';

const INITIAL_FORM_DATA = {
  name: "",
  hostname: "",
  port: 22,
  username: "",
  auth_type: "password",
  password: "",
  ssh_key: "",
  connection_type: "ssh"
};

export default function Step2HostSelection() {
  const { 
    projectData, 
    setProjectData,
    saveHostToDatabase,
    updateHostInDatabase,
    deleteHostFromDatabase,
    fetchAllHosts,
    initializeTasksFromHosts
  } = useWizard();

  const [isHostDialogOpen, setIsHostDialogOpen] = useState(false);
  const [editingHost, setEditingHost] = useState(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importing, setImporting] = useState(false);
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);
  const fileInputRef = useRef(null);

  const projectHosts = projectData.hostsList || [];

  const handleHostsUpdate = useCallback((updatedHostsList) => {
    const updatedTasks = initializeTasksFromHosts(updatedHostsList);
    setProjectData(prev => ({
      ...prev,
      hostsList: updatedHostsList,
      tasks: updatedTasks
    }));
  }, [initializeTasksFromHosts, setProjectData]);

  const handleSubmitHost = useCallback(async (e) => {
    e.preventDefault();
    try {
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

      let savedHost;
      if (editingHost?.id) {
        savedHost = await updateHostInDatabase(editingHost.id, hostToSave);
      } else {
        savedHost = await saveHostToDatabase(hostToSave);
      }

      const updatedHosts = editingHost
        ? projectHosts.map(h => h.id === savedHost.id ? savedHost : h)
        : [...projectHosts, savedHost];

      handleHostsUpdate(updatedHosts);
      await fetchAllHosts();
      
      setIsHostDialogOpen(false);
      resetForm();
      toast.success(editingHost ? "Хост обновлен" : "Хост добавлен");
    } catch (error) {
      console.error('Error saving host:', error);
      toast.error("Ошибка сохранения хоста");
    }
  }, [formData, editingHost, projectHosts, handleHostsUpdate, saveHostToDatabase, updateHostInDatabase, fetchAllHosts]);

  const handleDeleteHost = useCallback(async (hostId) => {
    try {
      await deleteHostFromDatabase(hostId);
      const updatedHosts = projectHosts.filter(h => h.id !== hostId);
      handleHostsUpdate(updatedHosts);
      await fetchAllHosts();
      toast.success("Хост удален");
    } catch (error) {
      console.error('Error deleting host:', error);
      toast.error("Ошибка удаления хоста");
    }
  }, [projectHosts, handleHostsUpdate, deleteHostFromDatabase, fetchAllHosts]);

  const resetForm = useCallback(() => {
    setFormData(INITIAL_FORM_DATA);
    setEditingHost(null);
  }, []);

  const openEditDialog = useCallback((host) => {
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
  }, []);

  const handleFileImport = useCallback(async (event) => {
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
        const hostToSave = {
          ...hostData,
          auth_type: hostData.auth_type || 'password'
        };
        
        try {
          const savedHost = await saveHostToDatabase(hostToSave);
          newHosts.push(savedHost);
        } catch (error) {
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
        
        if (i < hostsData.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      const updatedHosts = [...projectHosts, ...newHosts];
      handleHostsUpdate(updatedHosts);
      await fetchAllHosts();
      
      await new Promise(resolve => setTimeout(resolve, 500));
      setImportDialogOpen(false);
      
      toast.success(`Импортировано хостов: ${newHosts.length}`);
    } catch (error) {
      console.error('Import error:', error);
      setImportDialogOpen(false);
      toast.error("Ошибка при импорте файла. Проверьте формат файла.");
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [projectHosts, handleHostsUpdate, saveHostToDatabase, fetchAllHosts]);

  const handleFormChange = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Шаг 2: Управление хостами проекта</CardTitle>
        <CardDescription>
          Добавьте хосты для выполнения проверок. Все добавленные хосты будут использоваться в проекте.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Control panel */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex gap-2">
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
                  <Button type="button" variant="ghost" className="h-10 w-10 p-0">
                    <HelpCircle className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="w-96">
                  <pre className="text-xs whitespace-pre-wrap">
{`•Импорт хостов реализован в формате json;
•Используйте файлы .json или .txt;
•Для linux порт 22 и connection_type=ssh;
•Для windows порт 5986 и connection_type=winrm;
•Для авторизации через ssh-key auth_type=key;`}
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
                <DialogDescription>Внесите информацию о сервере</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmitHost} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Название</Label>
                    <Input
                      placeholder="ЗАКС сервер хранения"
                      value={formData.name}
                      onChange={(e) => handleFormChange('name', e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label>Хост</Label>
                    <Input
                      placeholder="192.168.1.1 или host1.rn.ru"
                      value={formData.hostname}
                      onChange={(e) => handleFormChange('hostname', e.target.value)}
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
                      onChange={(e) => handleFormChange('port', parseInt(e.target.value))}
                      required
                    />
                  </div>
                  <div>
                    <Label>Имя пользователя</Label>
                    <Input
                      value={formData.username}
                      placeholder="user"
                      onChange={(e) => handleFormChange('username', e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Тип подключения</Label>
                    <Select 
                      value={formData.connection_type} 
                      onValueChange={(value) => {
                        const newPort = value === 'winrm' ? 5985 : 22;
                        setFormData(prev => ({ ...prev, connection_type: value, port: newPort }));
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
                      value={formData.auth_type} 
                      onValueChange={(value) => handleFormChange('auth_type', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="password">Пароль</SelectItem>
                        {formData.connection_type !== 'winrm' && (
                          <SelectItem value="key">SSH ключ</SelectItem>
                        )}
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
                      onChange={(e) => handleFormChange('password', e.target.value)}
                      placeholder={editingHost ? "Оставьте пустым, чтобы не менять" : ""}
                      required={!editingHost}
                    />
                  </div>
                ) : (
                  <div>
                    <Label>SSH приватный ключ</Label>
                    <Textarea
                      value={formData.ssh_key}
                      onChange={(e) => handleFormChange('ssh_key', e.target.value)}
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

        {/* Hosts list */}
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

        {/* Import progress dialog */}
        <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Импорт хостов из файла</DialogTitle>
              <DialogDescription>Импортирование хостов из файла...</DialogDescription>
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
}

