import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import { Label } from "@/components/ui/label";
import { ChevronLeft, CheckCircle, XCircle, Eye, Download, BarChart3, X } from "lucide-react";
import { toast } from "sonner";
import { api } from '../config/api';


export default function ProjectResultsPage({ projectId, onNavigate }) {
  const [searchParams, setSearchParams] = useSearchParams(); // ← Добавьте этот хук
  const [project, setProject] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [executions, setExecutions] = useState([]);
  const [groupedExecutions, setGroupedExecutions] = useState({});
  const [selectedExecution, setSelectedExecution] = useState(null);
  const [hosts, setHosts] = useState({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonMode, setComparisonMode] = useState("last2");  
  

  useEffect(() => {
    fetchProjectAndSessions();
  }, [projectId]);

  useEffect(() => {
    if (selectedSession) {
      fetchSessionExecutions(selectedSession);
    }
  }, [selectedSession]);

  const handleBack = () => {
    const returnTo = searchParams.get('returnTo');
    
    if (returnTo === 'scheduler') {
      navigate('/scheduler');
    } else {
      navigate('/');
    }
  };

  const getComparisonSessions = () => {
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
  };  

  // эффект для обработки параметра URL
  useEffect(() => {
    const sessionFromUrl = searchParams.get('session');
    if (sessionFromUrl && sessions.length > 0) {
      // Проверяем что сессия существует в списке
      const sessionExists = sessions.some(session => session.session_id === sessionFromUrl);
      if (sessionExists) {
        setSelectedSession(sessionFromUrl);
      }
    }
  }, [sessions, searchParams]);  

  const fetchProjectAndSessions = async () => {
    try {
      setLoading(true);
      const [projectRes, sessionsRes, hostsRes] = await Promise.all([
        api.get(`/api/projects/${projectId}`),
        api.get(`/api/projects/${projectId}/sessions`),
        api.get(`/api/hosts`),
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
      const response = await api.get(
        `/api/projects/${projectId}/sessions/${sessionId}/executions`
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
      const response = await api.get(
        `/api/projects/${projectId}/sessions/${selectedSession}/export-excel`,
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

  // Обновите функцию изменения сессии чтобы обновлять URL
  const handleSessionChange = (sessionId) => {
    setSelectedSession(sessionId);
    // Обновляем параметр URL
    if (sessionId) {
      searchParams.set('session', sessionId);
      setSearchParams(searchParams);
    } else {
      searchParams.delete('session');
      setSearchParams(searchParams);
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
          <CardHeader>
            <CardTitle>Выбор запуска</CardTitle>
            <CardDescription>Просмотр результатов конкретного запуска проекта</CardDescription>
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
                        {formatDate(session.executed_at)} 
                        {' - '}
                        Проверок - Пройдено: {session.passed_count}/{session.total_checks}. Не пройдено: {session.failed_count}/{session.total_checks}. Ошибок: {session.error_count}/{session.total_checks}; Требует участия оператора: {session.operator_count}/{session.total_checks}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleExportToExcel}
                disabled={!selectedSession}
                variant="yellow"
              >
                <Download className="mr-2 h-4 w-4" />
                Экспорт в Excel
              </Button>
              <Button
                onClick={() => setShowComparison(!showComparison)}
                variant={showComparison ? "default" : "outline"}
              >
                <BarChart3 className="mr-2 h-4 w-4" />
                Сравнение запусков
              </Button>
            </div>

            {/* Модальное окно сравнения */}
            {showComparison && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
                  {/* Крестик закрытия над формой */}
                  <div className="flex justify-end p-1">
                    <Button 
                      variant="ghost" 
                      onClick={() => setShowComparison(false)}
                      className="h-8 w-8 rounded-full bg-white border shadow-sm hover:bg-gray-50"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {/* Контент с вертикальным скроллом */}
                  <div className="flex-1 overflow-y-auto p-6">
                    <div className="mb-6" align="center">
                      <h3 className="text-lg font-semibold mb-2">Сравнение запусков проекта</h3>
                      <Select 
                        value={comparisonMode} 
                        onValueChange={(value) => setComparisonMode(value)}
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

                    {/* Гистограмма по статусам */}
                    <div className="space-y-3">
                      <h4 className="font-medium">Распределение по статусам</h4>
                      <div className="space-y-2">
                        {getComparisonSessions().map((session, index) => (
                          <div key={session.session_id} className="flex items-center gap-4 p-2 bg-gray-50 rounded">
                            {/* Дата слева */}
                            <div className="w-48 text-sm font-medium text-gray-700 whitespace-nowrap">
                              {formatDate(session.executed_at)}
                            </div>
                            
                            {/* График по центру */}
                            <div className="flex-1 min-w-0"> {/* Добавлено min-w-0 чтобы предотвратить переполнение */}
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
                            
                            {/* Общее количество справа */}
                            <div className="w-20 text-sm font-medium text-gray-700 text-right whitespace-nowrap">
                              {session.total_checks}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Легенда */}
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
            )}
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
