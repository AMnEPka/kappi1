import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function ExecutionDetailsDialog({ 
  execution, 
  onClose,
  formatDate,
  getHostName,
  getErrorInfo,
  getCheckStatusBadge
}) {
  if (!execution) return null;

  const errorInfo = getErrorInfo(execution);

  return (
    <Dialog open={!!execution} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {execution.script_name}
          </DialogTitle>
          <DialogDescription>
            Выполнено: {formatDate(execution.executed_at)}
            {execution.host_id && (
              <span> • Хост: {getHostName(execution.host_id)}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <h3 className="font-bold mb-2">Статус:</h3>
            {getCheckStatusBadge(execution)}
          </div>

          {/* Error/Failure info block */}
          {errorInfo && (
            <div className={`border rounded-lg p-4 ${
              execution.check_status === 'Ошибка' 
                ? 'bg-red-50 border-red-200' 
                : 'bg-yellow-50 border-yellow-200'
            }`}>
              <h3 className={`font-bold mb-2 ${
                execution.check_status === 'Ошибка' 
                  ? 'text-red-700' 
                  : 'text-yellow-700'
              }`}>
                {execution.check_status === 'Ошибка' 
                  ? 'Описание ошибки:' 
                  : 'Причина непрохождения проверки:'}
              </h3>
              <div className="space-y-2">
                {execution.error_code && (
                  <div>
                    <span className="font-medium">Код: </span>
                    <span className={`font-mono px-2 py-1 rounded ${
                      execution.check_status === 'Ошибка' 
                        ? 'bg-red-100' 
                        : 'bg-yellow-100'
                    }`}>
                      {execution.error_code}
                    </span>
                  </div>
                )}
                <div>
                  <span className="font-medium">Категория: </span>
                  <span>{errorInfo.category}</span>
                </div>
                <div>
                  <span className="font-medium">
                    {execution.check_status === 'Ошибка' ? 'Ошибка: ' : 'Проблема: '}
                  </span>
                  <span>{errorInfo.error}</span>
                </div>
                <div>
                  <span className="font-medium">Описание: </span>
                  <span>{errorInfo.description}</span>
                </div>
              </div>
            </div>
          )}

          {execution.output && (
            <div>
              <h3 className="font-bold mb-2">Вывод команды:</h3>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                {execution.output}
              </pre>
            </div>
          )}

          {execution.check_result && (
            <div>
              <h3 className="font-bold mb-2">Результат проверки:</h3>
              <pre className="bg-blue-50 text-blue-900 p-4 rounded-lg overflow-x-auto text-sm border border-blue-200">
                {execution.check_result}
              </pre>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

