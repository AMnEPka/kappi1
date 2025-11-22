import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Filter, RefreshCw, ShieldAlert } from "lucide-react";
import { api } from "@/config/api";
import { useAuth } from "@/contexts/AuthContext";

const EVENT_OPTIONS = [
  // Аутентификация и пользователи
  { value: "1", label: "Успешный вход" },
  { value: "2", label: "Неудачный вход" },
  { value: "3", label: "Создание пользователя" },
  { value: "4", label: "Редактирование пользователя" },
  { value: "5", label: "Удаление пользователя" },
  
  // Роли и права
  { value: "6", label: "Создание роли" },
  { value: "7", label: "Редактирование роли" },
  { value: "8", label: "Удаление роли" },
  
  // Категории
  { value: "9", label: "Создание категории" },
  { value: "10", label: "Редактирование категории" },
  { value: "11", label: "Удаление категории" },
  
  // Системы
  { value: "12", label: "Создание системы" },
  { value: "13", label: "Редактирование системы" },
  { value: "14", label: "Удаление системы" },
  
  // Хосты
  { value: "15", label: "Создание хоста" },
  { value: "16", label: "Редактирование хоста" },
  { value: "17", label: "Удаление хоста" },
  
  // Проверки
  { value: "18", label: "Создание проверки" },
  { value: "19", label: "Редактирование проверки" },
  { value: "20", label: "Удаление проверки" },
  
  // Проекты
  { value: "21", label: "Создание проекта" },
  { value: "22", label: "Удаление проекта" },
  { value: "23", label: "Запуск проекта" },
  { value: "24", label: "Запуск проекта планировщиком" },
  { value: "25", label: "Просмотр результатов проекта" },
  { value: "26", label: "Экспорт результатов проекта" },
];

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

const formatEventDetails = (eventNumber, details) => {
  if (!details) return "-";
  
  try {
    const detailsObj = typeof details === 'string' ? JSON.parse(details) : details;

    // ВРЕМЕННО: выводим в консоль для отладки
    console.log('🔍 Event Details Debug:', {
      eventNumber,
      details,
      detailsObj,
      type: typeof details,
      isString: typeof details === 'string',
      parsedType: typeof detailsObj
    });
    
    switch(eventNumber) {
      case "1": // Успешный вход
        return `IP-адрес: ${detailsObj.ip_address || 'Неизвестно'}
Браузер: ${detailsObj.user_agent || 'Неизвестно'}`;
    
      case "2": // Неудачный вход
        return `IP-адрес: ${detailsObj.ip_address || 'Неизвестно'}
Браузер: ${detailsObj.user_agent || 'Неизвестно'}
Причина: ${detailsObj.reason || 'Не определено'}`;       

      case "3": // Создание пользователя
        return `Логин: ${detailsObj.username}
ФИО: ${detailsObj.target_full_name || 'ФИО'}`;

      case "4": // Редактирование пользователя
        return `Логин: ${detailsObj.username}\nФИО: ${detailsObj.target_full_name || 'ФИО'}
Измененные поля: ${detailsObj.changed_fields || 'нет'}
Было ролей: ${detailsObj.old_roles_count}
Стало ролей: ${detailsObj.new_roles_count}`;
        
      case "5": // Удаление пользователя
        return `Удаленный пользователь: ${detailsObj.username}
ФИО: ${detailsObj.full_name}
Администратор: ${detailsObj.is_admin ? 'Да' : 'Нет'}
Данные перепривязаны на: ${detailsObj.reassigned_to_admin}
Всего объектов перепривязано: ${detailsObj.total_objects_reassigned || 0}`;  

      case "6": // Создание роли
        return `Роль: ${detailsObj.role_name}
Прав: ${detailsObj.permissions_ratio}`;

      case "7": // Редактирование роли
        return `Роль: ${detailsObj.role_name}
Прав было: ${detailsObj.old_permissions_ratio}
Прав стало: ${detailsObj.new_permissions_ratio}`;

      case "8": // Удаление роли
        return `Роль: ${detailsObj.role_name}
Прав в роли: ${detailsObj.permissions_count}
Затронуто пользователей: ${detailsObj.affected_users_count}`;
              
      case "15": // Создание хоста
        return `Название: ${detailsObj.host_name}\nАдрес: ${detailsObj.ip_address}`;
        
      case "16": // Редактирование хоста
        return `Хост: ${detailsObj.host_name}\nИзмененные поля: ${detailsObj.changed_fields?.join(', ') || 'не указаны'}\nПредыдущие значения: ${detailsObj.old_values ? JSON.stringify(detailsObj.old_values) : 'не сохранены'}`;
        
      case "21": // Создание проекта
        return `Название: ${detailsObj.project_name}\nОписание: ${detailsObj.description || 'не указано'}\nКоличество проверок: ${detailsObj.checks_count || 0}`;
        
      case "23": // Запуск проекта
        return `Проект: ${detailsObj.project_name || detailsObj.project_id}\nСессия: ${detailsObj.session_id}\nХостов: ${detailsObj.hosts_count || 'неизвестно'}\nПользователь: ${detailsObj.executed_by || 'система'}`;
        
      case "24": // Запуск проекта планировщиком
        return `ID проекта: ${detailsObj.project_id}\nID задания планировщика: ${detailsObj.scheduler_job_id}\nСессия: ${detailsObj.session_id}\nОбласть: ${detailsObj.scope || 'не указана'}`;
        
      case "25": // Просмотр результатов проекта
        return `Проект: ${detailsObj.project_name || detailsObj.project_id}\nСессия: ${detailsObj.session_id}\nПользователь: ${detailsObj.viewed_by}\nВремя просмотра: ${detailsObj.viewed_at || new Date().toLocaleString()}`;
        
      case "26": // Экспорт результатов проекта
        return `Проект: ${detailsObj.project_name || detailsObj.project_id}\nСессия: ${detailsObj.session_id}\nФормат: ${detailsObj.format || 'Excel'}\nЭкспортировано: ${detailsObj.exported_by}\nВремя: ${detailsObj.exported_at || new Date().toLocaleString()}`;
        
      default:
        // Для остальных событий показываем читаемый JSON
        return Object.entries(detailsObj)
          .map(([key, value]) => {
            const fieldNames = {
              'project_id': 'ID проекта',
              'project_name': 'Название проекта',
              'session_id': 'ID сессии', 
              'host_id': 'ID хоста',
              'host_name': 'Название хоста',
              'hostname': 'Адрес хоста',
              'scheduler_job_id': 'ID задания планировщика',
              'scope': 'Область',
              'username': 'Логин',
              'role': 'Роль',
              'email': 'Email',
              'ip_address': 'IP-адрес',
              'user_agent': 'Браузер',
              'port': 'Порт',
              'description': 'Описание'
            };
            
            const fieldName = fieldNames[key] || key;
            return `${fieldName}: ${value}`;
          })
          .join('\n');
    }
  } catch (error) {
    return typeof details === 'string' ? details : JSON.stringify(details);
  }
};

const renderDetails = (details, eventNumber) => {
  // eventNumber приходит как цифра "1", "3" и т.д.
  const eventOption = EVENT_OPTIONS.find(opt => opt.value === eventNumber);
  const eventName = eventOption ? eventOption.label : `Событие ${eventNumber}`;
  
  if (!details) return "-";
  if (typeof details === "string") return details;
  
  try {
    const detailsObj = typeof details === 'string' ? JSON.parse(details) : details;
    
    // Можно добавить специфичное форматирование для разных цифровых событий
    switch(eventNumber) {
      case "1": // Успешный вход
        return `IP: ${detailsObj.ip_address || 'неизвестно'}\nБраузер: ${detailsObj.user_agent || 'неизвестно'}`;
        
      case "3": // Создание пользователя
        return `Новый пользователь: ${detailsObj.new_user}\nРоль: ${detailsObj.role || 'не указана'}`;
        
      case "24": // Запуск планировщиком
        return `ID проекта: ${detailsObj.project_id}\nID задания: ${detailsObj.scheduler_job_id}`;
        
      default:
        return JSON.stringify(detailsObj, null, 2);
    }
  } catch (error) {
    return typeof details === 'string' ? details : JSON.stringify(details);
  }
};

const LogsPage = () => {
  const { isAdmin } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedEvents, setSelectedEvents] = useState([]);
  const [limit, setLimit] = useState(100);

  const activeEventLabels = useMemo(() => {
    if (!selectedEvents.length) return "Все события";
    return EVENT_OPTIONS
      .filter((opt) => selectedEvents.includes(opt.value))
      .map((opt) => opt.label)
      .join(", ");
  }, [selectedEvents]);

  const toggleEvent = (value) => {
    setSelectedEvents((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = { limit };
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      if (selectedEvents.length) params.event_types = selectedEvents.join(",");

      const response = await api.get("/api/audit/logs", { params });
      setLogs(response.data);
    } catch (error) {
      console.error("Failed to load logs", error);
      toast.error(error.response?.data?.detail || "Не удалось загрузить логи");
    } finally {
      setLoading(false);
    }
  };

  // Обработчики изменений с дебаунсом
  const handleDateChange = (setter) => (e) => {
    setter(e.target.value);
  };

  const handleLimitChange = (e) => {
    setLimit(Number(e.target.value));
  };  

  useEffect(() => {
    if (!isAdmin) return;
  
    let isMounted = true;
    
    const timeoutId = setTimeout(() => {
      if (isMounted) {
        fetchLogs();
      }
    }, 300);
  
    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [isAdmin, startDate, endDate, limit, selectedEvents]);

  const handleReset = () => {
    setStartDate("");
    setEndDate("");
    setSelectedEvents([]);
    fetchLogs();
  };

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="py-12 flex flex-col items-center text-center text-gray-500">
          <ShieldAlert className="h-12 w-12 mb-4 text-gray-400" />
          <p className="text-lg font-medium">Доступ к журналу разрешён только администраторам</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Журнал событий</h1>
          <p className="text-sm text-gray-500">Отслеживание действий пользователей и системы</p>
        </div>
      </div>
  
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <CardTitle>Фильтры</CardTitle>
              <CardDescription>Фильтры применяются автоматически</CardDescription>
            </div>
          </div>
          <Button variant="outline" onClick={handleReset} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Сбросить все фильтры
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-600">Дата от</label>
              <Input 
                type="date" 
                value={startDate} 
                onChange={handleDateChange(setStartDate)} 
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Дата до</label>
              <Input 
                type="date" 
                value={endDate} 
                onChange={handleDateChange(setEndDate)} 
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Количество записей</label>
              <Input
                type="number"
                min={1}
                max={500}
                value={limit}
                onChange={handleLimitChange}
              />
            </div>
          </div>
  
          <div>
            <label className="text-sm font-medium text-gray-600">Типы событий</label>
            <div className="mt-2 flex flex-wrap gap-2">
            {EVENT_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={selectedEvents.includes(option.value) ? "default" : "outline"}
                onClick={() => toggleEvent(option.value)}
                className="text-sm"
              >
                {option.label}
              </Button>
            ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">Выбрано: {activeEventLabels}</p>
          </div>
        </CardContent>
      </Card>
  
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Последние события</CardTitle>
          <div className="flex items-center gap-2">
            {loading && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Загрузка...
              </div>
            )}
            <Badge variant="outline">{logs.length} записей</Badge>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Дата</TableHead>
                <TableHead>Событие</TableHead>
                <TableHead>Пользователь</TableHead>
                <TableHead>Детали</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-gray-500">
                    События не найдены
                  </TableCell>
                </TableRow>
              )}
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap">{formatDate(log.created_at)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {EVENT_OPTIONS.find(option => option.value === log.event)?.label || log.event}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{log.username || "Система"}</span>
{/*}                      <span className="text-xs text-gray-500">{log.user_id || "-"}</span> */}
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="text-xs text-gray-700 whitespace-pre-wrap">
                      {formatEventDetails(log.event, log.details)}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default LogsPage;

