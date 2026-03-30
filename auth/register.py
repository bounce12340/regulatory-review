#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
User & company registration helpers.
"""

import re
import sys
from pathlib import Path
from datetime import datetime

import bcrypt

sys.path.insert(0, str(Path(__file__).parent.parent))
from database.db import get_db
from database.models import Company, User


# ── Validation helpers ────────────────────────────────────────────────────────

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_SLUG_RE  = re.compile(r"^[a-z0-9][a-z0-9\-]{1,98}[a-z0-9]$")


def _validate_email(email: str) -> str:
    email = email.strip().lower()
    if not _EMAIL_RE.match(email):
        raise ValueError(f"Invalid email address: {email!r}")
    return email


def _validate_password(password: str):
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters.")


def _slugify(name: str) -> str:
    """Convert a company name to a URL-safe slug."""
    slug = re.sub(r"[^\w\s-]", "", name.lower())
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug[:100] or "company"


def _hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


# ── Public API ────────────────────────────────────────────────────────────────

def register_company_and_admin(
    company_name: str,
    admin_email: str,
    admin_password: str,
    admin_full_name: str,
    plan: str = "basic",
) -> tuple[Company, User]:
    """
    Create a new Company tenant and its first admin User in one transaction.

    Returns (company, user) on success.
    Raises ValueError for validation failures or duplicate email/slug.
    """
    admin_email = _validate_email(admin_email)
    _validate_password(admin_password)

    if not company_name.strip():
        raise ValueError("Company name cannot be empty.")
    if not admin_full_name.strip():
        raise ValueError("Full name cannot be empty.")

    slug = _slugify(company_name.strip())

    with get_db() as db:
        # Check uniqueness
        if db.query(Company).filter_by(slug=slug).first():
            raise ValueError(f"Company slug {slug!r} already exists. Choose a different name.")
        if db.query(User).filter_by(email=admin_email).first():
            raise ValueError(f"Email {admin_email!r} is already registered.")

        company = Company(
            name=company_name.strip(),
            slug=slug,
            plan=plan,
        )
        db.add(company)
        db.flush()  # get company.id before creating user

        user = User(
            company_id=company.id,
            email=admin_email,
            password_hash=_hash_password(admin_password),
            full_name=admin_full_name.strip(),
            role="admin",
        )
        db.add(user)
        db.flush()

        # Refresh to get all DB-generated fields
        db.refresh(company)
        db.refresh(user)

        # Detach from session before returning so caller can use objects outside the context
        db.expunge(company)
        db.expunge(user)

        return company, user


def register_user(
    company_id: int,
    email: str,
    password: str,
    full_name: str,
    role: str = "member",
) -> User:
    """
    Add a new User to an existing Company.

    Raises ValueError on invalid input or duplicate email.
    """
    email = _validate_email(email)
    _validate_password(password)

    if not full_name.strip():
        raise ValueError("Full name cannot be empty.")
    if role not in ("admin", "member", "viewer"):
        raise ValueError(f"Invalid role: {role!r}")

    with get_db() as db:
        if not db.query(Company).filter_by(id=company_id, is_active=True).first():
            raise ValueError(f"Company id={company_id} not found or inactive.")
        if db.query(User).filter_by(email=email).first():
            raise ValueError(f"Email {email!r} is already registered.")

        user = User(
            company_id=company_id,
            email=email,
            password_hash=_hash_password(password),
            full_name=full_name.strip(),
            role=role,
        )
        db.add(user)
        db.flush()
        db.refresh(user)
        return user
