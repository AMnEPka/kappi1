import { BrowserRouter, Routes, Route, useNavigate, useParams } from "react-router-dom";
import { ThemeProvider } from './providers/ThemeProvider';

// Page imports
import AdminPage from "@/pages/AdminPage";
import ProjectsPage from "@/pages/ProjectsPage";
import ProjectWizard from "@/pages/ProjectWizard";
import ProjectExecutionPage from "@/pages/ProjectExecutionPage";
import ProjectResultsPage from "@/pages/ProjectResultsPage";
import LoginPage from "@/pages/LoginPage";
import UsersPage from "@/pages/UsersPage";
import RolesPage from "@/pages/RolesPage";
import LogsPage from "@/pages/LogsPage";
import SchedulerPage from "@/pages/SchedulerPage";
import HostsPage from "@/pages/HostsPage";
import ScriptsPage from "@/pages/ScriptsPage";
import ExecutePage from "@/pages/ExecutePage";
import HistoryPage from "@/pages/HistoryPage";

import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { MainLayout } from "@/components/layouts/MainLayout";

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
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/*" element={
              <ProtectedRoute>
                <MainLayout>
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
                </MainLayout>
              </ProtectedRoute>
            } />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;