#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Database engine and session management.

SQLite is used for easy local/cloud deployment.
The DB file lives at:  ~/.openclaw/workspace/regulatory-review/regulatory.db
(or the path in env var REGULATORY_DB_PATH)
"""

import os
from pathlib import Path
from contextlib import contextmanager

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from .models import Base

# ── DB path ───────────────────────────────────────────────────────────────────

def _default_db_path() -> Path:
    base = Path.home() / ".openclaw" / "workspace" / "regulatory-review"
    base.mkdir(parents=True, exist_ok=True)
    return base / "regulatory.db"


def get_db_url() -> str:
    env_path = os.environ.get("REGULATORY_DB_PATH")
    if env_path:
        return f"sqlite:///{env_path}"
    return f"sqlite:///{_default_db_path()}"


# ── Engine / SessionLocal ─────────────────────────────────────────────────────

def _make_engine():
    url = get_db_url()
    return create_engine(
        url,
        connect_args={"check_same_thread": False},  # required for SQLite + Streamlit threads
        echo=False,
    )


_engine = None
SessionLocal: sessionmaker = None  # initialised lazily by init_db()


def init_db():
    """Create all tables (idempotent). Call once at app startup."""
    global _engine, SessionLocal
    _engine = _make_engine()
    Base.metadata.create_all(bind=_engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)
    return _engine


def get_engine():
    global _engine
    if _engine is None:
        init_db()
    return _engine


def get_session_factory():
    global SessionLocal
    if SessionLocal is None:
        init_db()
    return SessionLocal


@contextmanager
def get_db() -> Session:
    """Context-manager that yields a DB session and handles commit/rollback."""
    factory = get_session_factory()
    db = factory()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
