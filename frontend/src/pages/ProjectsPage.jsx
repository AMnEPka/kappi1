import React, { useState, useEffect } from 'react';
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { PlusCircle, Play, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

export default function ProjectsPage({ onNavigate }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/projects`);
      setProjects(response.data);
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast.error("Ошибка загрузки проектов");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProject = async (projectId) => {
    if (!window.confirm('Вы уверены, что хотите удалить этот проект?')) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/api/projects/${projectId}`);
      toast({
        title: "Успешно",
        description: "Проект удален",
      });
      fetchProjects();
    } catch (error) {
      console.error('Error deleting project:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось удалить проект",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      draft: { label: 'Черновик', className: 'bg-gray-500' },
      running: { label: 'Выполняется', className: 'bg-blue-500 animate-pulse' },
      completed: { label: 'Завершено', className: 'bg-green-500' },
      failed: { label: 'Ошибка', className: 'bg-red-500' },
    };

    const config = statusConfig[status] || statusConfig.draft;
    return (
      <span className={`px-2 py-1 rounded text-white text-xs ${config.className}`}>
        {config.label}
      </span>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('ru-RU');
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Проекты</h1>
          <p className="text-gray-600 mt-1">
            Управление проектами для массового выполнения скриптов
          </p>
        </div>
        <Button onClick={() => onNavigate('project-wizard')}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Создать проект
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-500">Загрузка...</div>
        </div>
      ) : projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64">
            <p className="text-gray-500 mb-4">Проектов пока нет</p>
            <Button onClick={() => onNavigate('project-wizard')}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Создать первый проект
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {projects.map((project) => (
            <Card key={project.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl">{project.name}</CardTitle>
                    {project.description && (
                      <CardDescription>{project.description}</CardDescription>
                    )}
                  </div>
                  {getStatusBadge(project.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
                  <div>
                    <p className="text-gray-500">Создан</p>
                    <p className="font-medium">{formatDate(project.created_at)}</p>
                  </div>
                  {project.started_at && (
                    <div>
                      <p className="text-gray-500">Запущен</p>
                      <p className="font-medium">{formatDate(project.started_at)}</p>
                    </div>
                  )}
                  {project.completed_at && (
                    <div>
                      <p className="text-gray-500">Завершен</p>
                      <p className="font-medium">{formatDate(project.completed_at)}</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  {project.status === 'draft' && (
                    <Button
                      size="sm"
                      onClick={() => onNavigate('project-execute', project.id)}
                    >
                      <Play className="mr-2 h-4 w-4" />
                      Запустить
                    </Button>
                  )}
                  {(project.status === 'completed' || project.status === 'failed') && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onNavigate('project-results', project.id)}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Просмотр результатов
                    </Button>
                  )}
                  {project.status === 'running' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onNavigate('project-execute', project.id)}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Мониторинг выполнения
                    </Button>
                  )}
                  {project.status === 'draft' && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteProject(project.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Удалить
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
