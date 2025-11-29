import { BrowserRouter, Routes, Route, Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Server, 
  FileCode, 
  Briefcase, 
  LogOut, 
  User, 
  Shield, 
  Menu, 
  Calendar, 
  FileText, 
  Settings,
  ChevronRight,
  Home,
  PlayCircle,
  BarChart3,
  ChevronLeft,
  ChevronRight as ChevronRightIcon
} from "lucide-react";
import { useState } from "react";

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

const Layout = ({ children }) => {
  const location = useLocation();
  const { user, logout, hasPermission, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const showScheduler = isAdmin || hasPermission('projects_execute');
  
  const isActive = (path) => {
    if (path === '/hosts') return location.pathname === '/hosts';
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Желто-черная цветовая палитра
  const primaryColor = "bg-yellow-400";
  const primaryHover = "hover:bg-yellow-500";
  const surfaceColor = "bg-gray-50";
  const onSurface = "text-gray-900";
  const onPrimary = "text-black";
  
  const sidebarWidth = isSidebarExpanded ? "w-64" : "w-20";
  const contentMargin = isSidebarExpanded ? "ml-64" : "ml-20";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* App Bar - Fixed Top */}
      <header className={`fixed top-0 left-0 right-0 z-50 ${primaryColor} shadow-sm`}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Brand */}
            <Link to="/" className="flex items-center gap-3 group">
              <div className="relative">
                <img 
                  src="/logo.png" 
                  alt="OSIB" 
                  className="h-10 w-10 object-contain rounded-lg transition-transform group-hover:scale-105" 
                />
                <div className="absolute inset-0 rounded-lg bg-black/10 group-hover:bg-black/20 transition-colors"></div>
              </div>
              <span className="text-xl font-bold text-black">
                Инструмент автоматизации ОСИБ
              </span>
            </Link>
            
            {/* User Info and Actions */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 px-3 py-2 rounded-full bg-black/10 backdrop-blur-sm">
                <div className="w-8 h-8 rounded-full bg-black/20 flex items-center justify-center">
                  <User className="h-4 w-4 text-black" />
                </div>
                <span className="text-black text-sm font-medium">{user?.full_name}</span>
                {user?.is_admin && (
                  <Badge className="bg-black/20 text-black text-xs border-0 rounded-full px-2">
                    adm
                  </Badge>
                )}
              </div>
              
              <Button 
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-black hover:bg-black/10 hover:text-black rounded-full px-4"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Выйти
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Sidebar - Fixed Side */}
      <nav className={`fixed top-16 left-0 bottom-0 z-40 ${sidebarWidth} bg-white border-r border-gray-200 transition-all duration-300`}>
        <div className="flex flex-col h-full py-4">
          {/* Main Navigation Items */}
          <div className="flex-1 space-y-1 px-3">
            <Link to="/" className="block">
              <Button
                variant="ghost"
                className={`w-full justify-start rounded-lg h-12 ${
                  isActive('/') 
                    ? 'bg-yellow-100 text-black border border-yellow-300' 
                    : 'text-gray-700 hover:bg-gray-100 hover:text-black'
                }`}
              >
                <Home className="h-5 w-5 mr-3" />
                {isSidebarExpanded && "Проекты"}
              </Button>
            </Link>

            <Link to="/hosts" className="block">
              <Button
                variant="ghost"
                className={`w-full justify-start rounded-lg h-12 ${
                  isActive('/hosts') 
                    ? 'bg-yellow-100 text-black border border-yellow-300' 
                    : 'text-gray-700 hover:bg-gray-100 hover:text-black'
                }`}
              >
                <Server className="h-5 w-5 mr-3" />
                {isSidebarExpanded && "Хосты"}
              </Button>
            </Link>

            <Link to="/scripts" className="block">
              <Button
                variant="ghost"
                className={`w-full justify-start rounded-lg h-12 ${
                  isActive('/scripts') 
                    ? 'bg-yellow-100 text-black border border-yellow-300' 
                    : 'text-gray-700 hover:bg-gray-100 hover:text-black'
                }`}
              >
                <FileCode className="h-5 w-5 mr-3" />
                {isSidebarExpanded && "Проверки"}
              </Button>
            </Link>

            {showScheduler && (
              <Link to="/scheduler" className="block">
                <Button
                  variant="ghost"
                  className={`w-full justify-start rounded-lg h-12 ${
                    isActive('/scheduler') 
                      ? 'bg-yellow-100 text-black border border-yellow-300' 
                      : 'text-gray-700 hover:bg-gray-100 hover:text-black'
                  }`}
                >
                  <Calendar className="h-5 w-5 mr-3" />
                  {isSidebarExpanded && "Планировщик"}
                </Button>
              </Link>
            )}

            {/* Admin Section Separator */}
            {isAdmin && (
              <>
                <div className="border-t border-gray-200 my-3"></div>
                
                <Link to="/logs" className="block">
                  <Button
                    variant="ghost"
                    className={`w-full justify-start rounded-lg h-12 ${
                      isActive('/logs') 
                        ? 'bg-yellow-100 text-black border border-yellow-300' 
                        : 'text-gray-700 hover:bg-gray-100 hover:text-black'
                    }`}
                  >
                    <FileText className="h-5 w-5 mr-3" />
                    {isSidebarExpanded && "Логи системы"}
                  </Button>
                </Link>

                <Link to="/admin" className="block">
                  <Button
                    variant="ghost"
                    className={`w-full justify-start rounded-lg h-12 ${
                      isActive('/admin') 
                        ? 'bg-yellow-100 text-black border border-yellow-300' 
                        : 'text-gray-700 hover:bg-gray-100 hover:text-black'
                    }`}
                  >
                    <Settings className="h-5 w-5 mr-3" />
                    {isSidebarExpanded && "Админ-панель"}
                  </Button>
                </Link>

                <Link to="/users" className="block">
                  <Button
                    variant="ghost"
                    className={`w-full justify-start rounded-lg h-12 ${
                      isActive('/users') 
                        ? 'bg-yellow-100 text-black border border-yellow-300' 
                        : 'text-gray-700 hover:bg-gray-100 hover:text-black'
                    }`}
                  >
                    <User className="h-5 w-5 mr-3" />
                    {isSidebarExpanded && "Пользователи"}
                  </Button>
                </Link>

                <Link to="/roles" className="block">
                  <Button
                    variant="ghost"
                    className={`w-full justify-start rounded-lg h-12 ${
                      isActive('/roles') 
                        ? 'bg-yellow-100 text-black border border-yellow-300' 
                        : 'text-gray-700 hover:bg-gray-100 hover:text-black'
                    }`}
                  >
                    <Shield className="h-5 w-5 mr-3" />
                    {isSidebarExpanded && "Роли"}
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Sidebar Toggle Button */}
          <div className="px-3 pt-2 border-t border-gray-200">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
              className="w-full justify-center text-gray-600 hover:text-black hover:bg-gray-100 rounded-lg"
            >
              {isSidebarExpanded ? (
                <>
                  <ChevronLeft className="h-4 w-4" />
                  <span className="ml-2">Свернуть</span>
                </>
              ) : (
                <ChevronRightIcon className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className={`${contentMargin} pt-16 min-h-screen transition-all duration-300`}>
        <div className="max-w-7xl mx-auto px-6 py-6">
          {/* Breadcrumb Navigation */}
          {location.pathname !== '/' && (
            <nav className="flex items-center gap-2 mb-6 text-sm text-gray-600">
              <Link 
                to="/" 
                className="flex items-center gap-1 hover:text-yellow-600 transition-colors"
              >
                <Home className="h-4 w-4" />
                Главная
              </Link>
              <ChevronRight className="h-4 w-4" />
              <span className="text-gray-900 font-medium">
                {getPageTitle(location.pathname)}
              </span>
            </nav>
          )}
          
          {/* Page Content */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

// Helper function to get page titles
const getPageTitle = (pathname) => {
  const titles = {
    '/': 'Проекты',
    '/hosts': 'Хосты',
    '/scripts': 'Проверки',
    '/scheduler': 'Планировщик',
    '/logs': 'Логи системы',
    '/admin': 'Админ-панель',
    '/users': 'Пользователи',
    '/roles': 'Роли и разрешения',
    '/new': 'Новый проект',
    '/execute': 'Запуск проверок',
    '/history': 'История выполнений'
  };
  
  // For dynamic routes like /projectId/execute
  if (pathname.match(/\/.+\/execute/)) return 'Запуск проекта';
  if (pathname.match(/\/.+\/results/)) return 'Результаты проекта';
  
  return titles[pathname] || 'Страница';
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