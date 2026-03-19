"""
services/services_config_integrity_report.py
Generate HTML report and summary stats for config-integrity.
"""

from __future__ import annotations

import uuid
import io
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any

from config.config_init import db, logger
from config.config_settings import CONFIG_INTEGRITY_SCHEDULE_TZ
from utils.db_utils import prepare_for_mongo
from zoneinfo import ZoneInfo


def _escape_html(s: str) -> str:
    return (
        (s or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&#39;")
    )


def _fmt_dt_ru(iso: str | None) -> str:
    if not iso:
        return "—"
    try:
        tz = ZoneInfo(CONFIG_INTEGRITY_SCHEDULE_TZ)
        return (
            datetime.fromisoformat(iso.replace("Z", "+00:00"))
            .astimezone(tz)
            .strftime("%d.%m.%Y, %H:%M")
        )
    except Exception:
        return iso


async def generate_config_integrity_report(*, period_days: int) -> Dict[str, Any]:
    """
    Builds report from current monitored hosts + check history for the last N days.
    Stores HTML snapshot in `config_integrity_reports` and returns the stored doc.
    """
    now = datetime.now(timezone.utc)
    since_iso = (now - timedelta(days=period_days)).isoformat()

    hosts = await db.config_integrity_hosts.find({"is_monitored": True}, {"_id": 0}).to_list(5000)
    host_ids: List[str] = [h.get("id") for h in hosts if h.get("id")]

    checks = []
    if host_ids:
        checks = await db.config_integrity_checks.find(
            {"host_id": {"$in": host_ids}, "checked_at": {"$gte": since_iso}},
            {"_id": 0},
        ).to_list(200000)

    # violations_count = number of checks where changed_files_count > 0
    violations_by_host: Dict[str, int] = {}
    for c in checks:
        hid = c.get("host_id")
        changed = c.get("changed_files_count")
        if hid and isinstance(changed, int) and changed > 0:
            violations_by_host[hid] = violations_by_host.get(hid, 0) + 1

    rows = []
    hosts_with_violations = 0
    total_violations = 0
    for h in hosts:
        hid = h.get("id") or ""
        init_at = h.get("initialized_at")
        monitored_days = 0
        if init_at:
            try:
                init_dt = datetime.fromisoformat(init_at.replace("Z", "+00:00"))
                monitored_days = max(0, (now - init_dt).days)
            except Exception:
                monitored_days = 0

        vcount = violations_by_host.get(hid, 0)
        # "has_violations" must reflect only violations within the selected period
        has_v = vcount > 0
        if has_v:
            hosts_with_violations += 1
        total_violations += vcount

        rows.append(
            {
                "host_id": hid,
                "name": h.get("name") or "",
                "ip_address": h.get("ip_address") or "",
                "monitored_days": monitored_days,
                "files_count": h.get("monitored_files_count"),
                "changed_last": h.get("changed_files_count"),
                "violations_count": vcount,
                "has_violations": has_v,
                "last_check_at": h.get("last_check_at"),
            }
        )

    total_hosts = len(rows)
    percent = (hosts_with_violations / total_hosts * 100.0) if total_hosts else 0.0

    # Build HTML
    html_rows = []
    for r in rows:
        status = "Есть" if r["has_violations"] else "Нет"
        status_cls = "bad" if r["has_violations"] else "ok"
        html_rows.append(
            "<tr>"
            f"<td>{_escape_html(r['name'])}</td>"
            f"<td class='mono'>{_escape_html(r['ip_address'])}</td>"
            f"<td class='num'>{r['monitored_days']}</td>"
            f"<td class='num'>{r['violations_count']}</td>"
            f"<td class='{status_cls}'>{status}</td>"
            f"<td>{_escape_html(_fmt_dt_ru(r.get('last_check_at')))}</td>"
            "</tr>"
        )

    report_id = str(uuid.uuid4())
    generated_at = now.isoformat()
    title = f"Отчёт по целостности конфигурации (период {period_days} дней)"
    html = f"""<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{_escape_html(title)}</title>
  <style>
    body {{ font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; padding: 24px; color: #111; }}
    h1 {{ font-size: 18px; margin: 0 0 8px; }}
    .meta {{ color: #444; font-size: 12px; margin-bottom: 16px; }}
    .kpi {{ display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 16px 0 18px; }}
    .card {{ border: 1px solid #ddd; border-radius: 10px; padding: 12px; }}
    .card .label {{ font-size: 12px; color: #555; }}
    .card .value {{ font-size: 18px; font-weight: 700; margin-top: 4px; }}
    table {{ width: 100%; border-collapse: collapse; }}
    th, td {{ border-bottom: 1px solid #eee; padding: 10px 8px; font-size: 12px; vertical-align: top; }}
    th {{ text-align: left; color: #444; font-weight: 600; }}
    td.num {{ text-align: right; font-variant-numeric: tabular-nums; }}
    td.mono {{ font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }}
    .ok {{ color: #0a7a28; font-weight: 600; }}
    .bad {{ color: #b42318; font-weight: 700; }}
    @media print {{
      body {{ padding: 0; }}
      .noprint {{ display: none !important; }}
    }}
  </style>
</head>
<body>
  <div class="noprint" style="display:flex; justify-content:flex-end; gap:8px; margin-bottom:12px;">
    <button onclick="window.print()" style="padding:8px 10px; border:1px solid #ddd; border-radius:8px; background:#fff; cursor:pointer;">Экспорт в PDF (печать)</button>
  </div>
  <h1>{_escape_html(title)}</h1>
  <div class="meta">Сгенерировано: {_escape_html(_fmt_dt_ru(generated_at))}</div>

  <div class="kpi">
    <div class="card"><div class="label">Контролируемых хостов</div><div class="value">{total_hosts}</div></div>
    <div class="card"><div class="label">Хостов с нарушениями</div><div class="value">{hosts_with_violations}</div></div>
    <div class="card"><div class="label">% хостов с нарушениями</div><div class="value">{percent:.1f}%</div></div>
    <div class="card"><div class="label">Нарушений за период</div><div class="value">{total_violations}</div></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Хост</th>
        <th>IP</th>
        <th style="text-align:right;">Контролируется дней</th>
        <th style="text-align:right;">Нарушений</th>
        <th>Статус</th>
        <th>Последняя проверка</th>
      </tr>
    </thead>
    <tbody>
      {''.join(html_rows) if html_rows else '<tr><td colspan="6">Нет данных</td></tr>'}
    </tbody>
  </table>
</body>
</html>"""

    doc = {
        "id": report_id,
        "generated_at": generated_at,
        "period_days": period_days,
        "summary": {
            "period_days": period_days,
            "total_hosts": total_hosts,
            "hosts_with_violations": hosts_with_violations,
            "percent_hosts_with_violations": percent,
            "total_violations": total_violations,
            "generated_at": generated_at,
        },
        "rows": rows,
        "html": html,
    }

    try:
        await db.config_integrity_reports.insert_one(prepare_for_mongo(doc))
    except Exception:
        logger.exception("Failed to store config integrity report")
        raise

    return doc


async def generate_config_integrity_report_pdf_bytes(*, period_days: int) -> bytes:
    """
    Generates a PDF report (bytes) for the last N days.
    Uses the same underlying data aggregation as HTML report.
    """
    data = await generate_config_integrity_report(period_days=period_days)
    summary = data.get("summary") or {}
    rows = data.get("rows") or []

    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
        from reportlab.lib.enums import TA_LEFT
        from reportlab.platypus import (
            SimpleDocTemplate,
            Paragraph,
            Spacer,
            Table,
            TableStyle,
        )
    except Exception as e:
        logger.exception("reportlab import failed")
        raise RuntimeError("PDF генератор не установлен (reportlab)") from e

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=24,
        rightMargin=24,
        topMargin=24,
        bottomMargin=24,
        title="Config integrity report",
    )
    styles = getSampleStyleSheet()

    # Unicode font for Cyrillic (installed via fonts-dejavu-core in Dockerfile)
    font_name = "DejaVuSans"
    font_bold_name = "DejaVuSans-Bold"
    try:
        pdfmetrics.registerFont(
            TTFont(font_name, "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
        )
        pdfmetrics.registerFont(
            TTFont(font_bold_name, "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")
        )
    except Exception:
        # Fallback to default fonts (may not render Cyrillic)
        font_name = "Helvetica"
        font_bold_name = "Helvetica-Bold"

    styles["Title"].fontName = font_bold_name
    styles["Normal"].fontName = font_name
    header_style = styles["Normal"].clone("header")
    header_style.fontName = font_bold_name
    header_style.fontSize = 8
    header_style.leading = 9
    header_style.alignment = TA_LEFT
    cell_style = styles["Normal"].clone("cell")
    cell_style.fontName = font_name
    cell_style.fontSize = 8
    cell_style.leading = 9

    title = f"Отчёт по целостности конфигурации (период {period_days} дней)"
    generated_at = summary.get("generated_at") or data.get("generated_at")

    elements = [
        Paragraph(title, styles["Title"]),
        Spacer(1, 6),
        Paragraph(f"Сгенерировано: {_escape_html(_fmt_dt_ru(generated_at))}", styles["Normal"]),
        Spacer(1, 10),
        Paragraph(f"Контролируемых хостов: <b>{summary.get('total_hosts', 0)}</b>", styles["Normal"]),
        Paragraph(f"Хостов с нарушениями: <b>{summary.get('hosts_with_violations', 0)}</b>", styles["Normal"]),
        Paragraph(
            f"% хостов с нарушениями: <b>{float(summary.get('percent_hosts_with_violations', 0.0)):.1f}%</b>",
            styles["Normal"],
        ),
        Paragraph(f"Нарушений за период: <b>{summary.get('total_violations', 0)}</b>", styles["Normal"]),
        Spacer(1, 12),
    ]

    table_data = [
        [
            Paragraph("Хост", header_style),
            Paragraph("IP", header_style),
            Paragraph("Файлов", header_style),
            Paragraph("Изм.", header_style),
            Paragraph("Статус", header_style),
            Paragraph("Последняя<br/>проверка", header_style),
        ]
    ]
    for r in rows:
        files_count = r.get("files_count")
        changed_last = r.get("changed_last")
        table_data.append(
            [
                Paragraph(str(r.get("name") or ""), cell_style),
                Paragraph(str(r.get("ip_address") or ""), cell_style),
                Paragraph(str(files_count if files_count is not None else "—"), cell_style),
                Paragraph(str(changed_last if changed_last is not None else "—"), cell_style),
                Paragraph("Есть" if r.get("has_violations") else "Нет", cell_style),
                Paragraph(_fmt_dt_ru(r.get("last_check_at")), cell_style),
            ]
        )

    tbl = Table(table_data, repeatRows=1, colWidths=[170, 85, 55, 45, 60, 90])
    tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.black),
                ("FONTNAME", (0, 0), (-1, 0), font_bold_name),
                ("FONTSIZE", (0, 0), (-1, 0), 9),
                ("FONTNAME", (0, 1), (-1, -1), font_name),
                ("FONTSIZE", (0, 1), (-1, -1), 8),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ALIGN", (2, 1), (3, -1), "RIGHT"),
                ("ALIGN", (2, 0), (3, 0), "RIGHT"),
                ("WORDWRAP", (0, 0), (-1, -1), True),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    elements.append(tbl)

    doc.build(elements)
    return buf.getvalue()

