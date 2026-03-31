import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, Download, BarChart3, FileText } from "lucide-react";
import api from "@/config/api";
import { toast } from "sonner";

// Local components
import { useProjectResults } from './useProjectResults';
import ComparisonModal from './ComparisonModal';
import HostResultsCard from './HostResultsCard';
import ExecutionDetailsDialog from './ExecutionDetailsDialog';

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

  const handleExportTerminalMd = useCallback(async () => {
    if (!selectedSession) {
      toast.error("Выберите запуск для экспорта");
      return;
    }

    try {
      // Collect unique script IDs to fetch commands once
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

      const safeName = String(project?.name || "project")
        .replace(/[\\/:*?"<>|]+/g, "_")
        .slice(0, 80);
      const filename = `terminal-export_${safeName}_${new Date().toISOString().slice(0, 10)}.md`;

      const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e?.message || "Не удалось экспортировать вывод терминала");
    }
  }, [groupedExecutions, hosts, project?.name, selectedSession]);

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
                onClick={handleExportTerminalMd}
                disabled={!selectedSession}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Экспорт вывода терминала</span>
              </Button>
              <Button
                onClick={handleExportToExcel}
                disabled={!selectedSession}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Экспорт в Excel</span>
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
    </div>
  );
}

