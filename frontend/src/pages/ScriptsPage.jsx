import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SelectNative } from "@/components/ui/select-native";
//import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { FileCode, Plus, Edit, Trash2, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { api } from '../config/api';
import { usePermissions } from '@/hooks/usePermissions';

export default function ScriptsPage() {
  const { canEditScript, canDeleteScript, canCreateScript } = usePermissions();
  const [scripts, setScripts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [systems, setSystems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedSystem, setSelectedSystem] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingScript, setEditingScript] = useState(null);
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formSystems, setFormSystems] = useState([]);
  const [formData, setFormData] = useState({
    system_id: "",
    name: "",
    description: "",
    content: "",
    processor_script: "",
    has_reference_files: false,
    test_methodology: "",
    success_criteria: "",
    order: 0
  });

  useEffect(() => {
    fetchCategories();
    fetchScripts();
  }, []);

  useEffect(() => {
    if (selectedCategory && selectedCategory !== "all") {
      fetchSystemsByCategory(selectedCategory);
    } else {
      setSystems([]);
      setSelectedSystem("all");
    }
  }, [selectedCategory]);

  useEffect(() => {
    fetchScripts();
  }, [selectedSystem]);

  const fetchCategories = async () => {
    try {
      const response = await api.get(`/api/categories`);
      setCategories(response.data);
    } catch (error) {
      toast.error("Ошибка загрузки категорий");
    }
  };

  const fetchSystemsByCategory = async (categoryId) => {
    try {
      const response = await api.get(`/api/systems?category_id=${categoryId}`);
      setSystems(response.data);
    } catch (error) {
      toast.error("Ошибка загрузки систем");
    }
  };

  const fetchScripts = async () => {
    try {
      let url = `/api/scripts`;
      if (selectedSystem && selectedSystem !== "all") {
        url += `?system_id=${selectedSystem}`;
      } else if (selectedCategory && selectedCategory !== "all") {
        url += `?category_id=${selectedCategory}`;
      }
      const response = await api.get(url);
      setScripts(response.data);
    } catch (error) {
      toast.error("Ошибка загрузки проверок");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingScript) {
        await api.put(`/api/scripts/${editingScript.id}`, formData);
        toast.success("Проверка обновлена");
      } else {
        await api.post(`/api/scripts`, formData);
        toast.success("Проверка создана");
      }
      setIsDialogOpen(false);
      resetForm();
      fetchScripts();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Ошибка сохранения проверки");
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Удалить проверку?")) {
      try {
        await api.delete(`/api/scripts/${id}`);
        toast.success("Проверка удалена");
        fetchScripts();
      } catch (error) {
        toast.error("Ошибка удаления проверки");
      }
    }
  };

  const resetForm = () => {
    setFormData({
      system_id: "",
      name: "",
      description: "",
      content: "",
      processor_script: "",
      has_reference_files: false,
      test_methodology: "",
      success_criteria: "",
      order: 0
    });
    setFormCategoryId("");
    setFormSystems([]);
    setEditingScript(null);
  };

  const openEditDialog = async (script) => {
    setEditingScript(script);
    setFormData({
      system_id: script.system_id,
      name: script.name,
      description: script.description || "",
      content: script.content,
      processor_script: script.processor_script || "",
      has_reference_files: script.has_reference_files || false,
      test_methodology: script.test_methodology || "",
      success_criteria: script.success_criteria || "",
      order: script.order || 0
    });
    
    // Load category and systems for editing
    try {
      const systemRes = await api.get(`/api/systems/${script.system_id}`);
      const system = systemRes.data;
      setFormCategoryId(system.category_id);
      
      const systemsRes = await api.get(`/api/systems?category_id=${system.category_id}`);
      setFormSystems(systemsRes.data);
    } catch (error) {
      console.error("Error loading system info:", error);
    }
    
    setIsDialogOpen(true);
  };

  const handleCategoryChangeInForm = async (categoryId) => {
    setFormCategoryId(categoryId);
    setFormData({...formData, system_id: ""});
    
    try {
      const response = await api.get(`/api/systems?category_id=${categoryId}`);
      setFormSystems(response.data);
    } catch (error) {
      toast.error("Ошибка загрузки систем");
    }
  };

  // placeholder selection
  const getPlaceholder = () => {
    const category = categories.find(cat => cat.id === formCategoryId);
    
    if (!category) {
      return "Выберите категорию для отображения примера...";
    }

    if (category.name.toLowerCase().includes('linux')) {
      return `#!/bin/bash
  # Результат команды доступен в переменной $CHECK_OUTPUT
  # Эталонные данные доступны в переменной $env:ETALON_INPUT  
  if echo "$CHECK_OUTPUT" | grep -q "нужная строка"; then
    echo "Пройдена"
  else
    echo "Не пройдена"
  fi`;
    }

    if (category.name.toLowerCase().includes('windows')) {
      return `#!/bin/bash
  # Скрипт-обработчик даже для Windows пишем на BASH
  # Результат команды доступен в переменной $CHECK_OUTPUT
  # Эталонные данные доступны в переменной $env:ETALON_INPUT  
  if echo "$CHECK_OUTPUT" | grep -q "нужная строка"; then
    echo "Пройдена"
  else
    echo "Не пройдена"
  fi`;
    }

    // Общий пример для других категорий
    return `#!/bin/bash
  # Результат команды доступен в переменной $CHECK_OUTPUT
  # Эталонные данные доступны в переменной $env:ETALON_INPUT  
  # Пример обработки:
  if [ "$CHECK_OUTPUT" = "ожидаемое значение" ]; then
    echo "Пройдена"
  else
    echo "Не пройдена"
  fi`;
  };
  // Функция для получения тултипа в зависимости от категории
  const getTooltipContent = () => {
    const category = categories.find(cat => cat.id === formCategoryId);
    
    if (!category) {
      return (
        <div>
          <p>Выберите категорию для отображения подсказки</p>
        </div>
      );
    }

    if (category.name.toLowerCase().includes('linux')) {
      return (
        <div>
          <p className="font-semibold">Скрипт-обработчик для Linux-систем</p>
          <p>Используйте bash</p>
          <p><strong>Доступные переменные:</strong></p>
          <ul className="list-disc list-inside text-xs mt-1">
            <li><code>$CHECK_OUTPUT</code> - вывод команды</li>
            <li><code>$ETALON_INPUT</code> - эталонные данные</li>
          </ul>
          <p className="text-xs mt-2">Примеры: grep, awk, sed, if-else</p>
          <p className="text-xs mt-2">Для корректной обработки результатов, скрипт должен вернуть одно из следующих значений:</p>
          <p className="text-xs mt-2"><strong>'Пройдена', 'Не пройдена', 'Ошибка', 'Оператор'</strong></p>
        </div>
      );
    }

    if (category.name.toLowerCase().includes('windows')) {
      return (
        <div>
          <p className="font-semibold">Скрипт-обработчик для Windows-систем</p>
          <p>Используйте bash</p>
          <p><strong>Доступные переменные:</strong></p>
          <ul className="list-disc list-inside text-xs mt-1">
            <li><code>$CHECK_OUTPUT</code> - вывод команды</li>
            <li><code>$ETALON_INPUT</code> - эталонные данные</li>
          </ul>
          <p className="text-xs mt-2">Примеры: grep, awk, sed, if-else</p>
          <p className="text-xs mt-2">Для корректной обработки результатов, скрипт должен вернуть одно из следующих значений:</p>
          <p className="text-xs mt-2"><strong>'Пройдена', 'Не пройдена', 'Ошибка', 'Оператор'</strong></p>
        </div>
      );
    }

    // Для остальных категорий
    return (
      <div>
        <p className="font-semibold">Скрипт-обработчик</p>
        <p>Настройте обработку результатов для выбранной системы</p>
        <p><strong>Доступные переменные:</strong></p>
        <ul className="list-disc list-inside text-xs mt-1">
          <li><code>$CHECK_OUTPUT</code> - вывод команды</li>
          <li><code>$ETALON_INPUT</code> - эталонные данные</li>
          <p className="text-xs mt-2">Для корректной обработки данных, скрипт должен вернуть одно из следюущих значений:</p>
          <p className="text-xs mt-2"><strong>'Пройдена', 'Не пройдена', 'Ошибка', 'Оператор'</strong></p>
        </ul>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Проверки</h1>
          <p className="text-slate-600 mt-1">Управление проверками для систем</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            {canCreateScript() && (
              <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} data-testid="add-script-btn">
                <Plus className="mr-2 h-4 w-4" /> Добавить проверку
              </Button>
            )}            
          </DialogTrigger>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto" modal={false}>
            <DialogHeader>
              <DialogTitle>{editingScript ? "Редактировать проверку" : "Новая проверка"}</DialogTitle>
              <DialogDescription>Создайте проверку для конкретной системы</DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Левый столбец */}
                <div className="space-y-4">
                
                  <div>
                    <Label>Категория</Label>
                    <SelectNative
                      value={formCategoryId} // ← ИСПРАВЛЕНО
                      onChange={(e) => handleCategoryChangeInForm(e.target.value)}
                      required
                    >
                      <option value="">Выберите категорию...</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.icon} {cat.name}
                        </option>
                      ))}
                    </SelectNative>
                  </div>

                  <div>
                    <Label>Система</Label>
                    <SelectNative
                      value={formData.system_id} // ← ИСПРАВЛЕНО
                      onChange={(e) => setFormData({...formData, system_id: e.target.value})}
                      required
                      disabled={!formCategoryId}
                    >
                      <option value="">
                        {formCategoryId ? "Выберите систему..." : "Сначала выберите категорию"}
                      </option>
                      {formSystems.map((sys) => (
                        <option key={sys.id} value={sys.id}>
                          {sys.name}
                        </option>
                      ))}
                    </SelectNative>
                  </div>
                  
                  <div>
                    <Label>Название проверки</Label>
                    <Input
                      data-testid="script-name-input"
                      placeholder="Проверка версии ядра"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div>
                    <Label>Описание</Label>
                    <Input
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      placeholder="Опционально"
                    />
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Label>Команда</Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="h-4 w-4 text-gray-500 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <div className="text-xs text-gray-500 mt-1 space-y-1">
                              <p className="font-semibold">Для Windows команда пишется на PowerShell Scripting Language</p>
                              <p className="font-semibold">Для Linux команда пишется на Bash</p>
                              <p className="font-semibold">Команда должна получать вывод в терминал - файл ('cat /etc/passwd') или другой результат ('dir c:\windows')</p>
                              <p className="font-semibold">Доступ к результату команды из скрипта-обработчика: <code className="bg-gray-100 px-1 rounded">$CHECK_OUTPUT</code></p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Textarea
                      data-testid="script-content-input"
                      value={formData.content}
                      onChange={(e) => setFormData({...formData, content: e.target.value})}
                      placeholder="cat /etc/hostname"
                      rows={2}
                      className="font-mono text-sm"
                      required
                    />                    
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="has_reference_files"
                      checked={formData.has_reference_files}
                      onCheckedChange={(checked) => setFormData({...formData, has_reference_files: checked})}
                    />
                    <div className="flex items-center gap-1">
                      <Label htmlFor="has_reference_files" className="cursor-pointer">
                        Предусмотрены эталонные файлы
                      </Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="h-3 w-3 text-gray-500 cursor-help ml-1" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <div className="text-xs text-gray-500 space-y-2">
                              <p className="font-semibold">Включите, если для этой проверки нужны эталонные файлы</p>
                              <p>Например: список доменных УЗ на хосте, список разрешенных групп</p>
                              <p className="font-semibold">Эталонные файлы будут доступны в переменной: <code className="bg-gray-100 px-1 rounded">$ETALON_INPUT</code></p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                </div>

                {/* Правый столбец */}
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Label>Скрипт-обработчик</Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="icon" 
                              className="h-4 w-4 rounded-full"
                            >
                              <HelpCircle className="h-3 w-3 text-gray-500" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            {getTooltipContent()}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Textarea
                      value={formData.processor_script}
                      onChange={(e) => setFormData({...formData, processor_script: e.target.value})}
                      placeholder={getPlaceholder()}
                      rows={10}
                      className="font-mono text-sm"
                    />
                  </div>

                  <div>
                    <Label>Описание методики испытания (опционально)</Label>
                    <Textarea
                      value={formData.test_methodology}
                      onChange={(e) => setFormData({...formData, test_methodology: e.target.value})}
                      placeholder="Данные из ПМИ (для формирования отчета)"
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label>Критерий успешного прохождения испытания (опционально)</Label>
                    <Textarea
                      value={formData.success_criteria}
                      onChange={(e) => setFormData({...formData, success_criteria: e.target.value})}
                      placeholder="Данные из ПМИ (для формирования отчета)"
                      rows={3}
                    />
                  </div>
                </div>
              </div>

              {/* Кнопки в одну строку */}
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Отмена
                </Button>
                <Button type="submit" data-testid="save-script-btn">
                  {editingScript ? "Обновить" : "Создать"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <Label>Категория</Label>
          <SelectNative
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="all">Все категории</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.icon} {cat.name}
              </option>
            ))}
          </SelectNative>
        </div>

        <div>
          <Label>Система</Label>
          <SelectNative
            value={selectedSystem}
            onChange={(e) => setSelectedSystem(e.target.value)}
            disabled={selectedCategory === "all"}
          >
            <option value="all">
              {selectedCategory !== "all" ? "Все системы категории" : "Сначала выберите категорию"}
            </option>
            {systems.map((sys) => (
              <option key={sys.id} value={sys.id}>
                {sys.name}
              </option>
            ))}
          </SelectNative>
        </div>
      </div>

      <div className="overflow-x-auto">
        {scripts.length === 0 ? (
          <div className="text-center py-16">
            <FileCode className="h-16 w-16 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 text-lg mb-2">Нет проверок</p>
            <p className="text-slate-400 text-sm">Создайте первую проверку этого типа</p>
          </div>
        ) : (
      <div className="overflow-hidden">
        <table className="w-full border-collapse table-fixed">
        <colgroup>
          <col className="w-[25%]"/><col className="w-[20%]"/><col className="w-[40%]"/><col className="w-[15%]"/>
        </colgroup>
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left py-1 px-4 text-slate-600 font-medium">Название</th>
              <th className="text-left py-1 px-4 text-slate-600 font-medium">Категория</th>
              <th className="text-left py-1 px-4 text-slate-600 font-medium">Описание</th>
              <th className="text-left py-1 px-4 text-slate-600 font-medium">Действия</th>
            </tr>
          </thead>
          <tbody>
            {scripts.map((script) => (
              <tr key={script.id} className="border-b border-slate-100 hover:bg-slate-50" data-testid={`script-card-${script.id}`}>
                <td className="py-1 px-4 overflow-hidden">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-medium truncate">
                      <FileCode className="h-4 w-4 text-slate-500 flex-shrink-0" />
                      <span className="truncate">{script.name}</span>
                    </div>
                    {script.has_reference_files && (
                      <div className="text-xs text-slate-400 flex-shrink-0 ml-2" title="Предусмотрены эталонные файлы">
                        📝
                      </div>
                    )}
                  </div>
                </td>
                <td className="py-1 px-4 text-sm text-slate-600 overflow-hidden">
                  {script.category_name && (
                    <div className="truncate">
                      {script.category_icon} {script.category_name} → {script.system_name}
                    </div>
                  )}
                </td>
                <td className="py-1 px-4 text-sm text-slate-500">
                  {script.description ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="truncate cursor-help text-left">
                            {script.description}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <div className="text-sm">
                            {script.description}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="py-1 px-4">
                  <div className="flex gap-1">
                    {canEditScript(script) && (
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditDialog(script)}>
                        <Edit className="h-3 w-3" />
                      </Button>
                    )}
                    {canDeleteScript(script) && (
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDelete(script.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
        )}
      </div>
    </div>
  );
}
