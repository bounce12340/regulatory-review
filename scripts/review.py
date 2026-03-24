#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Regulatory Document Review System
Automated checklist for TFDA submissions
"""

import io
import json
import sys
import time
import argparse
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional

# Force UTF-8 output on Windows
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
if sys.stderr.encoding != 'utf-8':
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

try:
    from rich.console import Console
    from rich.table import Table
    from rich.panel import Panel
    from rich.progress import Progress, BarColumn, TextColumn, MofNCompleteColumn
    from rich.text import Text
    from rich import box
    RICH_AVAILABLE = True
except ImportError:
    RICH_AVAILABLE = False

console = Console(highlight=False) if RICH_AVAILABLE else None


# ---------------------------------------------------------------------------
# Data layer
# ---------------------------------------------------------------------------

DEFAULT_DATA: Dict = {
    "item1_status": "in_progress",
    "item1_notes": "Expected to complete today (2026-03-23)",
    "item2_status": "completed",
    "item2_notes": "GMP renewal completed",
    "item3_status": "under_review",
    "item3_notes": "TFDA review in progress",
    "item4_status": "completed",
    "item4_notes": "GMP certificate with QR code available",
    "item5_status": "blocked",
    "item5_notes": "QR code verification failed. Email sent to SMB Maryvonnic on 2026-03-23. Waiting for response.",
    "item6_status": "completed",
    "item6_notes": "Risk assessment report approved",
    "item7_status": "pending",
    "item7_notes": "Waiting for all documents to be ready",
}


def load_data(data_path: Optional[str]) -> Dict:
    """Load project data from file or return defaults."""
    if data_path:
        with open(data_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return DEFAULT_DATA


# ---------------------------------------------------------------------------
# Review logic
# ---------------------------------------------------------------------------

ITEM_DEFINITIONS = [
    ("item1", "換發新證申請書",            "license_renewal"),
    ("item2", "成品製造廠 GMP 核備函",      "gmp"),
    ("item3", "藥典/廠規檢驗規格變更備查",   "specification"),
    ("item4", "原料藥製造廠 GMP 證明文件",   "api_gmp"),
    ("item5", "非登不可上傳原料藥 GMP 文件", "upload"),
    ("item6", "成品元素不純物風險評估報告",   "risk_assessment"),
    ("item7", "ExPress 平臺上傳補正內容",    "submission"),
]

RISK_RULES = {
    "license_renewal": lambda s: "high" if s != "completed" else "low",
    "gmp":             lambda s: "low"  if s == "completed" else "high",
    "specification":   lambda s: "medium" if s == "under_review" else "high",
    "api_gmp":         lambda s: "low"  if s == "completed" else "medium",
    "upload":          lambda s: "high" if s == "blocked" else "low",
    "risk_assessment": lambda s: "low"  if s == "completed" else "high",
    "submission":      lambda s: "medium" if s == "pending" else "low",
}

ACTION_RECOMMENDATIONS = {
    "license_renewal": "Complete and submit license renewal application form",
    "gmp":             "Obtain updated GMP verification letter",
    "specification":   "Follow up with TFDA on specification change review",
    "api_gmp":         "Verify API GMP certificate authenticity",
    "upload":          "Resolve QR code verification issue and upload documents",
    "risk_assessment": "Submit risk assessment report for approval",
    "submission":      "Prepare all documents for ExPress platform upload",
}


def build_items(data: Dict) -> List[Dict]:
    """Build checklist items from raw data."""
    items = []
    for key, label, category in ITEM_DEFINITIONS:
        status = data.get(f"{key}_status", "pending")
        items.append({
            "item":       label,
            "category":   category,
            "status":     status,
            "notes":      data.get(f"{key}_notes", ""),
            "risk_level": RISK_RULES[category](status),
        })
    return items


def generate_report(project_name: str, data: Dict) -> Dict:
    """Build the full review report dict."""
    items = build_items(data)

    completed = sum(1 for i in items if i["status"] == "completed")
    total     = len(items)
    rate      = (completed / total * 100) if total else 0

    high_risk = [i for i in items if i["risk_level"] == "high"]

    action_items = [
        {
            "item":     i["item"],
            "priority": "high" if i["risk_level"] == "high" else "medium",
            "action":   ACTION_RECOMMENDATIONS.get(i["category"], "Complete required documentation"),
        }
        for i in items if i["status"] != "completed"
    ]

    if rate == 100:
        overall = "ready_for_submission"
    elif rate >= 70:
        overall = "in_progress"
    else:
        overall = "needs_attention"

    return {
        "review_date":     datetime.now().isoformat(),
        "project":         project_name,
        "document_type":   "drug_registration_extension",
        "overall_status":  overall,
        "completion_rate": f"{rate:.1f}%",
        "items":           items,
        "risks":           high_risk,
        "action_items":    action_items,
        "summary": {
            "completed":        completed,
            "total":            total,
            "high_risk_items":  len(high_risk),
        },
    }


# ---------------------------------------------------------------------------
# Persistence
# ---------------------------------------------------------------------------

def save_report(report: Dict, project_path: Path, output_path: Optional[str] = None) -> Path:
    """Save review report as JSON."""
    if output_path is None:
        dest = project_path / "review" / f"auto-review-{datetime.now().strftime('%Y%m%d')}.json"
    else:
        dest = Path(output_path)
    dest.parent.mkdir(parents=True, exist_ok=True)
    with open(dest, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    return dest


def export_markdown(report: Dict, project_path: Path) -> Path:
    """Export review report as Markdown."""
    dest = project_path / "review" / f"auto-review-{datetime.now().strftime('%Y%m%d-%H%M%S')}.md"
    dest.parent.mkdir(parents=True, exist_ok=True)

    STATUS_EMOJI = {
        "completed":    "✅",
        "in_progress":  "🔄",
        "under_review": "🔍",
        "blocked":      "🚫",
        "pending":      "⏳",
    }
    RISK_EMOJI = {"low": "🟢", "medium": "🟡", "high": "🔴"}

    lines = [
        f"# Regulatory Review — {report['project'].upper()}",
        f"",
        f"**Generated:** {report['review_date']}  ",
        f"**Overall Status:** `{report['overall_status']}`  ",
        f"**Completion:** {report['completion_rate']}  ",
        f"",
        f"## Checklist",
        f"",
        f"| # | Item | Status | Risk |",
        f"|---|------|--------|------|",
    ]
    for idx, item in enumerate(report["items"], 1):
        s_icon = STATUS_EMOJI.get(item["status"], "❓")
        r_icon = RISK_EMOJI.get(item["risk_level"], "")
        lines.append(
            f"| {idx} | {item['item']} | {s_icon} {item['status']} | {r_icon} {item['risk_level']} |"
        )

    if report["risks"]:
        lines += ["", "## High-Risk Items", ""]
        for risk in report["risks"]:
            lines.append(f"- **{risk['item']}**: {risk['notes']}")

    if report["action_items"]:
        lines += ["", "## Action Items", ""]
        for action in report["action_items"]:
            lines.append(f"- [{action['priority'].upper()}] **{action['item']}**")
            lines.append(f"  - {action['action']}")

    dest.write_text("\n".join(lines), encoding="utf-8")
    return dest


# ---------------------------------------------------------------------------
# Rich output
# ---------------------------------------------------------------------------

STATUS_STYLE = {
    "completed":    ("bold green",  "✓"),
    "in_progress":  ("bold yellow", "↻"),
    "under_review": ("cyan",        "🔍"),
    "blocked":      ("bold red",    "✗"),
    "pending":      ("dim",         "…"),
}

RISK_STYLE = {
    "low":    "bold green",
    "medium": "bold yellow",
    "high":   "bold red",
}

OVERALL_STYLE = {
    "ready_for_submission": "bold green",
    "in_progress":          "bold yellow",
    "needs_attention":      "bold red",
}


def _risk_text(level: str) -> Text:
    label = {"low": "LOW", "medium": "MED", "high": "HIGH"}.get(level, level.upper())
    return Text(label, style=RISK_STYLE.get(level, ""))


def _status_text(status: str) -> Text:
    style, icon = STATUS_STYLE.get(status, ("", "?"))
    return Text(f"{icon} {status}", style=style)


def render_rich(report: Dict, saved_path: Path, md_path: Optional[Path] = None):
    """Render the full report using Rich."""
    assert console is not None

    ts = datetime.fromisoformat(report["review_date"]).strftime("%Y-%m-%d %H:%M:%S")
    overall_style = OVERALL_STYLE.get(report["overall_status"], "")
    summary = report["summary"]

    # ── Header panel ──────────────────────────────────────────────────────
    header_text = Text()
    header_text.append(f"Project: ", style="bold")
    header_text.append(f"{report['project'].upper()}\n", style="bold cyan")
    header_text.append(f"Date:    {ts}\n")
    header_text.append(f"Status:  ")
    header_text.append(report["overall_status"], style=overall_style)
    console.print(Panel(header_text, title="[bold]Regulatory Review[/bold]", border_style="blue"))

    # ── Progress bar ──────────────────────────────────────────────────────
    completed = summary["completed"]
    total     = summary["total"]
    with Progress(
        TextColumn("[bold]Completion[/bold]"),
        BarColumn(bar_width=40),
        MofNCompleteColumn(),
        TextColumn(f"({report['completion_rate']})"),
        console=console,
        transient=False,
    ) as progress:
        task = progress.add_task("", total=total, completed=completed)
        progress.update(task)  # force render

    # ── Checklist table ───────────────────────────────────────────────────
    table = Table(
        title="Checklist Items",
        box=box.ROUNDED,
        show_lines=True,
        border_style="blue",
    )
    table.add_column("#",      style="dim",  width=3,  justify="right")
    table.add_column("Item",   style="bold", min_width=28)
    table.add_column("Status", min_width=14)
    table.add_column("Risk",   min_width=6,  justify="center")
    table.add_column("Notes",  style="dim",  min_width=20)

    for idx, item in enumerate(report["items"], 1):
        table.add_row(
            str(idx),
            item["item"],
            _status_text(item["status"]),
            _risk_text(item["risk_level"]),
            item["notes"] or "—",
        )
    console.print(table)

    # ── High-risk panel ───────────────────────────────────────────────────
    if report["risks"]:
        risk_text = Text()
        for risk in report["risks"]:
            risk_text.append("• ", style="bold red")
            risk_text.append(risk["item"], style="bold")
            if risk["notes"]:
                risk_text.append(f"\n  {risk['notes']}", style="dim")
            risk_text.append("\n")
        console.print(Panel(risk_text, title="[bold red]High-Risk Items[/bold red]", border_style="red"))

    # ── Action items panel ────────────────────────────────────────────────
    if report["action_items"]:
        action_text = Text()
        for action in report["action_items"]:
            priority_style = "bold red" if action["priority"] == "high" else "bold yellow"
            action_text.append(f"[{action['priority'].upper()}] ", style=priority_style)
            action_text.append(action["item"], style="bold")
            action_text.append(f"\n   → {action['action']}\n", style="dim")
        console.print(Panel(action_text, title="[bold yellow]Action Items[/bold yellow]", border_style="yellow"))

    # ── Footer ────────────────────────────────────────────────────────────
    footer = Text()
    footer.append(f"JSON saved → {saved_path}\n", style="dim")
    if md_path:
        footer.append(f"MD   saved → {md_path}\n", style="dim")
    footer.append(
        f"High-risk: {summary['high_risk_items']}  |  "
        f"Completed: {summary['completed']}/{summary['total']}",
        style="bold",
    )
    console.print(Panel(footer, border_style="dim"))


def render_plain(report: Dict, saved_path: Path, md_path: Optional[Path] = None):
    """Fallback plain-text renderer (no rich)."""
    sep = "=" * 60
    ts  = datetime.fromisoformat(report["review_date"]).strftime("%Y-%m-%d %H:%M:%S")
    print(f"\n{sep}")
    print(f"Regulatory Review Report: {report['project'].upper()}")
    print(f"{sep}")
    print(f"Date:             {ts}")
    print(f"Overall Status:   {report['overall_status']}")
    print(f"Completion Rate:  {report['completion_rate']}")
    summary = report["summary"]
    print(f"Completed:        {summary['completed']}/{summary['total']}")
    print(f"High Risk Items:  {summary['high_risk_items']}")

    print(f"\nItem Status:")
    for item in report["items"]:
        icons = {"completed": "[OK]", "in_progress": "[IN PROGRESS]", "blocked": "[BLOCKED]"}
        s_icon = icons.get(item["status"], f"[{item['status'].upper()}]")
        r_icon = {"low": "[LOW]", "medium": "[MED]", "high": "[HIGH]"}.get(item["risk_level"], "")
        print(f"  {s_icon} {item['item']} {r_icon}")

    if report["risks"]:
        print(f"\n[!] High Risk Items:")
        for risk in report["risks"]:
            print(f"  - {risk['item']}: {risk['notes']}")

    if report["action_items"]:
        print(f"\n[>] Action Items:")
        for action in report["action_items"]:
            print(f"  [{action['priority'].upper()}] {action['item']}")
            print(f"      -> {action['action']}")

    print(f"\n[>] JSON saved to: {saved_path}")
    if md_path:
        print(f"[>] MD   saved to: {md_path}")
    print(f"{sep}\n")


def render_report(report: Dict, saved_path: Path, md_path: Optional[Path] = None):
    """Dispatch to rich or plain renderer."""
    if RICH_AVAILABLE and console is not None:
        render_rich(report, saved_path, md_path)
    else:
        render_plain(report, saved_path, md_path)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def run_once(args: argparse.Namespace) -> int:
    project_path = Path.home() / "productivity" / "projects" / args.project
    data         = load_data(args.data)
    report       = generate_report(args.project, data)
    saved        = save_report(report, project_path, args.output)
    md_path      = export_markdown(report, project_path) if args.export_md else None
    render_report(report, saved, md_path)
    return 0 if report["overall_status"] == "ready_for_submission" else 1


def main() -> int:
    parser = argparse.ArgumentParser(description="Regulatory Document Review System")
    parser.add_argument("--project",   required=True, help="Project name (fenogal, gastrilex, …)")
    parser.add_argument("--data",      help="Path to project data JSON file")
    parser.add_argument("--output",    help="Custom output path for JSON report")
    parser.add_argument("--export-md", action="store_true", help="Also export a Markdown report")
    parser.add_argument("--watch",     type=int, metavar="SECONDS",
                        help="Continuous monitoring: re-run every N seconds (Ctrl-C to stop)")
    args = parser.parse_args()

    if args.watch:
        if RICH_AVAILABLE and console:
            console.print(
                f"[bold cyan]Watch mode[/bold cyan]: refreshing every {args.watch}s — Ctrl-C to stop\n"
            )
        else:
            print(f"Watch mode: refreshing every {args.watch}s — Ctrl-C to stop\n")
        try:
            while True:
                run_once(args)
                time.sleep(args.watch)
        except KeyboardInterrupt:
            if RICH_AVAILABLE and console:
                console.print("\n[dim]Watch stopped.[/dim]")
            else:
                print("\nWatch stopped.")
        return 0

    return run_once(args)


if __name__ == "__main__":
    sys.exit(main())
