/**
 * Page Wrapper Components
 * 
 * Обёртки для страниц, которым нужны props из роутера (projectId, onNavigate)
 * Используют хук useProjectNavigation для навигации
 */

import React, { Suspense, lazy } from 'react';
import { useLocation } from 'react-router-dom';
import { useProjectNavigation } from '@/hooks/useProjectNavigation';

// Lazy loaded pages
const ProjectsPage = lazy(() => import("@/pages/ProjectsPage"));
const ProjectWizard = lazy(() => import("@/pages/ProjectWizard"));
const ProjectExecutionPage = lazy(() => import("@/pages/ProjectExecutionPage"));
const ProjectResultsPage = lazy(() => import("@/pages/ProjectResultsPage"));

// Loading fallback
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto mb-4"></div>
      <p className="text-gray-600">Загрузка...</p>
    </div>
  </div>
);

export const ProjectsPageWrapper = () => {
  const { handleNavigate } = useProjectNavigation();
  return (
    <Suspense fallback={<PageLoader />}>
      <ProjectsPage onNavigate={handleNavigate} />
    </Suspense>
  );
};

export const ProjectWizardWrapper = () => {
  const location = useLocation();
  const { handleNavigate } = useProjectNavigation();
  const initialPreset = location.state && location.state.fromIsCatalog
    ? {
        fromIsCatalog: true,
        hostIds: location.state.hostIds || [],
        projectName: location.state.projectName || '',
      }
    : null;
  return (
    <Suspense fallback={<PageLoader />}>
      <ProjectWizard onNavigate={handleNavigate} initialPreset={initialPreset} />
    </Suspense>
  );
};

export const ProjectExecutionPageWrapper = () => {
  const { projectId, handleNavigate } = useProjectNavigation();
  return (
    <Suspense fallback={<PageLoader />}>
      <ProjectExecutionPage projectId={projectId} onNavigate={handleNavigate} />
    </Suspense>
  );
};

export const ProjectResultsPageWrapper = () => {
  const { projectId, handleNavigate } = useProjectNavigation();
  return (
    <Suspense fallback={<PageLoader />}>
      <ProjectResultsPage projectId={projectId} onNavigate={handleNavigate} />
    </Suspense>
  );
};

