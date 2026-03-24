#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Email Alert System for Regulatory Projects
Generates alert emails for deadline and risk notifications
"""

import io
import json
import sys
from pathlib import Path
from datetime import datetime, date
from typing import Dict, List, Optional

# Force UTF-8 output on Windows
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
if sys.stderr.encoding != 'utf-8':
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')


class EmailAlertGenerator:
    """Generate email alerts for regulatory projects."""
    
    def __init__(self, signature: Optional[str] = None):
        self.signature = signature or self._default_signature()
    
    def _default_signature(self) -> str:
        """Default email signature."""
        return """\
Best regards,

Josh Tsai 蔡忠栩
RA Manager
BD & Scientific Affairs
UNIVERSAL INTEGRATED CORP.
5FL. NO. 129 SEC. 1 FUXING S. ROAD,
TAIPEI 106660, TAIWAN, R.O.C.
TEL : +886-2-2752-3235 #219
E-mail : josh@uicgroup.com.tw
"""
    
    def generate_deadline_alert(self, project: str, days_remaining: int, 
                               deadline: str, details: str = "") -> str:
        """Generate deadline approaching alert email."""
        urgency = "URGENT" if days_remaining <= 7 else "Reminder"
        
        subject = f"[{urgency}] {project} - Registration Extension Deadline Alert ({days_remaining} days remaining)"
        
        body = f"""Dear Team,

This is an automated alert regarding the registration extension project:

**Project:** {project}
**Deadline:** {deadline}
**Days Remaining:** {days_remaining}

**Status Summary:**
{details if details else "Please check the current project status in the regulatory review system."}

**Required Actions:**
• Please prioritize completing any pending items
• Ensure all documents are ready for submission
• Contact relevant parties if external dependencies are blocking progress

{self.signature}

---
This is an automated message from the Regulatory Review System.
Generated at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
"""
        
        return f"Subject: {subject}\n\n{body}"
    
    def generate_high_risk_alert(self, project: str, high_risk_items: List[Dict]) -> str:
        """Generate high-risk items alert email."""
        subject = f"[HIGH RISK] {project} - {len(high_risk_items)} Critical Items Require Attention"
        
        items_list = "\n".join([
            f"• {item['item']}\n  Risk Level: {item['risk_level'].upper()}\n  Status: {item['status']}\n  Notes: {item.get('notes', 'N/A')}"
            for item in high_risk_items
        ])
        
        body = f"""Dear Team,

This alert is to notify you of high-risk items requiring immediate attention:

**Project:** {project}
**Alert Type:** High Risk Items
**Number of Items:** {len(high_risk_items)}

**High Risk Items:**
{items_list}

**Recommended Actions:**
• Review each high-risk item immediately
• Assign responsible persons for resolution
• Set up follow-up meetings if needed
• Update project timeline if necessary

{self.signature}

---
This is an automated message from the Regulatory Review System.
Generated at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
"""
        
        return f"Subject: {subject}\n\n{body}"
    
    def generate_weekly_summary(self, projects: List[Dict]) -> str:
        """Generate weekly status summary email."""
        subject = f"Weekly Regulatory Projects Summary - {len(projects)} Active Projects"
        
        # Build project table
        project_rows = []
        for p in projects:
            status = p.get('status', 'unknown')
            completion = p.get('completion', 0)
            days = p.get('days_remaining', 'N/A')
            risk = p.get('high_risk', 0)
            
            urgency_marker = "🔴" if days != 'N/A' and isinstance(days, int) and days <= 7 else "🟡" if risk > 0 else "🟢"
            project_rows.append(
                f"| {urgency_marker} {p['name']} | {completion:.1f}% | {days} days | {risk} | {status} |"
            )
        
        projects_table = "\n".join(project_rows)
        
        # Count urgent projects
        urgent = sum(1 for p in projects if p.get('days_remaining', 999) <= 7)
        
        body = f"""Dear Team,

Here is your weekly regulatory projects summary:

**Summary Statistics:**
• Total Active Projects: {len(projects)}
• Projects with Urgent Deadlines: {urgent}
• Average Completion: {sum(p.get('completion', 0) for p in projects) / len(projects):.1f}%

**Project Status Overview:**

| Project | Completion | Days Left | High Risk | Status |
|---------|------------|-----------|-----------|--------|
{projects_table}

**Action Required:**
Please review projects marked with 🔴 (urgent) or 🟡 (high risk).

{self.signature}

---
This is an automated weekly summary from the Regulatory Review System.
Generated at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
"""
        
        return f"Subject: {subject}\n\n{body}"
    
    def generate_item_specific_alert(self, project: str, item: str, 
                                   issue: str, recommendation: str) -> str:
        """Generate alert for specific item issue."""
        subject = f"[ACTION REQUIRED] {project} - {item}"
        
        body = f"""Dear Team,

An issue has been identified that requires your attention:

**Project:** {project}
**Item:** {item}
**Issue:** {issue}

**Recommendation:**
{recommendation}

**Next Steps:**
• Please review the issue details
• Coordinate with relevant stakeholders
• Update the project status once resolved

{self.signature}

---
This is an automated message from the Regulatory Review System.
Generated at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
"""
        
        return f"Subject: {subject}\n\n{body}"
    
    def save_email(self, email_content: str, project: str, alert_type: str,
                   output_dir: Optional[str] = None) -> Path:
        """Save email to file."""
        if output_dir is None:
            output_dir = Path.home() / "productivity" / "projects" / project / "alerts"
        else:
            output_dir = Path(output_dir)
        
        output_dir.mkdir(parents=True, exist_ok=True)
        
        timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
        filename = f"{alert_type}-{project}-{timestamp}.eml"
        
        output_path = output_dir / filename
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(email_content)
        
        return output_path


def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Email Alert Generator")
    parser.add_argument("--type", choices=["deadline", "high-risk", "weekly", "item"],
                       required=True, help="Type of alert to generate")
    parser.add_argument("--project", help="Project name")
    parser.add_argument("--days", type=int, help="Days remaining (for deadline alert)")
    parser.add_argument("--item", help="Item name (for item-specific alert)")
    parser.add_argument("--issue", help="Issue description (for item-specific alert)")
    parser.add_argument("--output", help="Output directory for email file")
    parser.add_argument("--print-only", action="store_true", 
                       help="Print to console only, don't save file")
    
    args = parser.parse_args()
    
    generator = EmailAlertGenerator()
    
    if args.type == "deadline":
        if not args.project or args.days is None:
            print("Error: --project and --days required for deadline alert")
            return 1
        
        deadline = (date.today() + __import__('datetime').timedelta(days=args.days)).strftime('%Y-%m-%d')
        email = generator.generate_deadline_alert(args.project, args.days, deadline)
    
    elif args.type == "high-risk":
        if not args.project:
            print("Error: --project required for high-risk alert")
            return 1
        
        # Example high-risk items
        sample_items = [
            {
                'item': 'API GMP Verification',
                'risk_level': 'high',
                'status': 'blocked',
                'notes': 'QR code verification failed'
            },
            {
                'item': 'License Renewal Application',
                'risk_level': 'high',
                'status': 'in_progress',
                'notes': 'Expected completion today'
            }
        ]
        email = generator.generate_high_risk_alert(args.project, sample_items)
    
    elif args.type == "weekly":
        # Example projects
        sample_projects = [
            {'name': 'fenogal', 'completion': 42.9, 'days_remaining': 56, 'high_risk': 2, 'status': 'needs_attention'},
            {'name': 'gastrilex', 'completion': 25.0, 'days_remaining': 90, 'high_risk': 1, 'status': 'in_progress'}
        ]
        email = generator.generate_weekly_summary(sample_projects)
    
    elif args.type == "item":
        if not args.project or not args.item or not args.issue:
            print("Error: --project, --item, and --issue required for item alert")
            return 1
        
        recommendation = "Please coordinate with vendor to resolve the issue."
        email = generator.generate_item_specific_alert(
            args.project, args.item, args.issue, recommendation
        )
    
    else:
        print(f"Unknown alert type: {args.type}")
        return 1
    
    # Output
    if args.print_only:
        print("=" * 70)
        print("GENERATED EMAIL")
        print("=" * 70)
        print(email)
        print("=" * 70)
    else:
        if args.project:
            output_path = generator.save_email(email, args.project, args.type, args.output)
            print(f"Email saved to: {output_path}")
        else:
            print("Error: --project required when saving email (or use --print-only)")
            return 1
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
