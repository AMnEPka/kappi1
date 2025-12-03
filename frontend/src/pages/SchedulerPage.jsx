import React, { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { api } from "@/config/api";
import { useAuth } from "@/contexts/AuthContext";
import { CalendarClock, PauseCircle, PlayCircle, RefreshCw, Repeat, Trash2, History as HistoryIcon, CheckCircle, XCircle, Loader2, Plus, X} from "lucide-react";
import { useNavigate } from 'react-router-dom';
import { SelectNative } from "@/components/ui/select-native";
import DateTimePicker from '../components/ui/datetime-picker';

const JOB_TYPES = [
  { value: "one_time", label: "Одиночный запуск" },
  { value: "multi_run", label: "Несколько запусков" },
  { value: "recurring", label: "Ежедневно" },
];

const statusMap = {
  active: { label: "Активно", variant: "default" },
  paused: { label: "Пауза", variant: "secondary" },
  completed: { label: "Завершено", variant: "outline" },
  running: { label: "Выполняется", variant: "default" }, 
  failed: { label: "Ошибка", variant: "destructive" },   
};

const runStatusMap = {
  running: { label: "Выполняется", showResults: false },
  success: { label: "Успешно выполнено", showResults: true },
  paused:  { label: "Приостановлено", showResults: false },
  failed:  { label: "Ошибка выполнения", showResults: true }
};

const statusIcons = {
  'running': <Loader2 className="h-3 w-3 animate-spin" />,
  'success': <CheckCircle className="h-3 w-3" />,
  'pause': <PauseCircle className="h-3 w-3" />,
  'failed': <XCircle className="h-3 w-3" />
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  return date.toLocaleString("ru-RU");
};

const toInputDateTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return date.toISOString().slice(0, 16);
};

const SchedulerPage = () => {
  const { hasPermission, isAdmin } = useAuth();
  const canSchedule = isAdmin || hasPermission("projects_execute");
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [runs, setRuns] = useState({});
  const [expandedJobId, setExpandedJobId] = useState(null);
  const [editingJob, setEditingJob] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(3000); // 3 секунды
  const [showJobForm, setShowJobForm] = useState(false);
  const [hideCompleted, setHideCompleted] = useState(false);
  const [form, setForm] = useState({
    name: "",
    project_id: "",
    job_type: "one_time",
    run_at: "",
    run_times: [""],
    recurrence_time: "10:00",
    recurrence_start_date: "",
  });

  useEffect(() => {
    if (canSchedule) {
      fetchJobs();
      fetchProjects();
    }
  }, [canSchedule]);

  useEffect(() => {
    if (!autoRefresh || !canSchedule) return;

    const interval = setInterval(() => {
      fetchJobs(); // Обновляем список заданий
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, canSchedule]);  

  const fetchJobs = async () => {
    try {
      const response = await api.get("/api/scheduler/jobs");
      setJobs(response.data);
    } catch (error) {
      console.error(error);
      toast.error("Не удалось загрузить задания");
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await api.get("/api/projects");
      setProjects(response.data);
    } catch (error) {
      console.error(error);
      toast.error("Не удалось загрузить проекты");
    }
  };

  const resetForm = () => {
    setEditingJob(null);
    setForm({
      name: "",
      project_id: "",
      job_type: "one_time",
      run_at: "",
      run_times: [""],
      recurrence_time: "10:00",
      recurrence_start_date: "",
    });
    setShowJobForm(false);
  };

  const filteredJobs = useMemo(() => {
    if (!hideCompleted) return jobs;
    
    return jobs.filter(job => {
      // Не скрываем задания, которые не являются завершенными одиночными запусками
      if (job.job_type !== 'one_time') return true;
      if (job.status !== 'completed') return true;
      return false;
    });
  }, [jobs, hideCompleted]);  

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.project_id) {
      toast.error("Выберите проект");
      return;
    }

    if (form.job_type === "one_time" && !form.run_at) {
      toast.error("Укажите время запуска");
      return;
    }

    if (form.job_type === "multi_run" && !form.run_times.filter(Boolean).length) {
      toast.error("Добавьте хотя бы одно время запуска");
      return;
    }

    if (form.job_type === "recurring" && !form.recurrence_time) {
      toast.error("Укажите время ежедневного запуска");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: form.name,
        // project_id включаем только при создании, при редактировании не меняем
        ...(editingJob ? {} : { project_id: form.project_id }),
        job_type: form.job_type,
      };

      if (form.job_type === "one_time") {
        payload.run_at = new Date(form.run_at).toISOString();
      } else if (form.job_type === "multi_run") {
        payload.run_times = form.run_times
          .filter(Boolean)
          .map((value) => new Date(value).toISOString());
      } else if (form.job_type === "recurring") {
        payload.recurrence_time = form.recurrence_time;
        if (form.recurrence_start_date) {
          payload.recurrence_start_date = form.recurrence_start_date;
        }
      }

      if (editingJob) {
        await api.put(`/api/scheduler/jobs/${editingJob.id}`, payload);
        toast.success("Задание обновлено");
      } else {
        await api.post("/api/scheduler/jobs", payload);
        toast.success("Задание создано");
      }
      resetForm();
      fetchJobs();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.detail || "Ошибка сохранения задания");
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async (jobId) => {
    try {
      await api.post(`/api/scheduler/jobs/${jobId}/pause`);
      toast.success("Задание приостановлено");
      fetchJobs();
    } catch (error) {
      toast.error("Не удалось приостановить");
    }
  };

  const handleResume = async (jobId) => {
    try {
      await api.post(`/api/scheduler/jobs/${jobId}/resume`);
      toast.success("Задание возобновлено");
      fetchJobs();
    } catch (error) {
      toast.error("Не удалось возобновить");
    }
  };

  const handleDelete = async (jobId) => {
    if (!window.confirm("Удалить задание и историю запусков?")) return;
    try {
      await api.delete(`/api/scheduler/jobs/${jobId}`);
      toast.success("Задание удалено");
      fetchJobs();
    } catch (error) {
      toast.error("Не удалось удалить");
    }
  };

  const handleEdit = (job) => {
    setEditingJob(job);
    
    // Базовые поля
    const baseForm = {
      name: job.name,
      project_id: job.project_id,
      job_type: job.job_type,
    };
  
    // Поля в зависимости от типа задания
    if (job.job_type === "one_time") {
      // Для одиночного запуска - используем run_at из данных задания
      baseForm.run_at = job.run_at ? toInputDateTime(job.run_at) : "";
    } else if (job.job_type === "multi_run") {
      // Для множественного запуска - используем run_times из данных задания
      baseForm.run_times = (job.run_times || []).map((value) => toInputDateTime(value));
    } else if (job.job_type === "recurring") {
      // Для ежедневного - используем данные из schedule_config
      baseForm.recurrence_time = job.schedule_config?.recurrence_time || "10:00";
      baseForm.recurrence_start_date = job.schedule_config?.recurrence_start_date || "";
    }
  
    setForm(baseForm);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleHistory = async (jobId) => {
    if (expandedJobId === jobId) {
      setExpandedJobId(null);
      return;
    }
    setExpandedJobId(jobId);
    if (runs[jobId]) return;
    try {
      const response = await api.get(`/api/scheduler/jobs/${jobId}/runs`);
      setRuns((prev) => ({ ...prev, [jobId]: response.data }));
    } catch (error) {
      toast.error("Не удалось загрузить историю запусков");
    }
  };

  const projectName = (projectId) => {
    const project = projects.find((p) => p.id === projectId);
    return project ? project.name : "Проект";
  };

  if (!canSchedule) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-gray-500">
          <p>У вас нет прав для управления планировщиком</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {/* Большая кнопка "Новое задание" */}
      {!editingJob && !showJobForm && (
        <div className="flex justify-center py-12">
          <Button
            type="button"
            onClick={() => setShowJobForm(true)}
            className="h-16 px-8 text-lg"
            size="lg"
          >
            <Plus className="h-5 w-5 mr-2" />
            Новое задание
          </Button>
        </div>
      )}
  
      {/* Карточка формы (показывается при создании или редактировании) */}
      {(showJobForm || editingJob) && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{editingJob ? "Редактирование задания" : "Новое задание"}</CardTitle>
            {!editingJob && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowJobForm(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Название</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Проверка ежедневная"
                    required
                  />
                </div>
                <div>
                  <Label>Проект</Label>
                  {editingJob ? (
                    // При редактировании показываем заблокированное поле
                    <div className="flex items-center gap-2">
                      <Input
                        value={projects.find(p => p.id === form.project_id)?.name || form.project_id}
                        disabled
                        className="bg-gray-100"
                      />
                      <Badge variant="secondary" className="whitespace-nowrap">
                        Нельзя изменить
                      </Badge>
                    </div>
                  ) : (
                    // При создании - обычный выбор
                    <SelectNative
                      value={form.project_id}
                      onChange={(e) => setForm({ ...form, project_id: e.target.value })}
                      required
                    >
                      <option value="">Выберите проект</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </SelectNative>
                  )}
                </div>
              </div>
  
              <div>
                <Label>Тип запуска</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {JOB_TYPES.map((type) => (
                    <Button
                      key={type.value}
                      type="button"
                      variant={form.job_type === type.value ? "default" : "outline"}
                      onClick={() => setForm({ ...form, job_type: type.value })}
                    >
                      {type.label}
                    </Button>
                  ))}
                </div>
              </div>
  
              {form.job_type === "one_time" && (
                <div className="space-y-2">
                  <Label>Дата и время запуска</Label>
                  <div className="flex items-center gap-3">
                    <DateTimePicker
                      value={form.run_at}
                      onChange={(value) => setForm({ ...form, run_at: value })}
                      required
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        const baseTime = form.run_at ? new Date(form.run_at) : new Date();
                        baseTime.setHours(baseTime.getHours() + 1);
                        setForm({ ...form, run_at: baseTime.toISOString() });
                      }}
                      className="h-7 w-7"
                      title="Прибавить 1 час"
                    >
                      <span className="text-xs">+1h</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        const baseTime = form.run_at ? new Date(form.run_at) : new Date();
                        baseTime.setHours(baseTime.getHours() + 8);
                        setForm({ ...form, run_at: baseTime.toISOString() });
                      }}
                      className="h-7 w-7"
                      title="Прибавить 8 часов"
                    >
                      <span className="text-xs">+8h</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        const baseTime = form.run_at ? new Date(form.run_at) : new Date();
                        baseTime.setDate(baseTime.getDate() + 1);
                        setForm({ ...form, run_at: baseTime.toISOString() });
                      }}
                      className="h-7 w-7"
                      title="Прибавить 1 сутки"
                    >
                      <span className="text-xs">+24h</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        setForm({ ...form, run_at: null });
                      }}
                      className="h-7 w-7"
                      title="Очистить дату и время"
                    >
                      <span className="text-xs">✕</span>
                    </Button>
                                    
                  </div>
                </div>
              )}
  
              {form.job_type === "multi_run" && (
                <div className="space-y-2">
                  <Label>Список запусков</Label>
                  {form.run_times.map((value, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      {/* Нумерация в кружке */}
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-medium flex-shrink-0">
                        {index + 1}
                      </div>
                      <div className="flex items-center gap-2 flex-1">
                        <div className="flex-1">
                          <DateTimePicker
                            value={value}
                            onChange={(newValue) => {
                              const next = [...form.run_times];
                              next[index] = newValue;
                              setForm({ ...form, run_times: next });
                            }}
                            required
                          />
                        </div>
                        {form.run_times.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const next = form.run_times.filter((_, i) => i !== index);
                              setForm({ ...form, run_times: next.length ? next : [""] });
                            }}
                            className="flex-shrink-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setForm({ ...form, run_times: [...form.run_times, ""] })}
                    className="ml-8"
                  >
                    Добавить запуск
                  </Button>
                </div>
              )}
  
              {form.job_type === "recurring" && (
                <div className="space-y-2">
                  <Label>Ежедневный запуск</Label>
                  <div className="flex flex-wrap gap-3 items-end">
                    <div className="flex flex-col gap-1">
                      <Label className="text-sm">Время</Label>
                      <Input
                        type="time"
                        value={form.recurrence_time}
                        onChange={(e) => setForm({ ...form, recurrence_time: e.target.value })}
                        required
                        className="w-[200px]"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label className="text-sm">Дата начала (опционально)</Label>
                      <Input
                        type="date"
                        value={form.recurrence_start_date}
                        onChange={(e) => setForm({ ...form, recurrence_start_date: e.target.value })}
                        className="w-[200px]"
                      />
                    </div>
                  </div>
                </div>
              )}
  
              <div className="flex gap-2">
                <Button type="submit" disabled={loading}>
                  {editingJob ? "Сохранить изменения" : "Создать задание"}
                </Button>
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={() => {
                    if (editingJob) {
                      resetForm();
                    } else {
                      setShowJobForm(false);
                    }
                  }}
                >
                  {editingJob ? "Отмена" : "Закрыть"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
  
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Запланированные задания</h2>
          <div className="flex gap-2 items-center">
            {/* Переключатель скрытия выполненных - слайдер */}
            <div className="flex items-center gap-2 mr-4">
              <button
                type="button"
                onClick={() => setHideCompleted(!hideCompleted)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                  hideCompleted ? 'bg-primary' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    hideCompleted ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <label className="text-sm text-gray-700 whitespace-nowrap cursor-pointer" onClick={() => setHideCompleted(!hideCompleted)}>
                Скрыть выполненные
              </label>
            </div>
            
            {/* Переключатель автообновления */}
            <Button 
              variant={autoRefresh ? "default" : "outline"} 
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
              {autoRefresh ? 'Автообновление статуса запланированных заданий' : 'Включить автообновление статуса запланированных заданий'}
            </Button>
            
            <Button variant="outline" size="sm" onClick={fetchJobs}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Обновить
            </Button>
          </div>
        </div>

        {filteredJobs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              <CalendarClock className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>
                {hideCompleted && jobs.length > 0 
                  ? "Нет активных заданий" 
                  : "Пока нет запланированных запусков"
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-sm">Задание</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm">Проект</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm">Тип</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm">Статус</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm">Следующий запуск</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredJobs.map((job) => {
                  // Проверяем, нужно ли блокировать кнопку "Изменить"
                  const isOneTimeCompleted = job.job_type === 'one_time' && job.status === 'completed';
                  
                  return (
                    <React.Fragment key={job.id}>
                      <tr className="hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div className="font-medium">{job.name}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-sm text-gray-600">{projectName(job.project_id)}</div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className="whitespace-nowrap">
                            {JOB_TYPES.find((type) => type.value === job.job_type)?.label || job.job_type}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={statusMap[job.status]?.variant || "secondary"} className="flex items-center gap-1 w-fit">
                            {job.status === "running" && <Loader2 className="h-3 w-3 animate-spin" />}
                            {statusMap[job.status]?.label || job.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          {job.next_run_at ? (
                            <div className="text-sm text-gray-600">{formatDateTime(job.next_run_at)}</div>
                          ) : (
                            <div className="text-sm text-gray-400">—</div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-1 flex-wrap">
                            {job.status === "active" ? (
                              <div className="relative group">
                                <Button variant="ghost" size="sm" onClick={() => handlePause(job.id)} title="Пауза">
                                  <PauseCircle className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : job.status === "paused" ? (
                              <div className="relative group">
                                <Button variant="ghost" size="sm" onClick={() => handleResume(job.id)} title="Возобновить">
                                  <PlayCircle className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : null}
                            
                            {/* Кнопка "Изменить" - заблокирована для завершенных одиночных запусков */}
                            <div className="relative group">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => !isOneTimeCompleted && handleEdit(job)} 
                                title="Редактировать"
                                disabled={isOneTimeCompleted}
                                className={isOneTimeCompleted ? "opacity-50 cursor-not-allowed" : ""}
                              >
                                <Repeat className="h-4 w-4" />
                              </Button>
                              {isOneTimeCompleted && (
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                  Недоступно для завершенных одиночных запусков
                                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                                </div>
                              )}
                            </div>
                            
                            <div className="relative group">
                              <Button variant="ghost" size="sm" onClick={() => toggleHistory(job.id)} title="История выполнения">
                                <HistoryIcon className="h-4 w-4" />
                              </Button>
                            </div>
                            
                            <div className="relative group">
                              <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDelete(job.id)} title="Удалить">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </td>
                      </tr>
                      
                      {/* Строка с историей запусков */}
                      {expandedJobId === job.id && (
                        <tr>
                          <td colSpan={6} className="p-4 bg-gray-50">
                            <div className="space-y-3">
                              <h4 className="font-semibold text-sm">История запусков</h4>
                              {(runs[job.id] || []).length === 0 ? (
                                <p className="text-sm text-gray-500">Запусков пока не было</p>
                              ) : (
                                <div className="space-y-2">
                                  {(runs[job.id] || []).map((run) => {
                                    const statusInfo = runStatusMap[run.status] || { 
                                      label: run.status, 
                                      showResults: false 
                                    };

                                    const statusVariant = {
                                      'running': 'secondary',
                                      'success': 'default',
                                      'paused': 'secondary', 
                                      'failed': 'destructive'
                                    };

                                    return (
                                      <div key={run.id} className="flex items-center justify-between py-2 border-b last:border-0">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-3">
                                            <p className="font-medium text-sm">{formatDateTime(run.started_at)}</p>
                                            <Badge 
                                              variant={statusVariant[run.status] || 'secondary'} 
                                              className={`flex items-center gap-1 ${
                                                run.status === 'success' ? 'bg-green-600 hover:bg-green-600 text-black' : ''
                                              }`}
                                            >
                                              {statusIcons[run.status]}
                                              {statusInfo.label}
                                            </Badge>
                                            {run.finished_at && (
                                              <span className="text-xs text-gray-500">
                                                Завершено: {formatDateTime(run.finished_at)}
                                              </span>
                                            )}
                                          </div>
                                          {run.session_id && (
                                            <p className="text-xs text-gray-500 mt-1">Session ID: {run.session_id}</p>
                                          )}
                                          {run.error && (
                                            <p className="text-xs text-red-500 mt-1">{run.error}</p>
                                          )}
                                        </div>
                                        
                                        {statusInfo.showResults && run.session_id && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                              navigate(`/${job.project_id}/results?session=${run.session_id}&returnTo=scheduler`);
                                            }}
                                            className="whitespace-nowrap"
                                          >
                                            Перейти к результатам
                                          </Button>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
};

export default SchedulerPage;
