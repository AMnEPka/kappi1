import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogClose, DialogTitle } from "@/components/ui/dialog";
import ReferenceComparison from './ReferenceComparison';

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
      <DialogContent className="w-[96vw] md:w-[calc(100vw-16rem-2rem)] max-w-none top-[calc(4rem+1rem)] translate-y-0 md:left-[calc(16rem+1rem)] md:translate-x-0 max-h-[calc(100vh-4rem-2rem)] flex flex-col overflow-hidden [&>button.absolute]:hidden">
        <div className="sticky top-0 z-10 bg-background border-b px-6 py-4">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <DialogTitle className="flex items-center gap-2 break-words">
                {execution.script_name}
              </DialogTitle>
              <DialogDescription className="break-words">
                Выполнено: {formatDate(execution.executed_at)}
                {execution.host_id && (
                  <span className="break-words"> • Хост: {getHostName(execution.host_id)}</span>
                )}
              </DialogDescription>
            </div>
            <DialogClose asChild>
              <button
                type="button"
                className="shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground"
                aria-label="Закрыть"
              >
                ×
              </button>
            </DialogClose>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
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
                <div className="break-words">
                  <span className="font-medium">Категория: </span>
                  <span className="break-words">{errorInfo.category}</span>
                </div>
                {/* <div className="break-words">
                  <span className="font-medium">
                    {execution.check_status === 'Ошибка' ? 'Ошибка: ' : 'Проблема: '}
                  </span>
                  <span className="break-words">{errorInfo.error}</span>
                </div> */}
                <div className="break-words">
                  <span className="font-medium">Описание: </span>
                  <span className="break-words">{errorInfo.description}</span>
                </div>
              </div>
            </div>
          )}

          {/* Reference Comparison */}
          {execution.reference_data && execution.actual_data && (
            <ReferenceComparison
              referenceData={execution.reference_data}
              actualData={execution.actual_data}
            />
          )}

          {execution.output && (
            <div>
              <h3 className="font-bold mb-2">Вывод исполненной команды:</h3>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm whitespace-pre-wrap break-words">
                {execution.output}
              </pre>
            </div>
          )}

          {execution.check_result && (
            <div>
              <h3 className="font-bold mb-2">Результат проверки:</h3>
              <pre className="bg-blue-50 text-blue-900 p-4 rounded-lg text-sm border border-blue-200 whitespace-pre-wrap break-words">
                {execution.check_result}
              </pre>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

