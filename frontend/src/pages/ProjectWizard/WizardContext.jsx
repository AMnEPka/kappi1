import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { api, getAccessToken } from '@/config/api';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

const WizardContext = createContext(null);

export const useWizard = () => {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error('useWizard must be used within WizardProvider');
  }
  return context;
};

const INITIAL_PROJECT_DATA = {
  name: '',
  description: '',
  hosts: [],
  tasks: [],
  accessUserIds: [],
  hostsList: []
};

export const WizardProvider = ({ children, onNavigate }) => {
  const [step, setStep] = useState(1);
  const [projectData, setProjectData] = useState(INITIAL_PROJECT_DATA);
  const [loading, setLoading] = useState(false);
  
  // Reference data
  const [hosts, setHosts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [systems, setSystems] = useState([]);
  const [scripts, setScripts] = useState([]);
  const [users, setUsers] = useState([]);
  const [checkGroups, setCheckGroups] = useState([]);
  const [systemCheckTemplates, setSystemCheckTemplates] = useState({});
  
  const { user: currentUser } = useAuth();

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      if (!currentUser) return;
      
      await new Promise(resolve => setTimeout(resolve, 500));
      await fetchData();
    };
    
    loadData();
  }, [currentUser]);

  const fetchData = useCallback(async () => {
    try {
      const hostsRes = await api.get('/api/hosts');
      setHosts(hostsRes.data);
      
      const [categoriesRes, systemsRes, scriptsRes, usersRes, checkGroupsRes] = await Promise.all([
        api.get('/api/categories'),
        api.get('/api/systems'),
        api.get('/api/scripts'),
        api.get('/api/users'),
        api.get('/api/check-groups'),
      ]);
      
      setCategories(categoriesRes.data);
      setSystems(systemsRes.data);
      setScripts(scriptsRes.data);
      setUsers(usersRes.data);
      setCheckGroups(checkGroupsRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error("Не удалось загрузить данные");
    }
  }, []);

  // Host API functions
  const saveHostToDatabase = useCallback(async (hostData) => {
    const response = await api.post('/api/hosts', hostData);
    return response.data;
  }, []);

  const updateHostInDatabase = useCallback(async (hostId, hostData) => {
    const response = await api.put(`/api/hosts/${hostId}`, hostData);
    return response.data;
  }, []);

  const deleteHostFromDatabase = useCallback(async (hostId) => {
    await api.delete(`/api/hosts/${hostId}`);
  }, []);

  const fetchAllHosts = useCallback(async () => {
    try {
      const response = await api.get('/api/hosts');
      setHosts(response.data);
    } catch (error) {
      if (error.response?.status !== 500) {
        toast.error("Не удалось загрузить хосты");
      }
    }
  }, []);

  // Helper functions
  const getHostById = useCallback((hostId) => {
    const projectHost = projectData.hostsList?.find(h => h.id === hostId);
    if (projectHost) return projectHost;
    return hosts.find(h => h.id === hostId) || null;
  }, [projectData.hostsList, hosts]);

  const getSystemById = useCallback((systemId) => {
    return systems.find(s => s.id === systemId);
  }, [systems]);

  const getCategoryById = useCallback((categoryId) => {
    return categories.find(c => c.id === categoryId);
  }, [categories]);

  const getScriptsBySystemId = useCallback((systemId) => {
    return scripts.filter(s => s.system_id === systemId);
  }, [scripts]);

  // Template functions
  const updateSystemCheckTemplate = useCallback((systemId, scriptIds) => {
    setSystemCheckTemplates(prev => ({
      ...prev,
      [systemId]: [...scriptIds]
    }));
  }, []);

  const getSystemCheckTemplate = useCallback((systemId) => {
    return systemCheckTemplates[systemId] || [];
  }, [systemCheckTemplates]);

  // Initialize tasks from hosts
  const initializeTasksFromHosts = useCallback((hostsList) => {
    if (!hostsList || hostsList.length === 0) return [];
    
    return hostsList.map(host => ({
      host_id: host.id,
      systems: [{ system_id: "", script_ids: [] }]
    }));
  }, []);

  // Navigation validation
  const canProceedToStep2 = useCallback(() => {
    return projectData.name.trim() !== '';
  }, [projectData.name]);

  const canProceedToStep3 = useCallback(() => {
    return projectData.hostsList && projectData.hostsList.length > 0;
  }, [projectData.hostsList]);

  const canProceedToStep4 = useCallback(() => {
    return projectData.tasks.every(
      task => task.systems.length > 0 && task.systems.every(
        sys => sys.system_id && sys.script_ids.length > 0
      )
    );
  }, [projectData.tasks]);

  const hasReferenceFiles = useMemo(() => {
    return projectData.tasks.some(task =>
      task.systems.some(system =>
        system.script_ids.some(scriptId => {
          const script = scripts.find(s => s.id === scriptId);
          return script && script.has_reference_files;
        })
      )
    );
  }, [projectData.tasks, scripts]);

  // Navigation
  const handleNext = useCallback(() => {
    if (step === 1 && !canProceedToStep2()) {
      toast.error("Введите название проекта");
      return;
    }
    if (step === 2 && !canProceedToStep3()) {
      toast.error("Выберите хотя бы один хост");
      return;
    }
    if (step === 2) {
      const tasks = initializeTasksFromHosts(projectData.hostsList);
      setProjectData(prev => ({ ...prev, tasks }));
    }
    if (step === 3 && !canProceedToStep4()) {
      toast.error("Для каждого хоста добавьте хотя бы одну систему и выберите проверки");
      return;
    }
    if (step === 3 && !hasReferenceFiles) {
      setStep(5);
      return;
    }
    setStep(prev => prev + 1);
  }, [step, canProceedToStep2, canProceedToStep3, canProceedToStep4, hasReferenceFiles, projectData.hostsList, initializeTasksFromHosts]);

  const handleBack = useCallback(() => {
    setStep(prev => prev - 1);
  }, []);

  // Create project
  const handleCreateProject = useCallback(async () => {
    try {
      setLoading(true);
      
      const projectResponse = await api.post('/api/projects', {
        name: projectData.name,
        description: projectData.description,
      });
      
      const projectId = projectResponse.data.id;
      
      for (const task of projectData.tasks) {
        for (const system of task.systems) {
          await api.post(`/api/projects/${projectId}/tasks`, {
            host_id: task.host_id,
            system_id: system.system_id,
            script_ids: system.script_ids,
            reference_data: system.reference_data || {},
          });
        }
      }
      
      for (const userId of projectData.accessUserIds) {
        try {
          await api.post(`/api/projects/${projectId}/users/${userId}`);
        } catch (error) {
          console.error(`Failed to grant access to user ${userId}:`, error);
        }
      }
      
      toast.success("Проект создан");
      onNavigate('projects');
    } catch (error) {
      console.error('Error creating project:', error);
      toast.error("Не удалось создать проект");
    } finally {
      setLoading(false);
    }
  }, [projectData, onNavigate]);

  const value = useMemo(() => ({
    // State
    step,
    setStep,
    projectData,
    setProjectData,
    loading,
    
    // Reference data
    hosts,
    categories,
    systems,
    scripts,
    users,
    checkGroups,
    currentUser,
    
    // Host API
    saveHostToDatabase,
    updateHostInDatabase,
    deleteHostFromDatabase,
    fetchAllHosts,
    
    // Helpers
    getHostById,
    getSystemById,
    getCategoryById,
    getScriptsBySystemId,
    
    // Templates
    updateSystemCheckTemplate,
    getSystemCheckTemplate,
    
    // Tasks
    initializeTasksFromHosts,
    
    // Navigation
    handleNext,
    handleBack,
    handleCreateProject,
    onNavigate,
    
    // Validation
    canProceedToStep2,
    canProceedToStep3,
    canProceedToStep4,
    hasReferenceFiles,
  }), [
    step, projectData, loading, hosts, categories, systems, scripts, users, checkGroups, currentUser,
    saveHostToDatabase, updateHostInDatabase, deleteHostFromDatabase, fetchAllHosts,
    getHostById, getSystemById, getCategoryById, getScriptsBySystemId,
    updateSystemCheckTemplate, getSystemCheckTemplate, initializeTasksFromHosts,
    handleNext, handleBack, handleCreateProject, onNavigate,
    canProceedToStep2, canProceedToStep3, canProceedToStep4, hasReferenceFiles
  ]);

  return (
    <WizardContext.Provider value={value}>
      {children}
    </WizardContext.Provider>
  );
};

export default WizardContext;

