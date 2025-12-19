import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useWizard } from './WizardContext';

export default function Step5AccessManagement() {
  const { users, currentUser, projectData, setProjectData } = useWizard();
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

  const handleUserToggle = (userId, checked) => {
    if (checked) {
      setProjectData(prev => ({
        ...prev,
        accessUserIds: [...prev.accessUserIds, userId]
      }));
    } else {
      setProjectData(prev => ({
        ...prev,
        accessUserIds: prev.accessUserIds.filter(id => id !== userId)
      }));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Шаг 5: Управление доступом</CardTitle>
        <CardDescription>Выберите пользователей, которые смогут выполнять этот проект</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            По умолчанию доступ к проекту есть у вас (создателя) и у администраторов. 
            Вы можете предоставить доступ другим пользователям.
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
                })}
              </div>
            </div>
          )}
          
          <div className="space-y-2">
            {/* Current user (non-removable) */}
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

            {/* Other users */}
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
                    onCheckedChange={(checked) => handleUserToggle(user.id, checked)}
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
              <strong>Администраторы</strong> имеют доступ ко всем проектам по умолчанию 
              и не отображаются в этом списке.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

