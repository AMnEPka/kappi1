import React, { useState, useEffect } from 'react';
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Checkbox } from "../components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { toast } from "sonner";
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

export default function ProjectWizard({ onNavigate }) {
  const [step, setStep] = useState(1);
  const [projectData, setProjectData] = useState({
    name: '',
    description: '',
    hosts: [],
    tasks: [], // { host_id, systems: [{ system_id, script_ids }] }
  });

  const [hosts, setHosts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [systems, setSystems] = useState([]);
  const [scripts, setScripts] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [hostsRes, categoriesRes, systemsRes, scriptsRes] = await Promise.all([
        axios.get(`${API_URL}/api/hosts`),
        axios.get(`${API_URL}/api/categories`),
        axios.get(`${API_URL}/api/systems`),
        axios.get(`${API_URL}/api/scripts`),
      ]);
      setHosts(hostsRes.data);
      setCategories(categoriesRes.data);
      setSystems(systemsRes.data);
      setScripts(scriptsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error("Не удалось загрузить данные");
    }
  };

  const handleHostToggle = (hostId) => {
    setProjectData(prev => {
      const isSelected = prev.hosts.includes(hostId);
      let newHosts;
      let newTasks = [...prev.tasks];

      if (isSelected) {
        // Remove host
        newHosts = prev.hosts.filter(id => id !== hostId);
        // Remove tasks for this host
        newTasks = newTasks.filter(task => task.host_id !== hostId);
      } else {
        // Add host
        newHosts = [...prev.hosts, hostId];
        // Add empty task structure for this host
        newTasks.push({
          host_id: hostId,
          systems: [], // Each system will be { system_id, script_ids }
        });
      }

      return { ...prev, hosts: newHosts, tasks: newTasks };
    });
  };

  const handleAddSystemToHost = (hostId) => {
    setProjectData(prev => ({
      ...prev,
      tasks: prev.tasks.map(task =>
        task.host_id === hostId
          ? { ...task, systems: [...task.systems, { system_id: '', script_ids: [] }] }
          : task
      ),
    }));
  };

  const handleRemoveSystemFromHost = (hostId, systemIndex) => {
    setProjectData(prev => ({
      ...prev,
      tasks: prev.tasks.map(task =>
        task.host_id === hostId
          ? { ...task, systems: task.systems.filter((_, idx) => idx !== systemIndex) }
          : task
      ),
    }));
  };

  const handleTaskSystemChange = (hostId, systemIndex, systemId) => {
    setProjectData(prev => ({
      ...prev,
      tasks: prev.tasks.map(task => {
        if (task.host_id === hostId) {
          const newSystems = [...task.systems];
          newSystems[systemIndex] = { system_id: systemId, script_ids: [] };
          return { ...task, systems: newSystems };
        }
        return task;
      }),
    }));
  };

  const handleTaskScriptToggle = (hostId, systemIndex, scriptId) => {
    setProjectData(prev => ({
      ...prev,
      tasks: prev.tasks.map(task => {
        if (task.host_id === hostId) {
          const newSystems = [...task.systems];
          const system = newSystems[systemIndex];
          const isSelected = system.script_ids.includes(scriptId);
          system.script_ids = isSelected
            ? system.script_ids.filter(id => id !== scriptId)
            : [...system.script_ids, scriptId];
          return { ...task, systems: newSystems };
        }
        return task;
      }),
    }));
  };

  const canProceedToStep2 = () => {
    return projectData.name.trim() !== '';
  };

  const canProceedToStep3 = () => {
    return projectData.hosts.length > 0;
  };

  const canProceedToStep4 = () => {
    return projectData.tasks.every(
      task => task.system_id && task.script_ids.length > 0
    );
  };

  const handleNext = () => {
    if (step === 1 && !canProceedToStep2()) {
      toast.error("Введите название проекта");
      return;
    }
    if (step === 2 && !canProceedToStep3()) {
      toast.error("Выберите хотя бы один хост");
      return;
    }
    if (step === 3 && !canProceedToStep4()) {
      toast.error("Для каждого хоста выберите систему и скрипты");
      return;
    }
    setStep(step + 1);
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleCreateProject = async () => {
    try {
      setLoading(true);

      // Create project
      const projectResponse = await axios.post(`${API_URL}/api/projects`, {
        name: projectData.name,
        description: projectData.description,
      });

      const projectId = projectResponse.data.id;

      // Create tasks
      for (const task of projectData.tasks) {
        await axios.post(`${API_URL}/api/projects/${projectId}/tasks`, {
          host_id: task.host_id,
          system_id: task.system_id,
          script_ids: task.script_ids,
        });
      }

      toast.success("Проект создан");

      onNavigate('projects');
    } catch (error) {
      console.error('Error creating project:', error);
      toast.error("Не удалось создать проект");
    } finally {
      setLoading(false);
    }
  };

  const getHostById = (hostId) => {
    return hosts.find(h => h.id === hostId);
  };

  const getSystemById = (systemId) => {
    return systems.find(s => s.id === systemId);
  };

  const getCategoryById = (categoryId) => {
    return categories.find(c => c.id === categoryId);
  };

  const getScriptsBySystemId = (systemId) => {
    return scripts.filter(s => s.system_id === systemId);
  };

  const renderStep1 = () => (
    <Card>
      <CardHeader>
        <CardTitle>Шаг 1: Основная информация</CardTitle>
        <CardDescription>Введите название и описание проекта</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="name">Название проекта *</Label>
          <Input
            id="name"
            value={projectData.name}
            onChange={(e) => setProjectData({ ...projectData, name: e.target.value })}
            placeholder="Например: Обновление серверов"
          />
        </div>
        <div>
          <Label htmlFor="description">Описание</Label>
          <Textarea
            id="description"
            value={projectData.description}
            onChange={(e) => setProjectData({ ...projectData, description: e.target.value })}
            placeholder="Опишите цель проекта"
            rows={4}
          />
        </div>
      </CardContent>
    </Card>
  );

  const renderStep2 = () => (
    <Card>
      <CardHeader>
        <CardTitle>Шаг 2: Выбор хостов</CardTitle>
        <CardDescription>Выберите хосты для выполнения скриптов</CardDescription>
      </CardHeader>
      <CardContent>
        {hosts.length === 0 ? (
          <p className="text-gray-500">Нет доступных хостов</p>
        ) : (
          <div className="space-y-2">
            {hosts.map((host) => (
              <div key={host.id} className="flex items-center space-x-2 p-2 border rounded">
                <Checkbox
                  checked={projectData.hosts.includes(host.id)}
                  onCheckedChange={() => handleHostToggle(host.id)}
                />
                <div className="flex-1">
                  <p className="font-medium">{host.name}</p>
                  <p className="text-sm text-gray-500">
                    {host.hostname}:{host.port}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderStep3 = () => (
    <Card>
      <CardHeader>
        <CardTitle>Шаг 3: Назначение скриптов</CardTitle>
        <CardDescription>Для каждого хоста выберите систему и скрипты</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {projectData.tasks.map((task) => {
            const host = getHostById(task.host_id);
            const availableScripts = getScriptsBySystemId(task.system_id);

            return (
              <div key={task.host_id} className="border rounded p-4">
                <h3 className="font-bold mb-3">{host?.name}</h3>

                <div className="mb-4">
                  <Label>Система</Label>
                  <Select
                    value={task.system_id}
                    onValueChange={(value) => handleTaskSystemChange(task.host_id, value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите систему" />
                    </SelectTrigger>
                    <SelectContent>
                      {systems.map((system) => {
                        const category = getCategoryById(system.category_id);
                        return (
                          <SelectItem key={system.id} value={system.id}>
                            {category?.icon} {category?.name} → {system.name}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {task.system_id && (
                  <div>
                    <Label>Скрипты</Label>
                    {availableScripts.length === 0 ? (
                      <p className="text-gray-500 text-sm mt-2">Нет доступных скриптов</p>
                    ) : (
                      <div className="space-y-2 mt-2">
                        {availableScripts.map((script) => (
                          <div key={script.id} className="flex items-center space-x-2">
                            <Checkbox
                              checked={task.script_ids.includes(script.id)}
                              onCheckedChange={() => handleTaskScriptToggle(task.host_id, script.id)}
                            />
                            <div className="flex-1">
                              <p className="font-medium text-sm">{script.name}</p>
                              {script.description && (
                                <p className="text-xs text-gray-500">{script.description}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );

  const renderStep4 = () => (
    <Card>
      <CardHeader>
        <CardTitle>Шаг 4: Подтверждение</CardTitle>
        <CardDescription>Проверьте настройки проекта перед созданием</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <h3 className="font-bold mb-2">Название:</h3>
            <p>{projectData.name}</p>
          </div>

          {projectData.description && (
            <div>
              <h3 className="font-bold mb-2">Описание:</h3>
              <p>{projectData.description}</p>
            </div>
          )}

          <div>
            <h3 className="font-bold mb-2">Хосты и задания:</h3>
            <div className="space-y-3">
              {projectData.tasks.map((task) => {
                const host = getHostById(task.host_id);
                const system = getSystemById(task.system_id);
                const taskScripts = scripts.filter(s => task.script_ids.includes(s.id));

                return (
                  <div key={task.host_id} className="border rounded p-3">
                    <p className="font-medium">{host?.name}</p>
                    <p className="text-sm text-gray-600">Система: {system?.name}</p>
                    <p className="text-sm text-gray-600">
                      Скрипты ({taskScripts.length}):
                    </p>
                    <ul className="list-disc list-inside text-sm text-gray-600 ml-2">
                      {taskScripts.map(script => (
                        <li key={script.id}>{script.name}</li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Создание проекта</h1>
        <div className="flex items-center gap-2 mt-4">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  s <= step ? 'bg-blue-500 text-white' : 'bg-gray-300 text-gray-600'
                }`}
              >
                {s < step ? <Check className="h-4 w-4" /> : s}
              </div>
              {s < 4 && (
                <div
                  className={`w-16 h-1 ${
                    s < step ? 'bg-blue-500' : 'bg-gray-300'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
      {step === 4 && renderStep4()}

      <div className="flex justify-between mt-6">
        <Button
          variant="outline"
          onClick={step === 1 ? () => onNavigate('projects') : handleBack}
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          {step === 1 ? 'Отмена' : 'Назад'}
        </Button>

        {step < 4 ? (
          <Button onClick={handleNext}>
            Далее
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleCreateProject} disabled={loading}>
            {loading ? 'Создание...' : 'Создать проект'}
          </Button>
        )}
      </div>
    </div>
  );
}
