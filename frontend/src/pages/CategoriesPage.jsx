import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Folder, Plus, Edit, Trash2, Smile } from "lucide-react";
import { api } from '../config/api';
import { useDialog } from "@/hooks/useDialog";
import { ConfirmationDialog } from "@/components/ui/ConfirmationDialog";

const CategoriesPage = () => {
  const { dialogState, setDialogState, showConfirm } = useDialog();
  const [categories, setCategories] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    icon: "📁",
    description: ""
  });
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await api.get(`/api/categories`);
      setCategories(response.data);
    } catch (error) {
      toast.error("Ошибка загрузки категорий");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingCategory) {
        await api.put(`/api/categories/${editingCategory.id}`, formData);
        toast.success("Категория обновлена");
      } else {
        await api.post(`/api/categories`, formData);
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
    const confirmed = await showConfirm(
      "Удаление категории",
      "Удалить категорию? Это удалит все связанные системы.",
      {
        variant: "destructive",
        confirmText: "Удалить",
        cancelText: "Отмена"
      }
    );

    if (!confirmed) return;

    try {
      await api.delete(`/api/categories/${id}`);
      toast.success("Категория удалена");
      fetchCategories();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Ошибка удаления категории");
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
                <div className="flex gap-2">
                  <Input
                    value={formData.icon}
                    onChange={(e) => setFormData({...formData, icon: e.target.value})}
                    placeholder=""
                    maxLength={2}
                    className="flex-1"
                  />
                  <div className="relative">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsIconPickerOpen(!isIconPickerOpen)}
                    >
                      <Smile className="h-4 w-4 mr-2" />
                      Выбрать
                    </Button>
                    
                  {isIconPickerOpen && (
                    <div className="absolute top-full right-0 mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-10 p-3">
                      <div className="grid grid-cols-8 gap-1 mb-2">
                        {[
                          // Emoji иконки
                          { type: 'emoji', value: '🐧', name: 'Linux' },
                          { type: 'emoji', value: '🟦', name: 'Windows' },
                          { type: 'emoji', value: '☸️', name: 'Kubernetes' },
                          { type: 'emoji', value: '🐳', name: 'Docker' },
                          { type: 'emoji', value: '🗄️', name: 'Сервер' },
                          { type: 'emoji', value: '💻', name: 'Ноутбук' },
                          { type: 'emoji', value: '🖥️', name: 'Компьютер' },
                          { type: 'emoji', value: '🔒', name: 'Безопасность' },
                          { type: 'emoji', value: '🌐', name: 'Сеть' },
                          { type: 'emoji', value: '📊', name: 'Мониторинг' },
                          { type: 'emoji', value: '☁️', name: 'Облако' },
                          { type: 'emoji', value: '🚀', name: 'Запуск' },
                          { type: 'emoji', value: '🔧', name: 'Настройка' },
                        ].map((icon) => (
                          <button
                            key={icon.type === 'emoji' ? icon.value : icon.value}
                            type="button"
                            className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 text-lg"
                            onClick={() => {
                              // Сохраняем тип и значение иконки
                              setFormData({
                                ...formData, 
                                icon: icon.type === 'emoji' ? icon.value : icon.value,
                                iconType: icon.type
                              });
                              setIsIconPickerOpen(false);
                            }}
                            title={icon.name}
                          >
                            {icon.type === 'emoji' ? (
                              <span className="text-lg">{icon.value}</span>
                            ) : (
                              <img 
                                src={icon.value} 
                                alt={icon.name}
                                className="w-5 h-5 object-contain"
                                onError={(e) => {
                                  // Fallback если изображение не загрузилось
                                  e.target.style.display = 'none';
                                  e.target.nextSibling.style.display = 'block';
                                }}
                              />
                            )}
                          </button>
                        ))}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setFormData({...formData, icon: '', iconType: ''});
                          setIsIconPickerOpen(false);
                        }}
                        className="w-full text-xs"
                      >
                        Очистить
                      </Button>
                    </div>
                  )}
                  </div>
                </div>
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
};

export default CategoriesPage;
