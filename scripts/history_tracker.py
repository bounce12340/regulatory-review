#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
History Tracker for Regulatory Review
Saves review results over time and generates completion-rate trend charts.
"""

import io
import json
import sys
import argparse
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

# Force UTF-8 on Windows
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
if sys.stderr.encoding != 'utf-8':
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

try:
    from rich.console import Console
    from rich.table import Table
    from rich.panel import Panel
    from rich.text import Text
    from rich import box
    RICH_AVAILABLE = True
except ImportError:
    RICH_AVAILABLE = False

try:
    import matplotlib
    matplotlib.use("Agg")          # headless — write to file
    import matplotlib.pyplot as plt
    import matplotlib.dates as mdates
    MATPLOTLIB_AVAILABLE = True
except ImportError:
    MATPLOTLIB_AVAILABLE = False

console = Console(highlight=False) if RICH_AVAILABLE else None

HISTORY_FILENAME = "review-history.json"


# ─── Storage helpers ──────────────────────────────────────────────────────────

def _history_path(project_path: Path) -> Path:
    return project_path / "review" / HISTORY_FILENAME


def load_history(project_path: Path) -> List[Dict]:
    """Load existing history records."""
    hp = _history_path(project_path)
    if not hp.exists():
        return []
    with open(hp, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_history(project_path: Path, records: List[Dict]):
    """Persist history records."""
    hp = _history_path(project_path)
    hp.parent.mkdir(parents=True, exist_ok=True)
    with open(hp, 'w', encoding='utf-8') as f:
        json.dump(records, f, ensure_ascii=False, indent=2)


def record_review(report: Dict, project_path: Path) -> Dict:
    """Append a new snapshot from a review report to history.  Returns the record."""
    records = load_history(project_path)

    record = {
        "timestamp":       report["review_date"],
        "project":         report["project"],
        "document_type":   report.get("document_type", ""),
        "completion_rate": float(report["completion_rate"].replace("%", "")),
        "overall_status":  report["overall_status"],
        "high_risk_items": report["summary"]["high_risk_items"],
        "completed":       report["summary"]["completed"],
        "total":           report["summary"]["total"],
        "item_statuses":   {i["category"]: i["status"] for i in report["items"]},
    }

    # Avoid exact duplicates (same timestamp)
    if records and records[-1]["timestamp"] == record["timestamp"]:
        records[-1] = record
    else:
        records.append(record)

    save_history(project_path, records)
    return record


# ─── ASCII trend chart ────────────────────────────────────────────────────────

def _ascii_bar(value: float, width: int = 30) -> str:
    filled = round(value / 100 * width)
    return "[" + "█" * filled + "░" * (width - filled) + f"] {value:.1f}%"


def print_ascii_trends(records: List[Dict]):
    """Print an ASCII trend chart to terminal."""
    if not records:
        print("No history records found.")
        return

    sep = "─" * 60
    print(f"\n{sep}")
    print("  Completion Rate Trend")
    print(sep)

    for rec in records[-20:]:          # show last 20 entries
        ts   = datetime.fromisoformat(rec["timestamp"]).strftime("%Y-%m-%d %H:%M")
        bar  = _ascii_bar(rec["completion_rate"])
        risk = f"  ⚠ {rec['high_risk_items']} high-risk" if rec["high_risk_items"] else ""
        print(f"  {ts}  {bar}{risk}")

    print(sep)

    # Trend direction
    if len(records) >= 2:
        delta = records[-1]["completion_rate"] - records[-2]["completion_rate"]
        if delta > 0:
            direction = f"↑ +{delta:.1f}% since last review"
        elif delta < 0:
            direction = f"↓ {delta:.1f}% since last review"
        else:
            direction = "→ No change since last review"
        print(f"  Trend: {direction}")

    print(f"{sep}\n")


def print_rich_trends(records: List[Dict]):
    """Print Rich-formatted trend table."""
    if not records:
        console.print("[yellow]No history records found.[/yellow]")
        return

    table = Table(
        title="Completion Rate History",
        box=box.ROUNDED,
        show_lines=True,
        border_style="blue",
    )
    table.add_column("Date/Time",       style="dim",       width=18)
    table.add_column("Completion",      justify="right",   width=12)
    table.add_column("Bar",             min_width=32)
    table.add_column("Status",          width=18)
    table.add_column("High Risk",       justify="center",  width=10)
    table.add_column("Δ",               justify="right",   width=7)

    prev_rate: Optional[float] = None
    for rec in records[-20:]:
        ts   = datetime.fromisoformat(rec["timestamp"]).strftime("%Y-%m-%d %H:%M")
        rate = rec["completion_rate"]

        # Bar
        filled = round(rate / 100 * 24)
        bar_color = "green" if rate >= 70 else "yellow" if rate >= 40 else "red"
        bar_text = Text()
        bar_text.append("█" * filled, style=f"bold {bar_color}")
        bar_text.append("░" * (24 - filled), style="dim")

        # Status color
        status_color = {
            "ready_for_submission": "bold green",
            "in_progress":          "bold yellow",
            "needs_attention":      "bold red",
        }.get(rec["overall_status"], "")

        # Delta
        if prev_rate is not None:
            delta = rate - prev_rate
            if delta > 0:
                delta_str = Text(f"+{delta:.1f}%", style="bold green")
            elif delta < 0:
                delta_str = Text(f"{delta:.1f}%", style="bold red")
            else:
                delta_str = Text("—", style="dim")
        else:
            delta_str = Text("—", style="dim")

        # Risk
        risk_count = rec["high_risk_items"]
        risk_text = Text(
            str(risk_count),
            style="bold red" if risk_count >= 2 else "bold yellow" if risk_count == 1 else "bold green"
        )

        table.add_row(
            ts,
            f"{rate:.1f}%",
            bar_text,
            Text(rec["overall_status"].replace("_", " ").title(), style=status_color),
            risk_text,
            delta_str,
        )
        prev_rate = rate

    console.print(table)

    # Trend summary
    if len(records) >= 2:
        delta = records[-1]["completion_rate"] - records[-2]["completion_rate"]
        if delta > 0:
            msg = f"[bold green]↑ Trending up +{delta:.1f}% since last review[/bold green]"
        elif delta < 0:
            msg = f"[bold red]↓ Trending down {delta:.1f}% since last review[/bold red]"
        else:
            msg = "[dim]→ No change since last review[/dim]"
        console.print(Panel(msg, border_style="dim"))


# ─── Matplotlib chart ─────────────────────────────────────────────────────────

def save_trend_chart(records: List[Dict], output_path: Optional[Path] = None) -> Optional[Path]:
    """Save a matplotlib trend chart as PNG. Returns the path or None if unavailable."""
    if not MATPLOTLIB_AVAILABLE:
        return None
    if not records:
        return None

    dates = [datetime.fromisoformat(r["timestamp"]) for r in records]
    rates = [r["completion_rate"] for r in records]
    risks = [r["high_risk_items"] for r in records]

    fig, ax1 = plt.subplots(figsize=(12, 5))
    fig.patch.set_facecolor("#FAFAFA")
    ax1.set_facecolor("#F5F8FF")

    # Completion rate line
    ax1.plot(dates, rates, marker="o", linewidth=2.5, color="#1A3A5C",
             markersize=6, label="Completion Rate (%)")
    ax1.fill_between(dates, rates, alpha=0.12, color="#1A3A5C")
    ax1.axhline(100, color="#1E8855", linewidth=1, linestyle="--", alpha=0.5, label="100% target")
    ax1.axhline(70,  color="#F57F17", linewidth=1, linestyle=":",  alpha=0.5, label="70% threshold")
    ax1.set_ylabel("Completion Rate (%)", color="#1A3A5C", fontsize=10)
    ax1.set_ylim(0, 105)
    ax1.tick_params(axis='y', labelcolor="#1A3A5C")
    ax1.xaxis.set_major_formatter(mdates.DateFormatter("%m/%d\n%H:%M"))
    plt.xticks(rotation=30, ha="right", fontsize=8)

    # High-risk items on secondary axis
    ax2 = ax1.twinx()
    ax2.bar(dates, risks, width=0.02, alpha=0.35, color="#C62828", label="High-Risk Items")
    ax2.set_ylabel("High-Risk Items", color="#C62828", fontsize=10)
    ax2.tick_params(axis='y', labelcolor="#C62828")
    ax2.set_ylim(0, max(risks) + 2 if risks else 5)

    # Legend & title
    project_name = records[-1].get("project", "Project").upper()
    lines1, labels1 = ax1.get_legend_handles_labels()
    lines2, labels2 = ax2.get_legend_handles_labels()
    ax1.legend(lines1 + lines2, labels1 + labels2, loc="lower right", fontsize=8)
    ax1.set_title(f"Regulatory Review Trend — {project_name}", fontsize=13, color="#1A3A5C", pad=12)

    plt.tight_layout()

    if output_path is None:
        project_dir = Path(records[-1].get("project", "project"))
        output_path = Path.home() / "productivity" / "projects" / project_dir.name / "review" / "trend-chart.png"

    output_path.parent.mkdir(parents=True, exist_ok=True)
    plt.savefig(str(output_path), dpi=150, bbox_inches="tight")
    plt.close(fig)
    return output_path


# ─── CLI ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Regulatory Review History Tracker")
    parser.add_argument("--project",     required=True, help="Project name")
    parser.add_argument("--record",      help="Path to a review JSON report to record")
    parser.add_argument("--show-trends", action="store_true", help="Display trend history")
    parser.add_argument("--save-chart",  action="store_true", help="Save matplotlib trend chart as PNG")
    parser.add_argument("--chart-out",   help="Output path for trend chart PNG")
    args = parser.parse_args()

    project_path = Path.home() / "productivity" / "projects" / args.project

    if args.record:
        with open(args.record, 'r', encoding='utf-8') as f:
            report = json.load(f)
        rec = record_review(report, project_path)
        msg = f"Recorded: {rec['project']} | {rec['completion_rate']:.1f}% | {rec['overall_status']}"
        if RICH_AVAILABLE and console:
            console.print(f"[bold green]✓[/bold green] {msg}")
        else:
            print(f"[OK] {msg}")

    if args.show_trends:
        records = load_history(project_path)
        if RICH_AVAILABLE and console:
            print_rich_trends(records)
        else:
            print_ascii_trends(records)

    if args.save_chart:
        records = load_history(project_path)
        chart_out = Path(args.chart_out) if args.chart_out else None
        path = save_trend_chart(records, chart_out)
        if path:
            if RICH_AVAILABLE and console:
                console.print(f"[green]Chart saved → {path}[/green]")
            else:
                print(f"Chart saved → {path}")
        else:
            print("matplotlib not available. Install with: pip install matplotlib")

    return 0


if __name__ == "__main__":
    sys.exit(main())
