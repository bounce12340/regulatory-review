#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PDF Report Generator for Regulatory Review
"""

from datetime import datetime
from pathlib import Path
from typing import Dict, Optional

try:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
    )
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
    from reportlab.pdfgen import canvas as pdfcanvas
    PDF_AVAILABLE = True
except ImportError:
    PDF_AVAILABLE = False


# ─── Color palette (reportlab colors) ────────────────────────────────────────
NAVY        = colors.HexColor("#1A3A5C")
LIGHT_BLUE  = colors.HexColor("#E8F0FE")
COMPLETED   = colors.HexColor("#1E8855")
BLOCKED     = colors.HexColor("#C62828")
IN_PROGRESS = colors.HexColor("#F57F17")
PENDING     = colors.HexColor("#757575")
HIGH_RISK   = colors.HexColor("#C62828")
MED_RISK    = colors.HexColor("#F57F17")
LOW_RISK    = colors.HexColor("#1E8855")
WHITE       = colors.white
LIGHT_GREY  = colors.HexColor("#F5F5F5")
MID_GREY    = colors.HexColor("#CCCCCC")

STATUS_DISPLAY = {
    "completed":    "Completed",
    "in_progress":  "In Progress",
    "under_review": "Under Review",
    "blocked":      "Blocked",
    "pending":      "Pending",
}

RISK_DISPLAY = {"high": "HIGH", "medium": "MEDIUM", "low": "LOW"}


def _status_color(status: str):
    return {
        "completed":    COMPLETED,
        "blocked":      BLOCKED,
        "in_progress":  IN_PROGRESS,
        "under_review": IN_PROGRESS,
        "pending":      PENDING,
    }.get(status, colors.black)


def _risk_color(level: str):
    return {"high": HIGH_RISK, "medium": MED_RISK, "low": LOW_RISK}.get(level, colors.black)


class _NumberedCanvas(pdfcanvas.Canvas):
    """Canvas that adds page numbers."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self._draw_page_number(num_pages)
            pdfcanvas.Canvas.showPage(self)
        pdfcanvas.Canvas.save(self)

    def _draw_page_number(self, page_count: int):
        self.setFont("Helvetica", 8)
        self.setFillColor(PENDING)
        text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(A4[0] - 2 * cm, 1.2 * cm, text)
        self.setFillColor(NAVY)
        self.drawString(2 * cm, 1.2 * cm, "UNIVERSAL INTEGRATED CORP. | BD & Scientific Affairs")


def generate_pdf_report(
    report: Dict,
    output_path: Optional[str] = None,
    project_path: Optional[Path] = None,
) -> Path:
    """Generate a professional PDF report from a review report dict."""
    if not PDF_AVAILABLE:
        raise ImportError("reportlab not installed. Run: pip install reportlab")

    # ── Output path ───────────────────────────────────────────────────────────
    if output_path:
        dest = Path(output_path)
    elif project_path:
        dest = Path(project_path) / "review" / f"review-report-{datetime.now().strftime('%Y%m%d-%H%M%S')}.pdf"
    else:
        dest = Path(f"review-report-{report['project']}-{datetime.now().strftime('%Y%m%d')}.pdf")

    dest.parent.mkdir(parents=True, exist_ok=True)

    # ── Styles ────────────────────────────────────────────────────────────────
    base_styles = getSampleStyleSheet()

    header_style = ParagraphStyle(
        "HeaderStyle",
        parent=base_styles["Title"],
        fontSize=18,
        textColor=WHITE,
        alignment=TA_LEFT,
        spaceAfter=2,
    )
    sub_header_style = ParagraphStyle(
        "SubHeaderStyle",
        parent=base_styles["Normal"],
        fontSize=9,
        textColor=WHITE,
        alignment=TA_RIGHT,
    )
    section_style = ParagraphStyle(
        "SectionStyle",
        parent=base_styles["Heading1"],
        fontSize=12,
        textColor=NAVY,
        spaceBefore=12,
        spaceAfter=6,
        borderPad=4,
    )
    normal_style = ParagraphStyle(
        "NormalStyle",
        parent=base_styles["Normal"],
        fontSize=9,
        spaceAfter=2,
    )
    small_style = ParagraphStyle(
        "SmallStyle",
        parent=base_styles["Normal"],
        fontSize=8,
        textColor=PENDING,
        alignment=TA_CENTER,
        spaceBefore=12,
    )

    # ── Document ──────────────────────────────────────────────────────────────
    doc = SimpleDocTemplate(
        str(dest),
        pagesize=A4,
        topMargin=2 * cm,
        bottomMargin=2.5 * cm,
        leftMargin=2.5 * cm,
        rightMargin=2.5 * cm,
        title=f"Regulatory Review — {report['project'].upper()}",
        author="UNIVERSAL INTEGRATED CORP.",
    )

    story = []
    ts = datetime.fromisoformat(report["review_date"]).strftime("%Y-%m-%d %H:%M")
    summary = report["summary"]
    rate_float = float(report["completion_rate"].replace("%", ""))

    # ── Header banner ─────────────────────────────────────────────────────────
    banner_data = [[
        Paragraph("REGULATORY REVIEW REPORT", header_style),
        Paragraph("UNIVERSAL INTEGRATED CORP.<br/>BD &amp; Scientific Affairs", sub_header_style),
    ]]
    banner_table = Table(banner_data, colWidths=["60%", "40%"])
    banner_table.setStyle(TableStyle([
        ("BACKGROUND",  (0, 0), (-1, -1), NAVY),
        ("TOPPADDING",  (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
        ("LEFTPADDING",  (0, 0), (-1, -1), 16),
        ("RIGHTPADDING", (0, 0), (-1, -1), 16),
        ("VALIGN",      (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(banner_table)
    story.append(Spacer(1, 0.4 * cm))

    # ── Project overview ──────────────────────────────────────────────────────
    story.append(Paragraph("Project Overview", section_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=NAVY))
    story.append(Spacer(1, 0.2 * cm))

    overall_color = COMPLETED if "ready" in report["overall_status"] else (
        BLOCKED if "attention" in report["overall_status"] else IN_PROGRESS
    )
    completion_color = COMPLETED if rate_float >= 70 else (IN_PROGRESS if rate_float >= 40 else BLOCKED)

    def _ov_val(text, color=colors.black, bold=False):
        weight = "b" if bold else "font"
        return Paragraph(f'<{weight} color="{color.hexval() if hasattr(color,"hexval") else color}">{text}</{weight}>', normal_style)

    overview_data = [
        [Paragraph("<b>Field</b>",       normal_style), Paragraph("<b>Value</b>", normal_style)],
        ["Project",          _ov_val(report["project"].upper(), NAVY, True)],
        ["Document Type",    _ov_val(report.get("document_type", "—").replace("_", " ").title())],
        ["Review Date",      _ov_val(ts)],
        ["Overall Status",   _ov_val(report["overall_status"].replace("_", " ").title(), overall_color, True)],
        ["Completion Rate",  _ov_val(report["completion_rate"], completion_color, True)],
        ["Completed Items",  _ov_val(f"{summary['completed']} / {summary['total']}")],
        ["High-Risk Items",  _ov_val(str(summary["high_risk_items"]),
                                     HIGH_RISK if summary["high_risk_items"] > 0 else COMPLETED,
                                     summary["high_risk_items"] > 0)],
    ]

    # Convert plain-string cells to Paragraph
    for row in overview_data[1:]:
        if isinstance(row[0], str):
            row[0] = Paragraph(row[0], normal_style)

    ov_table = Table(overview_data, colWidths=["35%", "65%"])
    ov_style = [
        ("BACKGROUND",    (0, 0), (-1, 0),  NAVY),
        ("TEXTCOLOR",     (0, 0), (-1, 0),  WHITE),
        ("BACKGROUND",    (0, 1), (0, -1),  LIGHT_BLUE),
        ("ROWBACKGROUNDS",(0, 1), (-1, -1), [WHITE, LIGHT_GREY]),
        ("GRID",          (0, 0), (-1, -1), 0.5, MID_GREY),
        ("FONTSIZE",      (0, 0), (-1, -1), 9),
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING",   (0, 0), (-1, -1), 8),
    ]
    ov_table.setStyle(TableStyle(ov_style))
    story.append(ov_table)
    story.append(Spacer(1, 0.5 * cm))

    # ── Checklist table ────────────────────────────────────────────────────────
    story.append(Paragraph("Document Checklist", section_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=NAVY))
    story.append(Spacer(1, 0.2 * cm))

    chk_header = [
        Paragraph("<b>#</b>", normal_style),
        Paragraph("<b>Document Item</b>", normal_style),
        Paragraph("<b>Status</b>", normal_style),
        Paragraph("<b>Risk</b>", normal_style),
        Paragraph("<b>Notes</b>", normal_style),
    ]

    chk_data = [chk_header]
    for i, item in enumerate(report["items"], 1):
        s_color = _status_color(item["status"])
        r_color = _risk_color(item["risk_level"])
        status_text  = STATUS_DISPLAY.get(item["status"], item["status"])
        risk_text    = RISK_DISPLAY.get(item["risk_level"], item["risk_level"])
        notes_text   = item.get("notes") or "—"

        chk_data.append([
            Paragraph(str(i), normal_style),
            Paragraph(item["item"], normal_style),
            Paragraph(f'<b><font color="{s_color.hexval() if hasattr(s_color,"hexval") else s_color}">{status_text}</font></b>', normal_style),
            Paragraph(f'<b><font color="{r_color.hexval() if hasattr(r_color,"hexval") else r_color}">{risk_text}</font></b>', normal_style),
            Paragraph(notes_text, normal_style),
        ])

    chk_table = Table(chk_data, colWidths=["5%", "28%", "15%", "12%", "40%"])
    chk_style = [
        ("BACKGROUND",    (0, 0), (-1, 0),  NAVY),
        ("TEXTCOLOR",     (0, 0), (-1, 0),  WHITE),
        ("ROWBACKGROUNDS",(0, 1), (-1, -1), [WHITE, LIGHT_GREY]),
        ("GRID",          (0, 0), (-1, -1), 0.5, MID_GREY),
        ("FONTSIZE",      (0, 0), (-1, -1), 8),
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING",   (0, 0), (-1, -1), 6),
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
    ]
    chk_table.setStyle(TableStyle(chk_style))
    story.append(chk_table)
    story.append(Spacer(1, 0.5 * cm))

    # ── Action items ──────────────────────────────────────────────────────────
    if report.get("action_items"):
        story.append(Paragraph("Action Items", section_style))
        story.append(HRFlowable(width="100%", thickness=1.5, color=NAVY))
        story.append(Spacer(1, 0.2 * cm))

        act_header = [
            Paragraph("<b>Priority</b>", normal_style),
            Paragraph("<b>Document Item</b>", normal_style),
            Paragraph("<b>Required Action</b>", normal_style),
        ]
        act_data = [act_header]
        for action in report["action_items"]:
            p_color = HIGH_RISK if action["priority"] == "high" else MED_RISK
            p_text  = action["priority"].upper()
            act_data.append([
                Paragraph(f'<b><font color="{p_color.hexval() if hasattr(p_color,"hexval") else p_color}">{p_text}</font></b>', normal_style),
                Paragraph(action["item"], normal_style),
                Paragraph(action["action"], normal_style),
            ])

        act_table = Table(act_data, colWidths=["12%", "35%", "53%"])
        act_table.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, 0),  NAVY),
            ("TEXTCOLOR",     (0, 0), (-1, 0),  WHITE),
            ("ROWBACKGROUNDS",(0, 1), (-1, -1), [WHITE, LIGHT_GREY]),
            ("GRID",          (0, 0), (-1, -1), 0.5, MID_GREY),
            ("FONTSIZE",      (0, 0), (-1, -1), 8),
            ("TOPPADDING",    (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING",   (0, 0), (-1, -1), 6),
            ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        ]))
        story.append(act_table)
        story.append(Spacer(1, 0.5 * cm))

    # ── Footer note ───────────────────────────────────────────────────────────
    story.append(Spacer(1, 0.5 * cm))
    story.append(Paragraph(
        f"Generated on {ts} by UNIVERSAL INTEGRATED CORP. Regulatory Affairs. "
        "This document is confidential and intended for internal use only.",
        small_style,
    ))

    doc.build(story, canvasmaker=_NumberedCanvas)
    return dest
