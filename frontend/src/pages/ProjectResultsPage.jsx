import React, { useState, useEffect } from 'react';
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { ChevronLeft, CheckCircle, XCircle, Eye } from "lucide-react";
import { useToast } from "../hooks/use-toast";
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

export default function ProjectResultsPage({ projectId, onNavigate }) {
  const [project, setProject] = useState(null);
  const [executions, setExecutions] = useState([]);
  const [groupedExecutions, setGroupedExecutions] = useState({});
  const [selectedExecution, setSelectedExecution] = useState(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [projectRes, executionsRes] = await Promise.all([
        axios.get(`${API_URL}/api/projects/${projectId}`),
        axios.get(`${API_URL}/api/projects/${projectId}/executions`),
      ]);

      setProject(projectRes.data);
      setExecutions(executionsRes.data);

      // Group executions by host
      const grouped = {};
      executionsRes.data.forEach(exec => {
        if (!grouped[exec.host_id]) {
          grouped[exec.host_id] = [];
        }
        grouped[exec.host_id].push(exec);
      });
      setGroupedExecutions(grouped);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить результаты",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('ru-RU');
  };

  const getHostName = (hostId) => {
    const firstExec = executions.find(e => e.host_id === hostId);
    return firstExec ? `Host ${hostId.substring(0, 8)}` : hostId;
  };

  const getHostStats = (hostId) => {
    const hostExecutions = groupedExecutions[hostId] || [];
    const total = hostExecutions.length;
    const successful = hostExecutions.filter(e => e.success).length;
    const failed = total - successful;
    return { total, successful, failed };
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

      {/* Overall Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold">{Object.keys(groupedExecutions).length}</p>
              <p className="text-gray-600 text-sm">Хостов</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold">{executions.length}</p>
              <p className="text-gray-600 text-sm">Всего выполнений</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                {executions.filter(e => e.success).length}
              </p>
              <p className="text-gray-600 text-sm">Успешно</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">
                {executions.filter(e => !e.success).length}
              </p>
              <p className="text-gray-600 text-sm">Ошибок</p>
            </div>
          </CardContent>
        </Card>
      </div>

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
                            Выполнено: {stats.successful}/{stats.total} скриптов
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-green-600 flex items-center gap-1">
                            <CheckCircle className="h-4 w-4" />
                            {stats.successful}
                          </span>
                          <span className="text-red-600 flex items-center gap-1">
                            <XCircle className="h-4 w-4" />
                            {stats.failed}
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
                              {execution.success ? (
                                <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                              ) : (
                                <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                              )}
                              <div>
                                <p className="font-medium">{execution.script_name}</p>
                                <p className="text-xs text-gray-500">
                                  {formatDate(execution.executed_at)}
                                </p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedExecution(execution)}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              Детали
                            </Button>
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
              {selectedExecution?.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              {selectedExecution?.script_name}
            </DialogTitle>
            <DialogDescription>
              Выполнено: {formatDate(selectedExecution?.executed_at)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <h3 className="font-bold mb-2">Статус:</h3>
              <p className={selectedExecution?.success ? 'text-green-600' : 'text-red-600'}>
                {selectedExecution?.success ? 'Успешно' : 'Ошибка'}
              </p>
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
