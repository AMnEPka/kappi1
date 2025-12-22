import React, { useState, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, RotateCcw, Calendar, User, Hash } from "lucide-react";
import { toast } from "sonner";
import { api } from '@/config/api';
import { useDialog } from "@/hooks/useDialog";
import { ConfirmationDialog } from "@/components/ui/ConfirmationDialog";
import { useAuth } from '@/contexts/AuthContext';

export default function VersionsDialog({ 
  open, 
  onOpenChange, 
  scriptId,
  onRollback
}) {
  const [versions, setVersions] = useState([]);
  const { isAdmin } = useAuth();
  const { dialogState, setDialogState, showConfirm } = useDialog();

  const fetchVersions = useCallback(async (id) => {
    try {
      const response = await api.get(`/api/scripts/${id}/processor-versions`);
      setVersions(response.data.versions || []);
    } catch (error) {
      toast.error("Ошибка загрузки версий");
    }
  }, []);

  React.useEffect(() => {
    if (open && scriptId) {
      fetchVersions(scriptId);
    }
  }, [open, scriptId, fetchVersions]);

  const handleRollback = useCallback(async (versionNumber) => {
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
      
      // Refresh versions
      await fetchVersions(scriptId);
      
      // Notify parent
      if (onRollback) {
        onRollback(scriptId);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Ошибка отката версии");
    }
  }, [scriptId, showConfirm, fetchVersions, onRollback]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
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
            {versions.length === 0 ? (
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
                {versions.map((version, index) => (
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
                    {/* Version card header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`
                          flex items-center justify-center h-10 w-10 rounded-lg shadow-sm
                          ${index === 0 
                            ? 'bg-green-100 text-green-700 border border-green-200' 
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }
                        `}>
                          <span className="font-bold text-base">v{version.version_number}</span>
                        </div>
                        
                        {index === 0 && (
                          <span className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-full font-medium">
                            Текущая версия
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 h-8">
                        {version.sha1_hash && (
                          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200" 
                               title={`SHA-1: ${version.sha1_hash}`}>
                            <Hash className="h-4 w-4 text-slate-500" />
                            <span className="text-xs font-mono text-slate-700">
                              {version.sha1_hash}
                            </span>
                          </div>
                        )}
                        
                        {version.created_by_username && (
                          <div className="flex items-center gap-2 bg-blue-50 px-3 py-1 rounded-lg border border-blue-200 h-full">
                            <User className="h-3.5 w-3.5 text-blue-500" />
                            <span className="text-xs font-medium text-blue-700">
                              {version.created_by_username}
                            </span>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1 rounded-lg border border-slate-200 h-full">
                          <Calendar className="h-3.5 w-3.5 text-slate-500" />
                          <div className="text-xs text-slate-700 whitespace-nowrap">
                            {new Date(version.created_at).toLocaleDateString('ru-RU')}
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
                            onClick={() => handleRollback(version.version_number)}
                            className="gap-2 border-slate-300 hover:bg-slate-50 hover:border-slate-400 h-full"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span className="text-xs">Откатить</span>
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    {/* Comment */}
                    <div className="mb-3">
                      <Label className="text-xs font-medium text-slate-700">Комментарий:</Label>
                      <div className="p-2 bg-slate-50 rounded border border-slate-200 text-xs min-h-[32px] mt-1">
                        {version.comment ? (
                          <p className="text-slate-700 whitespace-pre-wrap leading-snug">
                            {version.comment}
                          </p>
                        ) : (
                          <span className="text-slate-400 italic">—</span>
                        )}
                      </div>
                    </div>

                    {/* Script content */}
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Label className="text-xs font-medium text-slate-700">Скрипт:</Label>
                        <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          {version.content?.length || 0} симв.
                        </span>
                      </div>
                      <pre className="
                        p-2 bg-slate-50 rounded text-xs font-mono overflow-x-auto 
                        max-h-40 overflow-y-auto border border-slate-200 min-h-[32px]
                      ">
                        {version.content || <span className="text-slate-400 italic">—</span>}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
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

