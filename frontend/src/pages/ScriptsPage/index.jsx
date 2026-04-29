import React, { useMemo, useState, useCallback, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SelectNative } from "@/components/ui/select-native";
import { Pencil, Plus, Upload, Download } from "lucide-react";
import { toast } from "sonner";
import { api } from '@/config/api';
import { usePermissions } from '@/hooks/usePermissions';
import { useDialog } from "@/hooks/useDialog";
import { ConfirmationDialog } from "@/components/ui/ConfirmationDialog";
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CircleHelp } from "lucide-react";

// Local components
import { useScriptsData } from './useScriptsData';
import ScriptsTable from './ScriptsTable';
import ScriptFormDialog from './ScriptFormDialog';
import GroupsDialog from './GroupsDialog';
import VersionsDialog from './VersionsDialog';
import SyntaxCheckDialog from './SyntaxCheckDialog';

export default function ScriptsPage() {
  const { canCreateScript } = usePermissions();
  const { dialogState, setDialogState, showConfirm } = useDialog();
  const { isAdmin } = useAuth();
  
  // Data hook
  const {
    scripts,
    categories,
    systems,
    checkGroups,
    selectedCategory,
    selectedSystem,
    setSelectedCategory,
    setSelectedSystem,
    setCheckGroups,
    formData,
    setFormData,
    formCategoryId,
    formSystems,
    editingScript,
    setEditingScript,
    fetchScripts,
    refreshAll,
    resetForm,
    handleCategoryChangeInForm,
    openEditDialog,
    INITIAL_FORM_DATA
  } = useScriptsData();

  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isGroupsDialogOpen, setIsGroupsDialogOpen] = useState(false);
  const [isVersionsDialogOpen, setIsVersionsDialogOpen] = useState(false);
  const [currentScriptId, setCurrentScriptId] = useState(null);
  const [isSyntaxCheckDialogOpen, setIsSyntaxCheckDialogOpen] = useState(false);
  const [syntaxCheckResult, setSyntaxCheckResult] = useState(null);
  const [isCheckingSyntax, setIsCheckingSyntax] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [isOrderEditMode, setIsOrderEditMode] = useState(false);
  const fileInputRef = useRef(null);

  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportQuery, setExportQuery] = useState("");
  const [exportSelectedIds, setExportSelectedIds] = useState(() => new Set());
  const [exportFormat, setExportFormat] = useState("encoded");

  // Submit handler
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    
    try {
      const submitData = {
        system_id: formData.system_id,
        name: formData.name,
        description: formData.description,
        content: formData.content,
        processor_script: formData.processor_script,
        processor_script_comment: formData.processor_script_comment,
        create_new_version: formData.create_new_version,
        has_reference_files: formData.has_reference_files,
        test_methodology: formData.test_methodology,
        success_criteria: formData.success_criteria,
        non_compliance_criticality_ope: formData.non_compliance_criticality_ope,
        non_compliance_criticality_pe: formData.non_compliance_criticality_pe,
        order: formData.order,
        group_ids: formData.group_ids
      };

      if (editingScript) {
        await api.put(`/api/scripts/${editingScript.id}`, submitData);
        toast.success("Проверка обновлена");
      } else {
        await api.post('/api/scripts', submitData);
        toast.success("Проверка создана");
      }
      
      setIsDialogOpen(false);
      resetForm();
      fetchScripts();
    } catch (error) {
      console.error("Error saving script:", error);
      toast.error(error.response?.data?.detail || "Ошибка сохранения проверки");
    }
  }, [formData, editingScript, resetForm, fetchScripts]);

  // Delete handler
  const handleDelete = useCallback(async (id) => {
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
  }, [showConfirm, fetchScripts]);

  // Syntax check
  const handleSyntaxCheck = useCallback(async () => {
    const scriptContent = formData.processor_script;
    
    if (!scriptContent?.trim()) {
      toast.warning("Скрипт-обработчик пуст");
      return;
    }

    setIsCheckingSyntax(true);
    try {
      const response = await api.post('/api/scripts/validate-syntax', scriptContent, {
        headers: { 'Content-Type': 'text/plain' }
      });
      
      setSyntaxCheckResult(response.data);
      setIsSyntaxCheckDialogOpen(true);
    } catch (error) {
      setSyntaxCheckResult({
        valid: false,
        error: error.response?.data?.detail || "Ошибка проверки"
      });
      setIsSyntaxCheckDialogOpen(true);
    } finally {
      setIsCheckingSyntax(false);
    }
  }, [formData.processor_script]);

  // Open versions dialog
  const handleOpenVersions = useCallback((scriptId) => {
    setCurrentScriptId(scriptId);
    setIsVersionsDialogOpen(true);
  }, []);

  // Handle edit
  const handleEdit = useCallback(async (script) => {
    const success = await openEditDialog(script);
    if (success) {
      setIsDialogOpen(true);
    }
  }, [openEditDialog]);

  // Handle rollback
  const handleRollback = useCallback(async (scriptId) => {
    fetchScripts();
    
    if (editingScript?.id === scriptId) {
      const response = await api.get(`/api/scripts/${scriptId}`);
      const scriptData = response.data;
      setFormData(prev => ({
        ...prev,
        processor_script: scriptData.processor_script || "",
        processor_script_comment: scriptData.processor_script_version?.comment || ""
      }));
    }
  }, [editingScript?.id, fetchScripts, setFormData]);

  const handleMoveScript = useCallback(async (scriptId, direction) => {
    if (isReordering) return;

    const currentIndex = scripts.findIndex((script) => script.id === scriptId);
    if (currentIndex === -1) return;

    const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (nextIndex < 0 || nextIndex >= scripts.length) return;

    const reordered = [...scripts];
    [reordered[currentIndex], reordered[nextIndex]] = [reordered[nextIndex], reordered[currentIndex]];

    setIsReordering(true);
    try {
      await api.put('/api/scripts/reorder', {
        script_orders: reordered.map((script, index) => ({
          id: script.id,
          order: index,
        })),
      });
      await fetchScripts();
      toast.success("Порядок проверок обновлен");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Ошибка изменения порядка проверок");
    } finally {
      setIsReordering(false);
    }
  }, [isReordering, scripts, fetchScripts]);

  const filteredScriptsForExport = useMemo(() => {
    const q = exportQuery.trim().toLowerCase();
    if (!q) return scripts;
    return scripts.filter((s) => {
      const hay = [
        s?.name,
        s?.description,
        s?.category_name,
        s?.system_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [scripts, exportQuery]);

  const openExportDialog = useCallback(() => {
    // Default: select all currently shown in the table (respecting current filters)
    const next = new Set(filteredScriptsForExport.map((s) => s.id).filter(Boolean));
    setExportSelectedIds(next);
    setExportQuery("");
    setExportFormat("encoded");
    setExportDialogOpen(true);
  }, [filteredScriptsForExport]);

  const toggleExportId = useCallback((id) => {
    if (!id) return;
    setExportSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllFiltered = useCallback(() => {
    setExportSelectedIds((prev) => {
      const next = new Set(prev);
      for (const s of filteredScriptsForExport) {
        if (s?.id) next.add(s.id);
      }
      return next;
    });
  }, [filteredScriptsForExport]);

  const clearAll = useCallback(() => {
    setExportSelectedIds(new Set());
  }, []);

  const handleExport = useCallback(async () => {
    if (isExporting) return;
    const ids = Array.from(exportSelectedIds);
    if (ids.length === 0) {
      toast.error("Выберите проверки для экспорта");
      return;
    }
    setIsExporting(true);
    try {
      const encoded = exportFormat === "encoded";
      const response = await api.post(
        `/api/scripts/export/selected?encoded=${encoded}`,
        { script_ids: ids },
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `scripts-export-${encoded ? 'encoded' : 'plain'}-${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Экспорт завершен");
      setExportDialogOpen(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Ошибка экспорта");
    } finally {
      setIsExporting(false);
    }
  }, [isExporting, exportSelectedIds, exportFormat]);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImportFileChange = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const content = await file.text();
      const payload = JSON.parse(content);
      
      // Log request details for debugging
      console.log('Import request:', {
        url: '/api/scripts/import/bulk',
        payloadSize: JSON.stringify(payload).length,
        scriptsCount: payload.scripts?.length || 0
      });
      
      await api.post('/api/scripts/import/bulk', payload);
      toast.success("Импорт завершен");
      await refreshAll();
    } catch (error) {
      // Enhanced error logging
      console.error('Import error:', {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        status: error.response?.status,
        request: error.request,
        config: error.config
      });
      
      let detail = "Ошибка импорта";
      if (error.response?.data?.detail) {
        detail = error.response.data.detail;
      } else if (error.message) {
        detail = error.message;
      } else if (error.code === 'ECONNABORTED') {
        detail = "Таймаут запроса. Файл слишком большой или сервер не отвечает.";
      } else if (error.code === 'ERR_NETWORK' || !error.response) {
        detail = "Ошибка сети. Проверьте подключение к серверу.";
      }
      
      toast.error(detail);
    } finally {
      setIsImporting(false);
      event.target.value = "";
    }
  }, [refreshAll]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Проверки</h1>
          <p className="text-slate-600 mt-1">Создание, редактирование и удаление проверок</p>
        </div>
        <div className="flex gap-2">
          {canCreateScript() && (
            <>
              <Button 
                variant="outline" 
                onClick={openExportDialog}
                disabled={isExporting}
              >
                <Upload className="mr-2 h-4 w-4" /> {isExporting ? "Экспорт..." : "Экспорт"}
              </Button>
              <Button 
                variant="outline" 
                onClick={handleImportClick}
                disabled={isImporting}
              >
                <Download className="mr-2 h-4 w-4" /> {isImporting ? "Импорт..." : "Импорт"}
              </Button>
              <Button
                variant={isOrderEditMode ? "default" : "outline"}
                onClick={() => setIsOrderEditMode((prev) => !prev)}
                disabled={isReordering}
                title="Редактировать порядок отображения проверок"
              >
                <Pencil className="mr-2 h-4 w-4" /> Порядок
              </Button>
            </>
          )}
          {canCreateScript() && (
            <Button 
              variant="outline" 
              onClick={() => setIsGroupsDialogOpen(true)}
            >
              Группы проверок
            </Button>
          )}
          {canCreateScript() && (
            <Button 
              onClick={() => { resetForm(); setIsDialogOpen(true); }} 
              data-testid="add-script-btn"
            >
              <Plus className="mr-2 h-4 w-4" /> Добавить проверку
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
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

      {/* Scripts table */}
      <ScriptsTable 
        scripts={scripts}
        checkGroups={checkGroups}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onMove={handleMoveScript}
        isReordering={isReordering}
        showReorderControls={isOrderEditMode}
      />

      {/* Form dialog */}
      <ScriptFormDialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}
        formData={formData}
        setFormData={setFormData}
        formCategoryId={formCategoryId}
        formSystems={formSystems}
        categories={categories}
        checkGroups={checkGroups}
        editingScript={editingScript}
        onCategoryChange={handleCategoryChangeInForm}
        onSubmit={handleSubmit}
        onOpenVersions={handleOpenVersions}
        onSyntaxCheck={handleSyntaxCheck}
        isCheckingSyntax={isCheckingSyntax}
      />

      {/* Groups dialog */}
      <GroupsDialog
        open={isGroupsDialogOpen}
        onOpenChange={setIsGroupsDialogOpen}
        checkGroups={checkGroups}
        setCheckGroups={setCheckGroups}
      />

      {/* Versions dialog */}
      <VersionsDialog
        open={isVersionsDialogOpen}
        onOpenChange={setIsVersionsDialogOpen}
        scriptId={currentScriptId}
        onRollback={handleRollback}
      />

      {/* Syntax check dialog */}
      <SyntaxCheckDialog
        open={isSyntaxCheckDialogOpen}
        onOpenChange={setIsSyntaxCheckDialogOpen}
        result={syntaxCheckResult}
        isChecking={isCheckingSyntax}
      />

      {/* Confirmation dialog */}
      <ConfirmationDialog
        open={dialogState.open}
        onOpenChange={(open) => {
          if (!open && dialogState.onCancel) {
            dialogState.onCancel();
          } else {
            setDialogState(prev => ({ ...prev, open }));
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
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleImportFileChange}
      />

      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Экспорт проверок</DialogTitle>
            <DialogDescription>
              Выберите проверки, которые нужно экспортировать. Будут выгружены только выбранные.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={selectAllFiltered}>
                  Выбрать все (по фильтру)
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={clearAll}>
                  Очистить
                </Button>
              </div>
              <div className="text-sm text-muted-foreground">
                Выбрано: {exportSelectedIds.size} / {scripts.length}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-end">
              <div>
                <div className="flex items-center gap-2">
                  <Label>Формат экспорта</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          aria-label="Подсказка по формату экспорта"
                        >
                          <CircleHelp className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-sm">
                        <p>
                          v2 рекомендуется для сетей с контент-фильтрацией (DPI/WAF), где plain-скрипты могут блокироваться.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Select value={exportFormat} onValueChange={setExportFormat}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите формат экспорта" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="plain">Оригинальный (v1)</SelectItem>
                    <SelectItem value="encoded">Кодированный content/processor_script (v2)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Input
              placeholder="Поиск по названию, описанию, категории, системе…"
              value={exportQuery}
              onChange={(e) => setExportQuery(e.target.value)}
            />

            <div className="border rounded-md">
              <ScrollArea className="h-[360px]">
                <div className="p-3 space-y-2">
                  {filteredScriptsForExport.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-8 text-center">
                      Ничего не найдено
                    </div>
                  ) : (
                    filteredScriptsForExport.map((s) => {
                      const checked = exportSelectedIds.has(s.id);
                      const secondary = s.category_name
                        ? `${s.category_icon || "📁"} ${s.category_name} → ${s.system_name || ""}`
                        : (s.system_name || "");

                      return (
                        <label
                          key={s.id}
                          className="flex items-start gap-3 rounded-md border p-3 hover:bg-slate-50 cursor-pointer"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleExportId(s.id)}
                            className="mt-1"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate">{s.name}</div>
                            {(secondary || s.description) && (
                              <div className="text-xs text-muted-foreground mt-1 space-y-1">
                                {secondary && <div className="truncate">{secondary}</div>}
                                {s.description && <div className="truncate">{s.description}</div>}
                              </div>
                            )}
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setExportDialogOpen(false)}>
              Отмена
            </Button>
            <Button type="button" onClick={handleExport} disabled={isExporting || exportSelectedIds.size === 0}>
              {isExporting ? "Экспорт..." : "Экспортировать выбранные"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

