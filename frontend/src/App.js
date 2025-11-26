import { BrowserRouter, Routes, Route, Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Server, FileCode, Briefcase, LogOut, User, Shield, Menu, Calendar, FileText, Settings } from "lucide-react";

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

import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";

  return (
<div className="m-0 p-0 w-full">
  {/* Первая строка шапки - FIXED */}
{/* Обертка для всего приложения */}
<div className="m-0 p-0 w-full min-h-screen bg-gray-50">
  {/* Первая строка шапки */}
  {/* Первая строка шапки - FIXED */}
  <nav className="fixed top-0 left-0 right-0 z-50 w-full"> {/* ← ДОБАВИЛ w-full */}
    <div className="bg-gray-50 border-b border-gray-200 w-full"> {/* ← И здесь w-full */}
      <div className="max-w-7xl mx-auto px-6 w-full"> {/* ← И здесь w-full */}
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-3">
            <img src="/logo.png" alt="OSIB" className="h-14 w-14 object-contain" />
            <span className="text-2xl font-bold text-gray-800">Инструмент автоматизации ОСИБ</span>
          </Link>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-gray-500" />
              <span className="text-gray-700 font-medium">{user?.full_name}</span>
              {user?.is_admin && (
                <Badge className="bg-yellow-400 text-white text-xs border-0">adm</Badge>
              )}
            </div>
            <Button 
              className="bg-yellow-400 hover:bg-gray-50 text-black"
              size="sm"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4 mr-1" />
              Выйти
            </Button>
          </div>
        </div>
      </div>
    </div>
  </nav>

  {/* Вторая строка шапки */}
  <div className="fixed top-16 left-0 right-0 z-40 w-full"> 
    <div className="bg-yellow-400 shadow-md rounded-b-lg header-div"> 
      <div className="max-w-7xl mx-auto px-6 w-full content-div"> 
        <div className="flex items-center justify-between h-12">
          {/* Основные пункты меню слева */}
          <div className="flex items-center gap-1">
            <Link to="/">
              <Button
                variant={isActive('/') ? "default" : "ghost"}
                data-testid="nav-projects"
                className={`h-12 px-4 font-medium ${
                  isActive('/') ? 'bg-white text-black' : 'text-black hover:bg-white'
                }`}
              >
                <Briefcase className="mr-3 h-5 w-5" /> Проекты
              </Button>
            </Link>
            <Link to="/hosts">
              <Button
                variant={isActive('/hosts') ? "default" : "ghost"}
                data-testid="nav-hosts"
                className={`h-12 px-4 font-medium ${
                  isActive('/hosts') ? 'bg-white text-black' : 'text-black hover:bg-white'
                }`}
              >
                <Server className="mr-3 h-5 w-5" /> Хосты
              </Button>
            </Link>
            <Link to="/scripts">
              <Button
                variant={isActive('/scripts') ? "default" : "ghost"}
                data-testid="nav-scripts"
                className={`h-12 px-4 font-medium ${
                  isActive('/scripts') ? 'bg-white text-black' : 'text-black hover:bg-white'
                }`}
              >
                <FileCode className="mr-3 h-5 w-5" /> Проверки
              </Button>
            </Link>
            {showScheduler && (
              <Link to="/scheduler">
                <Button
                  variant={isActive('/scheduler') ? "default" : "ghost"}
                  data-testid="nav-scheduler"
                  className={`h-12 px-4 font-medium ${
                    isActive('/scheduler') ? 'bg-white text-black' : 'text-black hover:bg-white'
                  }`}
                >
                  <Calendar className="mr-3 h-8 w-8" /> Планировщик
                </Button>
              </Link>
            )}
            {isAdmin && (
              <Link to="/logs">
                <Button
                  variant={isActive('/logs') ? "default" : "ghost"}
                  data-testid="nav-logs"
                  className={`h-12 px-4 py-3 font-medium ${
                    isActive('/logs') ? 'bg-white text-black' : 'text-black hover:bg-white'
                  }`}
                >
                  <FileText className="mr-3 h-8 w-8" /> Логи
                </Button>
              </Link>
            )}
          </div>

          {/* Выпадающее меню справа */}
          <div className="relative group">
            <button className="flex items-center justify-center text-black hover:bg-white hover:text-black h-12 w-12 rounded-md transition-colors">
              <Menu className="h-8 w-8" />
            </button>
            <div className="absolute right-0 top-full mt-1 w-56 bg-white border-2 border-gray-300 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
              <Link to="/admin">
                <div className="flex items-center px-4 py-3 text-base font-medium text-gray-800 hover:bg-gray-100 cursor-pointer">
                  <Settings className="mr-3 h-5 w-5" /> Админ-панель
                </div>
              </Link>
              <div className="border-t-2 border-gray-200 my-1"></div>
              <Link to="/users">
                <div className="flex items-center px-4 py-3 text-base font-medium text-gray-800 hover:bg-gray-100 cursor-pointer">
                  <User className="mr-3 h-5 w-5" /> Пользователи
                </div>
              </Link>
              <div className="border-t-2 border-gray-200 my-1"></div>
              <Link to="/roles">
                <div className="flex items-center px-4 py-3 text-base font-medium text-gray-800 hover:bg-gray-100 cursor-pointer">
                  <Shield className="mr-3 h-5 w-5" /> Роли
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  {/* Основной контент */}
  <div className="pt-32">
    <div className="max-w-7xl mx-auto px-6 content-div">
      {children}
    </div>
  </div>
</div>

</div>
  );
};

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
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/*" element={
              <ProtectedRoute>
                <Layout>
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
                </Layout>
              </ProtectedRoute>
            } />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;