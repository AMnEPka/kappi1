import { useState, useEffect } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Folder, Plus, Edit, Trash2 } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CategoriesPage = () => {
  const [categories, setCategories] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    icon: "📁",
    description: ""
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await axios.get(`${API}/categories`);
      setCategories(response.data);
    } catch (error) {
      toast.error("Ошибка загрузки категорий");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingCategory) {
        await axios.put(`${API}/categories/${editingCategory.id}`, formData);
        toast.success("Категория обновлена");
      } else {
        await axios.post(`${API}/categories`, formData);
        toast.success("Категория создана");
      }
      setIsDialogOpen(false);
      resetForm();
      fetchCategories();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Ошибка сохранения категории");
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Удалить категорию? Это удалит все связанные системы.")) {
      try {
        await axios.delete(`${API}/categories/${id}`);
        toast.success("Категория удалена");
        fetchCategories();
      } catch (error) {
        toast.error(error.response?.data?.detail || "Ошибка удаления категории");
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      icon: "📁",
      description: ""
    });
    setEditingCategory(null);
  };

  const openEditDialog = (category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      icon: category.icon || "📁",
      description: category.description || ""
    });
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button data-testid="add-category-btn">
              <Plus className="mr-2 h-4 w-4" /> Добавить категорию
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCategory ? "Редактировать категорию" : "Новая категория"}</DialogTitle>
              <DialogDescription>
                Создайте категорию для группировки систем
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Название</Label>
                <Input
                  data-testid="category-name-input"
                  placeholder="Linux, Windows, Databases..."
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>
              
              <div>
                <Label>Иконка (emoji)</Label>
                <Input
                  value={formData.icon}
                  onChange={(e) => setFormData({...formData, icon: e.target.value})}
                  placeholder="🐧 🪟 🗄️"
                  maxLength={2}
                />
              </div>

              <div>
                <Label>Описание</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Операционные системы Linux"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Отмена
                </Button>
                <Button type="submit" data-testid="save-category-btn">
                  {editingCategory ? "Обновить" : "Создать"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.length === 0 ? (
          <div className="col-span-full text-center py-16">
            <Folder className="h-16 w-16 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 text-lg mb-2">Нет категорий</p>
            <p className="text-slate-400 text-sm">Создайте первую категорию систем</p>
          </div>
        ) : (
          categories.map((category) => (
            <Card key={category.id} data-testid={`category-card-${category.id}`}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <span className="text-2xl">{category.icon}</span>
                      {category.name}
                    </CardTitle>
                    {category.description && (
                      <CardDescription>{category.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(category)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(category.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default CategoriesPage;
