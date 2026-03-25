import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Plus,
  Upload,
  Trash2,
  Loader2,
  Play,
  ShieldCheck,
  FileText,
  RefreshCw,
  CalendarClock,
  FileDown,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "../config/api";
import { ConfirmationDialog } from "@/components/ui/ConfirmationDialog";

const SCHEDULE_INTERVALS = [
  { value: "daily", short: "24 ч", label: "Раз в 24 часа" },
  { value: "weekly", short: "7 дн.", label: "Раз в 7 дней" },
  { value: "monthly", short: "Месяц", label: "Раз в месяц" },
];

const REPORT_INTERVALS = [
  { value: "weekly", short: "7 дн.", label: "Раз в 7 дней", periodDays: 7 },
  { value: "monthly", short: "30 дн.", label: "Раз в 30 дней", periodDays: 30 },
];

function reportIntervalToIndex(interval) {
  const i = REPORT_INTERVALS.findIndex((x) => x.value === interval);
  return i >= 0 ? i : 0;
}

function intervalToIndex(interval) {
  const i = SCHEDULE_INTERVALS.findIndex((x) => x.value === interval);
  return i >= 0 ? i : 0;
}

export default function ConfigIntegrityPage() {
  const { hasPermission, isAdmin } = useAuth();
  const canManage = isAdmin || hasPermission("config_integrity_manage");

  const [hosts, setHosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  // Import is handled via a hidden file input (no modal dialog)
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [configContent, setConfigContent] = useState({ name: "", content: "" });

  const [initLoading, setInitLoading] = useState(false);
  const [checkLoading, setCheckLoading] = useState(false);

  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleIntervalIdx, setScheduleIntervalIdx] = useState(0);
  const [scheduleNextRun, setScheduleNextRun] = useState(null);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleWallTime, setScheduleWallTime] = useState("09:00");
  const [scheduleTimezone, setScheduleTimezone] = useState("Europe/Moscow");

  const scheduleEnabledRef = useRef(false);
  const schedulePersistTimerRef = useRef(null);

  const [reportEnabled, setReportEnabled] = useState(false);
  const [reportIntervalIdx, setReportIntervalIdx] = useState(0);
  const [reportNextRun, setReportNextRun] = useState(null);
  const [reportSaving, setReportSaving] = useState(false);
  const [reportGenerating, setReportGenerating] = useState(false);
  const [reports, setReports] = useState([]);

  const reportEnabledRef = useRef(false);
  const reportPersistTimerRef = useRef(null);

  const [formData, setFormData] = useState({
    name: "",
    ip_address: "",
    port: 22,
    username: "root",
    auth_type: "password",
    password: "",
    ssh_key: "",
  });

  const fileInputRef = useRef(null);
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: "",
    description: "",
    onConfirm: null,
    variant: "default",
  });

  const fetchHosts = useCallback(async () => {
    try {
      const res = await api.get("/api/config-integrity/hosts");
      setHosts(res.data);
    } catch (e) {
      toast.error("Ошибка загрузки хостов");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSchedule = useCallback(async () => {
    try {
      const res = await api.get("/api/config-integrity/schedule");
      const s = res.data;
      setScheduleEnabled(Boolean(s.enabled));
      setScheduleIntervalIdx(intervalToIndex(s.interval));
      setScheduleNextRun(s.next_run_at || null);
      if (s.schedule_wall_time) setScheduleWallTime(s.schedule_wall_time);
      if (s.schedule_timezone) setScheduleTimezone(s.schedule_timezone);
    } catch {
      /* нет права просмотра или сеть */
    }
  }, []);

  const fetchReportSchedule = useCallback(async () => {
    try {
      const res = await api.get("/api/config-integrity/report-schedule");
      const s = res.data;
      setReportEnabled(Boolean(s.enabled));
      setReportIntervalIdx(reportIntervalToIndex(s.interval));
      setReportNextRun(s.next_run_at || null);
    } catch {
      /* no-op */
    }
  }, []);

  const fetchReports = useCallback(async () => {
    try {
      const res = await api.get("/api/config-integrity/reports");
      setReports(res.data || []);
    } catch {
      /* no-op */
    }
  }, []);

  const persistSchedule = useCallback(
    async (enabled, intervalIdx) => {
      const interval = SCHEDULE_INTERVALS[intervalIdx]?.value || "daily";
      setScheduleSaving(true);
      try {
        const res = await api.put("/api/config-integrity/schedule", {
          enabled,
          interval,
        });
        setScheduleNextRun(res.data.next_run_at || null);
        if (res.data.schedule_wall_time) setScheduleWallTime(res.data.schedule_wall_time);
        if (res.data.schedule_timezone) setScheduleTimezone(res.data.schedule_timezone);
      } catch (e) {
        toast.error(e.response?.data?.detail || "Не удалось сохранить расписание");
        await fetchSchedule();
      } finally {
        setScheduleSaving(false);
      }
    },
    [fetchSchedule]
  );

  const persistReportSchedule = useCallback(
    async (enabled, intervalIdx) => {
      const interval = REPORT_INTERVALS[intervalIdx]?.value || "weekly";
      setReportSaving(true);
      try {
        const res = await api.put("/api/config-integrity/report-schedule", {
          enabled,
          interval,
        });
        setReportNextRun(res.data.next_run_at || null);
      } catch (e) {
        toast.error(e.response?.data?.detail || "Не удалось сохранить расписание отчёта");
        await fetchReportSchedule();
      } finally {
        setReportSaving(false);
      }
    },
    [fetchReportSchedule]
  );

  const handleGenerateReport = async () => {
    setReportGenerating(true);
    try {
      const periodDays = REPORT_INTERVALS[reportIntervalIdx]?.periodDays || 7;
      const res = await api.post(
        "/api/config-integrity/report/pdf",
        { period_days: periodDays },
        { responseType: "blob" }
      );

      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `config-integrity-report-${periodDays}d.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast.success("PDF отчёт сформирован");
    } catch (e) {
      const msg =
        e.response?.data?.detail ||
        e.message ||
        "Не удалось сформировать PDF отчёт";
      toast.error(msg);
    } finally {
      setReportGenerating(false);
    }
  };

  useEffect(() => {
    scheduleEnabledRef.current = scheduleEnabled;
  }, [scheduleEnabled]);

  useEffect(() => {
    reportEnabledRef.current = reportEnabled;
  }, [reportEnabled]);

  useEffect(() => {
    return () => {
      if (schedulePersistTimerRef.current) {
        clearTimeout(schedulePersistTimerRef.current);
      }
      if (reportPersistTimerRef.current) {
        clearTimeout(reportPersistTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    fetchHosts();
    fetchSchedule();
    fetchReportSchedule();
    fetchReports();
  }, [fetchHosts, fetchSchedule, fetchReportSchedule, fetchReports]);

  const resetForm = () => {
    setFormData({
      name: "",
      ip_address: "",
      port: 22,
      username: "root",
      auth_type: "password",
      password: "",
      ssh_key: "",
    });
  };

  const handleAddHost = async () => {
    if (!formData.name || !formData.ip_address || !formData.username) {
      toast.error("Заполните обязательные поля");
      return;
    }
    try {
      await api.post("/api/config-integrity/hosts", formData);
      toast.success("Хост добавлен");
      setAddDialogOpen(false);
      resetForm();
      fetchHosts();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Ошибка добавления хоста");
    }
  };

  const handleImportJson = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const hostsArr = Array.isArray(json) ? json : json.hosts || [json];
      await api.post("/api/config-integrity/hosts/import", { hosts: hostsArr });
      toast.success(`Импортировано хостов: ${hostsArr.length}`);
      fetchHosts();
    } catch (e) {
      toast.error("Ошибка импорта: " + (e.response?.data?.detail || e.message));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = (hostId, hostName) => {
    setConfirmDialog({
      open: true,
      title: "Удалить хост?",
      description: `Вы уверены, что хотите удалить хост "${hostName}"?`,
      variant: "destructive",
      onConfirm: async () => {
        try {
          await api.delete(`/api/config-integrity/hosts/${hostId}`);
          toast.success("Хост удалён");
          fetchHosts();
        } catch {
          toast.error("Ошибка удаления");
        }
        setConfirmDialog((p) => ({ ...p, open: false }));
      },
    });
  };

  const handleInitialize = async () => {
    const ids =
      selectedIds.size > 0
        ? [...selectedIds]
        : hosts.filter((h) => !h.is_monitored).map((h) => h.id);
    if (ids.length === 0) {
      toast.info("Нет хостов для инициализации");
      return;
    }
    setInitLoading(true);
    try {
      const res = await api.post("/api/config-integrity/hosts/initialize", {
        host_ids: ids,
      });
      const results = res.data;
      const ok = results.filter((r) => r.success).length;
      const fail = results.filter((r) => !r.success).length;
      if (ok > 0) toast.success(`Инициализировано: ${ok}`);
      if (fail > 0) {
        const errors = results
          .filter((r) => !r.success)
          .map((r) => r.error)
          .join("; ");
        toast.error(`Ошибки (${fail}): ${errors}`);
      }
      fetchHosts();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Ошибка инициализации");
    } finally {
      setInitLoading(false);
    }
  };

  const handleCheck = async () => {
    const monitoredIds = hosts
      .filter((h) => h.is_monitored)
      .map((h) => h.id);
    const ids =
      selectedIds.size > 0
        ? [...selectedIds].filter((id) =>
            monitoredIds.includes(id)
          )
        : monitoredIds;
    if (ids.length === 0) {
      toast.info("Нет контролируемых хостов для проверки");
      return;
    }
    setCheckLoading(true);
    try {
      const res = await api.post("/api/config-integrity/hosts/check", {
        host_ids: ids,
      });
      const results = res.data;
      const ok = results.filter((r) => r.success).length;
      const fail = results.filter((r) => !r.success).length;
      if (ok > 0) toast.success(`Проверено: ${ok}`);
      if (fail > 0) {
        const errors = results
          .filter((r) => !r.success)
          .map((r) => r.error)
          .join("; ");
        toast.error(`Ошибки (${fail}): ${errors}`);
      }
      fetchHosts();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Ошибка проверки");
    } finally {
      setCheckLoading(false);
    }
  };

  const handleViewConfig = async (hostId) => {
    try {
      const res = await api.get(
        `/api/config-integrity/hosts/${hostId}/afick-config`
      );
      setConfigContent(res.data);
      setConfigDialogOpen(true);
    } catch {
      toast.error("Не удалось загрузить конфигурацию afick");
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === hosts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(hosts.map((h) => h.id)));
    }
  };

  const fmtDate = (d) => {
    if (!d) return "—";
    return new Date(d).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">
        Проверка неизменности конфигурации
      </h1>

      {/* Action buttons + schedules + reports */}
      {hosts.length > 0 && (
        <div className="space-y-4">
          {canManage && (
            <Card>
              <CardContent className="p-4 flex flex-wrap items-start gap-x-4 gap-y-2">
                <div className="flex flex-col gap-1">
                  <Button
                    onClick={handleInitialize}
                    disabled={initLoading || checkLoading}
                    variant="default"
                  >
                    {initLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4 mr-2" />
                    )}
                    Инициализация инструмента проверки
                    {selectedIds.size > 0 && ` (${selectedIds.size})`}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {selectedIds.size > 0
                      ? `Выбрано хостов: ${selectedIds.size}. Действие — только для выбранных.`
                      : "Инициализация — один раз для хостов не на контроле."}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <Button
                    onClick={handleCheck}
                    disabled={checkLoading || initLoading}
                    variant="secondary"
                  >
                    {checkLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Проверить неизменность конфигурации
                    {selectedIds.size > 0 && ` (${selectedIds.size})`}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Проверка — для всех контролируемых (или всех отмеченных).
                  </span>
                </div>
                <div className="flex gap-2 ml-auto">
                  <Button onClick={() => setAddDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" /> Добавить хост
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      fileInputRef.current?.click();
                    }}
                  >
                    <Upload className="h-4 w-4 mr-2" /> Импорт JSON
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <CalendarClock className="h-4 w-4 text-muted-foreground" />
                  Автопроверка по расписанию
                </div>
                <p className="text-xs text-muted-foreground">
                  Для всех контролируемых хостов. Старт в{" "}
                  <span className="font-medium text-foreground">{scheduleWallTime}</span>{" "}
                  ({scheduleTimezone}).
                </p>
                {canManage ? (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm">Включить</span>
                      <div className="flex items-center gap-2">
                        {scheduleSaving && (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                        <Switch
                          checked={scheduleEnabled}
                          disabled={scheduleSaving}
                          onCheckedChange={(v) => {
                            setScheduleEnabled(v);
                            persistSchedule(v, scheduleIntervalIdx);
                          }}
                        />
                      </div>
                    </div>
                    <div className={`space-y-2 ${!scheduleEnabled ? "opacity-50 pointer-events-none" : ""}`}>
                      <Slider
                        value={[scheduleIntervalIdx]}
                        min={0}
                        max={2}
                        step={1}
                        disabled={!scheduleEnabled || scheduleSaving}
                        onValueChange={(v) => {
                          const idx = v[0] ?? 0;
                          setScheduleIntervalIdx(idx);
                          if (schedulePersistTimerRef.current) clearTimeout(schedulePersistTimerRef.current);
                          if (!scheduleEnabledRef.current) return;
                          schedulePersistTimerRef.current = setTimeout(() => {
                            persistSchedule(true, idx);
                            schedulePersistTimerRef.current = null;
                          }, 400);
                        }}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground px-0.5">
                        {SCHEDULE_INTERVALS.map((x) => (
                          <span key={x.value} className="text-center max-w-[5.5rem]">
                            {x.short}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {SCHEDULE_INTERVALS[scheduleIntervalIdx].label}
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {scheduleEnabled
                      ? `${SCHEDULE_INTERVALS[scheduleIntervalIdx].label}. Следующий запуск: ${fmtDate(scheduleNextRun)}`
                      : "Автопроверка выключена."}
                  </p>
                )}
                {scheduleEnabled && scheduleNextRun && canManage && (
                  <p className="text-xs text-muted-foreground">
                    Следующий запуск: {fmtDate(scheduleNextRun)}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FileDown className="h-4 w-4 text-muted-foreground" />
                  Отчётность
                </div>
                <p className="text-xs text-muted-foreground">
                  Таблица по всем контролируемым хостам + итоги за период.
                </p>
                {canManage && (
                  <Button
                    variant="outline"
                    disabled={reportGenerating}
                    onClick={handleGenerateReport}
                  >
                    {reportGenerating ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <FileDown className="h-4 w-4 mr-2" />
                    )}
                    Сформировать отчёт
                  </Button>
                )}
                {canManage ? (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm">Автогенерация</span>
                      <div className="flex items-center gap-2">
                        {reportSaving && (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                        <Switch
                          checked={reportEnabled}
                          disabled={reportSaving}
                          onCheckedChange={(v) => {
                            setReportEnabled(v);
                            persistReportSchedule(v, reportIntervalIdx);
                          }}
                        />
                      </div>
                    </div>
                    <div className={`space-y-2 ${!reportEnabled ? "opacity-50 pointer-events-none" : ""}`}>
                      <Slider
                        value={[reportIntervalIdx]}
                        min={0}
                        max={1}
                        step={1}
                        disabled={!reportEnabled || reportSaving}
                        onValueChange={(v) => {
                          const idx = v[0] ?? 0;
                          setReportIntervalIdx(idx);
                          if (reportPersistTimerRef.current) clearTimeout(reportPersistTimerRef.current);
                          if (!reportEnabledRef.current) return;
                          reportPersistTimerRef.current = setTimeout(() => {
                            persistReportSchedule(true, idx);
                            reportPersistTimerRef.current = null;
                          }, 400);
                        }}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground px-0.5">
                        {REPORT_INTERVALS.map((x) => (
                          <span key={x.value} className="text-center max-w-[7rem]">
                            {x.short}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {REPORT_INTERVALS[reportIntervalIdx].label}
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {reportEnabled
                      ? `${REPORT_INTERVALS[reportIntervalIdx].label}. Следующий запуск: ${fmtDate(reportNextRun)}`
                      : "Автоотчёт выключен."}
                  </p>
                )}
                {reportEnabled && reportNextRun && canManage && (
                  <p className="text-xs text-muted-foreground">
                    Следующий запуск: {fmtDate(reportNextRun)}
                  </p>
                )}
                {reports?.length > 0 && (
                  <div className="pt-1">
                    <div className="text-xs text-muted-foreground mb-1">Последние отчёты</div>
                    <div className="flex flex-wrap gap-1">
                      {reports.slice(0, 3).map((r) => (
                        <Button
                          key={r.id}
                          variant="ghost"
                          className="justify-start h-auto py-1 px-2 text-left"
                          onClick={async () => {
                            const doc = await api.get(`/api/config-integrity/reports/${r.id}`);
                            const html = doc.data?.html;
                            const w = window.open("", "_blank", "noopener,noreferrer");
                            if (w) {
                              w.location.href =
                                "data:text/html;charset=utf-8," +
                                encodeURIComponent(html || "<pre>Report HTML missing</pre>");
                            }
                          }}
                        >
                          <span className="text-xs">
                            {r.generated_at ? fmtDate(r.generated_at) : r.id}
                          </span>
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Hosts table */}
      {hosts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <ShieldCheck className="mx-auto h-12 w-12 mb-4 opacity-40" />
            <p>Хосты ещё не добавлены.</p>
            <p className="text-sm mt-1">
              Добавьте хост вручную или импортируйте из JSON-файла.
            </p>
            {canManage && (
              <div className="flex justify-center gap-2 mt-4">
                <Button onClick={() => setAddDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" /> Добавить хост
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    fileInputRef.current?.click();
                  }}
                >
                  <Upload className="h-4 w-4 mr-2" /> Импорт JSON
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {canManage && (
                      <TableHead className="w-10">
                        <Checkbox
                          checked={
                            selectedIds.size === hosts.length &&
                            hosts.length > 0
                          }
                          onCheckedChange={toggleAll}
                        />
                      </TableHead>
                    )}
                    <TableHead>Имя хоста</TableHead>
                    <TableHead>IP-адрес</TableHead>
                    <TableHead>Контроль</TableHead>
                    <TableHead className="text-right">
                      Контр. файлов
                    </TableHead>
                    <TableHead className="text-right">
                      Изменено
                    </TableHead>
                    <TableHead>Контрольная сумма</TableHead>
                    <TableHead>Последняя проверка</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hosts.map((h) => (
                    <TableRow key={h.id}>
                      {canManage && (
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(h.id)}
                            onCheckedChange={() => toggleSelect(h.id)}
                          />
                        </TableCell>
                      )}
                      <TableCell className="font-medium">{h.name}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {h.ip_address}
                      </TableCell>
                      <TableCell>
                        {h.is_monitored ? (
                          <Badge variant="default" className="bg-green-600">
                            Да
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Нет</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {h.monitored_files_count ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {h.changed_files_count != null ? (
                          h.changed_files_count > 0 ? (
                            <span className="text-red-600 font-semibold">
                              {h.changed_files_count}
                            </span>
                          ) : (
                            <span className="text-green-600">0</span>
                          )
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          className="font-mono text-xs break-all"
                          title={h.config_hash || ""}
                        >
                          {h.config_hash
                            ? h.config_hash.length > 24
                              ? h.config_hash.slice(0, 24) + "…"
                              : h.config_hash
                            : "—"}
                        </span>
                      </TableCell>
                      <TableCell>{fmtDate(h.last_check_at)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {h.is_monitored && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Просмотр afick.conf"
                              onClick={() => handleViewConfig(h.id)}
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                          )}
                          {canManage && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Удалить"
                              onClick={() => handleDelete(h.id, h.name)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add host dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Добавить хост</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Имя хоста *</Label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="web-server-01"
              />
            </div>
            <div>
              <Label>IP-адрес *</Label>
              <Input
                value={formData.ip_address}
                onChange={(e) =>
                  setFormData({ ...formData, ip_address: e.target.value })
                }
                placeholder="192.168.1.10"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Порт SSH</Label>
                <Input
                  type="number"
                  value={formData.port}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      port: parseInt(e.target.value) || 22,
                    })
                  }
                />
              </div>
              <div>
                <Label>Пользователь *</Label>
                <Input
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                />
              </div>
            </div>
            <div>
              <Label>Тип аутентификации</Label>
              <Select
                value={formData.auth_type}
                onValueChange={(v) =>
                  setFormData({ ...formData, auth_type: v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="password">Пароль</SelectItem>
                  <SelectItem value="key">SSH-ключ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formData.auth_type === "password" ? (
              <div>
                <Label>Пароль</Label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                />
              </div>
            ) : (
              <div>
                <Label>SSH-ключ (приватный)</Label>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formData.ssh_key}
                  onChange={(e) =>
                    setFormData({ ...formData, ssh_key: e.target.value })
                  }
                  placeholder="-----BEGIN RSA PRIVATE KEY-----"
                />
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setAddDialogOpen(false);
                  resetForm();
                }}
              >
                Отмена
              </Button>
              <Button onClick={handleAddHost}>Добавить</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden file input for JSON import (no modal) */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.txt,application/json,text/plain"
        className="hidden"
        onChange={handleImportJson}
      />

      {/* Afick config viewer dialog */}
      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              Конфигурация afick — {configContent.name}
            </DialogTitle>
          </DialogHeader>
          <pre className="text-xs bg-muted p-4 rounded overflow-auto max-h-[60vh] whitespace-pre-wrap font-mono">
            {configContent.content || "Конфигурация недоступна"}
          </pre>
        </DialogContent>
      </Dialog>

      {/* Confirmation dialog */}
      <ConfirmationDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        description={confirmDialog.description}
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((p) => ({ ...p, open: false }))}
      />
    </div>
  );
}
