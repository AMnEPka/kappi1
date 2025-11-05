import React, { useState, useEffect, useRef } from 'react';
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { ChevronLeft, Play, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

export default function ProjectExecutionPage({ projectId, onNavigate }) {
  const [project, setProject] = useState(null);
  const [executing, setExecuting] = useState(false);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    failed: 0,
  });
  const eventSourceRef = useRef(null);
  const logsEndRef = useRef(null);

  useEffect(() => {
    fetchProject();
    return () => {
      // Cleanup SSE connection on unmount
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [projectId]);

  useEffect(() => {
    // Auto-scroll to bottom when new logs arrive
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const fetchProject = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/projects/${projectId}`);
      setProject(response.data);
      
      // If project is running, connect to SSE
      if (response.data.status === 'running') {
        startExecution(false);
      }
    } catch (error) {
      console.error('Error fetching project:', error);
      toast.error("Не удалось загрузить проект");
    }
  };

  const startExecution = async (shouldTrigger = true) => {
    try {
      setExecuting(true);
      setLogs([]);
      setStats({ total: 0, completed: 0, failed: 0 });

      // Connect to SSE for real-time updates (EventSource uses GET by default)
      // The backend endpoint will start execution when first connected
      const eventSource = new EventSource(`${API_URL}/api/projects/${projectId}/execute`);
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Add log entry
          setLogs(prev => [...prev, data]);

          // Update stats
          if (data.type === 'info') {
            const match = data.message.match(/Всего заданий: (\d+)/);
            if (match) {
              setStats(prev => ({ ...prev, total: parseInt(match[1]) }));
            }
          } else if (data.type === 'task_complete') {
            if (data.success) {
              setStats(prev => ({ ...prev, completed: prev.completed + 1 }));
            } else {
              setStats(prev => ({ ...prev, failed: prev.failed + 1 }));
            }
          } else if (data.type === 'complete') {
            setStats({
              total: data.total,
              completed: data.completed,
              failed: data.failed,
            });
            setExecuting(false);
            eventSource.close();
            
            // Refresh project status
            fetchProject();

            toast.success(
              data.status === 'completed' 
                ? `Выполнено успешно: ${data.completed}/${data.total}`
                : `Завершено с ошибками: ${data.completed}/${data.total}, ошибок: ${data.failed}`
            );
          } else if (data.type === 'error') {
            setExecuting(false);
            eventSource.close();
            toast.error(`Ошибка: ${data.message}`);
          }
        } catch (error) {
          console.error('Error parsing SSE data:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE error:', error);
        eventSource.close();
        setExecuting(false);
        
        if (logs.length === 0) {
          toast.error("Не удалось подключиться к серверу");
        }
      };

    } catch (error) {
      console.error('Error starting execution:', error);
      setExecuting(false);
      toast.error("Не удалось запустить выполнение");
    }
  };

  const getLogIcon = (type) => {
    switch (type) {
      case 'status':
      case 'info':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'task_start':
        return <Play className="h-4 w-4 text-blue-500" />;
      case 'check_network':
      case 'check_login':
      case 'check_sudo':
        return null; // Will be determined by success/failure in color
      case 'script_progress':
        return null; // No icon for progress
      case 'task_complete':
        return null;
      case 'task_error':
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'complete':
        return null;
      default:
        return null;
    }
  };

  const getLogMessage = (log) => {
    switch (log.type) {
      case 'status':
      case 'info':
      case 'error':
        return log.message;
      case 'task_start':
        return `\nХост ${log.host_name}`;
      case 'check_network':
        return log.message;
      case 'check_login':
        return log.message;
      case 'check_sudo':
        return log.message;
      case 'script_progress':
        return `Проверки проведены ${log.completed}/${log.total}`;
      case 'task_complete':
        return 'Проверки завершены';
      case 'task_error':
        return `Ошибка на хосте ${log.host_name}: ${log.error}`;
      case 'complete':
        const totalHosts = log.total;
        const successfulHosts = log.successful_hosts || log.completed;
        return `\nПроверки проведены успешно на ${successfulHosts} ${successfulHosts === 1 ? 'хосте' : 'хостах'} из ${totalHosts}`;
      default:
        return JSON.stringify(log);
    }
  };

  const getLogClassName = (log) => {
    switch (log.type) {
      case 'script_error':
      case 'task_error':
      case 'error':
        return 'text-red-400';
      case 'script_success':
        return 'text-green-400';
      case 'check_network':
      case 'check_login':
      case 'check_sudo':
        return log.success ? 'text-green-400' : 'text-red-400';
      case 'script_progress':
        return 'text-yellow-400';
      case 'task_start':
        return 'text-blue-400 font-bold text-lg';
      case 'complete':
        return 'text-blue-400 font-bold';
      default:
        return 'text-gray-300';
    }
  };

  if (!project) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        </div>
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
        {!executing && (
          <Button onClick={() => startExecution(true)} size="lg">
            <Play className="mr-2 h-4 w-4" />
            Запустить проект
          </Button>
        )}
      </div>

      {/* Stats */}
      {stats.total > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold">{stats.total}</p>
                <p className="text-gray-600">Всего заданий</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-green-600">{stats.completed}</p>
                <p className="text-gray-600">Выполнено</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-red-600">{stats.failed}</p>
                <p className="text-gray-600">Ошибок</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Журнал выполнения</CardTitle>
          <CardDescription>
            {executing ? 'Выполнение в реальном времени...' : 'История выполнения'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-900 text-gray-100 p-4 rounded-lg h-96 overflow-y-auto font-mono text-sm">
            {logs.length === 0 && !executing ? (
              <p className="text-gray-400">
                Журнал пуст. Нажмите "Запустить проект" для начала выполнения.
              </p>
            ) : (
              <div className="space-y-1">
                {logs.map((log, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <span className="flex-shrink-0 mt-0.5">{getLogIcon(log.type)}</span>
                    <span className={getLogClassName(log)}>
                      {getLogMessage(log)}
                    </span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {!executing && logs.length > 0 && (
        <div className="mt-6 text-center">
          <Button onClick={() => onNavigate('project-results', projectId)} size="lg">
            Просмотр результатов
          </Button>
        </div>
      )}
    </div>
  );
}
