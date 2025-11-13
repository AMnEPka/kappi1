import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CategoriesPage from "@/pages/CategoriesPage";
import SystemsPage from "@/pages/SystemsPage";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Lock } from 'lucide-react';

const AdminPage = () => {
  const { hasPermission, hasAnyPermission } = useAuth();
  
  const canManageCategories = hasPermission('categories_manage');
  const canManageUsers = hasPermission('users_manage');
  const canManageRoles = hasPermission('roles_manage');

  if (!hasAnyPermission(['categories_manage', 'users_manage', 'roles_manage'])) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64">
            <Lock className="h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-400 text-sm">У вас нет прав для доступа к панели администратора</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Панель администратора</h1>
        <p className="text-slate-500 mt-1">Управление системой</p>
      </div>

      <Tabs defaultValue="categories" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          {canManageCategories && (
            <TabsTrigger value="categories" data-testid="admin-tab-categories">
              📁 Категории
            </TabsTrigger>
          )}
          {canManageCategories && (
            <TabsTrigger value="systems" data-testid="admin-tab-systems">
              💿 Системы
            </TabsTrigger>
          )}
        </TabsList>

        {canManageCategories && (
          <TabsContent value="categories" className="mt-6">
            <CategoriesPage />
          </TabsContent>
        )}

        {canManageCategories && (
          <TabsContent value="systems" className="mt-6">
            <SystemsPage />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default AdminPage;
