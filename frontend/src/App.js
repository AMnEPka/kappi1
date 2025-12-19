import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from './providers/ThemeProvider';
import { Suspense, lazy } from 'react';
import ErrorBoundary from "@/components/ErrorBoundary";

// Lazy loaded pages (simple pages without special props)
const AdminPage = lazy(() => import("@/pages/AdminPage"));
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const UsersPage = lazy(() => import("@/pages/UsersPage"));
const RolesPage = lazy(() => import("@/pages/RolesPage"));
const LogsPage = lazy(() => import("@/pages/LogsPage"));
const SchedulerPage = lazy(() => import("@/pages/SchedulerPage"));
const HostsPage = lazy(() => import("@/pages/HostsPage"));
const ScriptsPage = lazy(() => import("@/pages/ScriptsPage"));
const ExecutePage = lazy(() => import("@/pages/ExecutePage"));
const HistoryPage = lazy(() => import("@/pages/HistoryPage"));

// Page wrappers (pages that need router props)
import {
  ProjectsPageWrapper,
  ProjectWizardWrapper,
  ProjectExecutionPageWrapper,
  ProjectResultsPageWrapper
} from "@/components/PageWrappers";

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
                            {/* Pages with navigation props */}
                            <Route path="/" element={<ProjectsPageWrapper />} />
                            <Route path="/new" element={<ProjectWizardWrapper />} />
                            <Route path="/:projectId/execute" element={<ProjectExecutionPageWrapper />} />
                            <Route path="/:projectId/results" element={<ProjectResultsPageWrapper />} />
                            
                            {/* Simple pages */}
                            <Route path="/hosts" element={<HostsPage />} />
                            <Route path="/scripts" element={<ScriptsPage />} />
                            <Route path="/execute" element={<ExecutePage />} />
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
