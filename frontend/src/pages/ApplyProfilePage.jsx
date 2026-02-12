import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { api, getAccessToken, getSSETicket } from "@/config/api";
import { toast } from "sonner";
import {
  Server,
  Shield,
  Loader2,
  Upload,
  Plus,
  Trash2,
  ChevronRight,
  Lock,
  Library,
  Play,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";

const OS_LABELS = { linux: "Linux", windows: "Windows" };

function getOsFromHost(host) {
  return host?.connection_type === "winrm" ? "windows" : "linux";
}

export default function ApplyProfilePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canApply = hasPermission("ib_profiles_apply");
  const canViewProfiles = hasPermission("ib_profiles_view");

  const [hosts, setHosts] = useState([]); // all hosts from API
  const [selectedHostIds, setSelectedHostIds] = useState([]); // host ids chosen for apply
  const [profiles, setProfiles] = useState([]);
  const [systems, setSystems] = useState([]);
  const [profileByOs, setProfileByOs] = useState({ linux: "", windows: "" });
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [step, setStep] = useState(1);
  const [hostDialogOpen, setHostDialogOpen] = useState(false);
  const [hostFormData, setHostFormData] = useState({
    name: "",
    hostname: "",
    port: 22,
    username: "",
    auth_type: "password",
    password: "",
    ssh_key: "",
    connection_type: "ssh",
  });
  const [savingHost, setSavingHost] = useState(false);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ total: 0, completed: 0, failed: 0 });
  const fileInputRef = useRef(null);
  const eventSourceRef = useRef(null);
  const logsEndRef = useRef(null);

  const loadHosts = useCallback(async () => {
    try {
      const res = await api.get("/api/hosts");
      setHosts(res.data || []);
    } catch (_) {}
  }, []);
  const loadProfiles = useCallback(async () => {
    if (!canViewProfiles) return;
    try {
      const res = await api.get("/api/ib-profiles");
      setProfiles(res.data || []);
    } catch (_) {}
  }, [canViewProfiles]);
  const loadSystems = useCallback(async () => {
    try {
      const res = await api.get("/api/systems");
      setSystems(res.data || []);
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (!getAccessToken()) {
      setLoading(false);
      return;
    }
    loadHosts();
    loadProfiles();
    loadSystems();
    setLoading(false);
  }, [loadHosts, loadProfiles, loadSystems]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // From IS Catalog: location.state?.fromIsCatalogHostIds
  useEffect(() => {
    const fromCatalog = location.state?.fromIsCatalogHostIds;
    if (Array.isArray(fromCatalog) && fromCatalog.length > 0) {
      setSelectedHostIds((prev) => {
        const merged = new Set([...prev, ...fromCatalog]);
        return [...merged];
      });
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state?.fromIsCatalogHostIds, location.pathname, navigate]);

  const selectedHosts = selectedHostIds
    .map((id) => hosts.find((h) => h.id === id))
    .filter(Boolean);
  const groupedByOs = {
    linux: selectedHosts.filter((h) => getOsFromHost(h) === "linux"),
    windows: selectedHosts.filter((h) => getOsFromHost(h) === "windows"),
  };
  const hasLinux = groupedByOs.linux.length > 0;
  const hasWindows = groupedByOs.windows.length > 0;

  const profilesForLinux = profiles.filter((p) => {
    const sys = systems.find((s) => s.id === p.system_id);
    return sys?.os_type === "linux";
  });
  const profilesForWindows = profiles.filter((p) => {
    const sys = systems.find((s) => s.id === p.system_id);
    return sys?.os_type === "windows";
  });

  const addHostById = (id) => {
    if (id && !selectedHostIds.includes(id)) setSelectedHostIds((prev) => [...prev, id]);
  };
  const removeHost = (id) => setSelectedHostIds((prev) => prev.filter((x) => x !== id));

  const resetHostForm = () => {
    setHostFormData({
      name: "",
      hostname: "",
      port: 22,
      username: "",
      auth_type: "password",
      password: "",
      ssh_key: "",
      connection_type: "ssh",
    });
  };

  const handleAddHostSubmit = async (e) => {
    e.preventDefault();
    setSavingHost(true);
    try {
      const payload = {
        name: hostFormData.name,
        hostname: hostFormData.hostname,
        port: hostFormData.port ?? 22,
        username: hostFormData.username,
        auth_type: hostFormData.auth_type,
        connection_type: hostFormData.connection_type || "ssh",
      };
      if (hostFormData.auth_type === "password" && hostFormData.password) payload.password = hostFormData.password;
      if (hostFormData.auth_type === "key" && hostFormData.ssh_key) payload.ssh_key = hostFormData.ssh_key;
      const res = await api.post("/api/hosts", payload);
      const newId = res.data?.id;
      if (newId) {
        setSelectedHostIds((prev) => [...prev, newId]);
        await loadHosts();
        setHostDialogOpen(false);
        resetHostForm();
        toast.success("Хост добавлен");
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Ошибка добавления хоста");
    } finally {
      setSavingHost(false);
    }
  };

  const handleFileImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        const lines = text.trim().split("\n").filter((l) => l.trim());
        data = lines.map((line) => JSON.parse(line));
      }
      const list = Array.isArray(data) ? data : [data];
      const ids = list.map((x) => (typeof x === "string" ? x : x.id || x.host_id));
      const validIds = ids.filter((id) => hosts.some((h) => h.id === id));
      if (validIds.length > 0) {
        setSelectedHostIds((prev) => [...new Set([...prev, ...validIds])]);
        await loadHosts();
        toast.success(`Добавлено хостов: ${validIds.length}`);
      } else {
        const created = [];
        for (const item of list) {
          if (typeof item === "string") continue;
          try {
            const res = await api.post("/api/hosts", {
              name: item.name,
              hostname: item.hostname,
              port: item.port ?? 22,
              username: item.username,
              auth_type: item.auth_type || "password",
              password: item.password,
              ssh_key: item.ssh_key,
              connection_type: item.connection_type ?? "ssh",
            });
            if (res.data?.id) {
              created.push(res.data.id);
              setSelectedHostIds((prev) => [...prev, res.data.id]);
            }
          } catch (_) {}
        }
        await loadHosts();
        if (created.length) toast.success(`Импорт: добавлено хостов ${created.length}`);
        else toast.error("Не удалось добавить хосты из файла");
      }
    } catch (err) {
      toast.error("Ошибка чтения или разбора файла");
    }
    e.target.value = "";
  };

  const handleApply = async () => {
    if (!canApply) return;
    if (selectedHostIds.length === 0) {
      toast.error("Добавьте хотя бы один хост");
      return;
    }
    const needLinux = hasLinux && !profileByOs.linux;
    const needWindows = hasWindows && !profileByOs.windows;
    if (needLinux || needWindows) {
      toast.error("Для каждой группы хостов (Linux/Windows) выберите профиль");
      return;
    }
    setApplying(true);
    setLogs([]);
    setStats({ total: 0, completed: 0, failed: 0 });
    try {
      const startRes = await api.post("/api/ib-profiles/apply/start", {
        host_ids: selectedHostIds,
        profile_by_os: { linux: profileByOs.linux || undefined, windows: profileByOs.windows || undefined },
      });
      const sessionId = startRes.data?.session_id;
      if (!sessionId) {
        toast.error("Не получен идентификатор сессии");
        setApplying(false);
        return;
      }
      let ticket;
      try {
        ticket = await getSSETicket();
      } catch (err) {
        console.error('Failed to obtain SSE ticket:', err);
        toast.error("Не удалось получить SSE-тикет для стриминга");
        setApplying(false);
        return;
      }
      const protocol = window.location.protocol;
      const host = window.location.host;
      const streamUrl = `${protocol}//${host}/api/ib-profiles/apply/${sessionId}/stream?ticket=${ticket}`;
      const eventSource = new EventSource(streamUrl);
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLogs((prev) => {
            if (data.type === "script_progress") {
              const lastIndex = prev.length - 1;
              if (lastIndex >= 0 && prev[lastIndex].type === "script_progress" && prev[lastIndex].host_name === data.host_name) {
                return [...prev.slice(0, lastIndex), data];
              }
            }
            return [...prev, data];
          });
          if (data.type === "info" && data.message) {
            const m = data.message.match(/Всего хостов: (\d+)/);
            if (m) setStats((s) => ({ ...s, total: parseInt(m[1], 10) }));
          } else if (data.type === "task_complete") {
            setStats((s) => ({
              ...s,
              completed: s.completed + (data.success ? 1 : 0),
              failed: s.failed + (data.success ? 0 : 1),
            }));
          } else if (data.type === "task_error") {
            setStats((s) => ({ ...s, failed: s.failed + 1 }));
          } else if (data.type === "complete") {
            setStats({ total: data.total, completed: data.completed, failed: data.failed });
            setApplying(false);
            eventSource.close();
            eventSourceRef.current = null;
            toast.success(
              data.failed === 0
                ? `Применено успешно: ${data.completed}/${data.total}`
                : `Завершено: ${data.completed}/${data.total}, ошибок: ${data.failed}`
            );
          } else if (data.type === "error") {
            setApplying(false);
            eventSource.close();
            eventSourceRef.current = null;
            toast.error(data.message || "Ошибка выполнения");
          }
        } catch (e) {
          console.error("Parse SSE data:", e);
        }
      };

      eventSource.onerror = () => {
        if (eventSourceRef.current?.readyState === EventSource.CLOSED) return;
        eventSource.close();
        eventSourceRef.current = null;
        setApplying(false);
        if (logs.length === 0) toast.error("Не удалось подключиться к потоку выполнения");
      };
    } catch (err) {
      toast.error(err.response?.data?.detail || "Ошибка запуска применения");
      setApplying(false);
    }
  };

  if (!canApply && !canViewProfiles) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center min-h-[320px]">
          <Lock className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-sm">Нет прав для применения профилей ИБ</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Применение профилей ИБ</h1>
        <p className="text-muted-foreground mt-1">Выбор хостов, сопоставление профилей по ОС и применение</p>
      </div>

      <div className="flex gap-2">
        <Button variant={step === 1 ? "default" : "outline"} onClick={() => setStep(1)}>
          1. Хосты
        </Button>
        <Button variant={step === 2 ? "default" : "outline"} onClick={() => setStep(2)} disabled={selectedHostIds.length === 0}>
          2. Профили
        </Button>
        <Button variant={step === 3 ? "default" : "outline"} onClick={() => setStep(3)} disabled={selectedHostIds.length === 0}>
          3. Применить
        </Button>
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Шаг 1: Выбор хостов</CardTitle>
            <CardDescription>
              Ручной ввод, импорт JSON или выбор из каталога ИС (кнопка «Применить профиль ИБ» на странице Каталог ИС).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2 items-center">
              <Button variant="outline" size="sm" onClick={() => { resetHostForm(); setHostDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-1" />
                Ввод / JSON
              </Button>
              <input type="file" accept=".json,.txt" ref={fileInputRef} className="hidden" onChange={handleFileImport} />
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-1" />
                Импорт файла
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate("/is-catalog")}>
                <Library className="h-4 w-4 mr-1" />
                Из каталога ИС
              </Button>
            </div>

            <Dialog open={hostDialogOpen} onOpenChange={(open) => { setHostDialogOpen(open); if (!open) resetHostForm(); }}>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Новый хост</DialogTitle>
                  <DialogDescription>Внесите информацию о сервере</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddHostSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Название</Label>
                      <Input
                        placeholder="ЗАКС сервер хранения"
                        value={hostFormData.name}
                        onChange={(e) => setHostFormData((p) => ({ ...p, name: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Хост</Label>
                      <Input
                        placeholder="192.168.1.1 или host1.rn.ru"
                        value={hostFormData.hostname}
                        onChange={(e) => setHostFormData((p) => ({ ...p, hostname: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Порт</Label>
                      <Input
                        type="number"
                        value={hostFormData.port}
                        onChange={(e) => setHostFormData((p) => ({ ...p, port: parseInt(e.target.value, 10) || 22 }))}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Имя пользователя</Label>
                      <Input
                        placeholder="user"
                        value={hostFormData.username}
                        onChange={(e) => setHostFormData((p) => ({ ...p, username: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Тип подключения</Label>
                      <Select
                        value={hostFormData.connection_type || "ssh"}
                        onValueChange={(v) => setHostFormData((p) => ({ ...p, connection_type: v, port: v === "winrm" ? 5985 : 22 }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ssh">SSH (Linux)</SelectItem>
                          <SelectItem value="winrm">WinRM (Windows)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Тип аутентификации</Label>
                      <Select
                        value={hostFormData.auth_type}
                        onValueChange={(v) => setHostFormData((p) => ({ ...p, auth_type: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="password">Пароль</SelectItem>
                          {hostFormData.connection_type !== "winrm" && (
                            <SelectItem value="key">SSH ключ</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {hostFormData.auth_type === "password" ? (
                    <div className="space-y-2">
                      <Label>Пароль</Label>
                      <Input
                        type="password"
                        value={hostFormData.password}
                        onChange={(e) => setHostFormData((p) => ({ ...p, password: e.target.value }))}
                        required
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label>SSH приватный ключ</Label>
                      <Textarea
                        value={hostFormData.ssh_key}
                        onChange={(e) => setHostFormData((p) => ({ ...p, ssh_key: e.target.value }))}
                        placeholder="-----BEGIN RSA PRIVATE KEY-----\n..."
                        rows={4}
                        required
                      />
                    </div>
                  )}
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setHostDialogOpen(false)}>
                      Отмена
                    </Button>
                    <Button type="submit" disabled={savingHost}>
                      {savingHost && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      Создать
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            <div className="space-y-2">
              <Label>Выбранные хосты ({selectedHostIds.length})</Label>
              {selectedHosts.length === 0 ? (
                <p className="text-muted-foreground text-sm">Добавьте хосты одним из способов выше.</p>
              ) : (
                <ul className="space-y-1 max-h-60 overflow-y-auto rounded border p-2">
                  {selectedHosts.map((h) => (
                    <li key={h.id} className="flex items-center justify-between text-sm py-1">
                      <span><Badge variant="outline" className="mr-2">{OS_LABELS[getOsFromHost(h)]}</Badge>{h.name} — {h.hostname}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeHost(h.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {selectedHostIds.length > 0 && (
              <Button onClick={() => setStep(2)}>
                Далее: сопоставление профилей <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Шаг 2: Сопоставление профилей по ОС</CardTitle>
            <CardDescription>
              Для каждой группы хостов (Linux / Windows) выберите профиль ИБ.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasLinux && (
              <div className="space-y-2">
                <Label>Linux-хосты ({groupedByOs.linux.length})</Label>
                <Select value={profileByOs.linux} onValueChange={(v) => setProfileByOs((p) => ({ ...p, linux: v }))}>
                  <SelectTrigger className="max-w-md">
                    <SelectValue placeholder="Выберите профиль" />
                  </SelectTrigger>
                  <SelectContent>
                    {profilesForLinux.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.category_name} / {p.system_name} — {p.version}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {hasWindows && (
              <div className="space-y-2">
                <Label>Windows-хосты ({groupedByOs.windows.length})</Label>
                <Select value={profileByOs.windows} onValueChange={(v) => setProfileByOs((p) => ({ ...p, windows: v }))}>
                  <SelectTrigger className="max-w-md">
                    <SelectValue placeholder="Выберите профиль" />
                  </SelectTrigger>
                  <SelectContent>
                    {profilesForWindows.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.category_name} / {p.system_name} — {p.version}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>Назад</Button>
              <Button onClick={() => setStep(3)}>Далее: применить</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Шаг 3: Применение</CardTitle>
              <CardDescription>
                Запуск применит профили на выбранные хосты по SSH/WinRM. В журнале отображаются проверки соединения, прав и вывод скриптов.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">Хостов: {selectedHostIds.length}. Linux: профиль {profileByOs.linux ? "выбран" : "не выбран"}. Windows: профиль {profileByOs.windows ? "выбран" : "не выбран"}.</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)}>Назад</Button>
                <Button onClick={handleApply} disabled={applying || (hasLinux && !profileByOs.linux) || (hasWindows && !profileByOs.windows)}>
                  {applying && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Применить профиль ко всем подходящим хостам
                </Button>
              </div>
            </CardContent>
          </Card>

          {(applying || logs.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle>Журнал выполнения</CardTitle>
                <CardDescription>
                  {applying ? "Выполнение в процессе…" : "Выполнение завершено."}
                </CardDescription>
                {stats.total > 0 && (
                  <div className="flex items-center gap-4 pt-2">
                    <Progress value={stats.total ? ((stats.completed + stats.failed) / stats.total) * 100 : 0} className="max-w-xs" />
                    <span className="text-sm text-muted-foreground">
                      {stats.completed + stats.failed} / {stats.total} хостов
                      {stats.failed > 0 && ` (ошибок: ${stats.failed})`}
                    </span>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {logs.length === 0 && applying ? (
                  <p className="text-muted-foreground text-sm">Ожидание событий…</p>
                ) : (
                  <ScrollArea className="h-[360px] w-full rounded-md border bg-muted/30 p-3 font-mono text-sm">
                    {logs.map((log, index) => (
                      <div
                        key={index}
                        className={`flex gap-2 py-1.5 ${log.type === "task_error" || (log.success === false && log.type === "task_complete") ? "text-destructive" : ""} ${log.success === true && log.type !== "script_progress" ? "text-green-700 dark:text-green-400" : ""}`}
                      >
                        {log.type === "status" || log.type === "info" ? (
                          <CheckCircle className="h-4 w-4 shrink-0 mt-0.5 text-green-600" />
                        ) : log.type === "task_start" ? (
                          <Play className="h-4 w-4 shrink-0 mt-0.5 text-blue-500" />
                        ) : log.type === "check_network" || log.type === "check_login" || log.type === "check_sudo" ? (
                          log.success ? (
                            <CheckCircle className="h-4 w-4 shrink-0 mt-0.5 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 shrink-0 mt-0.5 text-destructive" />
                          )
                        ) : log.type === "script_progress" ? (
                          <span className="text-muted-foreground shrink-0">[{log.completed}/{log.total}]</span>
                        ) : log.type === "task_complete" ? (
                          log.success ? (
                            <CheckCircle className="h-4 w-4 shrink-0 mt-0.5 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 shrink-0 mt-0.5 text-destructive" />
                          )
                        ) : log.type === "task_error" || log.type === "error" ? (
                          <XCircle className="h-4 w-4 shrink-0 mt-0.5 text-destructive" />
                        ) : null}
                        <span className="break-all">
                          {log.type === "status" || log.type === "info" ? log.message : null}
                          {log.type === "task_start" ? `Хост ${log.host_name} (${log.host_address})` : null}
                          {log.type === "check_network" ? `Сеть: ${log.message}` : null}
                          {log.type === "check_login" ? `Вход: ${log.message}` : null}
                          {log.type === "check_sudo" ? `Права: ${log.message}` : null}
                          {log.type === "task_complete" ? `${log.host_name}: ${log.success ? "успех" : "ошибка"}${log.exit_code != null ? ` (код ${log.exit_code})` : ""}${log.output_preview ? ` — ${log.output_preview.slice(0, 120)}${log.output_preview.length > 120 ? "…" : ""}` : ""}${log.error ? ` — ${log.error}` : ""}` : null}
                          {log.type === "task_error" ? `${log.host_name}: ${log.error}` : null}
                          {log.type === "error" ? log.message : null}
                          {log.type === "complete" ? `Готово: ${log.completed}/${log.total}, ошибок: ${log.failed}` : null}
                        </span>
                      </div>
                    ))}
                    <div ref={logsEndRef} />
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
