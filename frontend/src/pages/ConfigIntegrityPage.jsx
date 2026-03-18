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
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "../config/api";
import { ConfirmationDialog } from "@/components/ui/ConfirmationDialog";

export default function ConfigIntegrityPage() {
  const { hasPermission, isAdmin } = useAuth();
  const canManage = isAdmin || hasPermission("config_integrity_manage");

  const [hosts, setHosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [configContent, setConfigContent] = useState({ name: "", content: "" });

  const [initLoading, setInitLoading] = useState(false);
  const [checkLoading, setCheckLoading] = useState(false);

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

  useEffect(() => {
    fetchHosts();
  }, [fetchHosts]);

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
      setImportDialogOpen(false);
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
      toast.info("Нет мониторируемых хостов для проверки");
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">
          Проверка неизменности конфигурации
        </h1>
        <div className="flex flex-wrap gap-2">
          {canManage && (
            <>
              <Button onClick={() => setAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> Добавить хост
              </Button>
              <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
                <Upload className="h-4 w-4 mr-2" /> Импорт JSON
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Action buttons */}
      {canManage && hosts.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-3">
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
            </div>
            {selectedIds.size > 0 && (
              <p className="text-sm text-muted-foreground mt-2">
                Выбрано хостов: {selectedIds.size}. Действие будет выполнено
                только для выбранных.
              </p>
            )}
            {selectedIds.size === 0 && (
              <p className="text-sm text-muted-foreground mt-2">
                Инициализация — для неинициализированных хостов. Проверка — для
                всех мониторируемых.
              </p>
            )}
          </CardContent>
        </Card>
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

      {/* Import dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Импорт хостов из JSON</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Загрузите файл (.json или .txt) с массивом хостов в формате JSON:
            </p>
            <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
{`[
  {
    "name": "server-01",
    "ip_address": "10.0.0.1",
    "port": 22,
    "username": "root",
    "auth_type": "password",
    "password": "secret"
  }
]`}
            </pre>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.txt"
              className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:opacity-90 cursor-pointer"
              onChange={handleImportJson}
            />
          </div>
        </DialogContent>
      </Dialog>

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
