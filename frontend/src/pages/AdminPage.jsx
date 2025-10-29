import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CategoriesPage from "@/pages/CategoriesPage";
import SystemsPage from "@/pages/SystemsPage";

const AdminPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Панель администратора</h1>
        <p className="text-slate-500 mt-1">Управление категориями и системами</p>
      </div>

      <Tabs defaultValue="categories" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="categories" data-testid="admin-tab-categories">
            📁 Категории
          </TabsTrigger>
          <TabsTrigger value="systems" data-testid="admin-tab-systems">
            💿 Системы
          </TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="mt-6">
          <CategoriesPage />
        </TabsContent>

        <TabsContent value="systems" className="mt-6">
          <SystemsPage />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPage;
