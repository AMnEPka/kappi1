import { useState, useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Server, FileCode, Play, History as HistoryIcon, Settings } from "lucide-react";
import HostsPage from "@/pages/HostsPage";
import ScriptsPage from "@/pages/ScriptsPage";
import ExecutePage from "@/pages/ExecutePage";
import HistoryPage from "@/pages/HistoryPage";
import CategoriesPage from "@/pages/CategoriesPage";
import SystemsPage from "@/pages/SystemsPage";
import { Terminal } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Main Layout
const Layout = ({ children }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      <nav className="bg-white border-b shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <Terminal className="h-6 w-6 text-blue-600" />
              <span className="text-xl font-bold">SSH Script Runner</span>
            </div>
            <div className="flex gap-2">
              <Link to="/">
                <Button variant="ghost" data-testid="nav-hosts">
                  <Server className="mr-2 h-4 w-4" /> Хосты
                </Button>
              </Link>
              <Link to="/scripts">
                <Button variant="ghost" data-testid="nav-scripts">
                  <FileCode className="mr-2 h-4 w-4" /> Скрипты
                </Button>
              </Link>
              <Link to="/execute">
                <Button variant="ghost" data-testid="nav-execute">
                  <Play className="mr-2 h-4 w-4" /> Выполнение
                </Button>
              </Link>
              <Link to="/history">
                <Button variant="ghost" data-testid="nav-history">
                  <HistoryIcon className="mr-2 h-4 w-4" /> История
                </Button>
              </Link>
              <div className="border-l mx-2 h-8"></div>
              <Link to="/admin/categories">
                <Button variant="ghost" data-testid="nav-admin">
                  <Settings className="mr-2 h-4 w-4" /> Админ
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
};

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<HostsPage />} />
            <Route path="/scripts" element={<ScriptsPage />} />
            <Route path="/execute" element={<ExecutePage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/admin/categories" element={<CategoriesPage />} />
            <Route path="/admin/systems" element={<SystemsPage />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </div>
  );
}

export default App;