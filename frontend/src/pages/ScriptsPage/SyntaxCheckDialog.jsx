import React from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

export default function SyntaxCheckDialog({ 
  open, 
  onOpenChange, 
  result,
  isChecking
}) {
  if (isChecking) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Проверка синтаксиса</DialogTitle>
            <DialogDescription>Проверяем код на ошибки...</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!result) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Результат проверки синтаксиса</DialogTitle>
          <DialogDescription>
            Проверка кода на наличие синтаксических ошибок
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          {result.valid ? (
            <div className="flex flex-col items-center justify-center py-6 gap-4">
              <div className="p-4 bg-green-50 rounded-full">
                <CheckCircle2 className="h-12 w-12 text-green-500" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-medium text-green-700 mb-1">Синтаксис корректен</h3>
                <p className="text-sm text-slate-500">Ошибок в коде не обнаружено</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-red-50 rounded-lg border border-red-100">
                <XCircle className="h-6 w-6 text-red-500 flex-shrink-0" />
                <div>
                  <h3 className="font-medium text-red-700">Обнаружены ошибки</h3>
                  <p className="text-sm text-red-600">Код содержит синтаксические ошибки</p>
                </div>
              </div>
              
              {result.errors && result.errors.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-slate-700">Список ошибок:</h4>
                  <ScrollArea className="max-h-[300px]">
                    <div className="space-y-2">
                      {result.errors.map((error, index) => (
                        <div 
                          key={index} 
                          className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-sm"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">
                              Строка {error.line}
                            </span>
                            {error.column && (
                              <span className="text-xs text-slate-500">
                                Позиция: {error.column}
                              </span>
                            )}
                          </div>
                          <p className="text-slate-700 font-mono text-xs">{error.message}</p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
              
              {result.raw_error && !result.errors?.length && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-slate-700">Ошибка:</h4>
                  <pre className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-sm text-red-600 font-mono whitespace-pre-wrap overflow-auto max-h-[200px]">
                    {result.raw_error}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={() => onOpenChange(false)}>Закрыть</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

