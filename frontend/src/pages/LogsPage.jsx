import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RefreshCw, ShieldAlert, ChevronDown, Minus, ChevronUp  } from "lucide-react";
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
  // { value: "15", label: "Создание хоста" },
  // { value: "16", label: "Редактирование хоста" },
  // { value: "17", label: "Удаление хоста" },
  
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
  { value: "27", label: "Предоставлен доступ к проекту" },
  { value: "28", label: "Отозван доступ к проекту" },
  { value: "34", label: "Неуспешный запуск проекта" },   // наверное никогда не возникнет, тестово

    // Планировщик
  { value: "29", label: "Создание задания планировщика" },
  { value: "30", label: "Редактирование задания планировщика" },
  { value: "31", label: "Задание планировщика приостановлено" },
  { value: "32", label: "Задание планировщика возобновлено" },
  { value: "33", label: "Задание планировщика удалено" }
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
        return `Логин: ${detailsObj.username}
ФИО: ${detailsObj.target_full_name || 'ФИО'}`;
        
      case "5": // Удаление пользователя
        return `Удаленный пользователь: ${detailsObj.username}
ФИО: ${detailsObj.deleted_full_name}`;  

      case "6": // Создание роли
        return `Роль: ${detailsObj.role_name}
Прав: ${detailsObj.permissions_ratio}`;

      case "7": // Редактирование роли
        return `Роль: ${detailsObj.role_name}`;

      case "8": // Удаление роли
        return `Роль: ${detailsObj.role_name}`;
        
      case "9": // Создание категории
        return `Категория: ${detailsObj.category_name}`;

      case "10": // Редактирование категории
        return `Категория: ${detailsObj.category_name}`;

      case "11": // Удаление категории
        return `Категория: ${detailsObj.category_name}`;

      case "12": // Создание системы
        return `Система: ${detailsObj.system_name}
Родительская категория: ${detailsObj.category_name}`;        

      case "13": // Редактирование системы
        return `Система: ${detailsObj.system_name}
Родительская категория: ${detailsObj.category_name}`;  

      case "14": // Удаление системы
        return `Система: ${detailsObj.system_name}`;
              
//       case "15": // Создание хоста
//         return `Название: ${detailsObj.host_name}
// Адрес: ${detailsObj.ip_address}`;
        
//       case "16": // Редактирование хоста
//         return `Название: ${detailsObj.host_name}
// Адрес: ${detailsObj.ip_address}`;

//       case "17": // Удаление хоста
//         return `Хост: ${detailsObj.host_name}
// Адрес: ${detailsObj.hostname}`;
        
      case "18": // Создание проверки
        return `Название: ${detailsObj.script_name}
Система: ${detailsObj.system_name}
Категория: ${detailsObj.category_name}`;

      case "19": // Редактирование проверки
        return `Название: ${detailsObj.script_name}
Система: ${detailsObj.system_name}
Категория: ${detailsObj.category_name}`;

      case "20": // Удаление проверки
          return `Проверка: ${detailsObj.script_name}
Система: ${detailsObj.system_name}
Категория: ${detailsObj.category_name}`;

      case "21": // Создание проекта
        return `Название: ${detailsObj.project_name}
Описание: ${detailsObj.project_description || 'Не указано'}`;

      case "22": // Удаление проекта
        return `Название: ${detailsObj.project_name}`;
        
      case "23": // Запуск проекта
        return `Проект: ${detailsObj.project_name}`;
    
      case "24": // Запуск проекта планировщиком
          return `Проект: ${detailsObj.project_name}
Задание планировщика: ${detailsObj.scheduler_job_name}`; 

      case "25": // Просмотр результатов проекта
        return `Проект: ${detailsObj.project_name}`;
        
      case "26": // Экспорт результатов проекта
        return `Проект: ${detailsObj.project_name}
Имя файла: ${detailsObj.project_filename}`; 

      case "27": // Предоставлен доступ к проекту
        return `Проект: ${detailsObj.project_name}
Пользователь: ${detailsObj.target_username}`;
      
      case "28": // Отозван доступ к проекту
        return `Проект: ${detailsObj.project_name}
Пользователь: ${detailsObj.target_username}`;        

      case "29": // Создание задания планировщика
        return `Задание: ${detailsObj.job_name}
Проект: ${detailsObj.project_name}
Тип запуска: ${detailsObj.job_type_label}`;

      case "30": // Редактирование задания планировщика
        return `Задание: ${detailsObj.job_name}
Проект: ${detailsObj.project_name}
Тип запуска: ${detailsObj.job_type_label}`;

      case "31": // Задание планировщика приостановлено
        return `Задание: ${detailsObj.job_name}
Проект: ${detailsObj.project_name}
Тип запуска: ${detailsObj.job_type_label}`;

      case "32": // Задание планировщика возобновлено
        return `Задание: ${detailsObj.job_name}
Проект: ${detailsObj.project_name}
Тип запуска: ${detailsObj.job_type_label}`;

      case "33": // Задание планировщика удалено
        return `Задание: ${detailsObj.job_name}
Проект: ${detailsObj.project_name}
Тип запуска: ${detailsObj.job_type_label}`;

      case "34": // Неуспешный запуск проекта
        return `Проект: ${detailsObj.project_name}
Причина: ${detailsObj.failure_reason}`;
        
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

const LogsPage = () => {
  const { isAdmin } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedEvents, setSelectedEvents] = useState([]);
  const [excludedEvents, setExcludedEvents] = useState([]);
  const [limit, setLimit] = useState(250);
  const [isEventsExpanded, setIsEventsExpanded] = useState(false);

  // Функция для форматирования даты в YYYY-MM-DD
  const formatDateForInput = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Функция для получения дат по умолчанию
  const getDefaultDates = () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    
    return {
      start: formatDateForInput(yesterday),
      end: formatDateForInput(today)
    };
  };

  // Установка дат по умолчанию при загрузке компонента
  useEffect(() => {
    const dates = getDefaultDates();
    setStartDate(dates.start);
    setEndDate(dates.end);
  }, []);

  const activeEventLabels = useMemo(() => {
    if (selectedEvents.length > 0) {
      const selected = EVENT_OPTIONS
        .filter((opt) => selectedEvents.includes(opt.value))
        .map((opt) => opt.label)
        .join(", ");
      return `Выбранные типы событий: ${selected}`;
    }
    if (excludedEvents.length > 0) {
      const excluded = EVENT_OPTIONS
        .filter((opt) => excludedEvents.includes(opt.value))
        .map((opt) => opt.label)
        .join(", ");
      return `Показываются все типы событий кроме: ${excluded}`;
    }
    return "Показываются все типы событий (лимит 250 сообщений)";
  }, [selectedEvents, excludedEvents]);

  const toggleEvent = (value) => {
    // Remove from excluded if present
    setExcludedEvents((prev) => prev.filter((item) => item !== value));
    // Toggle in selected
    setSelectedEvents((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  };

  const toggleExcludeEvent = (value, e) => {
    e.stopPropagation();
    // Remove from selected if present
    setSelectedEvents((prev) => prev.filter((item) => item !== value));
    // Toggle in excluded
    setExcludedEvents((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = { limit };
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      if (selectedEvents.length) {
        params.event_types = selectedEvents.join(",");
      } else if (excludedEvents.length) {
        params.excluded_event_types = excludedEvents.join(",");
      }

      const response = await api.get("/api/audit/logs", { params });
      setLogs(response.data);
    } catch (error) {
      console.error("Failed to load logs", error);
      toast.error(error.response?.data?.detail || "Не удалось загрузить логи");
    } finally {
      setLoading(false);
    }
  };

  // Обработчики изменений
  const handleDateChange = (setter) => (e) => {
    setter(e.target.value);
  };

  const handleLimitChange = (e) => {
    setLimit(Number(e.target.value));
  };  

  const handleReset = () => {
    const dates = getDefaultDates();
    setStartDate(dates.start);
    setEndDate(dates.end);
    setSelectedEvents([]);
    setExcludedEvents([]);
    setLimit(250);
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
  }, [isAdmin, startDate, endDate, limit, selectedEvents, excludedEvents]);

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
          <p className="text-sm text-gray-500">Отслеживание действий пользователей в системе</p>
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

            {/* <div>
              <label className="text-sm font-medium text-gray-600">Количество записей</label>
              <Input
                type="number"
                min={1}
                max={500}
                value={limit}
                onChange={handleLimitChange}
              />
            </div> */}
          </div>

          <div>
            <label className="text-sm font-medium text-gray-600">Типы событий</label>
            <div className="mt-2">
              {/* Первая строка - всегда видимая */}
              <div className="flex flex-wrap gap-2">
                {EVENT_OPTIONS.slice(0, 6).map((option) => { // Показываем первые 6 событий
                  const isSelected = selectedEvents.includes(option.value);
                  const isExcluded = excludedEvents.includes(option.value);
                  
                  return (
                    <div key={option.value} className="relative inline-flex">
                      <Button
                        type="button"
                        variant={isSelected ? "default" : isExcluded ? "destructive" : "outline"}
                        onClick={() => toggleEvent(option.value)}
                        className={`text-sm pr-8 ${isExcluded ? 'opacity-70' : ''}`}
                      >
                        {option.label}
                      </Button>
                      <button
                        type="button"
                        onClick={(e) => toggleExcludeEvent(option.value, e)}
                        className={`absolute right-0 top-0 bottom-0 px-2 flex items-center justify-center hover:bg-black/10 rounded-r transition-colors ${
                          isExcluded ? 'text-white' : 'text-gray-600'
                        }`}
                        title={isExcluded ? "Убрать исключение" : "Исключить событие"}
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Кнопка для разворачивания/сворачивания остальных событий */}
              {EVENT_OPTIONS.length > 6 && (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEventsExpanded(!isEventsExpanded)}
                    className="text-xs text-gray-500 hover:text-gray-700 p-1 h-auto mt-2"
                  >
                    {isEventsExpanded ? (
                      <>
                        <ChevronUp className="h-3 w-3 mr-1" />
                        Свернуть
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3 w-3 mr-1" />
                        Показать еще {EVENT_OPTIONS.length - 6} типов событий
                      </>
                    )}
                  </Button>

                  {/* Остальные события (скрыты по умолчанию) */}
                  {isEventsExpanded && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {EVENT_OPTIONS.slice(6).map((option) => {
                        const isSelected = selectedEvents.includes(option.value);
                        const isExcluded = excludedEvents.includes(option.value);
                        
                        return (
                          <div key={option.value} className="relative inline-flex">
                            <Button
                              type="button"
                              variant={isSelected ? "default" : isExcluded ? "destructive" : "outline"}
                              onClick={() => toggleEvent(option.value)}
                              className={`text-sm pr-8 ${isExcluded ? 'opacity-70' : ''}`}
                            >
                              {option.label}
                            </Button>
                            <button
                              type="button"
                              onClick={(e) => toggleExcludeEvent(option.value, e)}
                              className={`absolute right-0 top-0 bottom-0 px-2 flex items-center justify-center hover:bg-black/10 rounded-r transition-colors ${
                                isExcluded ? 'text-white' : 'text-gray-600'
                              }`}
                              title={isExcluded ? "Убрать исключение" : "Исключить событие"}
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center"><b>{activeEventLabels}</b></p>
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