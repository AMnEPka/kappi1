import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
  ChevronLeft,
} from "lucide-react";
import { Button, Badge, AppBar, AppBarContent, Sidebar, SidebarContent } from '@/components/ui-new';
import { useAuth } from '@/contexts/AuthContext';
import './MainLayout.css';

export const MainLayout = ({ children }) => {
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

  const sidebarWidth = isSidebarExpanded ? 'md3-main-content-sidebar-expanded' : 'md3-main-content-sidebar-collapsed';

  return (
    <div className="md3-layout">
      {/* App Bar */}
      <AppBar>
        <AppBarContent>
          <Link to="/" className="md3-app-bar-brand">
            <div className="md3-app-bar-logo">
              <img 
                src="/logo.png" 
                alt="OSIB" 
                className="md3-app-bar-logo-img"
              />
            </div>
            <span className="md3-app-bar-title">
              Инструмент автоматизации ОСИБ
            </span>
          </Link>
          
          <div className="md3-app-bar-actions">
            <div className="md3-app-bar-user">
              <div className="md3-app-bar-user-avatar">
                <User className="md3-icon" />
              </div>
              <span className="md3-app-bar-user-name">{user?.full_name}</span>
              {user?.is_admin && (
                <Badge variant="tonal" className="md3-app-bar-user-badge">
                  adm
                </Badge>
              )}
            </div>
            
            <Button 
              variant="text"
              size="md"
              onClick={handleLogout}
              className="md3-app-bar-logout"
            >
              <LogOut className="md3-icon" />
              Выйти
            </Button>
          </div>
        </AppBarContent>
      </AppBar>

      {/* Sidebar */}
      <Sidebar expanded={isSidebarExpanded}>
        <SidebarContent>
          <Link to="/" className="md3-sidebar-item-link">
            <Button
              variant={isActive('/') ? "tonal" : "text"}
              className={`md3-sidebar-button ${isActive('/') ? 'md3-sidebar-button-active' : ''}`}
            >
              <Home className="md3-icon" />
              {isSidebarExpanded && "Проекты"}
            </Button>
          </Link>

          <Link to="/hosts" className="md3-sidebar-item-link">
            <Button
              variant={isActive('/hosts') ? "tonal" : "text"}
              className={`md3-sidebar-button ${isActive('/hosts') ? 'md3-sidebar-button-active' : ''}`}
            >
              <Server className="md3-icon" />
              {isSidebarExpanded && "Хосты"}
            </Button>
          </Link>

          <Link to="/scripts" className="md3-sidebar-item-link">
            <Button
              variant={isActive('/scripts') ? "tonal" : "text"}
              className={`md3-sidebar-button ${isActive('/scripts') ? 'md3-sidebar-button-active' : ''}`}
            >
              <FileCode className="md3-icon" />
              {isSidebarExpanded && "Проверки"}
            </Button>
          </Link>

          {showScheduler && (
            <Link to="/scheduler" className="md3-sidebar-item-link">
              <Button
                variant={isActive('/scheduler') ? "tonal" : "text"}
                className={`md3-sidebar-button ${isActive('/scheduler') ? 'md3-sidebar-button-active' : ''}`}
              >
                <Calendar className="md3-icon" />
                {isSidebarExpanded && "Планировщик"}
              </Button>
            </Link>
          )}

          {/* Admin Section Separator */}
          {isAdmin && (
            <>
              <div className="md3-sidebar-divider"></div>
              
              <Link to="/logs" className="md3-sidebar-item-link">
                <Button
                  variant={isActive('/logs') ? "tonal" : "text"}
                  className={`md3-sidebar-button ${isActive('/logs') ? 'md3-sidebar-button-active' : ''}`}
                >
                  <FileText className="md3-icon" />
                  {isSidebarExpanded && "Логи системы"}
                </Button>
              </Link>

              <Link to="/admin" className="md3-sidebar-item-link">
                <Button
                  variant={isActive('/admin') ? "tonal" : "text"}
                  className={`md3-sidebar-button ${isActive('/admin') ? 'md3-sidebar-button-active' : ''}`}
                >
                  <Settings className="md3-icon" />
                  {isSidebarExpanded && "Админ-панель"}
                </Button>
              </Link>

              <Link to="/users" className="md3-sidebar-item-link">
                <Button
                  variant={isActive('/users') ? "tonal" : "text"}
                  className={`md3-sidebar-button ${isActive('/users') ? 'md3-sidebar-button-active' : ''}`}
                >
                  <User className="md3-icon" />
                  {isSidebarExpanded && "Пользователи"}
                </Button>
              </Link>

              <Link to="/roles" className="md3-sidebar-item-link">
                <Button
                  variant={isActive('/roles') ? "tonal" : "text"}
                  className={`md3-sidebar-button ${isActive('/roles') ? 'md3-sidebar-button-active' : ''}`}
                >
                  <Shield className="md3-icon" />
                  {isSidebarExpanded && "Роли"}
                </Button>
              </Link>
            </>
          )}
          
          <div className="md3-sidebar-divider"></div>
          
          <Button
            variant="text"
            size="sm"
            onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
            className="md3-sidebar-toggle"
          >
            {isSidebarExpanded ? (
              <>
                <ChevronLeft className="md3-icon" />
                <span>Свернуть</span>
              </>
            ) : (
              <ChevronRight className="md3-icon" />
            )}
          </Button>
        </SidebarContent>
      </Sidebar>

      {/* Main Content */}
      <main className={`md3-main-content ${sidebarWidth}`}>
        <div className="md3-page-container">
          {/* Breadcrumb Navigation - Всегда показываем полный путь */}
          <nav className="md3-breadcrumb">
            <Link to="/" className="md3-breadcrumb-link">
              <Home className="md3-icon-sm" />
              Главная
            </Link>
            
            {/* Показываем разделитель и текущую страницу, если это не главная */}
            {location.pathname !== '/' && (
              <>
                <ChevronRight className="md3-breadcrumb-separator md3-icon-sm" />
                <span className="md3-breadcrumb-current">
                  {getPageTitle(location.pathname)}
                </span>
              </>
            )}
          </nav>
          
          {/* Page Content */}
          <div className="md3-page-content">
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