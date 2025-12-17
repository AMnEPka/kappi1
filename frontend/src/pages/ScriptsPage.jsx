import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SelectNative } from "@/components/ui/select-native";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { FileCode, Plus, Edit, Trash2, HelpCircle, CheckCircle2, XCircle, Loader2, X, MessageSquare, FileText, History, RotateCcw, Calendar, User, Download, Hash  } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { api } from '../config/api';
import { usePermissions } from '@/hooks/usePermissions';
import { useDialog } from "@/hooks/useDialog";
import { ConfirmationDialog } from "@/components/ui/ConfirmationDialog";
import { useAuth } from '@/contexts/AuthContext';
import { ScrollArea } from "@/components/ui/scroll-area"
import { CodeEditor } from "@/components/ui/code-editor"
import { AdvancedCodeEditor } from "@/components/ui/advanced-code-editor"

export default function ScriptsPage() {
  const { canEditScript, canDeleteScript, canCreateScript } = usePermissions();
  const { dialogState, setDialogState, showConfirm } = useDialog();
  const { isAdmin } = useAuth();
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
    processor_script_comment: "",
    create_new_version: false,
    has_reference_files: false,
    test_methodology: "",
    success_criteria: "",
    order: 0,
    group_ids: []
  });
  const [checkGroups, setCheckGroups] = useState([]);
  const [isGroupsDialogOpen, setIsGroupsDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [groupFormData, setGroupFormData] = useState({ name: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processorVersions, setProcessorVersions] = useState([]);
  const [isVersionsDialogOpen, setIsVersionsDialogOpen] = useState(false);
  const [currentScriptId, setCurrentScriptId] = useState(null);
  const [isSyntaxCheckDialogOpen, setIsSyntaxCheckDialogOpen] = useState(false);
  const [syntaxCheckResult, setSyntaxCheckResult] = useState(null);
  const [isCheckingSyntax, setIsCheckingSyntax] = useState(false);

  useEffect(() => {
    fetchCategories();
    fetchScripts();
    fetchCheckGroups();
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

  const fetchCheckGroups = async () => {
    try {
      const response = await api.get(`/api/check-groups`);
      setCheckGroups(response.data);
    } catch (error) {
      toast.error("Ошибка загрузки групп проверок");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const submitData = { ...formData };
      
      // При создании новой проверки не отправляем поля версий
      if (!editingScript) {
        delete submitData.processor_script_comment;
        delete submitData.create_new_version;
      } else {
        // При обновлении: если пользователь не админ и processor_script изменился, создаем новую версию
        if (!isAdmin) {
          const originalProcessorScript = editingScript.processor_script || "";
          const currentProcessorScript = submitData.processor_script || "";
          // Создаем новую версию только если содержимое действительно изменилось
          if (originalProcessorScript !== currentProcessorScript) {
            submitData.create_new_version = true;
          } else {
            // Если не изменилось, не отправляем processor_script и связанные поля
            delete submitData.processor_script;
            delete submitData.processor_script_comment;
            delete submitData.create_new_version;
          }
        }
      }
      
      if (editingScript) {
        await api.put(`/api/scripts/${editingScript.id}`, submitData);
        toast.success("Проверка обновлена");
      } else {
        await api.post(`/api/scripts`, submitData);
        toast.success("Проверка создана");
      }
      setIsDialogOpen(false);
      resetForm();
      fetchScripts();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Ошибка сохранения проверки");
    }
  };

  const fetchProcessorVersions = async (scriptId, keepDialogOpen = false) => {
    try {
      const response = await api.get(`/api/scripts/${scriptId}/processor-versions`);
      setProcessorVersions(response.data.versions || []);
      setCurrentScriptId(scriptId);
      if (!keepDialogOpen) {
        setIsVersionsDialogOpen(true);
      }
    } catch (error) {
      toast.error("Ошибка загрузки версий");
    }
  };

  const handleRollback = async (scriptId, versionNumber) => {
    const confirmed = await showConfirm(
      "Откат версии",
      `Вы уверены, что хотите откатить скрипт-обработчик к версии ${versionNumber}?`,
      {
        variant: "default",
        confirmText: "Откатить",
        cancelText: "Отмена"
      }
    );

    if (!confirmed) return;

    try {
      await api.post(`/api/scripts/${scriptId}/processor-versions/rollback?version_number=${versionNumber}`);
      toast.success(`Откат к версии ${versionNumber} выполнен`);
      
      // Обновляем список версий (диалог остается открытым)
      await fetchProcessorVersions(scriptId, true);
      
      fetchScripts();
      // Обновляем форму, если редактируем этот скрипт
      if (editingScript && editingScript.id === scriptId) {
        const script = await api.get(`/api/scripts/${scriptId}`);
        const scriptData = script.data;
        const currentVersionComment = scriptData.processor_script_version?.comment || "";
        setFormData(prev => ({
          ...prev,
          processor_script: scriptData.processor_script || "",
          processor_script_comment: currentVersionComment
        }));
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Ошибка отката версии");
    }
  };

  const handleSyntaxCheck = async () => {
    const scriptContent = formData.processor_script;
    
    if (!scriptContent || !scriptContent.trim()) {
      toast.warning("Скрипт-обработчик пуст. Нечего проверять.");
      return;
    }

    setIsCheckingSyntax(true);
    try {
      const response = await api.post('/api/scripts/validate-syntax', scriptContent, {
        headers: {
          'Content-Type': 'text/plain'
        }
      });
      
      setSyntaxCheckResult(response.data);
      setIsSyntaxCheckDialogOpen(true);
    } catch (error) {
      setSyntaxCheckResult({
        valid: false,
        error: error.response?.data?.detail || error.response?.data?.error || "Ошибка при проверке синтаксиса"
      });
      setIsSyntaxCheckDialogOpen(true);
    } finally {
      setIsCheckingSyntax(false);
    }
  };

  const handleDelete = async (id) => {
    const confirmed = await showConfirm(
      "Удаление проверки",
      "Вы уверены, что хотите удалить эту проверку?",
      {
        variant: "destructive",
        confirmText: "Удалить",
        cancelText: "Отмена"
      }
    );

    if (!confirmed) return;

    try {
      await api.delete(`/api/scripts/${id}`);
      toast.success("Проверка удалена");
      fetchScripts();
    } catch (error) {
      toast.error("Ошибка удаления проверки");
    }
  };

  const resetForm = () => {
    setFormData({
      system_id: "",
      name: "",
      description: "",
      content: "",
      processor_script: "",
      processor_script_comment: "",
      create_new_version: false,
      has_reference_files: false,
      test_methodology: "",
      success_criteria: "",
      order: 0,
      group_ids: []
    });
    setFormCategoryId("");
    setFormSystems([]);
    setEditingScript(null);
  };

  const resetGroupForm = () => {
    setGroupFormData({ name: "" });
    setEditingGroup(null);
  };

  const handleGroupSubmit = async (e) => {
    e.preventDefault();
    
    if (!groupFormData.name.trim() || isSubmitting) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      if (editingGroup) {
        // Обновление существующей группы
        const response = await api.put(`/api/check-groups/${editingGroup.id}`, {
          name: groupFormData.name
        });
        
        const updatedGroup = response.data;
        
        // Обновляем локальное состояние
        setCheckGroups(prev => prev.map(g => 
          g.id === editingGroup.id ? updatedGroup : g
        ));
        
        resetGroupForm();
        setIsGroupsDialogOpen(false);
        toast.success("Группа обновлена");
      } else {
        // Создание новой группы
        const response = await api.post(`/api/check-groups`, {
          name: groupFormData.name
        });
        
        const newGroup = response.data;
        
        // Добавляем новую группу в список
        setCheckGroups(prev => [...prev, newGroup]);
        
        // Сбрасываем только поле ввода, диалог остается открытым
        setGroupFormData({ name: "" });
        toast.success("Группа создана");
      }
    } catch (error) {
      console.error("Ошибка при сохранении группы:", error);
      toast.error(error.response?.data?.detail || "Ошибка сохранения группы");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleGroupDelete = async (groupId) => {
    const confirmed = await showConfirm(
      "Удаление группы",
      "Вы уверены, что хотите удалить эту группу?",
      {
        variant: "destructive",
        confirmText: "Удалить",
        cancelText: "Отмена"
      }
    );
  
    if (!confirmed) return;
    
    try {
      await api.delete(`/api/check-groups/${groupId}`);
      
      // Обновляем локальное состояние
      setCheckGroups(prev => prev.filter(g => g.id !== groupId));
      toast.success("Группа удалена");
    } catch (error) {
      console.error("Ошибка при удалении группы:", error);
      toast.error(error.response?.data?.detail || "Ошибка удаления группы");
    }
  };

  const openGroupEditDialog = (group) => {
    setEditingGroup(group);
    setGroupFormData({ name: group.name });
    setIsGroupsDialogOpen(true);
  };

  const openEditDialog = async (script) => {
    // Загружаем полные данные скрипта для получения актуальной версии processor_script
    try {
      const fullScript = await api.get(`/api/scripts/${script.id}`);
      const scriptData = fullScript.data;
      
      setEditingScript(scriptData);
      // Получаем комментарий текущей версии, если есть
      const currentVersionComment = scriptData.processor_script_version?.comment || "";
      // Для не-админов по умолчанию создаем новую версию
      const defaultCreateNewVersion = !isAdmin;
      setFormData({
        system_id: scriptData.system_id,
        name: scriptData.name,
        description: scriptData.description || "",
        content: scriptData.content,
        processor_script: scriptData.processor_script || "",
        processor_script_comment: currentVersionComment,
        create_new_version: defaultCreateNewVersion,
        has_reference_files: scriptData.has_reference_files || false,
        test_methodology: scriptData.test_methodology || "",
        success_criteria: scriptData.success_criteria || "",
        order: scriptData.order || 0,
        group_ids: scriptData.group_ids || []
      });
      
      // Load category and systems for editing
      try {
        const systemRes = await api.get(`/api/systems/${scriptData.system_id}`);
        const system = systemRes.data;
        setFormCategoryId(system.category_id);
        
        const systemsRes = await api.get(`/api/systems?category_id=${system.category_id}`);
        setFormSystems(systemsRes.data);
      } catch (error) {
        console.error("Error loading system info:", error);
      }
      
      setIsDialogOpen(true);
    } catch (error) {
      console.error("Error loading script:", error);
      toast.error("Ошибка загрузки проверки");
    }
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
          <p className="text-slate-600 mt-1">Создание, редактирование и удаление проверок</p>
        </div>
        <div className="flex gap-2">
          {canCreateScript() && (
            <Button 
              variant="outline" 
              onClick={() => { resetGroupForm(); setIsGroupsDialogOpen(true); }}
            >
              Группы проверок
            </Button>
          )}
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
                    <Label>Добавить проверку в группы</Label>
                    <div className="space-y-2">
                      {checkGroups.length === 0 ? (
                        <p className="text-sm text-slate-400">Нет групп. Создайте группы через кнопку "Группы проверок"</p>
                      ) : (
                        <>
                          <select
                            className="w-full border rounded-md p-2 text-sm"
                            onChange={(e) => {
                              const groupId = e.target.value;
                              if (groupId && !formData.group_ids?.includes(groupId)) {
                                setFormData({
                                  ...formData,
                                  group_ids: [...(formData.group_ids || []), groupId]
                                });
                              }
                              e.target.value = ""; // Сбрасываем выбор
                            }}
                          >
                            <option value="">Выберите группу...</option>
                            {checkGroups
                              .filter(group => !formData.group_ids?.includes(group.id))
                              .map((group) => (
                                <option key={group.id} value={group.id}>
                                  {group.name}
                                </option>
                              ))
                            }
                          </select>
                          
                          {/* Выбранные группы в виде тегов */}
                          <div className="flex flex-wrap gap-2 min-h-[40px] p-2 border rounded-md">
                            {formData.group_ids?.length > 0 ? (
                              formData.group_ids.map(groupId => {
                                const group = checkGroups.find(g => g.id === groupId);
                                return group ? (
                                  <div 
                                    key={group.id} 
                                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                                  >
                                    {group.name}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setFormData({
                                          ...formData,
                                          group_ids: formData.group_ids.filter(id => id !== group.id)
                                        });
                                      }}
                                      className="ml-1 text-blue-600 hover:text-blue-800"
                                    >
                                      ×
                                    </button>
                                  </div>
                                ) : null;
                              })
                            ) : (
                              <span className="text-slate-400 text-sm">Группы не выбраны</span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
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
                    <div className="flex items-center justify-between gap-2 mb-2">
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
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleSyntaxCheck}
                          disabled={isCheckingSyntax || !formData.processor_script?.trim()}
                        >
                          {isCheckingSyntax ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              Проверка...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Проверить синтаксис
                            </>
                          )}
                        </Button>
                        {editingScript && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => fetchProcessorVersions(editingScript.id)}
                          >
                            <History className="h-4 w-4 mr-1" />
                            Версии
                          </Button>
                        )}
                      </div>
                    </div>
                    <AdvancedCodeEditor
                      value={formData.processor_script}
                      onChange={(e) => setFormData({...formData, processor_script: e.target.value})}
                      placeholder={getPlaceholder()}
                      title="Скрипт-обработчик (Bash)"
                      minHeight={300}
                      maxHeight={450}
                      tabSize={2}
                    />
                    <div className="mt-2">
                      <Label className="text-sm">
                        Комментарий к версии (опционально)
                        {editingScript ? " - опишите изменения в этой версии" : " - опишите первую версию скрипта"}
                      </Label>
                      <Textarea
                        value={formData.processor_script_comment}
                        onChange={(e) => setFormData({...formData, processor_script_comment: e.target.value})}
                        placeholder={editingScript ? "Опишите изменения в этой версии" : "Опишите первую версию скрипта"}
                        className="mt-1"
                      />
                    </div>
                    {editingScript && isAdmin && (
                      <div className="flex items-center space-x-2 mt-2">
                        <Checkbox
                          id="create_new_version"
                          checked={formData.create_new_version}
                          onCheckedChange={(checked) => setFormData({...formData, create_new_version: checked})}
                        />
                        <Label htmlFor="create_new_version" className="cursor-pointer text-sm">
                          Создать новую версию (текущая версия будет сохранена в истории)
                        </Label>
                      </div>
                    )}
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
      </div>

      {/* Check Groups Management Dialog */}
      <Dialog open={isGroupsDialogOpen} onOpenChange={(open) => {
        setIsGroupsDialogOpen(open);
        if (!open) resetGroupForm();
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingGroup ? "Редактировать группу" : "Управление группами проверок"}</DialogTitle>
            <DialogDescription>
              {editingGroup ? "Измените название группы" : "Создайте, отредактируйте или удалите группы проверок"}
            </DialogDescription>
          </DialogHeader>

          {editingGroup ? (
              <form onSubmit={handleGroupSubmit} className="space-y-4">
                <div>
                  <Label>Название группы</Label>
                  <Input
                    value={groupFormData.name}
                    onChange={(e) => setGroupFormData({...groupFormData, name: e.target.value})}
                    placeholder="Название группы"
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => { resetGroupForm(); setIsGroupsDialogOpen(false); }}
                    disabled={isSubmitting}
                  >
                    Отмена
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Сохранение..." : "Сохранить"}
                  </Button>
                </div>
              </form>
            ) : (
            <div className="space-y-4">
              <form onSubmit={handleGroupSubmit} className="space-y-4 border-b pb-4">
                <div>
                  <Label>Новая группа</Label>
                  <div className="flex gap-2">
                    <Input
                      value={groupFormData.name}
                      onChange={(e) => setGroupFormData({...groupFormData, name: e.target.value})}
                      placeholder="Название группы"
                      required
                    />
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Создание..." : "Создать"}
                  </Button>
                  </div>
                </div>
              </form>

              <div>
                <Label className="mb-2 block">Существующие группы</Label>
                {checkGroups.length === 0 ? (
                  <p className="text-sm text-slate-400">Нет групп</p>
                ) : (
                  <div className="space-y-2">
                    {checkGroups.map((group) => (
                      <div key={group.id} className="flex items-center justify-between p-2 border rounded-md">
                        <span className="text-sm">{group.name}</span>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => openGroupEditDialog(group)}
                          >
                            <Edit className="text-black-600" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleGroupDelete(group.id)}
                          >
                            <Trash2 className="text-red-600" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
            <col className="w-[20%]"/>
            <col className="w-[20%]"/>
            <col className="w-[25%]"/>
            <col className="w-[20%]"/>
            <col className="w-[15%]"/>
          </colgroup>
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left py-1 px-4 text-slate-600 font-medium">Название</th>
              <th className="text-left py-1 px-4 text-slate-600 font-medium">Категория</th>
              <th className="text-left py-1 px-4 text-slate-600 font-medium">Описание</th>
              <th className="text-left py-1 px-4 text-slate-600 font-medium">Группы</th>
              <th className="text-left py-1 px-4 text-slate-600 font-medium">Действия</th>
            </tr>
          </thead>
          <tbody>
            {scripts.map((script) => {
              // Находим группы для этой проверки
              const scriptGroups = checkGroups.filter(group => 
                script.group_ids?.includes(group.id)
              );
              
              return (
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
                  <td className="py-1 px-4 text-sm text-slate-500">
                    {scriptGroups.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {scriptGroups.map(group => (
                          <span 
                            key={group.id} 
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200"
                            title={group.name}
                          >
                            <span className="truncate max-w-[100px]">{group.name}</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400 text-sm">-</span>
                    )}
                  </td>
                  <td className="py-1 px-4">
                    <div className="flex gap-1">
                      {canEditScript(script) && (
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(script)}>
                          <Edit className="text-black-600" />
                        </Button>
                      )}
                      {canDeleteScript(script) && (
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(script.id)}>
                          <Trash2 className="text-red-600" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
        )}
      </div>

      {/* Syntax Check Result Dialog */}
      <Dialog open={isSyntaxCheckDialogOpen} onOpenChange={setIsSyntaxCheckDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {syntaxCheckResult?.valid ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  Проверка синтаксиса пройдена
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-600" />
                  Обнаружены ошибки синтаксиса
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {syntaxCheckResult?.valid 
                ? "Скрипт-обработчик синтаксически корректен"
                : "В скрипте-обработчике обнаружены синтаксические ошибки"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {syntaxCheckResult?.valid ? (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-800 font-medium">
                  {syntaxCheckResult.message || "Синтаксис скрипта корректен"}
                </p>
                <p className="text-sm text-green-600 mt-2">
                  Обратите внимание, что проверка не гарантирует корректность логики скрипта и не проверяет опечатки в написании команд.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800 font-medium mb-2">Ошибка синтаксиса:</p>
                  <pre className="text-sm text-red-700 font-mono bg-red-100 p-3 rounded overflow-x-auto whitespace-pre-wrap">
                    {syntaxCheckResult?.error || "Неизвестная ошибка"}
                  </pre>
                </div>
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-yellow-800 text-sm">
                    <strong>Внимание:</strong> Скрипт содержит синтаксические ошибки. 
                    Вы можете сохранить его, но при выполнении могут возникнуть проблемы. 
                    Рекомендуется исправить ошибки перед сохранением.
                  </p>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button 
              variant="outline" 
              onClick={() => setIsSyntaxCheckDialogOpen(false)}
            >
              Закрыть
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Processor Versions Dialog */}
      <Dialog open={isVersionsDialogOpen} onOpenChange={setIsVersionsDialogOpen}>
        <DialogContent className="w-[1600px] h-[700px] max-w-[1600px] max-h-[90vh] rounded-lg p-6 overflow-hidden">
          <DialogHeader className="shrink-0 flex flex-row items-center justify-between">
            <div>
              <DialogTitle className="text-2xl">История версий скрипта-обработчика</DialogTitle>
              <DialogDescription>
                Просмотр и управление версиями скрипта-обработчика
            </DialogDescription>
            </div>
          </DialogHeader>
          <ScrollArea className="flex-1 mt-4 pr-2">
          {processorVersions.length === 0 ? 
		  (
            <div className="h-full flex flex-col items-center justify-center text-center py-16">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <FileText className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-700 mb-2">Нет сохраненных версий</h3>
              <p className="text-slate-500 max-w-md">
                Здесь будут отображаться все версии скрипта-обработчика после их сохранения
              </p>
            </div>
          ) : (
            <div className="space-y-5 pr-3">
              {processorVersions.map((version, index) => (
                <div 
                  key={index} 
                  className={`
                    border rounded-xl p-5 transition-all duration-200 
                    hover:shadow-md hover:border-slate-300
                    ${index === 0 
                      ? 'border-green-200 bg-gradient-to-r from-green-50/30 to-white' 
                      : 'border-slate-200 bg-white'
                    }
                  `}
                >
{/* Карточка версии */}
<div key={index} className="border rounded-xl p-5 transition-all duration-200 hover:shadow-md hover:border-slate-300 bg-white">
  
  {/* ВЕРХНИЙ РЯД */}
  <div className="flex items-center justify-between mb-4">
    {/* ЛЕВАЯ ЧАСТЬ: версия + бейдж */}
    <div className="flex items-center gap-3">
      {/* Иконка версии */}
      <div className={`
        flex items-center justify-center h-10 w-10 rounded-lg
        shadow-sm
        ${index === 0 
          ? 'bg-green-100 text-green-700 border border-green-200' 
          : 'bg-slate-100 text-slate-700 border border-slate-200'
        }
      `}>
        <span className="font-bold text-base">v{version.version_number}</span>
      </div>
      
      {/* Бейдж "Текущая версия" */}
      {index === 0 && (
        <span className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-full font-medium">
          Текущая версия
        </span>
      )}
    </div>
    
    {/* ПРАВАЯ ЧАСТЬ: кнопка, автор, дата, SHA-1 (справа налево) */}
    <div className="flex items-center gap-2 h-8">
      {/* SHA-1 сумма */}
      {version.content && version.sha1_hash && (
        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200" 
             title={`SHA-1: ${version.sha1_hash}`}>
          <Hash className="h-4 w-4 text-slate-500" />
          <span className="text-xs font-mono text-slate-700">
            {version.sha1_hash}
          </span>
        </div>
      )}
      
  {/* Автор */}
  {version.created_by_username && (
    <div className="flex items-center gap-2 bg-blue-50 px-3 py-1 rounded-lg border border-blue-200 h-full">
      <User className="h-3.5 w-3.5 text-blue-500" />
      <span className="text-xs font-medium text-blue-700">
        {version.created_by_username}
      </span>
    </div>
  )}
  
    {/* Дата и время */}
    <div className="flex items-center gap-2 bg-slate-50 px-3 py-1 rounded-lg border border-slate-200 h-full">
      <Calendar className="h-3.5 w-3.5 text-slate-500" />
      <div className="text-xs text-slate-700 whitespace-nowrap">
        {new Date(version.created_at).toLocaleDateString('ru-RU', {
          day: 'numeric',
          month: 'numeric',
          year: 'numeric'
        })}
        {' '}
        {new Date(version.created_at).toLocaleTimeString('ru-RU', {
          hour: '2-digit',
          minute: '2-digit'
        })}
      </div>
    </div>

    {isAdmin && index !== 0 && (
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleRollback(currentScriptId, version.version_number)}
        className="gap-2 border-slate-300 hover:bg-slate-50 hover:border-slate-400 h-full"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        <span className="text-xs">Откатить</span>
      </Button>
    )}
  </div>
  </div>
  
{/* Заголовок комментария */}
<div className="mb-1">
  <div className="flex items-center gap-2">
    <Label className="text-xs font-medium text-slate-700">
      Комментарий:
    </Label>

  </div>
</div>

{/* Текст комментария */}
<div className="mb-3">
  <div className="
    p-2 bg-slate-50 rounded 
    border border-slate-200
    text-xs
    min-h-[32px]
  ">
    {version.comment ? (
      <p className="text-slate-700 whitespace-pre-wrap leading-snug">
        {version.comment}
      </p>
    ) : (
      <div className="flex items-center justify-center h-[32px]">
        <span className="text-slate-400 italic text-xs">—</span>
      </div>
    )}
  </div>
</div>

{/* Содержимое скрипта */}
<div>
  <div className="flex items-center justify-between mb-1">
    <div className="flex items-center gap-2">
      <Label className="text-xs font-medium text-slate-700">
        Скрипт:
      </Label>
      <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
        {version.content?.length || 0} симв.
      </span>
    </div>
  </div>
  <pre className="
    p-2 bg-slate-50 rounded 
    text-xs font-mono overflow-x-auto 
    max-h-40 overflow-y-auto
    border border-slate-200
    min-h-[32px]
  ">
    {version.content || (
      <span className="text-slate-400 italic">—</span>
    )}
  </pre>
</div>
</div>
                </div>
              ))}
            </div>
          )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

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
