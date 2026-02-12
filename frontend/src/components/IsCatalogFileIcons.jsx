/**
 * Icons for IS catalog file field types: Word, Excel, PDF.
 * Used in table view and forms.
 */

import React from "react";

const WORD_COLOR = "#2B579A";
const EXCEL_COLOR = "#217346";
const PDF_COLOR = "#E74C3C";

// Document icon with fold (generic); color distinguishes Word/Excel/PDF
function DocumentIcon({ color, className, title }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label={title} title={title}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill={color} fillOpacity="0.15" />
      <path d="M14 2v6h6" fill={color} fillOpacity="0.25" />
    </svg>
  );
}

export function IconWord({ className = "h-6 w-6", title = "Word" }) {
  return <DocumentIcon color={WORD_COLOR} className={className} title={title} />;
}

export function IconExcel({ className = "h-6 w-6", title = "Excel" }) {
  return <DocumentIcon color={EXCEL_COLOR} className={className} title={title} />;
}

export function IconPdf({ className = "h-6 w-6", title = "PDF" }) {
  return <DocumentIcon color={PDF_COLOR} className={className} title={title} />;
}

/** Get file type from content_type or filename for icon choice */
export function getFileType(contentType, filename = "") {
  const ct = (contentType || "").toLowerCase();
  const ext = (filename || "").split(".").pop()?.toLowerCase();
  if (ct.includes("word") || ext === "doc" || ext === "docx") return "word";
  if (ct.includes("sheet") || ct.includes("excel") || ext === "xls" || ext === "xlsx") return "excel";
  if (ct.includes("pdf") || ext === "pdf") return "pdf";
  return null;
}

export function FileTypeIcon({ contentType, filename, className = "h-6 w-6", title }) {
  const type = getFileType(contentType, filename);
  const t = title || filename || type;
  if (type === "word") return <IconWord className={className} title={t} />;
  if (type === "excel") return <IconExcel className={className} title={t} />;
  if (type === "pdf") return <IconPdf className={className} title={t} />;
  return null;
}
