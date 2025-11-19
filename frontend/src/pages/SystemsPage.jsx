import { useState, useEffect } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { HardDrive, Plus, Edit, Trash2 } from "lucide-react";
import { api } from '../config/api';


const SystemsPage = () => {
  const [systems, setSystems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSystem, setEditingSystem] = useState(null);
  const [formData, setFormData] = useState({
    category_id: "",
    name: "",
    description: "",
    os_type: "linux"
  });

  useEffect(() => {
    fetchCategories();
    fetchSystems();
  }, []);

  useEffect(() => {
    fetchSystems();
  }, [selectedCategoryFilter]);

  const fetchCategories = async () => {
    try {
      const response = await api.get(`/api/categories`);
      setCategories(response.data);
    } catch (error) {
      toast.error("Ошибка загрузки категорий");
    }
  };

  const fetchSystems = async () => {
    try {
      const url = selectedCategoryFilter && selectedCategoryFilter !== "all"
        ? `/api/systems?category_id=${selectedCategoryFilter}`
        : `/api/systems`;
      const response = await api.get(url);
      setSystems(response.data);
    } catch (error) {
      toast.error("Ошибка загрузки систем");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.category_id) {
      toast.error("Выберите категорию");
      return;
    }
    
    try {
      if (editingSystem) {
        await api.put(`/api/systems/${editingSystem.id}`, formData);
        toast.success("Система обновлена");
      } else {
        await api.post(`/api/categories/${formData.category_id}/systems`, formData);
        toast.success("Система создана");
      }
      setIsDialogOpen(false);
      resetForm();
      fetchSystems();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Ошибка сохранения системы");
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Удалить систему? Это удалит все связанные скрипты.")) {
      try {
        await api.delete(`/api/systems/${id}`);
        toast.success("Система удалена");
        fetchSystems();
      } catch (error) {
        toast.error(error.response?.data?.detail || "Ошибка удаления системы");
      }
    }
  };

  const resetForm = () => {
    setFormData({
      category_id: "",
      name: "",
      description: "",
      os_type: "linux"
    });
    setEditingSystem(null);
  };

  const openEditDialog = (system) => {
    setEditingSystem(system);
    setFormData({
      category_id: system.category_id,
      name: system.name,
      description: system.description || "",
      os_type: system.os_type
    });
    setIsDialogOpen(true);
  };

  const getCategoryName = (categoryId) => {
    const category = categories.find(c => c.id === categoryId);
    return category ? `${category.icon} ${category.name}` : categoryId;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button data-testid="add-system-btn">
              <Plus className="mr-2 h-4 w-4" /> Добавить систему
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingSystem ? "Редактировать систему" : "Новая система"}</DialogTitle>
              <DialogDescription>
                Добавьте конкретную систему или программу
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Категория</Label>
                <Select 
                  value={formData.category_id} 
                  onValueChange={(value) => setFormData({...formData, category_id: value})}
                  required
                >
                  <SelectTrigger data-testid="system-category-select">
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
                <Label>Название системы</Label>
                <Input
                  data-testid="system-name-input"
                  placeholder="Astra Linux 1.6, PostgreSQL 14..."
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>

              <div>
                <Label>Тип ОС</Label>
                <Select 
                  value={formData.os_type} 
                  onValueChange={(value) => setFormData({...formData, os_type: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="linux">Linux</SelectItem>
                    <SelectItem value="windows">Windows</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Описание</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Версия, особенности..."
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Отмена
                </Button>
                <Button type="submit" data-testid="save-system-btn">
                  {editingSystem ? "Обновить" : "Создать"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-4">
        <Label>Фильтр по категории</Label>
        <Select 
          value={selectedCategoryFilter} 
          onValueChange={setSelectedCategoryFilter}
        >
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Все категории" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все категории</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.icon} {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {systems.length === 0 ? (
          <div className="col-span-full text-center py-16">
            <HardDrive className="h-16 w-16 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 text-lg mb-2">Нет систем</p>
            <p className="text-slate-400 text-sm">Создайте первую систему для проверок</p>
          </div>
        ) : (
          systems.map((system) => (
            <Card key={system.id} data-testid={`system-card-${system.id}`}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="text-sm text-slate-500 mb-1">
                      {getCategoryName(system.category_id)}
                    </div>
                    <CardTitle className="flex items-center gap-2">
                      <HardDrive className="h-5 w-5" />
                      {system.name}
                    </CardTitle>
                    {system.description && (
                      <CardDescription>{system.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(system)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(system.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Badge variant="outline">
                  {system.os_type === "linux" ? "Linux" : "Windows"}
                </Badge>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default SystemsPage;
