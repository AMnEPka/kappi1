import React, { useState, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from '@/config/api';
import { useDialog } from "@/hooks/useDialog";
import { ConfirmationDialog } from "@/components/ui/ConfirmationDialog";

export default function GroupsDialog({ 
  open, 
  onOpenChange, 
  checkGroups, 
  setCheckGroups 
}) {
  const [editingGroup, setEditingGroup] = useState(null);
  const [groupFormData, setGroupFormData] = useState({ name: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { dialogState, setDialogState, showConfirm } = useDialog();

  const resetGroupForm = useCallback(() => {
    setGroupFormData({ name: "" });
    setEditingGroup(null);
  }, []);

  const handleGroupSubmit = useCallback(async (e) => {
    e.preventDefault();
    
    if (!groupFormData.name.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    
    try {
      if (editingGroup) {
        const response = await api.put(`/api/check-groups/${editingGroup.id}`, {
          name: groupFormData.name
        });
        
        setCheckGroups(prev => prev.map(g => 
          g.id === editingGroup.id ? response.data : g
        ));
        
        resetGroupForm();
        onOpenChange(false);
        toast.success("Группа обновлена");
      } else {
        const response = await api.post('/api/check-groups', {
          name: groupFormData.name
        });
        
        setCheckGroups(prev => [...prev, response.data]);
        setGroupFormData({ name: "" });
        toast.success("Группа создана");
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Ошибка сохранения группы");
    } finally {
      setIsSubmitting(false);
    }
  }, [groupFormData, editingGroup, isSubmitting, setCheckGroups, resetGroupForm, onOpenChange]);

  const handleGroupDelete = useCallback(async (groupId) => {
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
      setCheckGroups(prev => prev.filter(g => g.id !== groupId));
      toast.success("Группа удалена");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Ошибка удаления группы");
    }
  }, [showConfirm, setCheckGroups]);

  const openGroupEditDialog = useCallback((group) => {
    setEditingGroup(group);
    setGroupFormData({ name: group.name });
  }, []);

  const handleClose = useCallback(() => {
    resetGroupForm();
    onOpenChange(false);
  }, [resetGroupForm, onOpenChange]);

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => {
        if (!isOpen) handleClose();
        else onOpenChange(isOpen);
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingGroup ? "Редактировать группу" : "Управление группами проверок"}
            </DialogTitle>
            <DialogDescription>
              {editingGroup 
                ? "Измените название группы" 
                : "Создайте, отредактируйте или удалите группы проверок"}
            </DialogDescription>
          </DialogHeader>

          {editingGroup ? (
            <form onSubmit={handleGroupSubmit} className="space-y-4">
              <div>
                <Label>Название группы</Label>
                <Input
                  value={groupFormData.name}
                  onChange={(e) => setGroupFormData({ name: e.target.value })}
                  placeholder="Название группы"
                  required
                  disabled={isSubmitting}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleClose}
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
                      onChange={(e) => setGroupFormData({ name: e.target.value })}
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
    </>
  );
}

