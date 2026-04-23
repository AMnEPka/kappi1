import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, FileSpreadsheet, BarChart3, FileText } from "lucide-react";
import api from "@/config/api";
import { toast } from "sonner";

// Local components
import { useProjectResults } from './useProjectResults';
import ComparisonModal from './ComparisonModal';
import HostResultsCard from './HostResultsCard';
import ExecutionDetailsDialog from './ExecutionDetailsDialog';
import { FilePreviewDialog } from "@/components/is-catalog/FilePreviewDialog";

const getCheckStatusBadge = (execution) => {
  const status = execution.check_status;
  
  if (status === 'Пройдена') {
    return <Badge className="bg-green-500 hover:bg-green-600">Пройдена</Badge>;
  } else if (status === 'Не пройдена') {
    return <Badge className="bg-yellow-500 hover:bg-yellow-600">Не пройдена</Badge>;
  } else if (status === 'Оператор') {
    return <Badge className="bg-blue-500 hover:bg-blue-600">Оператор</Badge>;
  }
  return <Badge className="bg-red-500 hover:bg-red-600">Ошибка</Badge>;
};

export default function ProjectResultsPage({ projectId, onNavigate }) {
  const navigate = useNavigate();
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonMode, setComparisonMode] = useState("last2");
  const [selectedExecution, setSelectedExecution] = useState(null);

  // Inline Excel preview state. Kept in page scope so it can react to session changes.
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [exporting, setExporting] = useState(false);
  const lastPreviewSessionRef = useRef(null);
  
  const {
    project,
    sessions,
    selectedSession,
    groupedExecutions,
    hosts,
    loading,
    searchParams,
    handleSessionChange,
    handleExportToExcel,
    formatDate,
    getHostName,
    getHostStats,
    getErrorInfo
  } = useProjectResults(projectId);

  // Build the terminal-output markdown for a given session and return
  // { blob, filename, content_type, session_id }. No download is triggered;
  // the caller decides how to present the result.
  const buildTerminalMdBlob = useCallback(async () => {
    if (!selectedSession) return null;

    const allExecutions = Object.values(groupedExecutions).flat();
    const uniqueScriptIds = [...new Set(allExecutions.map((e) => e.script_id).filter(Boolean))];

    const scriptsMap = {};
    if (uniqueScriptIds.length > 0) {
      const responses = await Promise.all(
        uniqueScriptIds.map((sid) =>
          api
            .get(`/api/scripts/${sid}`)
            .then((r) => ({ sid, content: r?.data?.content }))
            .catch(() => ({ sid, content: "" }))
        )
      );
      for (const r of responses) {
        scriptsMap[r.sid] = typeof r.content === "string" ? r.content : "";
      }
    }

    const getHostHeader = (hostId) => {
      const h = hosts?.[hostId];
      const name = h?.name || hostId;
      const ip = h?.hostname || h?.ip_address || "";
      return ip ? `${name} (${ip})` : name;
    };

    const hostIds = Object.keys(groupedExecutions);

    let md = `# Экспорт вывода терминала\n\n`;
    md += `Проект: **${project?.name || "—"}**\n\n`;
    md += `Сессия: **${selectedSession}**\n\n`;

    for (const hostId of hostIds) {
      md += `# ${getHostHeader(hostId)}\n\n`;
      const executions = groupedExecutions[hostId] || [];

      for (const ex of executions) {
        md += `## ${ex.script_name || ex.script_id || "Проверка"}\n\n`;

        const cmd = scriptsMap[ex.script_id] || "";
        md += `### Команда\n\n`;
        md += "```bash\n";
        md += `${cmd || "—"}\n`;
        md += "```\n\n";

        md += `### Вывод\n\n`;
        md += "```text\n";
        md += `${ex.output || "—"}\n`;
        md += "```\n\n";
      }
    }

    const MD_MIME = "text/markdown;charset=utf-8";
    const blob = new Blob([md], { type: MD_MIME });
    const safeName = String(project?.name || "project")
      .replace(/[\\/:*?"<>|]+/g, "_")
      .slice(0, 80);
    const filename = `terminal-export_${safeName}_${new Date().toISOString().slice(0, 10)}.md`;

    return {
      blob,
      filename,
      content_type: MD_MIME,
      session_id: selectedSession,
    };
  }, [groupedExecutions, hosts, project?.name, selectedSession]);

  // One-click flow: build the terminal output markdown and open the preview
  // dialog. No automatic download — the user saves the file from the dialog.
  const handleExportTerminalAndPreview = useCallback(async () => {
    if (!selectedSession) {
      toast.error("Выберите запуск для экспорта");
      return;
    }
    if (exporting) return;
    setExporting(true);
    try {
      const result = await buildTerminalMdBlob();
      if (!result?.blob) {
        toast.error("Не удалось сформировать вывод терминала");
        return;
      }
      setPreviewFile({
        kind: "md",
        blob: result.blob,
        filename: result.filename,
        content_type: result.content_type,
        session_id: result.session_id,
      });
      lastPreviewSessionRef.current = result.session_id;
      setPreviewOpen(true);
    } catch (e) {
      toast.error(e?.message || "Не удалось экспортировать вывод терминала");
    } finally {
      setExporting(false);
    }
  }, [selectedSession, exporting, buildTerminalMdBlob]);

  // One-click flow: generate the xlsx and immediately open the preview
  // dialog. No automatic download — the user saves the file manually
  // from the dialog if they need a local copy.
  const handleExportAndPreview = useCallback(async () => {
    if (!selectedSession) {
      toast.error("Выберите запуск для экспорта");
      return;
    }
    if (exporting) return;
    setExporting(true);
    try {
      const result = await handleExportToExcel();
      if (!result?.blob) return;
      setPreviewFile({
        kind: "xlsx",
        blob: result.blob,
        filename: result.filename,
        content_type: result.content_type,
        session_id: result.session_id,
      });
      lastPreviewSessionRef.current = result.session_id;
      setPreviewOpen(true);
    } finally {
      setExporting(false);
    }
  }, [selectedSession, exporting, handleExportToExcel]);

  // If the user switches to another run while the preview dialog is open,
  // regenerate the export (xlsx or md — depending on what's currently shown)
  // for the newly selected session automatically.
  useEffect(() => {
    if (!previewOpen || !selectedSession || !previewFile?.kind) return;
    if (lastPreviewSessionRef.current === selectedSession) return;

    const currentKind = previewFile.kind;
    let cancelled = false;
    (async () => {
      const generator = currentKind === "md" ? buildTerminalMdBlob : handleExportToExcel;
      const result = await generator();
      if (cancelled || !result?.blob) return;
      setPreviewFile({
        kind: currentKind,
        blob: result.blob,
        filename: result.filename,
        content_type: result.content_type,
        session_id: result.session_id,
      });
      lastPreviewSessionRef.current = result.session_id;
    })();

    return () => {
      cancelled = true;
    };
  }, [previewOpen, selectedSession, previewFile?.kind, handleExportToExcel, buildTerminalMdBlob]);

  const handlePreviewOpenChange = useCallback((nextOpen) => {
    setPreviewOpen(nextOpen);
    if (!nextOpen) {
      setPreviewFile(null);
      lastPreviewSessionRef.current = null;
    }
  }, []);

  const handleBack = useCallback(() => {
    const returnTo = searchParams.get('returnTo');
    
    if (returnTo === 'scheduler') {
      navigate('/scheduler');
    } else {
      navigate('/');
    }
  }, [searchParams, navigate]);

  const handleViewDetails = useCallback((execution) => {
    setSelectedExecution(execution);
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-gray-500">Проект не найден</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={handleBack}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Назад
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{project.name}</h1>
          {project.description && (
            <p className="text-gray-600 mt-1">{project.description}</p>
          )}
        </div>
      </div>

      {/* Session selector */}
      {sessions.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                Выбор запуска
              </CardTitle>
              <CardDescription>
                Просмотр результатов конкретного запуска проекта
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleExportTerminalAndPreview}
                disabled={!selectedSession || exporting}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {exporting ? "Формирование..." : "Просмотр вывода терминала"}
                </span>
              </Button>
              <Button
                onClick={handleExportAndPreview}
                disabled={!selectedSession || exporting}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {exporting ? "Формирование..." : "Просмотр протокола (Excel)"}
                </span>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1">
                <Select value={selectedSession} onValueChange={handleSessionChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Выберите запуск" />
                  </SelectTrigger>
                  <SelectContent>
                    {sessions.map((session, index) => (
                      <SelectItem key={session.session_id} value={session.session_id}>
                        {index === 0 ? '🆕 ' : ''}
                        {session.is_offline ? '(офлайн) ' : ''}
                        {formatDate(session.executed_at)} 
                        {' - '}
                        Пройдено: {session.passed_count}/{session.total_checks}. 
                        Не пройдено: {session.failed_count}/{session.total_checks}. 
                        Ошибок: {session.error_count}/{session.total_checks}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => setShowComparison(!showComparison)}
                variant={showComparison ? "default" : "outline"}
                size="sm"
                className="gap-2 whitespace-nowrap"
              >
                <BarChart3 className="h-4 w-4" />
                <span>Сравнение запусков</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {sessions.length === 0 && (
        <Card className="mb-6">
          <CardContent className="p-6 text-center">
            <p className="text-gray-500">Проект ещё не запускался</p>
          </CardContent>
        </Card>
      )}

      {/* Results by Host */}
      <Card>
        <CardHeader>
          <CardTitle>Результаты по хостам</CardTitle>
          <CardDescription>Детальная информация о выполнении на каждом хосте</CardDescription>
        </CardHeader>
        <CardContent>
          {Object.keys(groupedExecutions).length === 0 ? (
            <p className="text-gray-500">Нет результатов выполнения</p>
          ) : (
            <div className="space-y-4">
              {Object.keys(groupedExecutions).map((hostId) => (
                <HostResultsCard
                  key={hostId}
                  hostId={hostId}
                  executions={groupedExecutions[hostId]}
                  hostName={getHostName(hostId)}
                  stats={getHostStats(hostId)}
                  formatDate={formatDate}
                  onViewDetails={handleViewDetails}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comparison Modal */}
      <ComparisonModal
        open={showComparison}
        onClose={() => setShowComparison(false)}
        sessions={sessions}
        comparisonMode={comparisonMode}
        setComparisonMode={setComparisonMode}
        formatDate={formatDate}
      />

      {/* Execution Details Dialog */}
      <ExecutionDetailsDialog
        execution={selectedExecution}
        onClose={() => setSelectedExecution(null)}
        formatDate={formatDate}
        getHostName={getHostName}
        getErrorInfo={getErrorInfo}
        getCheckStatusBadge={getCheckStatusBadge}
      />

      {/* Inline Excel Preview (reuses the just-exported blob; no extra requests) */}
      <FilePreviewDialog
        open={previewOpen}
        onOpenChange={handlePreviewOpenChange}
        file={previewFile}
      />
    </div>
  );
}

