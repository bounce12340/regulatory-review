#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Migration script: JSON files → SQLite database

Usage:
    python migrate.py                     # dry-run (preview only)
    python migrate.py --execute           # apply migration
    python migrate.py --seed-demo         # seed demo data (no JSON files needed)
    python migrate.py --execute --seed-demo

What it does:
  1. Initialises the SQLite DB (creates tables if missing).
  2. Creates a default Company + admin User (if not already present).
  3. Scans ~/productivity/projects/*/review/*.json for existing project data.
  4. For each project JSON found, creates a Project row + ChecklistItem rows.
  5. Seed mode: inserts demo projects (fenogal, gastrilex) with sample data.

Backwards compatibility:
  - Existing JSON files are NOT deleted or modified.
  - The dashboard can still fall back to JSON files if DB is empty.
"""

import json
import sys
import argparse
from pathlib import Path
from datetime import datetime, date

# ── Path setup ────────────────────────────────────────────────────────────────
ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT))

from database.db import init_db, get_db
from database.models import Company, User, Project, ChecklistItem
from auth.register import _hash_password, _slugify


# ── Defaults ──────────────────────────────────────────────────────────────────

DEFAULT_COMPANY_NAME  = "My Company"
DEFAULT_ADMIN_EMAIL   = "admin@example.com"
DEFAULT_ADMIN_PASSWORD = "changeme123"  # user should change this after first login
DEFAULT_ADMIN_NAME     = "System Admin"

PROJECTS_ROOT = Path.home() / "productivity" / "projects"

DEMO_DEADLINES = {
    "fenogal":   date(2026, 5, 18),
    "gastrilex": date(2026, 6, 30),
}

DEMO_PROJECTS = {
    "fenogal": {
        "schema_type": "drug_registration_extension",
        "description": "換發藥品許可證 — 藥品查驗登記",
        "items": [
            {"item_key": "item1", "item_name": "換發新證申請書",           "category": "license_renewal", "status": "in_progress",  "notes": "預計 2026-03-23 完成",    "risk_level": "high"},
            {"item_key": "item2", "item_name": "成品製造廠 GMP 核備函",    "category": "gmp",             "status": "completed",    "notes": "GMP 展延已完成",          "risk_level": "low"},
            {"item_key": "item3", "item_name": "藥典/廠規檢驗規格變更備查","category": "specification",   "status": "under_review", "notes": "TFDA 審查中",             "risk_level": "medium"},
            {"item_key": "item4", "item_name": "原料藥製造廠 GMP 證明文件","category": "api_gmp",         "status": "completed",    "notes": "附 QR code GMP 證書",    "risk_level": "low"},
            {"item_key": "item5", "item_name": "非登不可上傳原料藥 GMP 文件","category":"api_upload",     "status": "blocked",      "notes": "QR code 驗證失敗",        "risk_level": "high"},
            {"item_key": "item6", "item_name": "成品元素不純物風險評估報告","category": "risk_assessment","status": "completed",    "notes": "風險評估已核准",          "risk_level": "low"},
            {"item_key": "item7", "item_name": "ExPress 平臺上傳補正內容", "category": "submission",      "status": "pending",      "notes": "等待所有文件就緒",        "risk_level": "medium"},
        ],
    },
    "gastrilex": {
        "schema_type": "food_registration",
        "description": "食品登錄 — 健康食品查驗",
        "items": [
            {"item_key": "item1", "item_name": "食品業者登錄證明",         "category": "business_reg",   "status": "completed",    "notes": "已完成登錄",              "risk_level": "low"},
            {"item_key": "item2", "item_name": "產品配方及製造流程說明書",  "category": "formulation",    "status": "in_progress",  "notes": "配方修訂中",              "risk_level": "medium"},
            {"item_key": "item3", "item_name": "原料規格及來源證明",        "category": "raw_materials",  "status": "pending",      "notes": "等待供應商文件",          "risk_level": "high"},
            {"item_key": "item4", "item_name": "成品檢驗規格及方法",        "category": "testing_specs",  "status": "under_review", "notes": "實驗室審查中",            "risk_level": "medium"},
            {"item_key": "item5", "item_name": "衛生安全性試驗報告",        "category": "safety_testing", "status": "pending",      "notes": "尚未開始",                "risk_level": "high"},
        ],
    },
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _ensure_default_company_and_admin(db, dry_run: bool) -> tuple:
    """Return (company, user) — create them if they don't exist."""
    company = db.query(Company).filter_by(slug=_slugify(DEFAULT_COMPANY_NAME)).first()
    if company is None:
        if dry_run:
            print(f"  [DRY-RUN] Would create Company: {DEFAULT_COMPANY_NAME!r}")
            return None, None
        company = Company(
            name=DEFAULT_COMPANY_NAME,
            slug=_slugify(DEFAULT_COMPANY_NAME),
            plan="basic",
        )
        db.add(company)
        db.flush()
        print(f"  Created Company: {company.name!r} (slug={company.slug!r})")
    else:
        print(f"  Company already exists: {company.name!r}")

    user = db.query(User).filter_by(email=DEFAULT_ADMIN_EMAIL).first()
    if user is None:
        if dry_run:
            print(f"  [DRY-RUN] Would create admin User: {DEFAULT_ADMIN_EMAIL!r}")
            return company, None
        user = User(
            company_id=company.id,
            email=DEFAULT_ADMIN_EMAIL,
            password_hash=_hash_password(DEFAULT_ADMIN_PASSWORD),
            full_name=DEFAULT_ADMIN_NAME,
            role="admin",
        )
        db.add(user)
        db.flush()
        print(f"  Created admin: {user.email!r} (password: {DEFAULT_ADMIN_PASSWORD!r})")
        print("  *** IMPORTANT: Change the admin password after first login! ***")
    else:
        print(f"  Admin user already exists: {user.email!r}")

    return company, user


def _migrate_json_project(db, company, user, project_name: str, json_path: Path, dry_run: bool):
    """Read a JSON review file and insert/update Project + ChecklistItems."""
    with open(json_path, encoding="utf-8") as f:
        data = json.load(f)

    slug = project_name.lower()
    existing = db.query(Project).filter_by(company_id=company.id, slug=slug).first()
    if existing:
        print(f"  Project {slug!r} already in DB — skipping")
        return

    deadline_str = DEMO_DEADLINES.get(slug)
    deadline_dt = datetime.combine(deadline_str, datetime.min.time()) if deadline_str else None

    schema_type = data.get("document_type", "drug_registration_extension")

    if dry_run:
        items = data.get("items", [])
        print(f"  [DRY-RUN] Would create Project {slug!r} with {len(items)} checklist items")
        return

    project = Project(
        company_id=company.id,
        created_by=user.id,
        name=project_name,
        slug=slug,
        schema_type=schema_type,
        deadline=deadline_dt,
        description=f"Imported from {json_path.name}",
    )
    db.add(project)
    db.flush()

    for item in data.get("items", []):
        ci = ChecklistItem(
            project_id=project.id,
            item_key=item.get("item", "unknown")[:100],
            item_name=item.get("item", ""),
            category=item.get("category", ""),
            status=item.get("status", "pending"),
            notes=item.get("notes", ""),
            risk_level=item.get("risk_level", "medium"),
            updated_by=user.id,
        )
        db.add(ci)

    db.flush()
    print(f"  Migrated Project {slug!r}: {len(data.get('items', []))} items")


def _seed_demo_project(db, company, user, name: str, info: dict, dry_run: bool):
    """Insert a demo project with hardcoded sample data."""
    slug = name.lower()
    if db.query(Project).filter_by(company_id=company.id, slug=slug).first():
        print(f"  Demo project {slug!r} already exists — skipping")
        return

    deadline = DEMO_DEADLINES.get(slug)
    deadline_dt = datetime.combine(deadline, datetime.min.time()) if deadline else None

    if dry_run:
        print(f"  [DRY-RUN] Would seed demo project {slug!r} with {len(info['items'])} items")
        return

    project = Project(
        company_id=company.id,
        created_by=user.id,
        name=name.capitalize(),
        slug=slug,
        schema_type=info["schema_type"],
        deadline=deadline_dt,
        description=info.get("description", ""),
    )
    db.add(project)
    db.flush()

    for item in info["items"]:
        ci = ChecklistItem(
            project_id=project.id,
            item_key=item["item_key"],
            item_name=item["item_name"],
            category=item.get("category", ""),
            status=item["status"],
            notes=item.get("notes", ""),
            risk_level=item["risk_level"],
            updated_by=user.id,
        )
        db.add(ci)

    db.flush()
    print(f"  Seeded demo project {slug!r}: {len(info['items'])} items")


# ── Main ──────────────────────────────────────────────────────────────────────

def run_migration(dry_run: bool = True, seed_demo: bool = False):
    print("=" * 60)
    print("Regulatory Review — DB Migration")
    print(f"Mode: {'DRY-RUN (no changes)' if dry_run else 'EXECUTE'}")
    print("=" * 60)

    print("\n[1] Initialising database...")
    init_db()
    print("    Tables ready.")

    print("\n[2] Ensuring default company + admin user...")
    with get_db() as db:
        company, user = _ensure_default_company_and_admin(db, dry_run)

        if not dry_run and company is not None:
            print("\n[3] Scanning for JSON project files...")
            found = 0
            if PROJECTS_ROOT.exists():
                for proj_dir in sorted(PROJECTS_ROOT.iterdir()):
                    if not proj_dir.is_dir():
                        continue
                    review_dir = proj_dir / "review"
                    json_files = list(review_dir.glob("*.json")) if review_dir.exists() else []
                    if json_files:
                        latest = max(json_files, key=lambda p: p.stat().st_mtime)
                        print(f"  Found: {proj_dir.name} -> {latest.name}")
                        _migrate_json_project(db, company, user, proj_dir.name, latest, dry_run)
                        found += 1
            if found == 0:
                print("  No JSON project files found.")

            if seed_demo:
                print("\n[4] Seeding demo projects...")
                for name, info in DEMO_PROJECTS.items():
                    _seed_demo_project(db, company, user, name, info, dry_run)
        elif dry_run:
            print("\n[3] (Dry-run: skipping JSON scan)")
            if seed_demo:
                print("\n[4] Demo projects that would be seeded:")
                for name, info in DEMO_PROJECTS.items():
                    print(f"  - {name}: {len(info['items'])} items")

    print("\n" + "=" * 60)
    print("Migration complete.")
    if dry_run:
        print("Run with --execute to apply changes.")
    print("=" * 60)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate JSON data to SQLite")
    parser.add_argument("--execute",   action="store_true", help="Apply migration (default is dry-run)")
    parser.add_argument("--seed-demo", action="store_true", help="Insert demo projects")
    args = parser.parse_args()

    run_migration(dry_run=not args.execute, seed_demo=args.seed_demo)
