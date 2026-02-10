import React, { useState, useEffect, useRef } from 'react';
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { ChevronLeft, Play, CheckCircle, XCircle, Loader2, Users, CircleCheck } from "lucide-react";
import { toast } from "sonner";
import { api, getAccessToken } from '../config/api';
import { ERROR_CODES, getErrorDescription, extractErrorCode } from '../config/errorcodes';

const fallbackExtractErrorCode = (output) => {
  if (!output) return null;
  const text = String(output);
  const exitMatch = text.match(/exit code:?\s*(\d+)/i);
  if (exitMatch?.[1]) return Number(exitMatch[1]);
  const lines = text.trim().split('\n');
  const lastLine = (lines[lines.length - 1] || '').trim();
  if (/^\d+$/.test(lastLine)) return Number(lastLine);
  return null;
};

const safeExtractErrorCode =
  typeof extractErrorCode === 'function' ? extractErrorCode : fallbackExtractErrorCode;

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
  
  // Состояние для отслеживания завершения начальных статусов
  const [statusDone, setStatusDone] = useState(false);
  const [infoDone, setInfoDone] = useState(false);

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
      const [projectRes, tasksRes, hostsRes, systemsRes, usersRes] = await Promise.all([
        api.get(`/api/projects/${projectId}`),          
        api.get(`/api/projects/${projectId}/tasks`),      
        api.get('/api/hosts'),                          
        api.get('/api/systems'),                        
        api.get(`/api/projects/${projectId}/users`)
      ]);
      
      setProject(projectRes.data);
      setTasks(tasksRes.data);
      setHosts(hostsRes.data);
      setSystems(systemsRes.data);
      setProjectUsers(Array.isArray(usersRes.data) ? usersRes.data : []);

      // Load scripts per system type from project tasks so each system (e.g. Linux and Windows) gets its full list of checks (avoids 1000 limit showing only first system's scripts)
      const systemIds = [...new Set((tasksRes.data || []).map(t => t.system_id).filter(Boolean))];
      let scriptsData = [];
      if (systemIds.length > 0) {
        const scriptResponses = await Promise.all(
          systemIds.map(sid => api.get('/api/scripts', { params: { system_id: sid } }))
        );
        scriptsData = scriptResponses.flatMap(r => r.data || []);
      } else {
        const scriptsRes = await api.get('/api/scripts');
        scriptsData = scriptsRes.data || [];
      }
      setScripts(scriptsData);
      
      const tasksMap = {};
      (tasksRes.data || []).forEach(task => {
        tasksMap[task.id] = {
          ...task,
          script_ids: [...(task.script_ids || [])],
          reference_data: { ...(task.reference_data || {}) }
        };
      });
      setEditedTasks(tasksMap);
      
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
      // Update each modified task (include system_id if changed)
      const updates = Object.values(editedTasks).map(task => {
        const payload = {
          script_ids: task.script_ids,
          reference_data: task.reference_data
        };
        // Find original task to check if system_id changed
        const originalTask = tasks.find(t => t.id === task.id);
        if (originalTask && task.system_id !== originalTask.system_id) {
          payload.system_id = task.system_id;
        }
        return api.put(`/api/projects/${projectId}/tasks/${task.id}`, payload);
      });
      
      await Promise.all(updates);
      
      // Full reload to pick up new system's scripts
      await fetchProject();
      
      setEditMode(false);
      toast.success("Изменения сохранены");
    } catch (error) {
      console.error('Error saving changes:', error);
      toast.error("Не удалось сохранить изменения");
    }
  };

  const changeTaskSystem = async (taskId, newSystemId) => {
    // Check if we already have scripts for this system loaded
    const existingScripts = scripts.filter(s => s.system_id === newSystemId);
    
    let newSystemScripts = existingScripts;
    if (existingScripts.length === 0) {
      // Load scripts for the new system
      try {
        const res = await api.get('/api/scripts', { params: { system_id: newSystemId } });
        const loadedScripts = res.data || [];
        newSystemScripts = loadedScripts;
        // Merge into scripts state (avoid duplicates)
        setScripts(prev => {
          const existingIds = new Set(prev.map(s => s.id));
          const newOnes = loadedScripts.filter(s => !existingIds.has(s.id));
          return [...prev, ...newOnes];
        });
      } catch (err) {
        console.error('Error loading scripts for system:', err);
        toast.error("Не удалось загрузить скрипты для выбранной системы");
        return;
      }
    }
    
    // Reset script_ids to all scripts of the new system, clear reference_data
    setEditedTasks(prev => ({
      ...prev,
      [taskId]: {
        ...prev[taskId],
        system_id: newSystemId,
        script_ids: newSystemScripts.map(s => s.id),
        reference_data: {}
      }
    }));
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
    console.log('=== startExecution called ===');
    console.log('projectId:', projectId);
    console.log('shouldTrigger:', shouldTrigger);
    
    try {
      setExecuting(true);
      setLogs([]);
      setStats({ total: 0, completed: 0, failed: 0 });
      // Сбрасываем состояния галочек при новом запуске
      setStatusDone(false);
      setInfoDone(false);

      // Connect to SSE for real-time updates (EventSource uses GET by default)
      // The backend endpoint will start execution when first connected
      // EventSource doesn't support custom headers, so token must be in URL
      const token = getAccessToken();
      if (!token) {
        console.error('No token available!');
        toast.error("Токен авторизации не найден. Пожалуйста, войдите снова.");
        setExecuting(false);
        return;
      }
      
      // Build absolute URL based on current window location to avoid issues with <base> tag
      // This ensures EventSource uses the correct origin
      const protocol = window.location.protocol;
      const host = window.location.host;
      const executeUrl = `${protocol}//${host}/api/projects/${projectId}/execute?token=${token}`;
      
      console.log('=== EventSource Configuration ===');
      console.log('Creating EventSource with URL:', executeUrl);
      console.log('Token present:', !!token);
      console.log('Token length:', token ? token.length : 0);
      console.log('Current window location:', window.location.href);
      console.log('Protocol:', protocol, 'Host:', host);
      
      const eventSource = new EventSource(executeUrl);
      eventSourceRef.current = eventSource;
      
      console.log('EventSource created successfully');
      console.log('EventSource readyState:', eventSource.readyState);
      console.log('EventSource URL:', eventSource.url);
      console.log('EventSource withCredentials:', eventSource.withCredentials);

      // Log when connection opens
      eventSource.onopen = (event) => {
        console.log('✅ EventSource connection opened!', event);
        console.log('EventSource readyState:', eventSource.readyState);
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Add log entry - but replace previous progress if new progress comes
          setLogs(prev => {
            // Skip task_error if we already showed check_network/check_login/check_sudo error for this host
            if (data.type === 'task_error') {
              // Check if there was a check error for this host recently
              const hasCheckError = prev.some(log => 
                log.host_name === data.host_name &&
                (
                  (log.type === 'check_network' && !log.success) ||
                  (log.type === 'check_login' && !log.success) ||
                  (log.type === 'check_sudo' && !log.success)
                )
              );
              if (hasCheckError) {
                // Skip this task_error as it's a duplicate of the check error
                return prev;
              }
            }
            
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

          // Обработка завершения начальных статусов
          if (data.type === 'status') {
            // Сохраняем сообщение статуса
          } else if (data.type === 'info') {
            // Сохраняем сообщение информации
          }
          
          // Когда начинается первое задание, ставим галочки
          if (data.type === 'task_start' || data.type === 'check_network') {
            if (!statusDone) setStatusDone(true);
            if (!infoDone) setInfoDone(true);
          }
          
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
            
            // Устанавливаем галочки при полном завершении
            setStatusDone(true);
            setInfoDone(true);
            
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
            // При ошибке тоже ставим галочки
            setStatusDone(true);
            setInfoDone(true);
            toast.error(`Ошибка: ${data.message}`);
          }
        } catch (error) {
          console.error('Error parsing SSE data:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('EventSource error:', error);
        console.error('EventSource readyState:', eventSource.readyState);
        console.error('EventSource URL:', executeUrl);
        
        // EventSource.readyState: 0 = CONNECTING, 1 = OPEN, 2 = CLOSED
        if (eventSource.readyState === EventSource.CLOSED) {
          console.error('EventSource connection closed');
        } else if (eventSource.readyState === EventSource.CONNECTING) {
          console.error('EventSource still connecting - connection may have failed');
        }
        
        eventSource.close();
        setExecuting(false);
        // При ошибке соединения ставим галочки
        setStatusDone(true);
        setInfoDone(true);
        
        if (logs.length === 0) {
          toast.error("Не удалось подключиться к серверу");
          console.error('No logs received, connection failed immediately');
                    
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
      // При ошибке запуска ставим галочки
      setStatusDone(true);
      setInfoDone(true);
      toast.error("Не удалось запустить выполнение");
    }
  };

  const getLogIcon = (type) => {
    switch (type) {
      case 'status':
      case 'info':
        // Используем кружок для начальных статусов и галочку при завершении
        if ((type === 'status' && statusDone) || (type === 'info' && infoDone)) {
          return <CheckCircle className="h-4 w-4 text-green-500" />;
        }
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
    // Helper to format error info from backend
    const formatErrorInfo = (errorInfo) => {
      if (!errorInfo) return '';
      return `\n  → [${errorInfo.category}] ${errorInfo.error}: ${errorInfo.description}`;
    };
    
    switch (log.type) {
      case 'status':
        return log.message;
      case 'info':
        return log.message;
      case 'error':
        // Попробуем извлечь информацию об ошибке
        const errorCode = safeExtractErrorCode(log.message);
        if (errorCode && ERROR_CODES[errorCode]) {
          const errorInfo = getErrorDescription(errorCode);
          return `${log.message}\n  → [${errorInfo.category}] ${errorInfo.error}: ${errorInfo.description}`;
        }
        return log.message;
      case 'task_error':
        // Используем error_info от бэкенда если есть
        if (log.error_info) {
          return `Ошибка на хосте ${log.host_name}: ${log.error}${formatErrorInfo(log.error_info)}`;
        }
        // Fallback на извлечение кода из текста ошибки
        const taskErrorCode = safeExtractErrorCode(log.error);
        if (taskErrorCode && ERROR_CODES[taskErrorCode]) {
          const taskErrorInfo = getErrorDescription(taskErrorCode);
          return `Ошибка на хосте ${log.host_name}: ${log.error}\n  → [${taskErrorInfo.category}] ${taskErrorInfo.error}: ${taskErrorInfo.description}`;
        }
        return `Ошибка на хосте ${log.host_name}: ${log.error}`;      
      case 'task_start':
        return `\nХост ${log.host_name}`;
      case 'check_network':
        if (!log.success && log.error_info) {
          return `${log.message}${formatErrorInfo(log.error_info)}`;
        }
        return log.message;
      case 'check_login':
        if (!log.success && log.error_info) {
          return `${log.message}${formatErrorInfo(log.error_info)}`;
        }
        return log.message;
      case 'check_sudo':
        if (!log.success && log.error_info) {
          return `${log.message}${formatErrorInfo(log.error_info)}`;
        }
        return log.message;
      case 'script_progress':
        return `Проверки проведены ${log.completed}/${log.total}`;
      case 'task_complete':
        return 'Проверки завершены';
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

  // Функция для определения, какой компонент отображать в журнале
  const getStatusIconComponent = (type) => {
    if (type === 'status') {
      return statusDone ? (
        <CheckCircle className="h-4 w-4 text-green-500" />
      ) : (
        <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
      );
    } else if (type === 'info') {
      return infoDone ? (
        <CheckCircle className="h-4 w-4 text-green-500" />
      ) : (
        <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
      );
    }
    return getLogIcon(type);
  };

  if (!project) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
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
                const editedTask = editedTasks[task.id] || task;
                const activeSystemId = editedTask.system_id || task.system_id;
                const system = systems.find(s => s.id === activeSystemId);
                const systemScripts = scripts.filter(s => s.system_id === activeSystemId);

                // Filter available systems by host connection type
                const availableSystems = systems.filter(s => {
                  if (host?.connection_type === 'winrm') return s.os_type === 'windows';
                  if (host?.connection_type === 'ssh') return s.os_type === 'linux';
                  return true;
                });
                
                return (
                  <div key={task.id} className="border rounded-lg p-4">
                    {editMode ? (
                      <div className="mb-3">
                        <div className="font-semibold text-lg mb-1">
                          {host?.name || 'Неизвестный хост'}
                        </div>
                        <div className="text-sm text-gray-600 mb-2">{host?.hostname}</div>
                        <Select
                          value={activeSystemId}
                          onValueChange={(value) => changeTaskSystem(task.id, value)}
                        >
                          <SelectTrigger className="w-full max-w-xs">
                            <SelectValue placeholder="Выберите систему" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableSystems.map(s => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.name} ({s.os_type === 'windows' ? 'Windows' : 'Linux'})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <>
                        <div className="font-semibold text-lg mb-2">
                          {host?.name || 'Неизвестный хост'} - {system?.name || 'Неизвестная система'}
                        </div>
                        <div className="text-sm text-gray-600 mb-3">
                          {host?.hostname}
                        </div>
                      </>
                    )}
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
                    <span className="flex-shrink-0 mt-0.5">
                      {getStatusIconComponent(log.type)}
                    </span>
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