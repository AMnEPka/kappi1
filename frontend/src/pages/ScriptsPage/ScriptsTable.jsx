import React, { useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FileCode, Edit, Trash2 } from "lucide-react";
import { usePermissions } from '@/hooks/usePermissions';

export default function ScriptsTable({ 
  scripts, 
  checkGroups, 
  onEdit, 
  onDelete 
}) {
  const { canEditScript, canDeleteScript } = usePermissions();

  const rows = useMemo(() => (
    scripts.map((script) => {
      const scriptGroups = checkGroups.filter(group => 
        script.group_ids?.includes(group.id)
      );
      
      return (
        <tr 
          key={script.id} 
          className="border-b border-slate-100 hover:bg-slate-50" 
          data-testid={`script-card-${script.id}`}
        >
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
                    <div className="text-sm">{script.description}</div>
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
                <Button variant="ghost" size="icon" onClick={() => onEdit(script)}>
                  <Edit className="text-black-600" />
                </Button>
              )}
              {canDeleteScript(script) && (
                <Button variant="ghost" size="icon" onClick={() => onDelete(script.id)}>
                  <Trash2 className="text-red-600" />
                </Button>
              )}
            </div>
          </td>
        </tr>
      );
    })
  ), [scripts, checkGroups, canEditScript, canDeleteScript, onEdit, onDelete]);

  if (scripts.length === 0) {
    return (
      <div className="text-center py-16">
        <FileCode className="h-16 w-16 mx-auto text-slate-300 mb-4" />
        <p className="text-slate-500 text-lg mb-2">Нет проверок</p>
        <p className="text-slate-400 text-sm">Создайте первую проверку этого типа</p>
      </div>
    );
  }

  return (
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
          {rows}
        </tbody>
      </table>
    </div>
  );
}

