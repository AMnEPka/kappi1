import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Filter, RefreshCw, ShieldAlert } from "lucide-react";
import { api } from "@/config/api";
import { useAuth } from "@/contexts/AuthContext";

const EVENT_OPTIONS = [
  { value: "user_login_success", label: "Успешный вход" },
  { value: "user_login_failed", label: "Неудачный вход" },
  { value: "host_created", label: "Создание хоста" },
  { value: "host_updated", label: "Редактирование хоста" },
  { value: "check_created", label: "Создание проверки" },
  { value: "check_updated", label: "Редактирование проверки" },
  { value: "project_created", label: "Создание проекта" },
  { value: "project_execution_started", label: "Запуск проекта" },
  { value: "project_results_viewed", label: "Просмотр результатов" },
  { value: "project_results_exported", label: "Экспорт результатов" },
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

const renderDetails = (details) => {
  if (!details) return "-";
  if (typeof details === "string") return details;
  try {
    return JSON.stringify(details, null, 2);
  } catch {
    return String(details);
  }
};

const LogsPage = () => {
  const { isAdmin } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedEvents, setSelectedEvents] = useState([]);
  const [limit, setLimit] = useState(200);

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

  useEffect(() => {
    if (isAdmin) {
      fetchLogs();
    }
  }, [isAdmin]);

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
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Сбросить
          </Button>
          <Button onClick={fetchLogs} disabled={loading}>
            <Filter className="h-4 w-4 mr-2" />
            Применить
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Фильтры</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-600">Дата от</label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Дата до</label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Количество записей</label>
              <Input
                type="number"
                min={1}
                max={500}
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
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
          <Badge variant="outline">{logs.length} записей</Badge>
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
              {logs.length === 0 && (
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
                    <Badge variant="outline" className="capitalize">
                      {log.event.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{log.username || "Система"}</span>
                      <span className="text-xs text-gray-500">{log.user_id || "-"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <pre className="text-xs bg-gray-50 rounded-md p-2 max-w-xl overflow-x-auto">
                      {renderDetails(log.details)}
                    </pre>
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

