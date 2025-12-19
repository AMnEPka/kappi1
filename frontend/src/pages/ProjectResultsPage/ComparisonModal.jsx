import React, { useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";

export default function ComparisonModal({ 
  open, 
  onClose, 
  sessions, 
  comparisonMode, 
  setComparisonMode,
  formatDate 
}) {
  const comparisonSessions = useMemo(() => {
    switch (comparisonMode) {
      case "last2":
        return sessions.slice(0, 2);
      case "last5":
        return sessions.slice(0, 5);
      case "all":
        return sessions;
      default:
        return sessions.slice(0, 5);
    }
  }, [sessions, comparisonMode]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Close button */}
        <div className="flex justify-end p-1">
          <Button 
            variant="ghost" 
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-white border shadow-sm hover:bg-gray-50"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Content with scroll */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-6" align="center">
            <h3 className="text-lg font-semibold mb-2">Сравнение запусков проекта</h3>
            <Select 
              value={comparisonMode} 
              onValueChange={setComparisonMode}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="last2">2 последних запуска</SelectItem>
                <SelectItem value="last5">5 последних запусков</SelectItem>
                <SelectItem value="all">Все запуски</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Chart by statuses */}
          <div className="space-y-3">
            <h4 className="font-medium">Распределение по статусам</h4>
            <div className="space-y-2">
              {comparisonSessions.map((session) => (
                <div key={session.session_id} className="flex items-center gap-4 p-2 bg-gray-50 rounded">
                  {/* Date on left */}
                  <div className="w-48 text-sm font-medium text-gray-700 whitespace-nowrap">
                    {formatDate(session.executed_at)}
                  </div>
                  
                  {/* Chart in center */}
                  <div className="flex-1 min-w-0">
                    <div className="flex h-6 bg-gray-200 rounded overflow-hidden">
                      <div 
                        className="bg-green-600 transition-all flex items-center justify-center"
                        style={{ width: `${(session.passed_count / session.total_checks) * 100}%` }}
                        title={`Выполнено: ${session.passed_count}`}
                      >
                        {session.passed_count > 0 && (
                          <span className="text-white text-xs font-medium">
                            {session.passed_count}
                          </span>
                        )}
                      </div>
                      <div 
                        className="bg-yellow-600 transition-all flex items-center justify-center"
                        style={{ width: `${(session.failed_count / session.total_checks) * 100}%` }}
                        title={`Не выполнено: ${session.failed_count}`}
                      >
                        {session.failed_count > 0 && (
                          <span className="text-white text-xs font-medium">
                            {session.failed_count}
                          </span>
                        )}
                      </div>
                      <div 
                        className="bg-blue-600 transition-all flex items-center justify-center"
                        style={{ width: `${(session.operator_count / session.total_checks) * 100}%` }}
                        title={`Оператор: ${session.operator_count}`}
                      >
                        {session.operator_count > 0 && (
                          <span className="text-white text-xs font-medium">
                            {session.operator_count}
                          </span>
                        )}
                      </div>
                      <div 
                        className="bg-red-600 transition-all flex items-center justify-center"
                        style={{ width: `${(session.error_count / session.total_checks) * 100}%` }}
                        title={`Ошибки: ${session.error_count}`}
                      >
                        {session.error_count > 0 && (
                          <span className="text-white text-xs font-medium">
                            {session.error_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Total on right */}
                  <div className="w-20 text-sm font-medium text-gray-700 text-right whitespace-nowrap">
                    {session.total_checks}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Legend */}
          <div className="flex gap-6 justify-center mt-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-600 rounded"></div>
              <span>Выполнено</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-600 rounded"></div>
              <span>Не выполнено</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-600 rounded"></div>
              <span>Оператор</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-600 rounded"></div>
              <span>Ошибки</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

