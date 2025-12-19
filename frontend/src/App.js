import { BrowserRouter, Routes, Route, useNavigate, useParams } from "react-router-dom";
import { ThemeProvider } from './providers/ThemeProvider';
import { Suspense, lazy } from 'react';
import ErrorBoundary from "@/components/ErrorBoundary";

// Lazy loaded pages
const AdminPage = lazy(() => import("@/pages/AdminPage"));
const ProjectsPage = lazy(() => import("@/pages/ProjectsPage"));
const ProjectWizard = lazy(() => import("@/pages/ProjectWizard"));
const ProjectExecutionPage = lazy(() => import("@/pages/ProjectExecutionPage"));
const ProjectResultsPage = lazy(() => import("@/pages/ProjectResultsPage"));
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const UsersPage = lazy(() => import("@/pages/UsersPage"));
const RolesPage = lazy(() => import("@/pages/RolesPage"));
const LogsPage = lazy(() => import("@/pages/LogsPage"));
const SchedulerPage = lazy(() => import("@/pages/SchedulerPage"));
const HostsPage = lazy(() => import("@/pages/HostsPage"));
const ScriptsPage = lazy(() => import("@/pages/ScriptsPage"));
const ExecutePage = lazy(() => import("@/pages/ExecutePage"));
const HistoryPage = lazy(() => import("@/pages/HistoryPage"));

import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { MainLayout } from "@/components/layouts/MainLayout";

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto mb-4"></div>
      <p className="text-gray-600">Загрузка...</p>
    </div>
  </div>
);

// Wrapper components for project pages with routing
const ProjectsPageWrapper = () => {
  const navigate = useNavigate();
  const handleNavigate = (page, id) => {
    if (page === 'project-wizard') {
      navigate('/new');
    } else if (page === 'project-execute') {
      navigate(`/${id}/execute`);
    } else if (page === 'project-results') {
      navigate(`/${id}/results`);
    } else if (page === 'projects') {
      navigate('/');
    }
  };
  return <ProjectsPage onNavigate={handleNavigate} />;
};

const ProjectWizardWrapper = () => {
  const navigate = useNavigate();
  const handleNavigate = (page) => {
    if (page === 'projects') {
      navigate('/');
    }
  };
  return <ProjectWizard onNavigate={handleNavigate} />;
};

const ProjectExecutionPageWrapper = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const handleNavigate = (page, id) => {
    if (page === 'projects') {
      navigate('/');
    } else if (page === 'project-results') {
      navigate(`/${id || projectId}/results`);
    }
  };
  return <ProjectExecutionPage projectId={projectId} onNavigate={handleNavigate} />;
};

const ProjectResultsPageWrapper = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const handleNavigate = (page) => {
    if (page === 'projects') {
      navigate('/');
    }
  };
  return <ProjectResultsPage projectId={projectId} onNavigate={handleNavigate} />;
};

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/*" element={
                  <ProtectedRoute>
                    <MainLayout>
                      <ErrorBoundary>
                        <Suspense fallback={<PageLoader />}>
                          <Routes>
                            <Route path="/" element={<ProjectsPageWrapper />} />
                            <Route path="/hosts" element={<HostsPage />} />
                            <Route path="/scripts" element={<ScriptsPage />} />
                            <Route path="/execute" element={<ExecutePage />} />
                            <Route path="/new" element={<ProjectWizardWrapper />} />
                            <Route path="/:projectId/execute" element={<ProjectExecutionPageWrapper />} />
                            <Route path="/:projectId/results" element={<ProjectResultsPageWrapper />} />
                            <Route path="/history" element={<HistoryPage />} />
                            <Route path="/scheduler" element={<SchedulerPage />} />
                            <Route path="/logs" element={<LogsPage />} />
                            <Route path="/admin" element={<AdminPage />} />
                            <Route path="/users" element={<UsersPage />} />
                            <Route path="/roles" element={<RolesPage />} />
                          </Routes>
                        </Suspense>
                      </ErrorBoundary>
                    </MainLayout>
                  </ProtectedRoute>
                } />
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
