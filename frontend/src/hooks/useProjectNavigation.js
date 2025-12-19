import { useNavigate, useParams } from 'react-router-dom';
import { useCallback } from 'react';

/**
 * Хук для навигации между страницами проекта
 * Заменяет onNavigate prop во всех компонентах
 */
export const useProjectNavigation = () => {
  const navigate = useNavigate();
  const params = useParams();
  const projectId = params.projectId;

  const goToProjects = useCallback(() => {
    navigate('/');
  }, [navigate]);

  const goToProjectWizard = useCallback(() => {
    navigate('/new');
  }, [navigate]);

  const goToProjectExecute = useCallback((id) => {
    navigate(`/${id || projectId}/execute`);
  }, [navigate, projectId]);

  const goToProjectResults = useCallback((id) => {
    navigate(`/${id || projectId}/results`);
  }, [navigate, projectId]);

  const goToScheduler = useCallback(() => {
    navigate('/scheduler');
  }, [navigate]);

  const goToHosts = useCallback(() => {
    navigate('/hosts');
  }, [navigate]);

  const goToScripts = useCallback(() => {
    navigate('/scripts');
  }, [navigate]);

  // Универсальная функция для обратной совместимости с onNavigate
  const handleNavigate = useCallback((page, id) => {
    switch (page) {
      case 'projects':
        goToProjects();
        break;
      case 'project-wizard':
        goToProjectWizard();
        break;
      case 'project-execute':
        goToProjectExecute(id);
        break;
      case 'project-results':
        goToProjectResults(id);
        break;
      case 'scheduler':
        goToScheduler();
        break;
      default:
        console.warn(`Unknown navigation target: ${page}`);
    }
  }, [goToProjects, goToProjectWizard, goToProjectExecute, goToProjectResults, goToScheduler]);

  return {
    projectId,
    navigate,
    goToProjects,
    goToProjectWizard,
    goToProjectExecute,
    goToProjectResults,
    goToScheduler,
    goToHosts,
    goToScripts,
    handleNavigate  // для обратной совместимости
  };
};

export default useProjectNavigation;

