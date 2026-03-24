#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Login / credential-verification helpers.
"""

import sys
from pathlib import Path
from datetime import datetime

import bcrypt

sys.path.insert(0, str(Path(__file__).parent.parent))
from database.db import get_db
from database.models import User, Company


def get_user_by_email(email: str) -> User | None:
    """Return the active User with this email, or None."""
    email = email.strip().lower()
    with get_db() as db:
        user = (
            db.query(User)
            .filter_by(email=email, is_active=True)
            .first()
        )
        if user:
            # Detach from session so caller can use the object after context exits
            db.expunge(user)
        return user


def verify_login(email: str, password: str) -> User | None:
    """
    Verify email + password.

    Returns the User object if credentials are valid, otherwise None.
    Also updates last_login timestamp on success.
    """
    email = email.strip().lower()
    with get_db() as db:
        user = db.query(User).filter_by(email=email, is_active=True).first()
        if user is None:
            return None

        if not bcrypt.checkpw(password.encode("utf-8"), user.password_hash.encode("utf-8")):
            return None

        # Update last login
        user.last_login = datetime.utcnow()
        db.flush()
        db.refresh(user)
        db.expunge(user)
        return user


def get_company_for_user(user_id: int) -> Company | None:
    """Return the Company the user belongs to."""
    with get_db() as db:
        user = db.query(User).filter_by(id=user_id).first()
        if user is None:
            return None
        company = db.query(Company).filter_by(id=user.company_id, is_active=True).first()
        if company:
            db.expunge(company)
        return company
