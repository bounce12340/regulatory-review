#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Multi-Project Regulatory Dashboard
Overview of all regulatory projects with deadline tracking
"""

import io
import json
import sys
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
    from rich import box
    from rich.columns import Columns
    RICH_AVAILABLE = True
except ImportError:
    RICH_AVAILABLE = False
    print("Warning: Rich library not available. Install with: pip install rich")

console = Console(highlight=False) if RICH_AVAILABLE else None


class RegulatoryDashboard:
    """Multi-project regulatory dashboard."""
    
    def __init__(self, projects_root: str = "~/productivity/projects"):
        self.projects_root = Path(projects_root).expanduser()
        self.projects: List[Dict] = []
    
    def scan_projects(self) -> List[Dict]:
        """Scan all projects for regulatory review data."""
        projects = []
        
        if not self.projects_root.exists():
            print(f"Projects directory not found: {self.projects_root}")
            return projects
        
        for project_dir in self.projects_root.iterdir():
            if not project_dir.is_dir():
                continue
            
            # Check for review data
            review_files = list(project_dir.glob("review/*.json"))
            if review_files:
                # Get the most recent review
                latest_review = max(review_files, key=lambda p: p.stat().st_mtime)
                try:
                    with open(latest_review, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    
                    # Extract project info
                    project_info = {
                        'name': data.get('project', project_dir.name),
                        'type': data.get('document_type', 'unknown'),
                        'completion': self._parse_completion(data.get('completion_rate', '0%')),
                        'status': data.get('overall_status', 'unknown'),
                        'high_risk': data.get('summary', {}).get('high_risk_items', 0),
                        'last_review': data.get('review_date', ''),
                        'deadline': self._get_deadline(project_dir.name),
                        'days_remaining': 0
                    }
                    
                    # Calculate days remaining
                    if project_info['deadline']:
                        days = (project_info['deadline'] - date.today()).days
                        project_info['days_remaining'] = days
                    
                    projects.append(project_info)
                    
                except Exception as e:
                    print(f"Error reading {latest_review}: {e}")
                    continue
        
        # Sort by risk (high risk first, then by days remaining)
        projects.sort(key=lambda p: (
            -p['high_risk'],
            p['days_remaining'] if p['days_remaining'] > 0 else 9999
        ))
        
        self.projects = projects
        return projects
    
    def _parse_completion(self, completion_str: str) -> float:
        """Parse completion rate string to float."""
        try:
            return float(completion_str.replace('%', ''))
        except:
            return 0.0
    
    def _get_deadline(self, project_name: str) -> Optional[date]:
        """Get deadline for project (hardcoded for now, could be from config)."""
        deadlines = {
            'fenogal': date(2026, 5, 18),  # From deficiency notice
            'gastrilex': date(2026, 6, 30),  # Estimated
        }
        return deadlines.get(project_name.lower())
    
    def _get_deadline_color(self, days: int) -> str:
        """Get color code for deadline."""
        if days < 0:
            return "red"
        elif days < 7:
            return "red"
        elif days < 30:
            return "yellow"
        else:
            return "green"
    
    def _get_risk_color(self, high_risk: int) -> str:
        """Get color code for risk level."""
        if high_risk >= 2:
            return "red"
        elif high_risk == 1:
            return "yellow"
        else:
            return "green"
    
    def render_dashboard(self):
        """Render the dashboard with Rich."""
        if not RICH_AVAILABLE:
            self._render_plain()
            return
        
        # Header
        console.print(Panel.fit(
            "[bold blue]Regulatory Projects Dashboard[/bold blue]\n"
            f"[dim]Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}[/dim]",
            border_style="blue"
        ))
        
        if not self.projects:
            console.print("[yellow]No projects found with review data.[/yellow]")
            return
        
        # Summary statistics
        total_projects = len(self.projects)
        urgent_projects = sum(1 for p in self.projects if p['days_remaining'] < 7)
        high_risk_projects = sum(1 for p in self.projects if p['high_risk'] > 0)
        
        # Summary panel
        summary_text = (
            f"[bold]Total Projects:[/bold] {total_projects}\n"
            f"[bold red]Urgent (< 7 days):[/bold red] {urgent_projects}\n"
            f"[bold yellow]High Risk Items:[/bold yellow] {high_risk_projects}"
        )
        console.print(Panel(summary_text, title="Summary", border_style="green"))
        
        # Projects table
        table = Table(
            title="Project Status Overview",
            box=box.ROUNDED,
            show_header=True,
            header_style="bold"
        )
        
        table.add_column("#", justify="right", style="dim", width=3)
        table.add_column("Project", style="cyan", width=20)
        table.add_column("Type", width=15)
        table.add_column("Completion", justify="center", width=12)
        table.add_column("Deadline", justify="center", width=12)
        table.add_column("Days Left", justify="right", width=10)
        table.add_column("Risk", justify="center", width=8)
        table.add_column("Status", width=15)
        
        for i, project in enumerate(self.projects, 1):
            # Completion bar
            comp_color = "green" if project['completion'] >= 70 else "yellow" if project['completion'] >= 40 else "red"
            completion = f"[{comp_color}]{project['completion']:.1f}%[/{comp_color}]"
            
            # Deadline
            if project['deadline']:
                deadline_str = project['deadline'].strftime('%Y-%m-%d')
                days_color = self._get_deadline_color(project['days_remaining'])
                if project['days_remaining'] < 0:
                    days_str = f"[{days_color}]OVERDUE[/{days_color}]"
                else:
                    days_str = f"[{days_color}]{project['days_remaining']}[/{days_color}]"
            else:
                deadline_str = "N/A"
                days_str = "N/A"
            
            # Risk
            risk_color = self._get_risk_color(project['high_risk'])
            risk_str = f"[{risk_color}]{project['high_risk']}[/{risk_color}]"
            
            # Status
            status_color = {
                'ready_for_submission': 'green',
                'in_progress': 'yellow',
                'needs_attention': 'red'
            }.get(project['status'], 'white')
            status_str = f"[{status_color}]{project['status'].replace('_', ' ').title()}[/{status_color}]"
            
            table.add_row(
                str(i),
                project['name'],
                project['type'].replace('_', ' ').title(),
                completion,
                deadline_str,
                days_str,
                risk_str,
                status_str
            )
        
        console.print(table)
        
        # Alert section
        alerts = self._generate_alerts()
        if alerts:
            alert_text = "\n".join(f"• {alert}" for alert in alerts)
            console.print(Panel(
                alert_text,
                title="[bold red]⚠ Alerts[/bold red]",
                border_style="red"
            ))
        
        console.print()
    
    def _render_plain(self):
        """Render plain text version without Rich."""
        print("=" * 70)
        print("REGULATORY PROJECTS DASHBOARD")
        print(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
        print("=" * 70)
        
        if not self.projects:
            print("No projects found with review data.")
            return
        
        print(f"\nTotal Projects: {len(self.projects)}")
        
        print("\n{:<4} {:<20} {:<12} {:<12} {:<10} {:<8} {:<15}".format(
            "#", "Project", "Completion", "Deadline", "Days", "Risk", "Status"
        ))
        print("-" * 70)
        
        for i, project in enumerate(self.projects, 1):
            deadline = project['deadline'].strftime('%Y-%m-%d') if project['deadline'] else 'N/A'
            days = str(project['days_remaining']) if project['days_remaining'] else 'N/A'
            
            print("{:<4} {:<20} {:<12} {:<12} {:<10} {:<8} {:<15}".format(
                i,
                project['name'][:20],
                f"{project['completion']:.1f}%",
                deadline,
                days,
                project['high_risk'],
                project['status']
            ))
        
        alerts = self._generate_alerts()
        if alerts:
            print("\n[!] ALERTS:")
            for alert in alerts:
                print(f"  - {alert}")
        
        print("=" * 70)
    
    def _generate_alerts(self) -> List[str]:
        """Generate alerts for urgent items."""
        alerts = []
        
        for project in self.projects:
            if project['days_remaining'] < 0:
                alerts.append(f"[CRITICAL] {project['name']}: OVERDUE by {abs(project['days_remaining'])} days")
            elif project['days_remaining'] <= 7:
                alerts.append(f"[URGENT] {project['name']}: {project['days_remaining']} days remaining")
            elif project['high_risk'] >= 2:
                alerts.append(f"[HIGH RISK] {project['name']}: {project['high_risk']} high-risk items")
        
        return alerts
    
    def export_summary(self, output_path: Optional[str] = None):
        """Export dashboard summary to JSON."""
        if output_path is None:
            timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
            output_path = self.projects_root / f"dashboard-summary-{timestamp}.json"
        
        output_path = Path(output_path)
        
        summary = {
            'generated_at': datetime.now().isoformat(),
            'total_projects': len(self.projects),
            'projects': self.projects,
            'alerts': self._generate_alerts()
        }
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(summary, f, ensure_ascii=False, indent=2, default=str)
        
        return output_path


def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Regulatory Projects Dashboard")
    parser.add_argument("--projects-root", default="~/productivity/projects",
                       help="Root directory containing projects")
    parser.add_argument("--export", help="Export summary to JSON file")
    
    args = parser.parse_args()
    
    # Create dashboard
    dashboard = RegulatoryDashboard(args.projects_root)
    
    # Scan projects
    dashboard.scan_projects()
    
    # Render
    dashboard.render_dashboard()
    
    # Export if requested
    if args.export:
        output_path = dashboard.export_summary(args.export)
        if RICH_AVAILABLE:
            console.print(f"[green]Summary exported to: {output_path}[/green]")
        else:
            print(f"Summary exported to: {output_path}")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
