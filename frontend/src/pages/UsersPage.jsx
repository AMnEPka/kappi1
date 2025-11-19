import React, { useState, useEffect } from 'react';
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Badge } from "../components/ui/badge";
import { Checkbox } from "../components/ui/checkbox";
import { PlusCircle, Edit, Trash2, Key, User, Shield, Lock } from "lucide-react";
import { toast } from "sonner";
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { api } from '../config/api';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [rolesDialogOpen, setRolesDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const { hasPermission } = useAuth();

  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    password: '',
    is_admin: false
  });

  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    if (hasPermission('users_manage')) {
      fetchUsers();
      fetchRoles();
    }
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/users`);
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error("Ошибка загрузки пользователей");
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await api.get(`/api/roles`);
      setRoles(response.data);
    } catch (error) {
      console.error('Error fetching roles:', error);
    }
  };

  const fetchUserRoles = async (userId) => {
    try {
      const response = await api.get(`/api/users/${userId}/roles`);
      return response.data.map(r => r.id);
    } catch (error) {
      console.error('Error fetching user roles:', error);
      return [];
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (editingUser) {
        // Update user
        const updateData = {
          full_name: formData.full_name,
          is_admin: formData.is_admin,
          is_active: true
        };
        await api.put(`/api/users/${editingUser.id}`, updateData);
        toast.success("Пользователь обновлен");
      } else {
        // Create user
        await api.post(`/api/users`, formData);
        toast.success("Пользователь создан");
      }

      setDialogOpen(false);
      resetForm();
      fetchUsers();
    } catch (error) {
      console.error('Error saving user:', error);
      toast.error(error.response?.data?.detail || "Ошибка сохранения пользователя");
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('Вы уверены, что хотите удалить этого пользователя? Его данные будут переназначены на администратора.')) {
      return;
    }

    try {
      await api.delete(`/api/users/${userId}`);
      toast.success("Пользователь удален");
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error(error.response?.data?.detail || "Не удалось удалить пользователя");
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword) {
      toast.error("Введите новый пароль");
      return;
    }

    try {
      await api.put(`/api/users/${selectedUserId}/password`, {
        new_password: newPassword
      });
      toast.success("Пароль изменен");
      setPasswordDialogOpen(false);
      setNewPassword('');
    } catch (error) {
      console.error('Error resetting password:', error);
      toast.error("Не удалось изменить пароль");
    }
  };

  const openRolesDialog = async (user) => {
    setSelectedUserId(user.id);
    const userRoles = await fetchUserRoles(user.id);
    setSelectedRoles(userRoles);
    setRolesDialogOpen(true);
  };

  const handleSaveRoles = async () => {
    try {
      await api.put(`/api/users/${selectedUserId}/roles`, selectedRoles);
      toast.success("Роли назначены");
      setRolesDialogOpen(false);
      fetchUsers();
    } catch (error) {
      console.error('Error saving roles:', error);
      toast.error("Не удалось сохранить роли");
    }
  };

  const openEditDialog = (user) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      full_name: user.full_name,
      password: '',
      is_admin: user.is_admin
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingUser(null);
    setFormData({
      username: '',
      full_name: '',
      password: '',
      is_admin: false
    });
  };

  if (!hasPermission('users_manage')) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center h-64">
          <Lock className="h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-500">У вас нет прав для управления пользователями</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Управление пользователями</h2>
          <p className="text-gray-600 mt-1">Создание и управление учетными записями</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="yellow" onClick={resetForm}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Создать пользователя
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingUser ? 'Редактировать пользователя' : 'Новый пользователь'}</DialogTitle>
              <DialogDescription>
                {editingUser ? 'Обновите информацию о пользователе' : 'Создайте нового пользователя системы'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="username">Логин</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  required
                  disabled={editingUser}
                />
              </div>
              <div>
                <Label htmlFor="full_name">ФИО</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  required
                />
              </div>
              {!editingUser && (
                <div>
                  <Label htmlFor="password">Пароль</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                  />
                </div>
              )}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_admin"
                  checked={formData.is_admin}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_admin: checked })}
                />
                <Label htmlFor="is_admin" className="cursor-pointer">
                  Администратор (полный доступ)
                </Label>
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="flex-1" variant="yellow">
                  {editingUser ? 'Сохранить' : 'Создать'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">
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
          {users.map((user) => (
            <Card key={user.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center">
                      <User className="h-6 w-6 text-yellow-600" />
                    </div>
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {user.full_name}
                        {user.is_admin && (
                          <Badge variant="yellow">
                            <Shield className="h-3 w-3 mr-1" />
                            Админ
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription>@{user.username}</CardDescription>
                    </div>
                  </div>
                  <TooltipProvider>
                    <div className="flex gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditDialog(user)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Редактировать пользователя</p>
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openRolesDialog(user)}
                          >
                            <Shield className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Настроить роли</p>
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedUserId(user.id);
                              setPasswordDialogOpen(true);
                            }}
                          >
                            <Key className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Сменить пароль</p>
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(user.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Удалить пользователя</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </TooltipProvider>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {/* Roles Dialog */}
      <Dialog open={rolesDialogOpen} onOpenChange={setRolesDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Назначение ролей</DialogTitle>
            <DialogDescription>Выберите роли для пользователя</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {roles.map((role) => (
              <div key={role.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                <Checkbox
                  id={`role-${role.id}`}
                  checked={selectedRoles.includes(role.id)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedRoles([...selectedRoles, role.id]);
                    } else {
                      setSelectedRoles(selectedRoles.filter(id => id !== role.id));
                    }
                  }}
                />
                <div className="flex-1">
                  <Label htmlFor={`role-${role.id}`} className="cursor-pointer font-medium">
                    {role.name}
                  </Label>
                  {role.description && (
                    <p className="text-sm text-gray-500 mt-1">{role.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSaveRoles} className="flex-1" variant="yellow">
              Сохранить
            </Button>
            <Button variant="outline" onClick={() => setRolesDialogOpen(false)} className="flex-1">
              Отмена
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Password Reset Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Сброс пароля</DialogTitle>
            <DialogDescription>Введите новый пароль для пользователя</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="new_password">Новый пароль</Label>
              <Input
                id="new_password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Введите новый пароль"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleResetPassword} className="flex-1" variant="yellow">
                Изменить пароль
              </Button>
              <Button variant="outline" onClick={() => {
                setPasswordDialogOpen(false);
                setNewPassword('');
              }} className="flex-1">
                Отмена
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
