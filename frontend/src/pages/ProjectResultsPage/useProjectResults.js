import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, getAccessToken } from '@/config/api';
import { toast } from 'sonner';
import { ERROR_CODES, getErrorDescription, extractErrorCode } from '@/config/errorcodes';

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

export const useProjectResults = (projectId) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [project, setProject] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [executions, setExecutions] = useState([]);
  const [groupedExecutions, setGroupedExecutions] = useState({});
  const [hosts, setHosts] = useState({});
  const [loading, setLoading] = useState(true);

  // Fetch project and sessions
  const fetchProjectAndSessions = useCallback(async () => {
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
  }, [projectId]);

  // Fetch session executions
  const fetchSessionExecutions = useCallback(async (sessionId) => {
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
  }, [projectId]);

  // Initial load
  useEffect(() => {
    fetchProjectAndSessions();
  }, [fetchProjectAndSessions]);

  // Load session executions when session changes
  useEffect(() => {
    if (selectedSession) {
      fetchSessionExecutions(selectedSession);
    }
  }, [selectedSession, fetchSessionExecutions]);

  // Handle URL session parameter
  useEffect(() => {
    const sessionFromUrl = searchParams.get('session');
    if (sessionFromUrl && sessions.length > 0) {
      const sessionExists = sessions.some(s => s.session_id === sessionFromUrl);
      if (sessionExists) {
        setSelectedSession(sessionFromUrl);
      }
    }
  }, [sessions, searchParams]);

  // Handle session change
  const handleSessionChange = useCallback((sessionId) => {
    setSelectedSession(sessionId);
    if (sessionId) {
      searchParams.set('session', sessionId);
      setSearchParams(searchParams);
    } else {
      searchParams.delete('session');
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams]);

  // Helper functions
  const formatDate = useCallback((dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('ru-RU');
  }, []);

  const getHostName = useCallback((hostId) => {
    const host = hosts[hostId];
    if (host) {
      return `${host.name} (${host.hostname})`;
    }
    return `Host ${hostId.substring(0, 8)}`;
  }, [hosts]);

  const getHostStats = useCallback((hostId) => {
    const hostExecutions = groupedExecutions[hostId] || [];
    const total = hostExecutions.length;
    const passed = hostExecutions.filter(e => e.check_status === 'Пройдена').length;
    const failed = hostExecutions.filter(e => e.check_status === 'Не пройдена').length;
    const error = hostExecutions.filter(e => e.check_status === 'Ошибка' || (!e.check_status && !e.success)).length;
    const operator = hostExecutions.filter(e => e.check_status === 'Оператор').length;
    return { total, passed, failed, error, operator };
  }, [groupedExecutions]);

  const getErrorInfo = useCallback((execution) => {
    // Show error info for both "Ошибка" and "Не пройдена" statuses
    if (!execution) return null;
    
    // Only show for error/failed statuses
    const hasErrorInfo = execution.check_status === 'Ошибка' || 
                         execution.check_status === 'Не пройдена';
    
    if (!hasErrorInfo) return null;
    
    // If we have error_description, use it (even without error_code)
    if (execution.error_description) {
      const parts = execution.error_description.split(': ');
      if (parts.length >= 2) {
        const category = parts[0];
        const rest = parts.slice(1).join(': ');
        const errorParts = rest.split(' - ');
        return {
          category,
          error: errorParts[0] || '',
          description: errorParts[1] || rest
        };
      }
      return {
        category: execution.check_status === 'Не пройдена' ? 'Проверка не пройдена' : 'Ошибка',
        error: execution.error_description,
        description: execution.error_description
      };
    }
    
    // If we have error_code but no description, get description from error codes
    if (execution.error_code) {
      return getErrorDescription(execution.error_code);
    }
    
    // Try to extract error code from output
    const errorCode = safeExtractErrorCode(execution.output);
    if (errorCode) {
      return getErrorDescription(errorCode);
    }
    
    // Fallback: show generic message for "Не пройдена" without specific info
    if (execution.check_status === 'Не пройдена') {
      // Check if error_description mentions "эталон" (reference data)
      const hasReferenceMention = execution.error_description && 
                                  execution.error_description.toLowerCase().includes('эталон');
      
      if (hasReferenceMention) {
        return {
          category: 'Конфигурация',
          error: 'Несоответствие эталонным данным',
          description: 'Результат проверки не соответствует эталонным данным'
        };
      }
      
      return {
        category: 'Проверка не пройдена',
        error: 'Результат проверки не соответствует требованиям',
        description: 'Проверка завершилась неудачно. Уточните причину в выводе команды.'
      };
    }
    
    return null;
  }, []);

  // Export to Excel
  const handleExportToExcel = useCallback(async () => {
    if (!selectedSession) {
      toast.error("Выберите сессию для экспорта");
      return;
    }

    try {
      const response = await api.get(
        `/api/projects/${projectId}/sessions/${selectedSession}/export-excel`,
        { responseType: 'blob' }
      );

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
  }, [selectedSession, projectId, project?.name]);

  return {
    // Data
    project,
    sessions,
    selectedSession,
    executions,
    groupedExecutions,
    hosts,
    loading,
    searchParams,
    
    // Actions
    handleSessionChange,
    handleExportToExcel,
    
    // Helpers
    formatDate,
    getHostName,
    getHostStats,
    getErrorInfo
  };
};

export default useProjectResults;

