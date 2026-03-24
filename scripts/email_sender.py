#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Email Automation for Regulatory Review Alerts
Sends deadline reminders and risk alerts via SMTP.

Usage:
    python email_sender.py --test                           # preview all pending alerts
    python email_sender.py --send deadline --project fenogal --days 56
    python email_sender.py --send high-risk --project fenogal
    python email_sender.py --send weekly
    python email_sender.py --schedule                       # run scheduled jobs
    python email_sender.py --config path/to/smtp_config.yaml
"""

import argparse
import io
import json
import smtplib
import sys
import time
from datetime import datetime, date, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# Force UTF-8 on Windows
if sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
if sys.stderr.encoding != "utf-8":
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

# ── Optional dependencies ──────────────────────────────────────────────────────

try:
    import yaml
    YAML_AVAILABLE = True
except ImportError:
    YAML_AVAILABLE = False

try:
    import schedule
    SCHEDULE_AVAILABLE = True
except ImportError:
    SCHEDULE_AVAILABLE = False

# ── Local imports ──────────────────────────────────────────────────────────────

SCRIPTS_DIR = Path(__file__).parent
sys.path.insert(0, str(SCRIPTS_DIR))

try:
    from email_alerts import EmailAlertGenerator
    ALERT_GENERATOR_AVAILABLE = True
except ImportError:
    ALERT_GENERATOR_AVAILABLE = False

# ── Default paths ──────────────────────────────────────────────────────────────

DEFAULT_CONFIG_PATH = Path(__file__).parent.parent / "config" / "smtp_config.yaml"
PROJECTS_ROOT = Path.home() / "productivity" / "projects"

DEADLINES: Dict[str, date] = {
    "fenogal":   date(2026, 5, 18),
    "gastrilex": date(2026, 6, 30),
}

# ── Config loader ──────────────────────────────────────────────────────────────

def load_smtp_config(config_path: Path = DEFAULT_CONFIG_PATH) -> Dict:
    """Load SMTP configuration from YAML file."""
    defaults = {
        "smtp": {
            "host": "smtp.gmail.com",
            "port": 587,
            "username": "",
            "password": "",
            "use_tls": True,
        },
        "sender": {
            "name": "Regulatory Review System",
            "email": "",
        },
        "recipients": {
            "default": [],
            "deadline_alerts": [],
            "high_risk_alerts": [],
            "weekly_summary": [],
        },
        "schedule": {
            "deadline_check_days": [30, 14, 7, 3, 1],
            "weekly_summary_day": "monday",
            "weekly_summary_time": "08:00",
        },
        "test_mode": True,
    }

    if not config_path.exists():
        print(f"[INFO] Config not found at {config_path} — using defaults (test mode ON)")
        return defaults

    if not YAML_AVAILABLE:
        print("[WARN] PyYAML not installed — using defaults. pip install pyyaml")
        return defaults

    try:
        with open(config_path, "r", encoding="utf-8") as f:
            user_cfg = yaml.safe_load(f) or {}
        # Deep merge user config over defaults
        for key, val in user_cfg.items():
            if isinstance(val, dict) and key in defaults:
                defaults[key].update(val)
            else:
                defaults[key] = val
        return defaults
    except Exception as e:
        print(f"[WARN] Could not load config: {e} — using defaults")
        return defaults


# ── Email builder ──────────────────────────────────────────────────────────────

def build_mime_message(
    subject: str,
    body: str,
    sender_name: str,
    sender_email: str,
    recipients: List[str],
) -> MIMEMultipart:
    """Build a MIME email message."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{sender_name} <{sender_email}>"
    msg["To"] = ", ".join(recipients)
    msg["Date"] = datetime.now().strftime("%a, %d %b %Y %H:%M:%S +0800")

    # Plain text part
    msg.attach(MIMEText(body, "plain", "utf-8"))

    # Simple HTML part (convert markdown-ish bold to HTML)
    html_body = body.replace("**", "<strong>", 1)
    while "**" in html_body:
        html_body = html_body.replace("**", "</strong>", 1).replace("**", "<strong>", 1)
    html_body = html_body.replace("\n", "<br>\n")
    html_part = f"""
<html><body style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px;">
  <div style="background: #1A3A5C; color: white; padding: 15px; border-radius: 4px 4px 0 0;">
    <h2 style="margin: 0;">Regulatory Review System</h2>
    <p style="margin: 4px 0 0; font-size: 12px;">UNIVERSAL INTEGRATED CORP.</p>
  </div>
  <div style="border: 1px solid #ddd; padding: 20px; border-radius: 0 0 4px 4px;">
    {html_body}
  </div>
</body></html>
"""
    msg.attach(MIMEText(html_part, "html", "utf-8"))
    return msg


# ── SMTP sender ────────────────────────────────────────────────────────────────

class EmailSender:
    """Sends regulatory alert emails via SMTP."""

    def __init__(self, config: Dict):
        self.config = config
        self.smtp_cfg = config.get("smtp", {})
        self.sender_cfg = config.get("sender", {})
        self.test_mode: bool = config.get("test_mode", True)
        self.alert_gen = EmailAlertGenerator() if ALERT_GENERATOR_AVAILABLE else None

    # ── Sending ─────────────────────────────────────────────────────────────

    def send(
        self,
        subject: str,
        body: str,
        recipients: Optional[List[str]] = None,
        recipient_group: str = "default",
    ) -> Tuple[bool, str]:
        """
        Send (or preview in test mode) an email.
        Returns (success: bool, message: str).
        """
        rcpts = recipients or self.config.get("recipients", {}).get(recipient_group, [])
        if not rcpts:
            return False, "No recipients configured."

        sender_email = self.sender_cfg.get("email", "")
        sender_name = self.sender_cfg.get("name", "Regulatory Review System")

        if self.test_mode:
            self._print_preview(subject, body, sender_email, sender_name, rcpts)
            return True, "TEST MODE — email previewed (not sent)"

        if not sender_email:
            return False, "sender.email not configured in smtp_config.yaml"

        msg = build_mime_message(subject, body, sender_name, sender_email, rcpts)

        try:
            host = self.smtp_cfg.get("host", "smtp.gmail.com")
            port = self.smtp_cfg.get("port", 587)
            username = self.smtp_cfg.get("username", sender_email)
            password = self.smtp_cfg.get("password", "")
            use_tls = self.smtp_cfg.get("use_tls", True)

            with smtplib.SMTP(host, port, timeout=30) as server:
                if use_tls:
                    server.starttls()
                if username and password:
                    server.login(username, password)
                server.sendmail(sender_email, rcpts, msg.as_string())

            return True, f"Sent to {', '.join(rcpts)}"
        except smtplib.SMTPAuthenticationError:
            return False, "SMTP authentication failed — check username/password in smtp_config.yaml"
        except smtplib.SMTPConnectError as e:
            return False, f"SMTP connection failed: {e}"
        except Exception as e:
            return False, f"Send error: {e}"

    def _print_preview(
        self, subject: str, body: str,
        sender_email: str, sender_name: str, recipients: List[str]
    ):
        print("\n" + "=" * 70)
        print("EMAIL PREVIEW (TEST MODE)")
        print("=" * 70)
        print(f"From   : {sender_name} <{sender_email or 'not-configured'}>")
        print(f"To     : {', '.join(recipients)}")
        print(f"Subject: {subject}")
        print("-" * 70)
        print(body)
        print("=" * 70 + "\n")

    # ── Alert type helpers ───────────────────────────────────────────────────

    def send_deadline_alert(
        self,
        project: str,
        days_remaining: int,
        details: str = "",
        recipients: Optional[List[str]] = None,
    ) -> Tuple[bool, str]:
        deadline = DEADLINES.get(project.lower())
        deadline_str = deadline.strftime("%Y-%m-%d") if deadline else "N/A"

        if self.alert_gen:
            email_content = self.alert_gen.generate_deadline_alert(
                project, days_remaining, deadline_str, details
            )
            lines = email_content.split("\n", 1)
            subject = lines[0].replace("Subject: ", "").strip()
            body = lines[1].strip() if len(lines) > 1 else email_content
        else:
            urgency = "URGENT" if days_remaining <= 7 else "Reminder"
            subject = f"[{urgency}] {project} — Deadline Alert ({days_remaining} days)"
            body = (
                f"Project: {project}\n"
                f"Deadline: {deadline_str}\n"
                f"Days Remaining: {days_remaining}\n\n"
                f"{details or 'Please review the project status.'}\n\n"
                f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}"
            )

        rcpt_group = "deadline_alerts" if not recipients else "default"
        return self.send(subject, body, recipients, rcpt_group)

    def send_high_risk_alert(
        self,
        project: str,
        high_risk_items: Optional[List[Dict]] = None,
        recipients: Optional[List[str]] = None,
    ) -> Tuple[bool, str]:
        items = high_risk_items or self._load_high_risk_items(project)

        if self.alert_gen and items:
            email_content = self.alert_gen.generate_high_risk_alert(project, items)
            lines = email_content.split("\n", 1)
            subject = lines[0].replace("Subject: ", "").strip()
            body = lines[1].strip() if len(lines) > 1 else email_content
        else:
            subject = f"[HIGH RISK] {project} — {len(items)} Critical Items"
            body = (
                f"Project: {project}\n"
                f"High-risk items detected: {len(items)}\n\n"
                + "\n".join(f"• {i.get('item', '?')} ({i.get('status', '?')})" for i in items)
                + f"\n\nGenerated: {datetime.now().strftime('%Y-%m-%d %H:%M')}"
            )

        rcpt_group = "high_risk_alerts" if not recipients else "default"
        return self.send(subject, body, recipients, rcpt_group)

    def send_weekly_summary(
        self,
        projects: Optional[List[Dict]] = None,
        recipients: Optional[List[str]] = None,
    ) -> Tuple[bool, str]:
        all_projects = projects or self._load_all_projects()

        if self.alert_gen and all_projects:
            email_content = self.alert_gen.generate_weekly_summary(all_projects)
            lines = email_content.split("\n", 1)
            subject = lines[0].replace("Subject: ", "").strip()
            body = lines[1].strip() if len(lines) > 1 else email_content
        else:
            subject = f"Weekly Regulatory Summary — {len(all_projects)} Projects"
            rows = [
                f"  {p['name']:<20} {p.get('completion', 0):.1f}%  {p.get('days_remaining', '?')}d  {p.get('status', '?')}"
                for p in all_projects
            ]
            body = (
                "Weekly Regulatory Projects Summary\n\n"
                + "  Project              Completion  Days  Status\n"
                + "  " + "-" * 55 + "\n"
                + "\n".join(rows)
                + f"\n\nGenerated: {datetime.now().strftime('%Y-%m-%d %H:%M')}"
            )

        rcpt_group = "weekly_summary" if not recipients else "default"
        return self.send(subject, body, recipients, rcpt_group)

    # ── Data loaders ─────────────────────────────────────────────────────────

    def _load_high_risk_items(self, project: str) -> List[Dict]:
        """Load high-risk items from latest review JSON."""
        review_dir = PROJECTS_ROOT / project / "review"
        files = list(review_dir.glob("*.json")) if review_dir.exists() else []
        if not files:
            return []
        latest = max(files, key=lambda p: p.stat().st_mtime)
        try:
            with open(latest, "r", encoding="utf-8") as f:
                data = json.load(f)
            return data.get("risks", [])
        except Exception:
            return []

    def _load_all_projects(self) -> List[Dict]:
        """Load summary for all projects."""
        projects = []
        today = date.today()
        for project_dir in sorted(PROJECTS_ROOT.iterdir()) if PROJECTS_ROOT.exists() else []:
            if not project_dir.is_dir():
                continue
            files = list(project_dir.glob("review/*.json"))
            if not files:
                continue
            latest = max(files, key=lambda p: p.stat().st_mtime)
            try:
                with open(latest, "r", encoding="utf-8") as f:
                    data = json.load(f)
                name = data.get("project", project_dir.name)
                dl = DEADLINES.get(name.lower())
                projects.append({
                    "name": name,
                    "completion": float(data.get("completion_rate", "0%").replace("%", "")),
                    "status": data.get("overall_status", "unknown"),
                    "high_risk": data.get("summary", {}).get("high_risk_items", 0),
                    "days_remaining": (dl - today).days if dl else None,
                })
            except Exception:
                continue
        return projects

    # ── Deadline scanner ─────────────────────────────────────────────────────

    def check_and_send_deadline_alerts(self) -> int:
        """Check all projects and send alerts for upcoming deadlines. Returns count sent."""
        alert_days = self.config.get("schedule", {}).get(
            "deadline_check_days", [30, 14, 7, 3, 1]
        )
        today = date.today()
        sent = 0

        for project, deadline in DEADLINES.items():
            days_left = (deadline - today).days
            if days_left in alert_days or days_left < 0:
                ok, msg = self.send_deadline_alert(project, days_left)
                status = "OK" if ok else "FAIL"
                print(f"  [{status}] {project} deadline alert: {msg}")
                if ok:
                    sent += 1

        return sent


# ── Scheduler ─────────────────────────────────────────────────────────────────

def start_scheduler(sender: EmailSender):
    """Set up and run scheduled email jobs."""
    if not SCHEDULE_AVAILABLE:
        print("schedule library not installed. pip install schedule")
        return

    cfg_schedule = sender.config.get("schedule", {})
    weekly_day = cfg_schedule.get("weekly_summary_day", "monday")
    weekly_time = cfg_schedule.get("weekly_summary_time", "08:00")

    # Daily deadline check at 07:30
    schedule.every().day.at("07:30").do(sender.check_and_send_deadline_alerts)

    # Weekly summary
    weekly_runner = getattr(schedule.every(), weekly_day, schedule.every().monday)
    weekly_runner.at(weekly_time).do(sender.send_weekly_summary)

    print(f"Scheduler started.")
    print(f"  Daily deadline check: 07:30")
    print(f"  Weekly summary: {weekly_day} at {weekly_time}")
    print("Press Ctrl+C to stop.")

    try:
        while True:
            schedule.run_pending()
            time.sleep(60)
    except KeyboardInterrupt:
        print("\nScheduler stopped.")


# ── CLI ────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Regulatory Review Email Automation",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python email_sender.py --test
  python email_sender.py --send deadline --project fenogal --days 56
  python email_sender.py --send high-risk --project gastrilex
  python email_sender.py --send weekly
  python email_sender.py --schedule
  python email_sender.py --check-deadlines
        """,
    )

    parser.add_argument(
        "--config",
        default=str(DEFAULT_CONFIG_PATH),
        help=f"Path to SMTP config YAML (default: {DEFAULT_CONFIG_PATH})",
    )
    parser.add_argument(
        "--test",
        action="store_true",
        help="Test mode: preview emails without sending",
    )
    parser.add_argument(
        "--send",
        choices=["deadline", "high-risk", "weekly"],
        help="Send a specific alert type",
    )
    parser.add_argument("--project", help="Project name for alert")
    parser.add_argument("--days", type=int, help="Days remaining (for deadline alert)")
    parser.add_argument(
        "--recipients",
        nargs="+",
        help="Override recipient list (space-separated emails)",
    )
    parser.add_argument(
        "--schedule",
        action="store_true",
        dest="run_scheduler",
        help="Start the email scheduler (runs continuously)",
    )
    parser.add_argument(
        "--check-deadlines",
        action="store_true",
        help="Check all project deadlines and send applicable alerts",
    )

    args = parser.parse_args()

    # Load config
    config = load_smtp_config(Path(args.config).expanduser())

    # CLI --test flag forces test mode
    if args.test:
        config["test_mode"] = True

    sender = EmailSender(config)

    mode_label = "[TEST MODE]" if config["test_mode"] else "[LIVE]"
    print(f"Email Sender {mode_label}")
    print(f"SMTP: {config['smtp']['host']}:{config['smtp']['port']}")
    print()

    # ── Dispatch ──────────────────────────────────────────────────────────

    if args.run_scheduler:
        start_scheduler(sender)
        return 0

    if args.check_deadlines:
        print("Checking project deadlines...")
        n = sender.check_and_send_deadline_alerts()
        print(f"Sent {n} deadline alert(s).")
        return 0

    if args.send:
        if args.send == "deadline":
            if not args.project:
                print("Error: --project required for deadline alert")
                return 1
            days = args.days
            if days is None:
                dl = DEADLINES.get(args.project.lower())
                days = (dl - date.today()).days if dl else 30
            ok, msg = sender.send_deadline_alert(args.project, days, recipients=args.recipients)
            print(f"{'OK' if ok else 'FAIL'}: {msg}")
            return 0 if ok else 1

        elif args.send == "high-risk":
            if not args.project:
                print("Error: --project required for high-risk alert")
                return 1
            ok, msg = sender.send_high_risk_alert(args.project, recipients=args.recipients)
            print(f"{'OK' if ok else 'FAIL'}: {msg}")
            return 0 if ok else 1

        elif args.send == "weekly":
            ok, msg = sender.send_weekly_summary(recipients=args.recipients)
            print(f"{'OK' if ok else 'FAIL'}: {msg}")
            return 0 if ok else 1

    # Default: preview one of each type
    print("No --send argument — previewing sample alerts in test mode...\n")
    config["test_mode"] = True
    sender.test_mode = True

    sender.send_deadline_alert("fenogal", 56)
    sender.send_high_risk_alert(
        "fenogal",
        [
            {"item": "非登不可上傳原料藥 GMP 文件", "status": "blocked", "risk_level": "high", "notes": "QR code 驗證失敗"},
        ],
    )
    sender.send_weekly_summary([
        {"name": "fenogal",   "completion": 42.9, "days_remaining": 56, "high_risk": 2, "status": "needs_attention"},
        {"name": "gastrilex", "completion": 20.0, "days_remaining": 99, "high_risk": 3, "status": "needs_attention"},
    ])

    return 0


if __name__ == "__main__":
    sys.exit(main())
