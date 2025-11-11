import React, { useState, useEffect } from 'react';
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { ChevronLeft, CheckCircle, XCircle, Eye, Download } from "lucide-react";
import { toast } from "sonner";
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

export default function ProjectResultsPage({ projectId, onNavigate }) {
  const [project, setProject] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [executions, setExecutions] = useState([]);
  const [groupedExecutions, setGroupedExecutions] = useState({});
  const [selectedExecution, setSelectedExecution] = useState(null);
  const [hosts, setHosts] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjectAndSessions();
  }, [projectId]);

  useEffect(() => {
    if (selectedSession) {
      fetchSessionExecutions(selectedSession);
    }
  }, [selectedSession]);

  const fetchProjectAndSessions = async () => {
    try {
      setLoading(true);
      const [projectRes, sessionsRes, hostsRes] = await Promise.all([
        axios.get(`${API_URL}/api/projects/${projectId}`),
        axios.get(`${API_URL}/api/projects/${projectId}/sessions`),
        axios.get(`${API_URL}/api/hosts`),
      ]);

      setProject(projectRes.data);
      setSessions(sessionsRes.data);
      
      // Create hosts map
      const hostsMap = {};
      hostsRes.data.forEach(host => {
        hostsMap[host.id] = host;
      });
      setHosts(hostsMap);
      
      // Auto-select latest session
      if (sessionsRes.data.length > 0) {
        setSelectedSession(sessionsRes.data[0].session_id);
      }

    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error("Не удалось загрузить проект");
    } finally {
      setLoading(false);
    }
  };

  const fetchSessionExecutions = async (sessionId) => {
    try {
      const response = await axios.get(
        `${API_URL}/api/projects/${projectId}/sessions/${sessionId}/executions`
      );
      
      setExecutions(response.data);

      // Group executions by host
      const grouped = {};
      response.data.forEach(exec => {
        if (!grouped[exec.host_id]) {
          grouped[exec.host_id] = [];
        }
        grouped[exec.host_id].push(exec);
      });
      setGroupedExecutions(grouped);

    } catch (error) {
      console.error('Error fetching session executions:', error);
      toast.error("Не удалось загрузить результаты сессии");
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('ru-RU');
  };

  const getHostName = (hostId) => {
    const host = hosts[hostId];
    if (host) {
      return `${host.name} (${host.hostname})`;
    }
    return `Host ${hostId.substring(0, 8)}`;
  };

  const getHostStats = (hostId) => {
    const hostExecutions = groupedExecutions[hostId] || [];
    const total = hostExecutions.length;
    const passed = hostExecutions.filter(e => e.check_status === 'Пройдена').length;
    const failed = hostExecutions.filter(e => e.check_status === 'Не пройдена').length;
    const error = hostExecutions.filter(e => e.check_status === 'Ошибка' || (!e.check_status && !e.success)).length;
    const operator = hostExecutions.filter(e => e.check_status === 'Оператор').length;
    return { total, passed, failed, error, operator };
  };

  const handleExportToExcel = async () => {
    if (!selectedSession) {
      toast.error("Выберите сессию для экспорта");
      return;
    }

    try {
      const response = await axios.get(
        `${API_URL}/api/projects/${projectId}/sessions/${selectedSession}/export-excel`,
        {
          responseType: 'blob',
        }
      );

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Протокол_${project.name}_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Excel файл успешно экспортирован");
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast.error("Не удалось экспортировать в Excel");
    }
  };

  // Get badge by check status with colors
  const getCheckStatusBadge = (execution) => {
    const status = execution.check_status;
    
    // Check explicit statuses first before fallback
    if (status === 'Пройдена') {
      return <Badge className="bg-green-500 hover:bg-green-600">Пройдена</Badge>;
    } else if (status === 'Не пройдена') {
      return <Badge className="bg-yellow-500 hover:bg-yellow-600">Не пройдена</Badge>;
    } else if (status === 'Оператор') {
      return <Badge className="bg-blue-500 hover:bg-blue-600">Оператор</Badge>;
    } else if (status === 'Ошибка') {
      return <Badge className="bg-red-500 hover:bg-red-600">Ошибка</Badge>;
    } else {
      // Fallback for undefined status
      return <Badge className="bg-red-500 hover:bg-red-600">Ошибка</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-500">Загрузка...</div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-gray-500">Проект не найден</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" onClick={() => onNavigate('projects')}>
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
          <CardHeader>
            <CardTitle>Выбор запуска</CardTitle>
            <CardDescription>Просмотр результатов конкретного запуска проекта</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedSession} onValueChange={setSelectedSession}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Выберите запуск" />
              </SelectTrigger>
              <SelectContent>
                {sessions.map((session, index) => (
                  <SelectItem key={session.session_id} value={session.session_id}>
                    {index === 0 ? '🆕 ' : ''}
                    {formatDate(session.executed_at)} 
                    {' - '}
                    Проверок - Пройдено: {session.passed_count}/{session.total_checks}. Не пройдено: {session.failed_count}/{session.total_checks}. Ошибок: {session.error_count}/{session.total_checks}; Требует участия оператора: {session.operator_count}/{session.total_checks}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              {Object.keys(groupedExecutions).map((hostId) => {
                const stats = getHostStats(hostId);
                const hostExecutions = groupedExecutions[hostId];

                return (
                  <Card key={hostId}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">{getHostName(hostId)}</CardTitle>
                          <CardDescription>
                            Всего проверок: {stats.total}
                          </CardDescription>
                        </div>
                        <div className="flex gap-3">
                          <span className="text-green-600 flex items-center gap-1" title="Пройдена">
                            <CheckCircle className="h-4 w-4" />
                            {stats.passed}
                          </span>
                          <span className="text-yellow-600 flex items-center gap-1" title="Не пройдена">
                            <XCircle className="h-4 w-4" />
                            {stats.failed}
                          </span>
                          <span className="text-red-600 flex items-center gap-1" title="Ошибка">
                            <XCircle className="h-4 w-4" />
                            {stats.error}
                          </span>
                          <span className="text-blue-600 flex items-center gap-1" title="Требует участия оператора">
                            <CheckCircle className="h-4 w-4" />
                            {stats.operator}
                          </span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {hostExecutions.map((execution) => (
                          <div
                            key={execution.id}
                            className="flex items-center justify-between p-3 border rounded hover:bg-gray-50"
                          >
                            <div className="flex items-center gap-3">
                              <div>
                                <p className="font-medium">{execution.script_name}</p>
                                <p className="text-xs text-gray-500">
                                  {formatDate(execution.executed_at)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {getCheckStatusBadge(execution)}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedExecution(execution)}
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                Детали
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Execution Details Dialog */}
      <Dialog open={!!selectedExecution} onOpenChange={() => setSelectedExecution(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedExecution?.script_name}
            </DialogTitle>
            <DialogDescription>
              Выполнено: {formatDate(selectedExecution?.executed_at)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <h3 className="font-bold mb-2">Статус:</h3>
              {selectedExecution && getCheckStatusBadge(selectedExecution)}
            </div>

            {selectedExecution?.output && (
              <div>
                <h3 className="font-bold mb-2">Вывод:</h3>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                  {selectedExecution.output}
                </pre>
              </div>
            )}

            {selectedExecution?.error && (
              <div>
                <h3 className="font-bold mb-2 text-red-600">Ошибка:</h3>
                <pre className="bg-red-50 text-red-900 p-4 rounded-lg overflow-x-auto text-sm border border-red-200">
                  {selectedExecution.error}
                </pre>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
