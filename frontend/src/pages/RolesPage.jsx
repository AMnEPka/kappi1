import React, { useState, useCallback, useMemo } from 'react';
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Badge } from "../components/ui/badge";
import { Checkbox } from "../components/ui/checkbox";
import { Infinity, PlusCircle, Edit, Trash2, Shield, Lock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from '../contexts/AuthContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { api } from '../config/api';
import { useDialog } from "@/hooks/useDialog";
import { ConfirmationDialog } from "@/components/ui/ConfirmationDialog";
import { useApiLoader } from "@/hooks/useApiLoader";

const INITIAL_FORM_DATA = {
  name: '',
  description: '',
  permissions: []
};

export default function RolesPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const { hasPermission, isAdmin } = useAuth();
  const { dialogState, setDialogState, showConfirm } = useDialog();
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);

  const canManageRoles = isAdmin || hasPermission('roles_manage');

  // Оптимизированная загрузка данных с AbortController
  const { data, loading, refetch } = useApiLoader([
    { key: 'roles', url: '/api/roles', enabled: canManageRoles },
    { key: 'permissionsData', url: '/api/permissions', enabled: canManageRoles }
  ], [canManageRoles]);

  const roles = data.roles || [];
  const permissionsData = data.permissionsData || { permissions: {}, groups: {} };
  const { permissions: ALL_PERMISSIONS = {}, groups: PERMISSION_GROUPS = {} } = permissionsData;

  // Мемоизированные handlers
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Введите название роли");
      return;
    }

    try {
      if (editingRole) {
        await api.put(`/api/roles/${editingRole.id}`, formData);
        toast.success("Роль обновлена");
      } else {
        await api.post(`/api/roles`, formData);
        toast.success("Роль создана");
      }

      setDialogOpen(false);
      setEditingRole(null);
      setFormData(INITIAL_FORM_DATA);
      refetch();
    } catch (error) {
      console.error('Error saving role:', error);
      if (error.response?.status === 403) {
        toast.error("Недостаточно прав для управления ролями");
      } else {
        toast.error(error.response?.data?.detail || "Ошибка сохранения роли");
      }
    }
  }, [editingRole, formData, refetch]);

  const handleDelete = useCallback(async (roleId) => {
    // Находим роль по ID
    const roleToDelete = roles?.find(role => role.id === roleId);
    
    // Проверяем, является ли роль "Администратором"
    if (roleToDelete?.name === "Администратор") {
      toast.error("Роль 'Администратор' нельзя удалить", {
        description: "Эта роль является системной и необходима для управления доступом"
      });
      return;
    }
  
    const confirmed = await showConfirm(
      "Удаление роли",
      `Вы уверены, что хотите удалить роль "${roleToDelete?.name || 'эту роль'}"? Все пользователи с этой ролью потеряют связанные с ней права.`,
      {
        variant: "destructive",
        confirmText: "Удалить",
        cancelText: "Отмена"
      }
    );
  
    if (!confirmed) return;
  
    try {
      await api.delete(`/api/roles/${roleId}`);
      toast.success("Роль удалена", {
        description: `Роль "${roleToDelete?.name}" была успешно удалена`
      });
      refetch();
    } catch (error) {
      console.error('Error deleting role:', error);
      
      // Обработка ошибок
      if (error.response?.status === 403) {
        toast.error("Недостаточно прав для удаления ролей", {
          description: "Обратитесь к администратору системы"
        });
      } else if (error.response?.status === 400) {
        // Проверяем, не пытаемся ли удалить роль, которая используется
        const errorMessage = error.response?.data?.detail || error.message;
        if (errorMessage.includes('пользователи') || errorMessage.includes('используется')) {
          toast.error("Нельзя удалить роль", {
            description: "Эта роль назначена пользователям. Сначала измените роли пользователей."
          });
        } else {
          toast.error(errorMessage || "Не удалось удалить роль");
        }
      } else {
        toast.error(error.response?.data?.detail || "Не удалось удалить роль", {
          description: "Попробуйте еще раз или обратитесь в поддержку"
        });
      }
    }
  }, [showConfirm, refetch, roles]);

  const openEditDialog = useCallback((role) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      description: role.description || '',
      permissions: role.permissions || []
    });
    setDialogOpen(true);
  }, []);

  const resetForm = useCallback(() => {
    setEditingRole(null);
    setFormData(INITIAL_FORM_DATA);
  }, []);

  const togglePermission = useCallback((permission) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission]
    }));
  }, []);

  const togglePermissionGroup = useCallback((groupPermissions) => {
    setFormData(prev => {
      const allSelected = groupPermissions.every(p => prev.permissions.includes(p));
      
      if (allSelected) {
        return {
          ...prev,
          permissions: prev.permissions.filter(p => !groupPermissions.includes(p))
        };
      } else {
        return {
          ...prev,
          permissions: [...new Set([...prev.permissions, ...groupPermissions])]
        };
      }
    });
  }, []);

  const handleFormChange = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  // Мемоизированный рендер списка ролей
  const roleCards = useMemo(() => (
    roles.map((role) => (
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
                  <Badge 
                    variant="outline" 
                    className={`ml-2 ${role.name === "Администратор" ? 'border-green-200 text-green-800 bg-green-50' : ''}`}
                  >
                    Права: {role.name === "Администратор" ? "∞" : role.permissions?.length || 0}
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
              <p className="text-sm font-medium text-gray-700">Права доступа:</p>
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
    ))
  ), [roles, ALL_PERMISSIONS, openEditDialog, handleDelete]);

  // Мемоизированный рендер групп разрешений
  const permissionGroups = useMemo(() => (
    Object.entries(PERMISSION_GROUPS).map(([groupName, groupPermissions]) => {
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
                  {ALL_PERMISSIONS[permission] || permission}
                </Label>
              </div>
            ))}
          </div>
        </div>
      );
    })
  ), [PERMISSION_GROUPS, ALL_PERMISSIONS, formData.permissions, togglePermission, togglePermissionGroup]);

  if (!canManageRoles) {
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
          <p className="text-gray-600 mt-1">Создание ролей и управление правами доступа</p>
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
        {editingRole ? 'Обновите информацию о роли и её правах доступа' : 'Создайте новую роль с набором прав доступа'}
      </DialogDescription>
    </DialogHeader>
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Label htmlFor="name">Название роли</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => handleFormChange('name', e.target.value)}
          placeholder="Например: Менеджер проектов"
          required
          disabled={editingRole?.name === "Администратор"} // Запрещаем редактирование названия для роли Администратор
        />
        {editingRole?.name === "Администратор" && (
          <p className="text-sm text-gray-500 mt-1">Название роли "Администратор" нельзя изменить</p>
        )}
      </div>
      
      <div>
        <Label htmlFor="description">Описание</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => handleFormChange('description', e.target.value)}
          placeholder="Краткое описание роли и её назначения"
          rows={2}
          disabled={editingRole?.name === "Администратор"} // Запрещаем редактирование описания для роли Администратор
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">Права</Label>
          {editingRole?.name === "Администратор" && (
            <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
              <Infinity className="h-3 w-3 mr-1" />
              Полный доступ
            </Badge>
          )}
        </div>
        <p className="text-sm text-gray-500">Выберите права доступа для этой роли</p>
        
        {/* Если редактируем роль Администратор, показываем сообщение вместо списка прав */}
        {editingRole?.name === "Администратор" ? (
          <div className="p-4 bg-blue-50 rounded-md border border-blue-200">
            <div className="flex items-center">
              <Shield className="h-5 w-5 text-blue-500 mr-2" />
              <p className="text-blue-700 font-medium">Роль "Администратор" имеет все права доступа по умолчанию</p>
            </div>
            <p className="text-blue-600 text-sm mt-1">
              Эта роль обладает неограниченными правами в системе. Для изменения прав создайте другую роль.
            </p>
          </div>
        ) : (
          permissionGroups
        )}
      </div>

      <div className="flex gap-2 pt-4 border-t">
        <Button 
          type="submit" 
          className="flex-1" 
          variant="yellow"
          disabled={editingRole?.name === "Администратор"} // Запрещаем сохранение изменений для Администратора
        >
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
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500 mx-auto mb-2"></div>
            <span className="text-gray-500">Загрузка ролей...</span>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {roles.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-32">
                <p className="text-gray-500">Роли не найдены</p>
              </CardContent>
            </Card>
          ) : roleCards}
        </div>
      )}

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
