import React, { useState, useEffect, useRef } from 'react';
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import { ChevronLeft, Play, CheckCircle, XCircle, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { api } from '../config/api';

export default function ProjectExecutionPage({ projectId, onNavigate }) {
  const [project, setProject] = useState(null);
  const [executing, setExecuting] = useState(false);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    failed: 0,
  });
  const [tasks, setTasks] = useState([]);
  const [hosts, setHosts] = useState([]);
  const [systems, setSystems] = useState([]);
  const [scripts, setScripts] = useState([]);
  const [projectUsers, setProjectUsers] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const [editedTasks, setEditedTasks] = useState({});
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
			const [projectRes, tasksRes, hostsRes, systemsRes, scriptsRes, usersRes] = await Promise.all([
				api.get(`/api/projects/${projectId}`),          
				api.get(`/api/projects/${projectId}/tasks`),      
				api.get('/api/hosts'),                          
				api.get('/api/systems'),                        
				api.get('/api/scripts'),                         
				api.get(`/api/projects/${projectId}/users`)
			]);
      
      setProject(projectRes.data);
      setTasks(tasksRes.data);
      setHosts(hostsRes.data);
      setSystems(systemsRes.data);
      setScripts(scriptsRes.data);
      setProjectUsers(usersRes.data);
      
      // Initialize edited tasks
      const tasksMap = {};
      tasksRes.data.forEach(task => {
        tasksMap[task.id] = {
          ...task,
          script_ids: [...task.script_ids],
          reference_data: { ...(task.reference_data || {}) }
        };
      });
      setEditedTasks(tasksMap);
      
      // If project is running, connect to SSE
      if (projectRes.data.status === 'running') {
        startExecution(false);
      }
    } catch (error) {
      console.error('Error fetching project:', error);
      toast.error("Не удалось загрузить проект");
    }
  };

  const saveTaskChanges = async () => {
    try {
      // Update each modified task
      const updates = Object.values(editedTasks).map(task => 
        api.put(`/api/projects/${projectId}/tasks/${task.id}`, {
          script_ids: task.script_ids,
          reference_data: task.reference_data
        })
      );
      
      await Promise.all(updates);
      
      // Refresh tasks
      const tasksRes = await api.get(`/api/projects/${projectId}/tasks`);
      setTasks(tasksRes.data);
      
      setEditMode(false);
      toast.success("Изменения сохранены");
    } catch (error) {
      console.error('Error saving changes:', error);
      toast.error("Не удалось сохранить изменения");
    }
  };

  const toggleScript = (taskId, scriptId) => {
    setEditedTasks(prev => {
      const task = prev[taskId];
      const scriptIds = [...task.script_ids];
      const index = scriptIds.indexOf(scriptId);
      
      if (index > -1) {
        scriptIds.splice(index, 1);
      } else {
        scriptIds.push(scriptId);
      }
      
      return {
        ...prev,
        [taskId]: {
          ...task,
          script_ids: scriptIds
        }
      };
    });
  };

  const startExecution = async (shouldTrigger = true) => {
    try {
      setExecuting(true);
      setLogs([]);
      setStats({ total: 0, completed: 0, failed: 0 });

      // Connect to SSE for real-time updates (EventSource uses GET by default)
      // The backend endpoint will start execution when first connected
      const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
      const token = localStorage.getItem('token');
      const eventSource = new EventSource(`${backendUrl}/api/projects/${projectId}/execute?token=${token}`);
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Add log entry - but replace previous progress if new progress comes
          setLogs(prev => {
            if (data.type === 'script_progress') {
              // Replace last progress entry if it exists
              const lastIndex = prev.length - 1;
              if (lastIndex >= 0 && prev[lastIndex].type === 'script_progress' && 
                  prev[lastIndex].host_name === data.host_name) {
                return [...prev.slice(0, lastIndex), data];
              }
            }
            return [...prev, data];
          });

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
        eventSource.close();
        setExecuting(false);
        
        if (logs.length === 0) {
          toast.error("Не удалось подключиться к серверу");
                    
          // Используем api вместо fetch
          api.get(`/api/projects/${projectId}/execution-failed`)
            .catch(logError => {
              console.error('Failed to log execution failure:', logError);
            });
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
      case 'task_error':
      case 'error':
        return 'text-red-400';
      case 'check_network':
      case 'check_login':
      case 'check_sudo':
        return log.success ? 'text-green-400' : 'text-red-400';
      case 'script_progress':
        return 'text-yellow-400';
      case 'task_start':
        return 'text-blue-400 font-bold text-lg';
      case 'task_complete':
        return 'text-green-400';
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

      {/* Users with access */}
      {projectUsers.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center text-base">
              <Users className="mr-2 h-4 w-4" />
              Пользователи с доступом ({projectUsers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {projectUsers.map(user => (
                <Badge key={user.id} variant="secondary" className="px-3 py-1">
                  {user.full_name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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

      {/* Task Configuration */}
      {!executing && (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Конфигурация проверок</CardTitle>
                <CardDescription>
                  {editMode ? 'Выберите проверки для выполнения' : 'Проверки, которые будут выполнены'}
                </CardDescription>
              </div>
              <Button 
                variant={editMode ? "default" : "outline"} 
                onClick={() => {
                  if (editMode) {
                    saveTaskChanges();
                  } else {
                    setEditMode(true);
                  }
                }}
              >
                {editMode ? 'Сохранить изменения' : 'Редактировать'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {tasks.map(task => {
                const host = hosts.find(h => h.id === task.host_id);
                const system = systems.find(s => s.id === task.system_id);
                const systemScripts = scripts.filter(s => s.system_id === task.system_id);
                const editedTask = editedTasks[task.id] || task;
                
                return (
                  <div key={task.id} className="border rounded-lg p-4">
                    <div className="font-semibold text-lg mb-2">
                      {host?.name || 'Неизвестный хост'} - {system?.name || 'Неизвестная система'}
                    </div>
                    <div className="text-sm text-gray-600 mb-3">
                      {host?.hostname}
                    </div>
                    <div className="space-y-2">
                      {systemScripts.map(script => {
                        const isSelected = editedTask.script_ids.includes(script.id);
                        const hasReferenceFiles = script.has_reference_files;
                        const referenceData = editedTask.reference_data?.[script.id] || '';
                        
                        return (
                          <div key={script.id} className="space-y-2">
                            <div className="flex items-center gap-2">
                              <input 
                                type="checkbox"
                                id={`${task.id}-${script.id}`}
                                checked={isSelected}
                                disabled={!editMode}
                                onChange={() => toggleScript(task.id, script.id)}
                                className="h-4 w-4 rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
                              />
                              <label 
                                htmlFor={`${task.id}-${script.id}`}
                                className={`flex-1 ${editMode ? 'cursor-pointer' : ''} ${!isSelected && editMode ? 'text-gray-400' : ''}`}
                              >
                                {script.name}
                                {hasReferenceFiles && <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">Эталонные данные</span>}
                              </label>
                            </div>
                            {hasReferenceFiles && isSelected && editMode && (
                              <Textarea
                                placeholder="Введите эталонные данные..."
                                value={referenceData}
                                onChange={(e) => {
                                  setEditedTasks(prev => ({
                                    ...prev,
                                    [task.id]: {
                                      ...prev[task.id],
                                      reference_data: {
                                        ...prev[task.id].reference_data,
                                        [script.id]: e.target.value
                                      }
                                    }
                                  }));
                                }}
                                rows={8}
                                className="ml-6 font-mono text-sm"
                              />
                            )}
                            {hasReferenceFiles && isSelected && !editMode && referenceData && (
                              <div className="ml-6 p-2 bg-gray-50 rounded text-sm font-mono whitespace-pre-wrap">
                                {referenceData}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            {editMode && (
              <div className="mt-4 flex gap-2">
                <Button variant="outline" onClick={() => {
                  // Reset changes
                  const tasksMap = {};
                  tasks.forEach(task => {
                    tasksMap[task.id] = {
                      ...task,
                      script_ids: [...task.script_ids]
                    };
                  });
                  setEditedTasks(tasksMap);
                  setEditMode(false);
                }}>
                  Отмена
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
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
