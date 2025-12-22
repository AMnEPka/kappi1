import React, { useState, useCallback, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SelectNative } from "@/components/ui/select-native";
import { Plus, Upload, Download } from "lucide-react";
import { toast } from "sonner";
import { api } from '@/config/api';
import { usePermissions } from '@/hooks/usePermissions';
import { useDialog } from "@/hooks/useDialog";
import { ConfirmationDialog } from "@/components/ui/ConfirmationDialog";
import { useAuth } from '@/contexts/AuthContext';

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
  const fileInputRef = useRef(null);

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

  const handleExport = useCallback(async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const response = await api.get('/api/scripts/export/all', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `scripts-export-${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Экспорт завершен");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Ошибка экспорта");
    } finally {
      setIsExporting(false);
    }
  }, [isExporting]);

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
      await api.post('/api/scripts/import/bulk', payload);
      toast.success("Импорт завершен");
      await refreshAll();
    } catch (error) {
      const detail = error.response?.data?.detail || error.message || "Ошибка импорта";
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
                onClick={handleExport}
                disabled={isExporting}
              >
                <Download className="mr-2 h-4 w-4" /> {isExporting ? "Экспорт..." : "Экспорт"}
              </Button>
              <Button 
                variant="outline" 
                onClick={handleImportClick}
                disabled={isImporting}
              >
                <Upload className="mr-2 h-4 w-4" /> {isImporting ? "Импорт..." : "Импорт"}
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
    </div>
  );
}

