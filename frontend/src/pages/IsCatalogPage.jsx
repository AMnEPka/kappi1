import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  ListOrdered,
  Plus,
  Trash2,
  Loader2,
  Lock,
  Settings2,
  Library,
  Server,
  Edit,
  ChevronRight,
  Upload,
  PlayCircle,
  ShieldCheck,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { api, getAccessToken } from "@/config/api";
import { ConfirmationDialog } from "@/components/ui/ConfirmationDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

const schemaFieldsOrdered = (schema) =>
  (schema?.fields || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

export default function IsCatalogPage() {
  const navigate = useNavigate();
  const { hasPermission, isAdmin } = useAuth();
  const canView = hasPermission("is_catalog_view");
  const canEdit = hasPermission("is_catalog_edit");
  const canManageSchema = isAdmin || hasPermission("is_catalog_manage_schema");
  const canCreateProject = hasPermission("projects_create");
  const canApplyIbProfile = hasPermission("ib_profiles_apply");

  const [schema, setSchema] = useState(null);
  const [items, setItems] = useState([]);
  const [hosts, setHosts] = useState([]);
  const [editingHost, setEditingHost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addFieldKey, setAddFieldKey] = useState("");
  const [addFieldLabel, setAddFieldLabel] = useState("");
  const [addFieldOrder, setAddFieldOrder] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState({
    open: false,
    fieldKey: null,
    onConfirm: null,
  });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState({});
  const [confirmDeleteIs, setConfirmDeleteIs] = useState({ open: false, item: null, onConfirm: null });
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
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (getAccessToken() && canView) {
      fetchSchema();
    } else {
      setLoading(false);
    }
  }, [canView]);

  const fetchItems = useCallback(async () => {
    if (!canView) return;
    setListLoading(true);
    try {
      const res = await api.get("/api/is-catalog");
      setItems(res.data || []);
    } catch (e) {
      if (e.response?.status !== 403) toast.error("Ошибка загрузки списка ИС");
    } finally {
      setListLoading(false);
    }
  }, [canView]);

  const fetchHosts = useCallback(async () => {
    try {
      const res = await api.get("/api/hosts");
      setHosts(res.data || []);
    } catch (e) {
      if (e.response?.status !== 403) toast.error("Ошибка загрузки хостов");
    }
  }, []);

  useEffect(() => {
    if (schema && canView) {
      fetchItems();
      fetchHosts();
    }
  }, [schema, canView, fetchItems, fetchHosts]);

  const fetchSchema = async () => {
    try {
      const res = await api.get("/api/is-catalog/schema");
      setSchema(res.data);
    } catch (e) {
      if (e.response?.status === 403) {
        setSchema(null);
      } else {
        toast.error("Ошибка загрузки схемы полей");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSchema = async (newFields) => {
    setSaving(true);
    try {
      await api.put("/api/is-catalog/schema", { fields: newFields });
      setSchema((prev) => (prev ? { ...prev, fields: newFields } : { id: "default", fields: newFields }));
      toast.success("Схема полей сохранена");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Ошибка сохранения схемы");
    } finally {
      setSaving(false);
    }
  };

  const handleAddField = (e) => {
    e.preventDefault();
    const key = addFieldKey.trim().toLowerCase().replace(/\s+/g, "_");
    const label = addFieldLabel.trim();
    if (!key || !label) {
      toast.error("Укажите ключ и подпись поля");
      return;
    }
    const current = schema?.fields || [];
    if (current.some((f) => f.key === key)) {
      toast.error("Поле с таким ключом уже есть");
      return;
    }
    const nextOrder = current.length ? Math.max(...current.map((f) => f.order), 0) + 1 : 0;
    const order = addFieldOrder !== undefined && addFieldOrder !== "" ? Number(addFieldOrder) : nextOrder;
    const newFields = [...current, { key, label, order }].sort((a, b) => a.order - b.order);
    handleSaveSchema(newFields);
    setAddFieldKey("");
    setAddFieldLabel("");
    setAddFieldOrder(nextOrder);
  };

  const handleDeleteField = (fieldKey) => {
    const current = schema?.fields || [];
    if (current.length <= 1) {
      toast.error("Должно остаться хотя бы одно поле");
      return;
    }
    const newFields = current.filter((f) => f.key !== fieldKey);
    handleSaveSchema(newFields);
    setConfirmDelete({ open: false, fieldKey: null, onConfirm: null });
  };

  const openDeleteConfirm = (fieldKey) => {
    setConfirmDelete({
      open: true,
      fieldKey,
      onConfirm: () => handleDeleteField(fieldKey),
    });
  };

  const openSheet = (item) => {
    setSelectedItem(item);
    setEditForm({ ...item });
    setSheetOpen(true);
  };

  const closeSheet = () => {
    setSheetOpen(false);
    setSelectedItem(null);
    setEditForm({});
  };

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

  const openEditHost = (host) => {
    if (!host) return;
    setEditingHost(host);
    setHostFormData({
      name: host.name,
      hostname: host.hostname,
      port: host.port ?? 22,
      username: host.username,
      auth_type: host.auth_type || "password",
      password: "",
      ssh_key: host.ssh_key ? "(уже задан)" : "",
      connection_type: host.connection_type || "ssh",
    });
    setHostDialogOpen(true);
  };

  const handleAddHostSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: hostFormData.name,
        hostname: hostFormData.hostname,
        port: hostFormData.port,
        username: hostFormData.username,
        auth_type: hostFormData.auth_type,
        connection_type: hostFormData.connection_type,
      };
      if (hostFormData.password) payload.password = hostFormData.password;
      if (hostFormData.ssh_key && hostFormData.ssh_key !== "(уже задан)") payload.ssh_key = hostFormData.ssh_key;

      if (editingHost) {
        await api.put(`/api/hosts/${editingHost.id}`, payload);
        await fetchHosts();
        setHostDialogOpen(false);
        setEditingHost(null);
        resetHostForm();
        toast.success("Хост обновлён");
      } else {
        const res = await api.post("/api/hosts", payload);
        const newId = res.data?.id;
        if (newId) {
          setEditForm((prev) => ({ ...prev, host_ids: [...(prev.host_ids || []), newId] }));
          await fetchHosts();
        }
        setHostDialogOpen(false);
        resetHostForm();
        toast.success("Хост добавлен");
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || (editingHost ? "Ошибка обновления хоста" : "Ошибка добавления хоста"));
    } finally {
      setSaving(false);
    }
  };

  const handleHostsImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportDialogOpen(true);
    setImportProgress({ current: 0, total: 0 });
    const addedIds = [];
    try {
      const text = await file.text();
      let hostsData;
      try {
        hostsData = JSON.parse(text);
      } catch {
        const lines = text.trim().split("\n").filter((l) => l.trim());
        hostsData = lines.map((line) => JSON.parse(line));
      }
      if (!Array.isArray(hostsData)) hostsData = [hostsData];
      setImportProgress((p) => ({ ...p, total: hostsData.length }));
      for (let i = 0; i < hostsData.length; i++) {
        const h = hostsData[i];
        try {
          const res = await api.post("/api/hosts", {
            name: h.name,
            hostname: h.hostname,
            port: h.port ?? 22,
            username: h.username,
            auth_type: h.auth_type,
            password: h.password,
            ssh_key: h.ssh_key,
            connection_type: h.connection_type ?? "ssh",
          });
          if (res.data?.id) addedIds.push(res.data.id);
        } catch (err) {
          console.error("Import host error:", err);
        }
        setImportProgress((p) => ({ ...p, current: i + 1 }));
        if (i < hostsData.length - 1) await new Promise((r) => setTimeout(r, 300));
      }
      await fetchHosts();
      setEditForm((prev) => ({ ...prev, host_ids: [...(prev.host_ids || []), ...addedIds] }));
      toast.success(`Импорт: добавлено хостов ${addedIds.length} из ${hostsData.length}`);
    } catch (err) {
      toast.error("Ошибка чтения или разбора файла");
    } finally {
      setImporting(false);
      setImportDialogOpen(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const saveEditForm = async () => {
    if (!selectedItem?.id) return;
    setSaving(true);
    try {
      const payload = { ...editForm };
      if (payload.created_at && typeof payload.created_at === "string" && payload.created_at.length > 0) {
        // keep as-is
      } else if (payload.created_at !== undefined) {
        payload.created_at = "";
      }
      await api.put(`/api/is-catalog/${selectedItem.id}`, payload);
      toast.success("ИС сохранена");
      fetchItems();
      const updated = { ...selectedItem, ...payload };
      setSelectedItem(updated);
      setEditForm(updated);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const deleteIs = async (item) => {
    if (!item?.id) return;
    try {
      await api.delete(`/api/is-catalog/${item.id}`);
      toast.success("ИС удалена");
      fetchItems();
      closeSheet();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Ошибка удаления");
    }
    setConfirmDeleteIs({ open: false, item: null, onConfirm: null });
  };

  const openCreateDialog = () => {
    const initial = { host_ids: [] };
    schemaFieldsOrdered(schema).forEach((f) => (initial[f.key] = ""));
    setCreateForm(initial);
    setCreateDialogOpen(true);
  };

  const submitCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/api/is-catalog", createForm);
      toast.success("ИС создана");
      fetchItems();
      setCreateDialogOpen(false);
      setCreateForm({ host_ids: [] });
    } catch (e) {
      toast.error(e.response?.data?.detail || "Ошибка создания ИС");
    } finally {
      setSaving(false);
    }
  };

  const removeHostFromSelected = (hostId) => {
    setEditForm((prev) => ({
      ...prev,
      host_ids: (prev.host_ids || []).filter((id) => id !== hostId),
    }));
  };

  const getHostById = (id) => hosts.find((h) => h.id === id);

  /** Переход в мастер создания проекта с хостами текущей ИС (шаг 2 уже заполнен) */
  const conductOsib = () => {
    const hostIds = editForm.host_ids ?? selectedItem?.host_ids ?? [];
    if (hostIds.length === 0) {
      toast.error("В ИС нет хостов. Добавьте хосты перед проведением ОСИБ.");
      return;
    }
    const projectName =
      selectedItem?.name ||
      selectedItem?.[schemaFieldsOrdered(schema)[0]?.key] ||
      "ИС";
    navigate("/new", {
      state: {
        fromIsCatalog: true,
        hostIds: [...hostIds],
        projectName: `${projectName} — ОСИБ`,
      },
    });
  };

  if (!canView) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center min-h-[320px]">
          <Lock className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-sm">Нет прав для просмотра каталога ИС</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[320px]">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const fields = schema?.fields || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Каталог ИС</h1>
        <p className="text-muted-foreground mt-1">Реестр информационных систем и настройка полей</p>
      </div>



      {/* Список ИС */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Library className="h-5 w-5" />
              <CardTitle>Информационные системы</CardTitle>
            </div>
            {canEdit && (
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Добавить ИС
              </Button>
            )}
          </div>
          <CardDescription>Реестр ИС и привязанные хосты</CardDescription>
        </CardHeader>
        <CardContent>
          {listLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Library className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Нет информационных систем</p>
              {canEdit && (
                <Button variant="outline" className="mt-3" onClick={openCreateDialog}>
                  Добавить первую ИС
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((item) => {
                const orderedFields = schemaFieldsOrdered(schema);
                const title = item.name || item[orderedFields[0]?.key] || "Без названия";
                const subtitle = orderedFields[1] ? `${orderedFields[1].label}: ${item[orderedFields[1].key] || "—"}` : null;
                const hostCount = (item.host_ids || []).length;
                return (
                  <Card key={item.id} className="overflow-hidden">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-base truncate">{title}</CardTitle>
                          {subtitle && (
                            <CardDescription className="truncate text-xs mt-0.5">{subtitle}</CardDescription>
                          )}
                        </div>
                        <Badge variant="secondary" className="shrink-0">
                          {hostCount} {hostCount === 1 ? "хост" : "хостов"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 flex justify-between items-center">
                      <Button variant="ghost" size="sm" onClick={() => openSheet(item)}>
                        <ChevronRight className="h-4 w-4 mr-1" />
                        Открыть
                      </Button>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() =>
                            setConfirmDeleteIs({
                              open: true,
                              item,
                              onConfirm: () => deleteIs(item),
                            })
                          }
                          title="Удалить ИС"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {canManageSchema && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              <CardTitle>Редактор полей</CardTitle>
            </div>
            <CardDescription>
              Поля, которые будут отображаться у каждой ИС. Добавление поля автоматически добавит его во все существующие ИС (с пустым значением). Удаление поля удалит его из всех ИС.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleAddField} className="flex flex-wrap items-end gap-4">
              <div className="space-y-2">
                <Label htmlFor="field-key">Ключ поля (латиница, без пробелов)</Label>
                <Input
                  id="field-key"
                  placeholder="например: owner"
                  value={addFieldKey}
                  onChange={(e) => setAddFieldKey(e.target.value)}
                  className="w-40"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="field-label">Подпись</Label>
                <Input
                  id="field-label"
                  placeholder="например: Владелец"
                  value={addFieldLabel}
                  onChange={(e) => setAddFieldLabel(e.target.value)}
                  className="w-48"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="field-order">Порядок</Label>
                <Input
                  id="field-order"
                  type="number"
                  min={0}
                  value={addFieldOrder}
                  onChange={(e) => setAddFieldOrder(e.target.value === "" ? "" : parseInt(e.target.value, 10))}
                  className="w-24"
                />
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Добавить поле
              </Button>
            </form>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <ListOrdered className="h-4 w-4" />
                <span className="font-medium">Текущие поля</span>
              </div>
              {fields.length === 0 ? (
                <p className="text-sm text-muted-foreground">Поля не заданы. Добавьте первое поле выше.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Порядок</TableHead>
                      <TableHead>Ключ</TableHead>
                      <TableHead>Подпись</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fields
                      .slice()
                      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                      .map((f) => (
                        <TableRow key={f.key}>
                          <TableCell>{f.order}</TableCell>
                          <TableCell className="font-mono text-sm">{f.key}</TableCell>
                          <TableCell>{f.label}</TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => openDeleteConfirm(f.key)}
                              disabled={fields.length <= 1}
                              title="Удалить поле"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Детали/редактирование ИС */}
      <Sheet open={sheetOpen} onOpenChange={(open) => { setSheetOpen(open); if (!open) closeSheet(); }}>
        <SheetContent side="right" className="sm:max-w-xl overflow-hidden flex flex-col">
          <SheetHeader>
            <SheetTitle>
              {selectedItem
                ? selectedItem.name ||
                  selectedItem[schemaFieldsOrdered(schema)[0]?.key] ||
                  "Информационная система"
                : ""}
            </SheetTitle>
            <SheetDescription>Поля и список хостов</SheetDescription>
          </SheetHeader>
          {selectedItem && (
            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-6 py-4">
                {(canCreateProject || canApplyIbProfile) && (editForm.host_ids ?? selectedItem.host_ids ?? []).length > 0 && (
                  <div className="flex justify-end gap-2">
                    {canCreateProject && (
                      <Button onClick={conductOsib} className="gap-2">
                        <PlayCircle className="h-4 w-4" />
                        Провести ОСИБ
                      </Button>
                    )}
                    {canApplyIbProfile && (
                      <Button
                        variant="outline"
                        className="gap-2"
                        onClick={() => {
                          const hostIds = editForm.host_ids ?? selectedItem?.host_ids ?? [];
                          if (hostIds.length === 0) {
                            toast.error("В ИС нет хостов.");
                            return;
                          }
                          navigate("/ib-profiles/apply", { state: { fromIsCatalogHostIds: hostIds } });
                        }}
                      >
                        <ShieldCheck className="h-4 w-4" />
                        Применить профиль ИБ
                      </Button>
                    )}
                  </div>
                )}
                {canEdit ? (
                  <>
                    {schemaFieldsOrdered(schema).map((f) => (
                      <div key={f.key} className="space-y-2">
                        <Label>{f.label}</Label>
                        <Input
                          value={editForm[f.key] ?? ""}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                          placeholder={f.label}
                        />
                      </div>
                    ))}
                  </>
                ) : (
                  <dl className="space-y-3">
                    {schemaFieldsOrdered(schema).map((f) => (
                      <div key={f.key}>
                        <dt className="text-sm text-muted-foreground">{f.label}</dt>
                        <dd className="font-medium">{selectedItem[f.key] ?? "—"}</dd>
                      </div>
                    ))}
                  </dl>
                )}

                <div className="border-t pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Server className="h-4 w-4" />
                    <span className="font-medium">Хосты</span>
                    <Badge variant="outline">{(editForm.host_ids || selectedItem.host_ids || []).length}</Badge>
                  </div>
                  {(editForm.host_ids ?? selectedItem.host_ids ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Хосты не добавлены</p>
                  ) : (
                    <ul className="space-y-2">
                      {(editForm.host_ids ?? selectedItem.host_ids ?? []).map((hostId) => {
                        const host = getHostById(hostId);
                        return (
                          <li
                            key={hostId}
                            className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                          >
                            <span>
                              {host ? (
                                <>
                                  <span className="font-medium">{host.name}</span>
                                  <span className="text-muted-foreground ml-2">{host.hostname}:{host.port}</span>
                                </>
                              ) : (
                                <span className="text-muted-foreground">Не найден (id: {hostId})</span>
                              )}
                            </span>
                            {canEdit && (
                              <div className="flex gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => host && openEditHost(host)}
                                  title="Редактировать хост"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:text-destructive h-8 w-8"
                                  onClick={() => removeHostFromSelected(hostId)}
                                  title="Удалить хост из ИС"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {canEdit && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <input
                        type="file"
                        accept=".json,.txt"
                        ref={fileInputRef}
                        onChange={handleHostsImport}
                        className="hidden"
                      />
                      <Button type="button" variant="outline" size="sm" onClick={() => setHostDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Добавить хост
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={importing}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Импортировать хосты
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          )}
          {selectedItem && (canEdit || canCreateProject) && (
            <SheetFooter className="border-t pt-4 mt-4 shrink-0">
              <Button variant="outline" onClick={closeSheet}>
                Закрыть
              </Button>
              {canEdit && (
                <>
                  <Button onClick={saveEditForm} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Сохранить
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setConfirmDeleteIs({ open: true, item: selectedItem, onConfirm: () => deleteIs(selectedItem) });
                    }}
                    disabled={saving}
                  >
                    Удалить ИС
                  </Button>
                </>
              )}
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>

      {/* Диалог добавления хоста (ручной ввод) */}
      <Dialog
        open={hostDialogOpen}
        onOpenChange={(open) => {
          setHostDialogOpen(open);
          if (!open) {
            resetHostForm();
            setEditingHost(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingHost ? "Редактировать хост" : "Новый хост"}</DialogTitle>
            <DialogDescription>
              {editingHost
                ? "Измените данные сервера. Пароль и ключ оставьте пустыми, чтобы не менять."
                : "Внесите данные сервера. Хост будет создан в системе и привязан к этой ИС."}
            </DialogDescription>
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
                  onValueChange={(v) =>
                    setHostFormData((p) => ({ ...p, connection_type: v, port: v === "winrm" ? 5985 : 22 }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ssh">SSH (Linux)</SelectItem>
                    <SelectItem value="winrm">WinRM (Windows)</SelectItem>
                    <SelectItem value="k8s" disabled>Kubernetes (скоро)</SelectItem>
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
                  placeholder={editingHost ? "Оставьте пустым, чтобы не менять" : ""}
                  required={!editingHost}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>SSH приватный ключ</Label>
                <Textarea
                  value={hostFormData.ssh_key === "(уже задан)" ? "" : hostFormData.ssh_key}
                  onChange={(e) => setHostFormData((p) => ({ ...p, ssh_key: e.target.value }))}
                  placeholder={editingHost ? "Оставьте пустым, чтобы не менять" : "-----BEGIN RSA PRIVATE KEY-----\n..."}
                  rows={4}
                  required={!editingHost}
                />
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setHostDialogOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {editingHost ? "Сохранить" : "Создать хост"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Диалог прогресса импорта хостов */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Импорт хостов</DialogTitle>
            <DialogDescription>Импортирование хостов из файла JSON...</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span>Прогресс:</span>
              <span>
                {importProgress.current} из {importProgress.total || 1}
              </span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${importProgress.total ? (importProgress.current / importProgress.total) * 100 : 0}%`,
                }}
              />
            </div>
            {importing && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Импорт...
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Диалог создания ИС */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Новая информационная система</DialogTitle>
            <DialogDescription>Заполните поля по схеме. Хосты можно добавить после создания.</DialogDescription>
          </DialogHeader>
          <form id="create-is-form" onSubmit={submitCreate} className="flex flex-col min-h-0">
            <ScrollArea className="flex-1 max-h-[60vh] pr-4">
              <div className="space-y-4 py-2">
                {schemaFieldsOrdered(schema).map((f) => (
                  <div key={f.key} className="space-y-2">
                    <Label htmlFor={`create-${f.key}`}>{f.label}</Label>
                    <Input
                      id={`create-${f.key}`}
                      value={createForm[f.key] ?? ""}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={f.label}
                    />
                  </div>
                ))}
              </div>
            </ScrollArea>
            <DialogFooter className="mt-4 shrink-0">
              <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" form="create-is-form" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Создать
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={confirmDeleteIs.open}
        onOpenChange={(open) => !open && setConfirmDeleteIs({ open: false, item: null, onConfirm: null })}
        title="Удалить информационную систему?"
        description="Запись будет удалена из каталога. Хосты при этом не удаляются."
        confirmText="Удалить"
        cancelText="Отмена"
        variant="destructive"
        onConfirm={() => confirmDeleteIs.onConfirm?.()}
        onCancel={() => setConfirmDeleteIs({ open: false, item: null, onConfirm: null })}
      />

      <ConfirmationDialog
        open={confirmDelete.open}
        onOpenChange={(open) => !open && setConfirmDelete((p) => ({ ...p, open: false }))}
        title="Удалить поле?"
        description="Поле будет удалено из схемы и из всех записей ИС. Это действие нельзя отменить."
        confirmText="Удалить"
        cancelText="Отмена"
        variant="destructive"
        onConfirm={() => {
          confirmDelete.onConfirm?.();
        }}
        onCancel={() => setConfirmDelete((p) => ({ ...p, open: false }))}
      />
    </div>
  );
}
