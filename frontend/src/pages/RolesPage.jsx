import React, { useState, useEffect } from 'react';
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Badge } from "../components/ui/badge";
import { Checkbox } from "../components/ui/checkbox";
import { PlusCircle, Edit, Trash2, Shield, Lock } from "lucide-react";
import { toast } from "sonner";
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

// Список всех доступных разрешений с описаниями
const ALL_PERMISSIONS = {
  'categories_manage': 'Управление категориями и системами',
  'checks_create': 'Создание проверок',
  'checks_edit_own': 'Редактирование своих проверок',
  'checks_edit_all': 'Редактирование всех проверок',
  'checks_delete_own': 'Удаление своих проверок',
  'checks_delete_all': 'Удаление всех проверок',
  'hosts_create': 'Создание хостов',
  'hosts_edit_own': 'Редактирование своих хостов',
  'hosts_edit_all': 'Редактирование всех хостов',
  'hosts_delete_own': 'Удаление своих хостов',
  'hosts_delete_all': 'Удаление всех хостов',
  'users_manage': 'Управление пользователями',
  'roles_manage': 'Управление ролями',
  'results_view_all': 'Просмотр всех результатов',
  'results_export_all': 'Экспорт всех результатов',
  'projects_create': 'Создание проектов',
  'projects_execute': 'Выполнение проектов',
};

// Группировка разрешений по категориям для лучшей читаемости
const PERMISSION_GROUPS = {
  'Категории и системы': ['categories_manage'],
  'Проверки': ['checks_create', 'checks_edit_own', 'checks_edit_all', 'checks_delete_own', 'checks_delete_all'],
  'Хосты': ['hosts_create', 'hosts_edit_own', 'hosts_edit_all', 'hosts_delete_own', 'hosts_delete_all'],
  'Проекты': ['projects_create', 'projects_execute'],
  'Результаты': ['results_view_all', 'results_export_all'],
  'Администрирование': ['users_manage', 'roles_manage'],
};

export default function RolesPage() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const { hasPermission } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: []
  });

  useEffect(() => {
    if (hasPermission('roles_manage')) {
      fetchRoles();
    }
  }, []);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/roles`);
      setRoles(response.data);
    } catch (error) {
      console.error('Error fetching roles:', error);
      toast.error("Ошибка загрузки ролей");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Введите название роли");
      return;
    }

    try {
      if (editingRole) {
        // Update role
        await axios.put(`${API_URL}/api/roles/${editingRole.id}`, formData);
        toast.success("Роль обновлена");
      } else {
        // Create role
        await axios.post(`${API_URL}/api/roles`, formData);
        toast.success("Роль создана");
      }

      setDialogOpen(false);
      resetForm();
      fetchRoles();
    } catch (error) {
      console.error('Error saving role:', error);
      toast.error(error.response?.data?.detail || "Ошибка сохранения роли");
    }
  };

  const handleDelete = async (roleId) => {
    if (!window.confirm('Вы уверены, что хотите удалить эту роль? Все пользователи с этой ролью потеряют связанные с ней права.')) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/api/roles/${roleId}`);
      toast.success("Роль удалена");
      fetchRoles();
    } catch (error) {
      console.error('Error deleting role:', error);
      toast.error(error.response?.data?.detail || "Не удалось удалить роль");
    }
  };

  const openEditDialog = (role) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      description: role.description || '',
      permissions: role.permissions || []
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingRole(null);
    setFormData({
      name: '',
      description: '',
      permissions: []
    });
  };

  const togglePermission = (permission) => {
    if (formData.permissions.includes(permission)) {
      setFormData({
        ...formData,
        permissions: formData.permissions.filter(p => p !== permission)
      });
    } else {
      setFormData({
        ...formData,
        permissions: [...formData.permissions, permission]
      });
    }
  };

  const togglePermissionGroup = (groupPermissions) => {
    const allSelected = groupPermissions.every(p => formData.permissions.includes(p));
    
    if (allSelected) {
      // Unselect all in group
      setFormData({
        ...formData,
        permissions: formData.permissions.filter(p => !groupPermissions.includes(p))
      });
    } else {
      // Select all in group
      const newPermissions = [...new Set([...formData.permissions, ...groupPermissions])];
      setFormData({
        ...formData,
        permissions: newPermissions
      });
    }
  };

  if (!hasPermission('roles_manage')) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center h-64">
          <Lock className="h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-500">У вас нет прав для управления ролями</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Управление ролями</h2>
          <p className="text-gray-600 mt-1">Создание ролей и управление разрешениями</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="yellow" onClick={resetForm}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Создать роль
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingRole ? 'Редактировать роль' : 'Новая роль'}</DialogTitle>
              <DialogDescription>
                {editingRole ? 'Обновите информацию о роли и её разрешениях' : 'Создайте новую роль с набором разрешений'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label htmlFor="name">Название роли</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Например: Менеджер проектов"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="description">Описание</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Краткое описание роли и её назначения"
                  rows={2}
                />
              </div>

              <div className="space-y-4">
                <Label className="text-base font-semibold">Разрешения</Label>
                <p className="text-sm text-gray-500">Выберите разрешения для этой роли</p>
                
                {Object.entries(PERMISSION_GROUPS).map(([groupName, groupPermissions]) => {
                  const allSelected = groupPermissions.every(p => formData.permissions.includes(p));
                  const someSelected = groupPermissions.some(p => formData.permissions.includes(p)) && !allSelected;
                  
                  return (
                    <div key={groupName} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center space-x-3">
                        <Checkbox
                          id={`group-${groupName}`}
                          checked={allSelected}
                          className={someSelected ? "opacity-50" : ""}
                          onCheckedChange={() => togglePermissionGroup(groupPermissions)}
                        />
                        <Label 
                          htmlFor={`group-${groupName}`} 
                          className="cursor-pointer font-semibold text-base"
                        >
                          {groupName}
                        </Label>
                      </div>
                      
                      <div className="ml-6 space-y-2">
                        {groupPermissions.map((permission) => (
                          <div key={permission} className="flex items-center space-x-3">
                            <Checkbox
                              id={`permission-${permission}`}
                              checked={formData.permissions.includes(permission)}
                              onCheckedChange={() => togglePermission(permission)}
                            />
                            <Label 
                              htmlFor={`permission-${permission}`} 
                              className="cursor-pointer text-sm"
                            >
                              {ALL_PERMISSIONS[permission]}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <Button type="submit" className="flex-1" variant="yellow">
                  {editingRole ? 'Сохранить изменения' : 'Создать роль'}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setDialogOpen(false)} 
                  className="flex-1"
                >
                  Отмена
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-500">Загрузка...</div>
        </div>
      ) : (
        <div className="grid gap-4">
          {roles.map((role) => (
            <Card key={role.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center">
                      <Shield className="h-6 w-6 text-yellow-600" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        {role.name}
                        <Badge variant="outline" className="ml-2">
                          {role.permissions?.length || 0} разрешений
                        </Badge>
                      </CardTitle>
                      {role.description && (
                        <CardDescription className="mt-1">{role.description}</CardDescription>
                      )}
                    </div>
                  </div>
                  <TooltipProvider>
                    <div className="flex gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditDialog(role)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Редактировать роль</p>
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(role.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Удалить роль</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </TooltipProvider>
                </div>
              </CardHeader>
              {role.permissions && role.permissions.length > 0 && (
                <CardContent>
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-gray-700">Разрешения:</p>
                    <div className="flex flex-wrap gap-2">
                      {role.permissions.map((permission) => (
                        <Badge key={permission} variant="secondary" className="text-xs">
                          {ALL_PERMISSIONS[permission] || permission}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
