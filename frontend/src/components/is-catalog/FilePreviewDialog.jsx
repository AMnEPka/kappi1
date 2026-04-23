import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/config/api";

function isPdfFile({ contentType, filename }) {
  if (contentType === "application/pdf") return true;
  const name = (filename || "").toLowerCase();
  return name.endsWith(".pdf");
}

async function extractAxiosErrorMessage(err) {
  const fallback = "Не удалось загрузить файл для предпросмотра";
  const status = err?.response?.status;
  const data = err?.response?.data;

  if (!data) {
    if (status === 404) return "Файл не найден (возможно удалён).";
    return fallback;
  }

  // When responseType is "blob", FastAPI error JSON comes as Blob.
  if (typeof Blob !== "undefined" && data instanceof Blob) {
    try {
      const text = await data.text();
      try {
        const parsed = JSON.parse(text);
        if (parsed?.detail) return String(parsed.detail);
      } catch {
        if (text?.trim()) return text.trim();
      }
    } catch {
      // ignore
    }
    if (status === 404) return "Файл не найден (возможно удалён).";
    return fallback;
  }

  if (typeof data === "object" && data?.detail) return String(data.detail);
  if (typeof data === "string" && data.trim()) return data.trim();

  if (status === 404) return "Файл не найден (возможно удалён).";
  return fallback;
}

async function downloadFile(fileId, filename) {
  const res = await api.get(`/api/is-catalog/files/${encodeURIComponent(fileId)}`, { responseType: "blob" });
  const url = window.URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || fileId;
  a.click();
  window.URL.revokeObjectURL(url);
}

export function FilePreviewDialog({ open, onOpenChange, file }) {
  const [loading, setLoading] = useState(false);
  const [blobUrl, setBlobUrl] = useState(null);
  const [error, setError] = useState("");

  const canPreview = useMemo(() => {
    if (!file?.file_id) return false;
    return isPdfFile({ contentType: file.content_type, filename: file.filename });
  }, [file?.content_type, file?.filename, file?.file_id]);

  useEffect(() => {
    if (!open) return;
    if (!file?.file_id) return;

    if (!canPreview) {
      setError("Предпросмотр доступен только для PDF.");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    (async () => {
      try {
        const res = await api.get(`/api/is-catalog/files/${encodeURIComponent(file.file_id)}`, {
          responseType: "blob",
        });
        if (cancelled) return;
        const url = window.URL.createObjectURL(res.data);
        setBlobUrl(url);
      } catch (e) {
        if (cancelled) return;
        const msg = await extractAxiosErrorMessage(e);
        setError(msg);
        toast.error(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, file?.file_id, canPreview]);

  useEffect(() => {
    if (!open && blobUrl) {
      window.URL.revokeObjectURL(blobUrl);
      setBlobUrl(null);
      setError("");
      setLoading(false);
    }
  }, [open, blobUrl]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && blobUrl) {
          window.URL.revokeObjectURL(blobUrl);
          setBlobUrl(null);
        }
        onOpenChange?.(nextOpen);
      }}
    >
      <DialogContent className="max-w-5xl h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>Просмотр файла</DialogTitle>
          <DialogDescription className="truncate">
            {file?.filename || (file?.file_id ? `Файл: ${file.file_id}` : "Файл не выбран")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 rounded-md border bg-background overflow-hidden">
          {loading ? (
            <div className="h-full w-full flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="h-full w-full flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
              {error}
            </div>
          ) : blobUrl ? (
            <iframe title="File preview" src={blobUrl} className="w-full h-full" />
          ) : (
            <div className="h-full w-full flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
              Нет данных для предпросмотра
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" type="button" onClick={() => onOpenChange?.(false)}>
            Закрыть
          </Button>
          {file?.file_id && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => downloadFile(file.file_id, file.filename)}
              disabled={loading}
            >
              Скачать
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

