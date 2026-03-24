#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Multi-Project Comparison for Regulatory Reviews
多專案法規審查比較分析

Compares completion rates, timelines, risk levels, and resource needs
across multiple regulatory projects.

Usage:
  python project_comparison.py compare fenogal gastrilex
  python project_comparison.py compare fenogal gastrilex --exec-summary
  python project_comparison.py priority --projects fenogal gastrilex mydevice
  python project_comparison.py bottlenecks --projects fenogal gastrilex
"""

import io
import sys
import json
import argparse
from pathlib import Path
from datetime import datetime, date
from typing import Dict, List, Optional, Tuple

# Force UTF-8 output on Windows
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
if sys.stderr.encoding != 'utf-8':
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

try:
    from rich.console import Console
    from rich.table import Table
    from rich.panel import Panel
    from rich.text import Text
    from rich.columns import Columns
    from rich.progress import BarColumn, Progress, TextColumn
    from rich import box
    RICH_AVAILABLE = True
except ImportError:
    RICH_AVAILABLE = False

console = Console(highlight=False) if RICH_AVAILABLE else None

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

PROJECTS_BASE = Path.home() / "productivity" / "projects"
COSTS_BASE    = Path.home() / "productivity" / "costs"

# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------

def find_latest_review(project: str) -> Optional[Dict]:
    """Find and load the most recent review JSON for a project."""
    review_dir = PROJECTS_BASE / project / "review"
    if not review_dir.exists():
        return None
    jsons = sorted(review_dir.glob("auto-review-*.json"), reverse=True)
    if not jsons:
        return None
    with open(jsons[0], 'r', encoding='utf-8') as f:
        data = json.load(f)
    data["_source_file"] = str(jsons[0])
    return data


def find_latest_cost(project: str) -> Optional[Dict]:
    """Load cost summary for a project if available."""
    cost_file = COSTS_BASE / project / "costs.json"
    if cost_file.exists():
        with open(cost_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    return None


def load_project_data(project: str) -> Optional[Dict]:
    """Load all available data for a project."""
    review = find_latest_review(project)
    if review is None:
        return None
    costs = find_latest_cost(project)
    return {
        "project":       project,
        "review":        review,
        "costs":         costs,
        "has_review":    True,
        "has_costs":     costs is not None,
    }


# ---------------------------------------------------------------------------
# Analysis helpers
# ---------------------------------------------------------------------------

def parse_completion_rate(rate_str: str) -> float:
    """Parse '71.4%' → 71.4"""
    try:
        return float(rate_str.replace("%", "").strip())
    except (ValueError, AttributeError):
        return 0.0


def count_by_status(items: List[Dict]) -> Dict[str, int]:
    counts: Dict[str, int] = {}
    for item in items:
        s = item.get("status", "unknown")
        counts[s] = counts.get(s, 0) + 1
    return counts


def risk_score(review: Dict) -> int:
    """Numeric risk score: higher = more at risk. (0-100)"""
    items    = review.get("items", [])
    if not items:
        return 0
    weights  = {"high": 3, "medium": 1, "low": 0}
    total    = sum(weights.get(i.get("risk_level", "low"), 0) for i in items)
    max_score = len(items) * 3
    return int((total / max_score * 100)) if max_score else 0


def infer_deadline_days(review: Dict) -> Optional[int]:
    """Try to infer days until deadline from review data."""
    # Look for deadline fields in notes or metadata
    for item in review.get("items", []):
        notes = item.get("notes", "")
        if "deadline" in notes.lower() or "due" in notes.lower():
            return None   # found mention but can't parse
    return None


def categorize_overall_status(review: Dict) -> Tuple[str, str]:
    """Return (status_text, style)."""
    status = review.get("overall_status", "unknown")
    mapping = {
        "ready_for_submission": ("Ready",        "bold green"),
        "in_progress":          ("In Progress",  "bold yellow"),
        "needs_attention":      ("Needs Attn",   "bold red"),
    }
    return mapping.get(status, (status, "dim"))


def identify_bottlenecks(review: Dict) -> List[Dict]:
    """Find items that are blocked or high-risk."""
    bottlenecks = []
    for item in review.get("items", []):
        if item.get("status") == "blocked":
            bottlenecks.append({
                "type":     "blocked",
                "label":    item["item"],
                "category": item.get("category", ""),
                "notes":    item.get("notes", ""),
                "severity": "critical",
            })
        elif item.get("risk_level") == "high" and item.get("status") != "completed":
            bottlenecks.append({
                "type":     "high_risk",
                "label":    item["item"],
                "category": item.get("category", ""),
                "notes":    item.get("notes", ""),
                "severity": "high",
            })
    return bottlenecks


def priority_score(review: Dict, weight_completion: float = 0.4, weight_risk: float = 0.6) -> float:
    """
    Priority score (0–100): higher means needs more attention NOW.
    Combines inverse completion and risk score.
    """
    completion = parse_completion_rate(review.get("completion_rate", "0%"))
    r_score    = risk_score(review)
    return (1 - completion / 100) * 100 * weight_completion + r_score * weight_risk


def resource_recommendation(review: Dict) -> List[str]:
    """Suggest resources needed based on blocked/pending items."""
    recs = []
    for item in review.get("items", []):
        if item.get("status") == "blocked":
            recs.append(f"Unblock: {item['item']} — {item.get('notes','')[:60]}")
        elif item.get("status") == "pending":
            recs.append(f"Assign owner for: {item['item']}")
    return recs[:5]   # top 5


# ---------------------------------------------------------------------------
# Side-by-side comparison
# ---------------------------------------------------------------------------

def compare_projects(projects_data: List[Dict]) -> Dict:
    """Build comparison matrix."""
    rows = []
    for pd_entry in projects_data:
        review = pd_entry["review"]
        compl  = parse_completion_rate(review.get("completion_rate", "0%"))
        r_sc   = risk_score(review)
        p_sc   = priority_score(review)
        status_txt, _ = categorize_overall_status(review)
        status_items  = count_by_status(review.get("items", []))

        rows.append({
            "project":       pd_entry["project"],
            "completion":    compl,
            "overall_status": review.get("overall_status", "unknown"),
            "status_text":   status_txt,
            "risk_score":    r_sc,
            "priority_score": p_sc,
            "total_items":   len(review.get("items", [])),
            "completed":     status_items.get("completed", 0),
            "blocked":       status_items.get("blocked", 0),
            "pending":       status_items.get("pending", 0),
            "in_progress":   status_items.get("in_progress", 0),
            "under_review":  status_items.get("under_review", 0),
            "high_risk_count": review["summary"].get("high_risk_items", 0),
            "action_items":  len(review.get("action_items", [])),
            "bottlenecks":   identify_bottlenecks(review),
            "recommendations": resource_recommendation(review),
            "doc_type":      review.get("document_type", ""),
            "review_date":   review.get("review_date", ""),
        })

    # Sort by priority (highest first = needs most attention)
    rows.sort(key=lambda r: r["priority_score"], reverse=True)

    return {
        "generated":   datetime.now().isoformat(),
        "project_count": len(rows),
        "projects":    rows,
    }


# ---------------------------------------------------------------------------
# Rich rendering
# ---------------------------------------------------------------------------

OVERALL_STYLE = {
    "ready_for_submission": "bold green",
    "in_progress":          "bold yellow",
    "needs_attention":      "bold red",
}

STATUS_COLORS = {
    "completed":    "green",
    "in_progress":  "yellow",
    "under_review": "cyan",
    "blocked":      "red",
    "pending":      "dim",
}


def _bar(value: float, width: int = 20) -> Text:
    """Draw an ASCII progress bar."""
    filled = int(value / 100 * width)
    bar    = "█" * filled + "░" * (width - filled)
    style  = "bold green" if value >= 80 else "bold yellow" if value >= 50 else "bold red"
    return Text(f"{bar} {value:.0f}%", style=style)


def render_comparison_table(comparison: Dict):
    if not RICH_AVAILABLE or not console:
        print("\nProject Comparison:")
        print(f"{'Project':<20} {'Completion':>12} {'Risk':>6} {'Priority':>10} {'Blocked':>8} {'Actions':>8}")
        print("-" * 70)
        for r in comparison["projects"]:
            print(f"{r['project']:<20} {r['completion']:>10.1f}% {r['risk_score']:>6} {r['priority_score']:>10.1f} {r['blocked']:>8} {r['action_items']:>8}")
        return

    table = Table(
        title=f"[bold]Multi-Project Comparison[/bold] — {datetime.now().strftime('%Y-%m-%d')}",
        box=box.ROUNDED,
        show_lines=True,
        border_style="blue",
    )
    table.add_column("Rank",      style="dim",       width=5,  justify="center")
    table.add_column("Project",   style="bold cyan",  min_width=14)
    table.add_column("Type",      style="dim",        min_width=12)
    table.add_column("Completion",                    min_width=28)
    table.add_column("Status",                        min_width=12)
    table.add_column("Risk\nScore", justify="center", min_width=8)
    table.add_column("Blocked",   justify="center",   min_width=8)
    table.add_column("Actions",   justify="center",   min_width=8)
    table.add_column("Priority",  justify="center",   min_width=10)

    rank_icons = ["🥇", "🥈", "🥉"]
    for idx, row in enumerate(comparison["projects"]):
        rank_icon   = rank_icons[idx] if idx < 3 else str(idx + 1)
        status_sty  = OVERALL_STYLE.get(row["overall_status"], "dim")
        risk_sty    = "bold red" if row["risk_score"] >= 60 else "bold yellow" if row["risk_score"] >= 30 else "green"
        prio_sty    = "bold red" if row["priority_score"] >= 60 else "bold yellow" if row["priority_score"] >= 30 else "green"

        doc_short = {
            "drug_registration_extension": "Drug Ext.",
            "food_registration":           "Food Reg.",
            "medical_device_registration": "Med Device",
        }.get(row["doc_type"], row["doc_type"][:10])

        table.add_row(
            rank_icon,
            row["project"],
            doc_short,
            _bar(row["completion"]),
            Text(row["status_text"], style=status_sty),
            Text(str(row["risk_score"]), style=risk_sty),
            Text(str(row["blocked"]),   style="bold red" if row["blocked"] else "green"),
            Text(str(row["action_items"]), style="bold yellow" if row["action_items"] else "green"),
            Text(f"{row['priority_score']:.0f}", style=prio_sty),
        )

    console.print(table)
    console.print("[dim]Priority = inverse completion × 0.4 + risk score × 0.6  (higher = needs more attention)[/dim]")


def render_bottlenecks(comparison: Dict):
    if not RICH_AVAILABLE or not console:
        for row in comparison["projects"]:
            bns = row.get("bottlenecks", [])
            if bns:
                print(f"\nBottlenecks — {row['project']}:")
                for b in bns:
                    print(f"  [{b['severity'].upper()}] {b['label']}: {b['notes'][:60]}")
        return

    any_bottleneck = any(row.get("bottlenecks") for row in comparison["projects"])
    if not any_bottleneck:
        console.print(Panel("[bold green]No bottlenecks found across all projects![/bold green]", border_style="green"))
        return

    for row in comparison["projects"]:
        bns = row.get("bottlenecks", [])
        if not bns:
            continue
        text = Text()
        for b in bns:
            sty  = "bold red" if b["severity"] == "critical" else "bold yellow"
            icon = "🚫" if b["type"] == "blocked" else "⚠"
            text.append(f"{icon} [{b['severity'].upper()}] ", style=sty)
            text.append(b["label"], style="bold")
            if b["notes"]:
                text.append(f"\n   {b['notes'][:80]}", style="dim")
            text.append("\n")
        console.print(Panel(text, title=f"[bold red]Bottlenecks — {row['project'].upper()}[/bold red]", border_style="red"))


def render_executive_summary(comparison: Dict):
    projects = comparison["projects"]
    ready    = [r for r in projects if r["overall_status"] == "ready_for_submission"]
    at_risk  = [r for r in projects if r["overall_status"] == "needs_attention"]
    blocked_projects = [r for r in projects if r["blocked"] > 0]

    avg_completion = sum(r["completion"] for r in projects) / len(projects) if projects else 0

    if not RICH_AVAILABLE or not console:
        print("\n=== EXECUTIVE SUMMARY ===")
        print(f"Projects reviewed: {len(projects)}")
        print(f"Average completion: {avg_completion:.1f}%")
        print(f"Ready for submission: {len(ready)}")
        print(f"Needs attention: {len(at_risk)}")
        print(f"Has blocked items: {len(blocked_projects)}")
        if blocked_projects:
            print("\nTop priority (needs attention first):")
            for r in projects[:3]:
                print(f"  {r['project']}: completion={r['completion']:.0f}%, risk={r['risk_score']}")
        return

    text = Text()
    text.append("Projects Reviewed:       ", style="bold")
    text.append(f"{len(projects)}\n")
    text.append("Average Completion:      ", style="bold")
    text.append(f"{avg_completion:.1f}%\n",
                style="bold green" if avg_completion >= 70 else "bold yellow" if avg_completion >= 40 else "bold red")
    text.append("Ready for Submission:    ", style="bold")
    text.append(f"{len(ready)}\n", style="bold green" if ready else "dim")
    text.append("Needs Attention:         ", style="bold")
    text.append(f"{len(at_risk)}\n", style="bold red" if at_risk else "dim")
    text.append("Projects with Blockers:  ", style="bold")
    text.append(f"{len(blocked_projects)}\n", style="bold red" if blocked_projects else "dim")

    if projects:
        text.append("\n[bold]Priority Order (high → low):[/bold]\n")
        for idx, r in enumerate(projects[:5], 1):
            p_sty = "bold red" if idx == 1 else "bold yellow" if idx == 2 else "dim"
            text.append(f"  {idx}. ", style="dim")
            text.append(r["project"].upper(), style=p_sty)
            text.append(f" — completion: {r['completion']:.0f}%, risk: {r['risk_score']}\n", style="dim")

    if blocked_projects:
        text.append("\n[bold red]Immediate Action Required:[/bold red]\n")
        for r in blocked_projects:
            text.append(f"  🚫 {r['project']}: {r['blocked']} blocked item(s)\n", style="red")

    console.print(Panel(text, title="[bold]Executive Summary[/bold]", border_style="cyan"))


def render_resource_recommendations(comparison: Dict):
    if not RICH_AVAILABLE or not console:
        for row in comparison["projects"]:
            recs = row.get("recommendations", [])
            if recs:
                print(f"\nRecommendations — {row['project']}:")
                for r in recs:
                    print(f"  → {r}")
        return

    text = Text()
    for row in comparison["projects"]:
        recs = row.get("recommendations", [])
        if not recs:
            continue
        text.append(f"\n[bold cyan]{row['project'].upper()}[/bold cyan]\n")
        for rec in recs:
            text.append(f"  → {rec}\n", style="dim")

    if text.plain.strip():
        console.print(Panel(text, title="[bold yellow]Resource Recommendations[/bold yellow]", border_style="yellow"))
    else:
        console.print(Panel("[bold green]No resource issues identified.[/bold green]", border_style="green"))


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def cmd_compare(args: argparse.Namespace):
    projects_input = args.projects
    loaded = []
    for p in projects_input:
        data = load_project_data(p)
        if data is None:
            if RICH_AVAILABLE and console:
                console.print(f"[bold yellow]⚠ No review data found for:[/bold yellow] {p}")
            else:
                print(f"Warning: No review data for {p}")
            continue
        loaded.append(data)

    if not loaded:
        if RICH_AVAILABLE and console:
            console.print("[bold red]No projects could be loaded.[/bold red]")
        else:
            print("No projects could be loaded.")
        return 1

    comparison = compare_projects(loaded)
    render_comparison_table(comparison)

    if args.bottlenecks or getattr(args, "exec_summary", False):
        render_bottlenecks(comparison)

    if getattr(args, "exec_summary", False):
        render_executive_summary(comparison)
        render_resource_recommendations(comparison)

    return 0


def cmd_priority(args: argparse.Namespace):
    loaded = []
    for p in args.projects:
        data = load_project_data(p)
        if data:
            loaded.append(data)

    if not loaded:
        print("No projects loaded.")
        return 1

    comparison = compare_projects(loaded)
    render_executive_summary(comparison)
    render_resource_recommendations(comparison)
    return 0


def cmd_bottlenecks(args: argparse.Namespace):
    loaded = []
    for p in args.projects:
        data = load_project_data(p)
        if data:
            loaded.append(data)

    if not loaded:
        print("No projects loaded.")
        return 1

    comparison = compare_projects(loaded)
    render_bottlenecks(comparison)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Multi-Project Comparison — Regulatory Reviews / 多專案法規審查比較"
    )
    sub = parser.add_subparsers(dest="command", required=True)

    # ── compare ──────────────────────────────────────────────────────────
    p_cmp = sub.add_parser("compare", help="Compare projects side-by-side / 並排比較專案")
    p_cmp.add_argument("projects", nargs="+", help="Project names to compare")
    p_cmp.add_argument("--bottlenecks",  action="store_true", help="Show bottleneck analysis")
    p_cmp.add_argument("--exec-summary", action="store_true", dest="exec_summary",
                       help="Include executive summary")

    # ── priority ─────────────────────────────────────────────────────────
    p_pri = sub.add_parser("priority", help="Priority ranking with exec summary / 優先順序排名")
    p_pri.add_argument("--projects", nargs="+", required=True)

    # ── bottlenecks ───────────────────────────────────────────────────────
    p_bot = sub.add_parser("bottlenecks", help="Identify bottlenecks across projects / 瓶頸分析")
    p_bot.add_argument("--projects", nargs="+", required=True)

    args = parser.parse_args()
    dispatch = {
        "compare":     cmd_compare,
        "priority":    cmd_priority,
        "bottlenecks": cmd_bottlenecks,
    }
    return dispatch[args.command](args)


if __name__ == "__main__":
    sys.exit(main())
