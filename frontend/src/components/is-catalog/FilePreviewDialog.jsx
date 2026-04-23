import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import DOMPurify from "dompurify";
import { api } from "@/config/api";

const PREVIEW_KIND_PDF = "pdf";
const PREVIEW_KIND_DOCX = "docx";
const PREVIEW_KIND_XLSX = "xlsx";
const PREVIEW_KIND_NONE = "none";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const XLS_MIME = "application/vnd.ms-excel";

const log = (...args) => {
  // eslint-disable-next-line no-console
  console.log("[FilePreviewDialog]", ...args);
};
const logError = (...args) => {
  // eslint-disable-next-line no-console
  console.error("[FilePreviewDialog]", ...args);
};

function detectPreviewKind({ contentType, filename }) {
  const name = (filename || "").toLowerCase();
  if (contentType === "application/pdf" || name.endsWith(".pdf")) return PREVIEW_KIND_PDF;
  if (contentType === DOCX_MIME || name.endsWith(".docx")) return PREVIEW_KIND_DOCX;
  if (
    contentType === XLSX_MIME ||
    contentType === XLS_MIME ||
    name.endsWith(".xlsx") ||
    name.endsWith(".xls")
  ) {
    return PREVIEW_KIND_XLSX;
  }
  return PREVIEW_KIND_NONE;
}

async function extractAxiosErrorMessage(err) {
  const fallback = "Не удалось загрузить файл для предпросмотра";
  const status = err?.response?.status;
  const data = err?.response?.data;

  if (!data) {
    if (status === 404) return "Файл не найден (возможно удалён).";
    return fallback;
  }

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

async function waitForRef(ref, { timeoutMs = 3000, intervalMs = 50 } = {}) {
  const start = Date.now();
  while (!ref.current) {
    if (Date.now() - start > timeoutMs) return null;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return ref.current;
}

async function blobToArrayBuffer(blob) {
  if (typeof blob.arrayBuffer === "function") return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

export function FilePreviewDialog({ open, onOpenChange, file }) {
  const [loading, setLoading] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [error, setError] = useState("");

  const [xlsxWorkbook, setXlsxWorkbook] = useState(null);
  const [xlsxSheetNames, setXlsxSheetNames] = useState([]);
  const [xlsxActiveSheet, setXlsxActiveSheet] = useState("");
  const [xlsxSheetHtml, setXlsxSheetHtml] = useState("");

  const docxContainerRef = useRef(null);

  const kind = useMemo(() => {
    if (!file?.file_id) return PREVIEW_KIND_NONE;
    return detectPreviewKind({ contentType: file.content_type, filename: file.filename });
  }, [file?.content_type, file?.filename, file?.file_id]);

  useEffect(() => {
    if (!open || !file?.file_id) return undefined;

    log("open preview", { file_id: file.file_id, filename: file.filename, content_type: file.content_type, kind });

    if (kind === PREVIEW_KIND_NONE) {
      setError("Предпросмотр поддерживается только для PDF, DOCX и XLSX.");
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError("");
    setXlsxWorkbook(null);
    setXlsxSheetNames([]);
    setXlsxActiveSheet("");
    setXlsxSheetHtml("");

    const load = async () => {
      try {
        log("fetching blob", `/api/is-catalog/files/${file.file_id}`);
        const res = await api.get(`/api/is-catalog/files/${encodeURIComponent(file.file_id)}`, {
          responseType: "blob",
        });
        if (cancelled) return;

        const blob = res.data;
        log("fetched blob", { size: blob?.size, type: blob?.type, isBlob: blob instanceof Blob });

        if (kind === PREVIEW_KIND_PDF) {
          const url = window.URL.createObjectURL(blob);
          setPdfBlobUrl(url);
          log("pdf blob url ready");
          return;
        }

        if (kind === PREVIEW_KIND_DOCX) {
          const container = await waitForRef(docxContainerRef);
          if (cancelled) return;
          if (!container) {
            throw new Error("DOCX контейнер не готов к рендеру");
          }
          container.innerHTML = "";

          log("loading docx-preview module");
          const mod = await import("docx-preview");
          if (cancelled) return;
          const renderAsync = mod.renderAsync || mod.default?.renderAsync;
          if (typeof renderAsync !== "function") {
            throw new Error("docx-preview: renderAsync не найден");
          }

          const docxBlob =
            blob instanceof Blob ? blob : new Blob([blob], { type: DOCX_MIME });

          log("renderAsync start", { size: docxBlob.size, type: docxBlob.type });
          await renderAsync(docxBlob, container, null, {
            className: "docx",
            inWrapper: true,
            ignoreWidth: false,
            ignoreHeight: false,
            ignoreFonts: false,
            breakPages: true,
            experimental: true,
          });
          log("renderAsync done, childNodes:", container.childNodes.length);
          if (container.childNodes.length === 0) {
            throw new Error("DOCX отрендерен пустым. Возможно, неподдерживаемая структура документа.");
          }
          return;
        }

        if (kind === PREVIEW_KIND_XLSX) {
          log("loading xlsx module");
          const XLSX = await import("xlsx");
          if (cancelled) return;

          const buffer = await blobToArrayBuffer(blob);
          if (cancelled) return;
          log("xlsx buffer ready", { byteLength: buffer?.byteLength });

          const workbook = XLSX.read(buffer, { type: "array" });
          const sheetNames = Array.isArray(workbook?.SheetNames) ? workbook.SheetNames : [];
          log("xlsx parsed", { sheetCount: sheetNames.length, sheets: sheetNames });

          if (sheetNames.length === 0) {
            throw new Error("В книге Excel нет листов");
          }

          setXlsxWorkbook(workbook);
          setXlsxSheetNames(sheetNames);
          setXlsxActiveSheet(sheetNames[0]);
        }
      } catch (e) {
        if (cancelled) return;
        logError("preview failed", e);
        const msg = await extractAxiosErrorMessage(e);
        const finalMsg = typeof e?.message === "string" && e.message && !e?.response ? e.message : msg;
        setError(finalMsg);
        toast.error(finalMsg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [open, file?.file_id, kind]);

  useEffect(() => {
    if (!xlsxWorkbook || !xlsxActiveSheet) {
      setXlsxSheetHtml("");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const XLSX = await import("xlsx");
        if (cancelled) return;
        const sheet = xlsxWorkbook.Sheets?.[xlsxActiveSheet];
        if (!sheet) {
          setXlsxSheetHtml("");
          return;
        }
        const html = XLSX.utils.sheet_to_html(sheet, { id: "xlsx-preview-table" });
        const safeHtml = DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
        setXlsxSheetHtml(safeHtml);
        log("xlsx sheet rendered", { sheet: xlsxActiveSheet, bytes: safeHtml.length });
      } catch (e) {
        logError("xlsx sheet render failed", e);
        setError(e?.message || "Ошибка отрисовки листа Excel");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [xlsxWorkbook, xlsxActiveSheet]);

  useEffect(() => {
    if (open) return;
    if (pdfBlobUrl) {
      window.URL.revokeObjectURL(pdfBlobUrl);
      setPdfBlobUrl(null);
    }
    if (docxContainerRef.current) {
      docxContainerRef.current.innerHTML = "";
    }
    setXlsxWorkbook(null);
    setXlsxSheetNames([]);
    setXlsxActiveSheet("");
    setXlsxSheetHtml("");
    setError("");
    setLoading(false);
  }, [open, pdfBlobUrl]);

  const handleOpenChange = (nextOpen) => {
    if (!nextOpen && pdfBlobUrl) {
      window.URL.revokeObjectURL(pdfBlobUrl);
      setPdfBlobUrl(null);
    }
    onOpenChange?.(nextOpen);
  };

  const showOverlay =
    loading ||
    !!error ||
    (kind === PREVIEW_KIND_PDF && !pdfBlobUrl) ||
    (kind === PREVIEW_KIND_XLSX && !xlsxSheetHtml);

  const renderOverlay = () => {
    if (loading) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-background/70">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }
    if (error) {
      return (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-muted-foreground bg-background/90">
          {error}
        </div>
      );
    }
    if (kind === PREVIEW_KIND_NONE) {
      return (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-muted-foreground bg-background/90">
          Предпросмотр поддерживается только для PDF, DOCX и XLSX
        </div>
      );
    }
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-5xl h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>Просмотр файла</DialogTitle>
          <DialogDescription className="truncate">
            {file?.filename || (file?.file_id ? `Файл: ${file.file_id}` : "Файл не выбран")}
          </DialogDescription>
        </DialogHeader>

        {kind === PREVIEW_KIND_XLSX && xlsxSheetNames.length > 1 && !error && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm text-muted-foreground">Лист:</span>
            <Select value={xlsxActiveSheet} onValueChange={setXlsxActiveSheet}>
              <SelectTrigger className="w-[240px] h-8">
                <SelectValue placeholder="Выберите лист" />
              </SelectTrigger>
              <SelectContent>
                {xlsxSheetNames.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="relative flex-1 min-h-0 rounded-md border bg-background overflow-hidden">
          {kind === PREVIEW_KIND_DOCX && (
            <div className="h-full w-full overflow-auto bg-white">
              <div ref={docxContainerRef} className="mx-auto my-4 max-w-[900px] px-4 docx-preview-host" />
            </div>
          )}

          {kind === PREVIEW_KIND_PDF && pdfBlobUrl && !error && (
            <iframe title="File preview" src={pdfBlobUrl} className="w-full h-full" />
          )}

          {kind === PREVIEW_KIND_XLSX && xlsxSheetHtml && !error && (
            <div className="h-full w-full overflow-auto bg-white">
              <div
                className="xlsx-preview-host p-3 text-sm"
                dangerouslySetInnerHTML={{ __html: xlsxSheetHtml }}
              />
            </div>
          )}

          {showOverlay && renderOverlay()}
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
