import React, { useCallback, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SelectNative } from "@/components/ui/select-native";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle, CheckCircle2, Loader2, History } from "lucide-react";
import { AdvancedCodeEditor } from "@/components/ui/advanced-code-editor";
import { useAuth } from '@/contexts/AuthContext';

export default function ScriptFormDialog({ 
  open, 
  onOpenChange, 
  formData, 
  setFormData,
  formCategoryId,
  formSystems,
  categories,
  checkGroups,
  editingScript,
  onCategoryChange,
  onSubmit,
  onOpenVersions,
  onSyntaxCheck,
  isCheckingSyntax
}) {
  const { isAdmin } = useAuth();

  const getPlaceholder = useMemo(() => {
    const category = categories.find(cat => cat.id === formCategoryId);
    
    if (!category) return "Выберите категорию для отображения примера...";

    if (category.name.toLowerCase().includes('linux')) {
      return `#!/bin/bash
# Результат команды доступен в переменной $CHECK_OUTPUT
# Эталонные данные доступны в переменной $ETALON_INPUT  
if echo "$CHECK_OUTPUT" | grep -q "нужная строка"; then
  echo "Пройдена"
else
  echo "Не пройдена"
fi`;
    }

    return `#!/bin/bash
# Результат команды доступен в переменной $CHECK_OUTPUT
# Эталонные данные доступны в переменной $ETALON_INPUT  
if [ "$CHECK_OUTPUT" = "ожидаемое значение" ]; then
  echo "Пройдена"
else
  echo "Не пройдена"
fi`;
  }, [categories, formCategoryId]);

  const getTooltipContent = useCallback(() => {
    const category = categories.find(cat => cat.id === formCategoryId);
    
    if (!category) {
      return <p>Выберите категорию для отображения подсказки</p>;
    }

    return (
      <div>
        <p className="font-semibold">Скрипт-обработчик</p>
        <p>Используйте bash</p>
        <p><strong>Доступные переменные:</strong></p>
        <ul className="list-disc list-inside text-xs mt-1">
          <li><code>$CHECK_OUTPUT</code> - вывод команды</li>
          <li><code>$ETALON_INPUT</code> - эталонные данные</li>
        </ul>
        <p className="text-xs mt-2">Скрипт должен вернуть:</p>
        <p className="text-xs mt-1"><strong>'Пройдена', 'Не пройдена', 'Ошибка', 'Оператор'</strong></p>
        <p className="text-xs mt-2">Для сравнения с эталоном (опционально):</p>
        <p className="text-xs mt-1">Выведите <code>ACTUAL_DATA: value1,value2</code> перед статусом для автоматического сравнения</p>
      </div>
    );
  }, [categories, formCategoryId]);

  const handleFormChange = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, [setFormData]);

  const handleGroupAdd = useCallback((groupId) => {
    if (groupId && !formData.group_ids?.includes(groupId)) {
      setFormData(prev => ({
        ...prev,
        group_ids: [...(prev.group_ids || []), groupId]
      }));
    }
  }, [formData.group_ids, setFormData]);

  const handleGroupRemove = useCallback((groupId) => {
    setFormData(prev => ({
      ...prev,
      group_ids: prev.group_ids.filter(id => id !== groupId)
    }));
  }, [setFormData]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto" modal={false}>
        <DialogHeader>
          <DialogTitle>{editingScript ? "Редактировать проверку" : "Новая проверка"}</DialogTitle>
          <DialogDescription>Создайте проверку для конкретной системы</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Left column */}
            <div className="space-y-4">
              <div>
                <Label>Категория</Label>
                <SelectNative
                  value={formCategoryId}
                  onChange={(e) => onCategoryChange(e.target.value)}
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
                  value={formData.system_id}
                  onChange={(e) => handleFormChange('system_id', e.target.value)}
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
                  onChange={(e) => handleFormChange('name', e.target.value)}
                  required
                />
              </div>
              
              <div>
                <Label>Описание</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => handleFormChange('description', e.target.value)}
                  placeholder="Опционально"
                />
              </div>

              <div>
                <Label>Добавить проверку в группы</Label>
                <div className="space-y-2">
                  {checkGroups.length === 0 ? (
                    <p className="text-sm text-slate-400">Нет групп</p>
                  ) : (
                    <>
                      <select
                        className="w-full border rounded-md p-2 text-sm"
                        onChange={(e) => {
                          handleGroupAdd(e.target.value);
                          e.target.value = "";
                        }}
                      >
                        <option value="">Выберите группу...</option>
                        {checkGroups
                          .filter(g => !formData.group_ids?.includes(g.id))
                          .map((group) => (
                            <option key={group.id} value={group.id}>
                              {group.name}
                            </option>
                          ))
                        }
                      </select>
                      
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
                                  onClick={() => handleGroupRemove(group.id)}
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
                        <p className="font-semibold">Для Windows - PowerShell, для Linux - Bash</p>
                        <p>Доступ к результату: <code className="bg-gray-100 px-1 rounded">$CHECK_OUTPUT</code></p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Textarea
                  data-testid="script-content-input"
                  value={formData.content}
                  onChange={(e) => handleFormChange('content', e.target.value)}
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
                  onCheckedChange={(checked) => handleFormChange('has_reference_files', checked)}
                />
                <Label htmlFor="has_reference_files" className="cursor-pointer">
                  Предусмотрены эталонные файлы
                </Label>
              </div>
            </div>

            {/* Right column */}
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <Label>Скрипт-обработчик</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-gray-500 cursor-help" />
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
                      onClick={onSyntaxCheck}
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
                          Проверить
                        </>
                      )}
                    </Button>
                    {editingScript && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onOpenVersions(editingScript.id)}
                      >
                        <History className="h-4 w-4 mr-1" />
                        Версии
                      </Button>
                    )}
                  </div>
                </div>
                <AdvancedCodeEditor
                  value={formData.processor_script}
                  onChange={(e) => handleFormChange('processor_script', e.target.value)}
                  placeholder={getPlaceholder}
                  title="Скрипт-обработчик (Bash)"
                  minHeight={300}
                  maxHeight={450}
                  tabSize={2}
                />
                <div className="mt-2">
                  <Label className="text-sm">Комментарий к версии</Label>
                  <Textarea
                    value={formData.processor_script_comment}
                    onChange={(e) => handleFormChange('processor_script_comment', e.target.value)}
                    placeholder={editingScript ? "Опишите изменения" : "Опишите первую версию"}
                    className="mt-1"
                  />
                </div>
                {editingScript && isAdmin && (
                  <div className="flex items-center space-x-2 mt-2">
                    <Checkbox
                      id="create_new_version"
                      checked={formData.create_new_version}
                      onCheckedChange={(checked) => handleFormChange('create_new_version', checked)}
                    />
                    <Label htmlFor="create_new_version" className="cursor-pointer text-sm">
                      Создать новую версию
                    </Label>
                  </div>
                )}
              </div>

              <div>
                <Label>Методика испытания (опционально)</Label>
                <Textarea
                  value={formData.test_methodology}
                  onChange={(e) => handleFormChange('test_methodology', e.target.value)}
                  placeholder="Данные из ПМИ"
                  rows={3}
                />
              </div>

              <div>
                <Label>Критерий успешного прохождения (опционально)</Label>
                <Textarea
                  value={formData.success_criteria}
                  onChange={(e) => handleFormChange('success_criteria', e.target.value)}
                  placeholder="Данные из ПМИ"
                  rows={3}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit" data-testid="save-script-btn">
              {editingScript ? "Обновить" : "Создать"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

