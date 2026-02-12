import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { api, getAccessToken } from "@/config/api";
import { toast } from "sonner";
import {
  Shield,
  Plus,
  Edit,
  Trash2,
  Eye,
  Download,
  Loader2,
  Upload,
  Lock,
} from "lucide-react";
import { ConfirmationDialog } from "@/components/ui/ConfirmationDialog";

const STATUS_LABELS = { draft: "Черновик", active: "Активный", archived: "Архивирован" };

export default function SecurityProfilesPage() {
  const { hasPermission, isAdmin } = useAuth();
  const canView = hasPermission("ib_profiles_view");
  const canManage = hasPermission("ib_profiles_manage");

  const [profiles, setProfiles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [systems, setSystems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState("");
  const [filterSystem, setFilterSystem] = useState("");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState(null);
  const [formData, setFormData] = useState({
    category_id: "",
    system_id: "",
    version: "",
    content: "",
    status: "draft",
    update_in_place: false,
  });
  const [saving, setSaving] = useState(false);
  const [previewContent, setPreviewContent] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, profile: null, onConfirm: null });
  const fileInputRef = useRef(null);

  const fetchProfiles = useCallback(async () => {
    if (!canView) return;
    try {
      const params = new URLSearchParams();
      if (filterCategory) params.set("category_id", filterCategory);
      if (filterSystem) params.set("system_id", filterSystem);
      if (search.trim()) params.set("search", search.trim());
      const res = await api.get(`/api/ib-profiles?${params.toString()}`);
      setProfiles(res.data || []);
    } catch (e) {
      if (e.response?.status !== 403) toast.error("Ошибка загрузки профилей");
    } finally {
      setLoading(false);
    }
  }, [canView, filterCategory, filterSystem, search]);

  useEffect(() => {
    if (!getAccessToken() || !canView) {
      setLoading(false);
      return;
    }
    fetchProfiles();
  }, [fetchProfiles, canView]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await api.get("/api/categories");
      setCategories(res.data || []);
    } catch (_) {}
  }, []);
  const fetchSystems = useCallback(async () => {
    try {
      const res = await api.get("/api/systems");
      setSystems(res.data || []);
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchCategories();
    fetchSystems();
  }, [fetchCategories, fetchSystems]);

  const systemsByCategory = formData.category_id
    ? systems.filter((s) => s.category_id === formData.category_id)
    : systems;
  const isProfileContentEmpty = !String(formData.content ?? "").trim();

  const openCreate = () => {
    setEditingProfile(null);
    setFormData({
      category_id: "",
      system_id: "",
      version: "",
      content: "",
      status: "draft",
      update_in_place: false,
    });
    setDialogOpen(true);
  };

  const openEdit = (profile) => {
    setEditingProfile(profile);
    setFormData({
      category_id: profile.category_id,
      system_id: profile.system_id,
      version: profile.version,
      content: "", // load full profile for content
      status: profile.status,
      update_in_place: !!isAdmin,
    });
    setDialogOpen(true);
    api
      .get(`/api/ib-profiles/${profile.id}`)
      .then((res) => setFormData((prev) => ({ ...prev, content: res.data?.content ?? "" })))
      .catch(() => toast.error("Ошибка загрузки профиля"));
  };

  const openPreview = (profile) => {
    setPreviewContent("");
    setPreviewOpen(true);
    api
      .get(`/api/ib-profiles/${profile.id}`)
      .then((res) => setPreviewContent(res.data?.content ?? ""))
      .catch(() => toast.error("Ошибка загрузки профиля"));
  };

  const handleExportDownload = (profile) => {
    api
      .get(`/api/ib-profiles/${profile.id}/export`, { responseType: "text" })
      .then((res) => {
        const blob = new Blob([res.data], { type: "text/plain" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `profile-${profile.version}-${profile.id.slice(0, 8)}.txt`;
        a.click();
        URL.revokeObjectURL(a.href);
        toast.success("Файл сохранён");
      })
      .catch(() => toast.error("Ошибка экспорта"));
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = (file.name || "").toLowerCase();
    if (![".sh", ".ps1", ".txt"].some((x) => ext.endsWith(x))) {
      toast.error("Допустимые форматы: .sh, .ps1, .txt");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setFormData((prev) => ({ ...prev, content: reader.result ?? "" }));
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingProfile) {
        await api.put(`/api/ib-profiles/${editingProfile.id}`, {
          version: formData.version,
          content: formData.content,
          status: formData.status,
          update_in_place: formData.update_in_place,
        });
        toast.success(formData.update_in_place ? "Профиль обновлён" : "Создана новая версия профиля");
      } else {
        await api.post("/api/ib-profiles", {
          category_id: formData.category_id,
          system_id: formData.system_id,
          version: formData.version || "1",
          content: formData.content,
          status: formData.status,
        });
        toast.success("Профиль создан");
      }
      setDialogOpen(false);
      fetchProfiles();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (profile) => {
    try {
      await api.delete(`/api/ib-profiles/${profile.id}`);
      toast.success("Профиль удалён");
      setDeleteConfirm({ open: false, profile: null, onConfirm: null });
      fetchProfiles();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Ошибка удаления");
    }
  };

  if (!canView) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center min-h-[320px]">
          <Lock className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-sm">Нет прав для просмотра профилей ИБ</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Профили информационной безопасности</h1>
        <p className="text-muted-foreground mt-1">Управление профилями ИБ и их версиями</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              <CardTitle>Профили</CardTitle>
            </div>
            {canManage && (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Создать профиль
              </Button>
            )}
          </div>
          <CardDescription>Категория, система, версия, статус. Редактирование и экспорт — по ролям.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Select value={filterCategory || "all"} onValueChange={(v) => setFilterCategory(v === "all" ? "" : v)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Категория" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все категории</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterSystem || "all"} onValueChange={(v) => setFilterSystem(v === "all" ? "" : v)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Система" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все системы</SelectItem>
                {systems.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Поиск по версии..."
              className="max-w-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : profiles.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Нет профилей</p>
              {canManage && (
                <Button variant="outline" className="mt-3" onClick={openCreate}>
                  Создать первый профиль
                </Button>
              )}
            </div>
          ) : (
            <ScrollArea className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Категория</TableHead>
                    <TableHead>Система</TableHead>
                    <TableHead>Версия</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Обновлён</TableHead>
                    <TableHead className="w-[180px]">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.category_name}</TableCell>
                      <TableCell>{p.system_name}</TableCell>
                      <TableCell className="font-mono">{p.version}</TableCell>
                      <TableCell>
                        <Badge variant={p.status === "active" ? "default" : "secondary"}>
                          {STATUS_LABELS[p.status] || p.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {p.updated_at ? new Date(p.updated_at).toLocaleString("ru") : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" title="Просмотр" onClick={() => openPreview(p)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {canManage && (
                            <>
                              <Button variant="ghost" size="icon" title="Экспорт" onClick={() => handleExportDownload(p)}>
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" title="Редактировать" onClick={() => openEdit(p)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                title="Удалить"
                                onClick={() => setDeleteConfirm({ open: true, profile: p, onConfirm: () => handleDelete(p) })}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingProfile ? "Редактировать профиль" : "Новый профиль ИБ"}</DialogTitle>
            <DialogDescription>
              Категория и система задают принадлежность. Версия — произвольная строка. Содержимое — скрипт или текст.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Категория</Label>
                <Select
                  value={formData.category_id}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, category_id: v, system_id: "" }))}
                  required
                  disabled={!!editingProfile}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите категорию" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Система</Label>
                <Select
                  value={formData.system_id}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, system_id: v }))}
                  required
                  disabled={!!editingProfile}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите систему" />
                  </SelectTrigger>
                  <SelectContent>
                    {systemsByCategory.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Версия</Label>
                <Input
                  value={formData.version}
                  onChange={(e) => setFormData((prev) => ({ ...prev, version: e.target.value }))}
                  placeholder="2, 3.1, 1.0-alpha"
                />
              </div>
              {editingProfile && isAdmin && (
                <div className="space-y-2 flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.update_in_place}
                      onChange={(e) => setFormData((prev) => ({ ...prev, update_in_place: e.target.checked }))}
                      className="rounded"
                    />
                    <span className="text-sm">Обновить текущую версию (не создавать новую)</span>
                  </label>
                </div>
              )}
            </div>
            {editingProfile && (
              <div className="space-y-2">
                <Label>Статус</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, status: v }))}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">{STATUS_LABELS.draft}</SelectItem>
                    <SelectItem value="active">{STATUS_LABELS.active}</SelectItem>
                    <SelectItem value="archived">{STATUS_LABELS.archived}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Содержимое профиля</Label>
                <div className="flex gap-2">
                  <input
                    type="file"
                    accept=".sh,.ps1,.txt"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-1" />
                    Загрузить файл
                  </Button>
                </div>
              </div>
              <div className="rounded-md border overflow-hidden min-h-[200px]">
                <Textarea
                  value={typeof formData.content === "string" ? formData.content : ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, content: e.target.value }))}
                  placeholder="# Скрипт или текст профиля..."
                  rows={16}
                  className="font-mono text-sm rounded-none border-0 focus-visible:ring-0"
                />
              </div>
              {isProfileContentEmpty && (
                <p className="text-amber-600 text-sm">
                  Поле пока пустое. Сохранение доступно, но рекомендуется добавить текст профиля.
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editingProfile ? "Сохранить" : "Создать"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Preview dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Просмотр профиля</DialogTitle>
            <DialogDescription>Содержимое профиля (только чтение)</DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 min-h-[300px] rounded-md border p-2">
            <pre className="text-sm whitespace-pre-wrap font-mono">{previewContent || "—"}</pre>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => !open && setDeleteConfirm({ open: false, profile: null, onConfirm: null })}
        title="Удалить профиль?"
        description="Профиль будет удалён без возможности восстановления."
        confirmText="Удалить"
        cancelText="Отмена"
        variant="destructive"
        onConfirm={() => deleteConfirm.onConfirm?.()}
        onCancel={() => setDeleteConfirm({ open: false, profile: null, onConfirm: null })}
      />
    </div>
  );
}
