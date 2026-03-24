#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Shared pytest fixtures for the Regulatory Review test suite.

All tests share an isolated in-memory SQLite database via StaticPool,
ensuring zero interference with the production database.
"""

import sys
import pytest
import bcrypt
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Ensure project root is importable
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from database.models import Base, Company, User, Project, ChecklistItem


# ── Database fixtures ──────────────────────────────────────────────────────────

@pytest.fixture(scope="function")
def engine():
    """In-memory SQLite engine, isolated per test function.

    StaticPool ensures every SQLAlchemy session in the same test shares the
    same underlying connection (required for in-memory SQLite isolation).
    """
    eng = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False,
    )
    Base.metadata.create_all(eng)
    yield eng
    Base.metadata.drop_all(eng)
    eng.dispose()


@pytest.fixture(scope="function")
def db_session(engine):
    """Yield a SQLAlchemy session bound to the test engine."""
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.rollback()
    session.close()


@pytest.fixture(autouse=True)
def patch_db(monkeypatch, engine):
    """
    Patch the global database module so auth/register/login functions use the
    test in-memory engine instead of the production SQLite file.

    expire_on_commit=False prevents DetachedInstanceError when auth functions
    return objects after their internal session has committed and closed.

    Applied automatically to every test.
    """
    import database.db as db_module
    TestSession = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=engine,
        expire_on_commit=False,  # keep attributes accessible after session.commit()
    )
    monkeypatch.setattr(db_module, "_engine", engine)
    monkeypatch.setattr(db_module, "SessionLocal", TestSession)


# ── Data factories ─────────────────────────────────────────────────────────────

@pytest.fixture
def company_factory(db_session):
    """Factory: create Company rows via db_session."""
    def _make(name="Acme Pharma", slug="acme-pharma", plan="basic", is_active=True):
        company = Company(name=name, slug=slug, plan=plan, is_active=is_active)
        db_session.add(company)
        db_session.commit()
        db_session.refresh(company)
        return company
    return _make


@pytest.fixture
def user_factory(db_session):
    """Factory: create User rows with a bcrypt-hashed password."""
    def _make(
        company_id,
        email="user@example.com",
        password="password123",
        full_name="Test User",
        role="member",
        is_active=True,
    ):
        pw_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        user = User(
            company_id=company_id,
            email=email,
            password_hash=pw_hash,
            full_name=full_name,
            role=role,
            is_active=is_active,
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        return user
    return _make


@pytest.fixture
def project_factory(db_session):
    """Factory: create Project rows."""
    def _make(
        company_id,
        created_by=None,
        name="Test Project",
        slug="test-project",
        schema_type="drug_registration_extension",
        status="active",
    ):
        project = Project(
            company_id=company_id,
            created_by=created_by,
            name=name,
            slug=slug,
            schema_type=schema_type,
            status=status,
        )
        db_session.add(project)
        db_session.commit()
        db_session.refresh(project)
        return project
    return _make


@pytest.fixture
def checklist_factory(db_session):
    """Factory: create ChecklistItem rows."""
    def _make(
        project_id,
        item_key="item1",
        item_name="License Renewal",
        category="license_renewal",
        status="pending",
        risk_level="medium",
    ):
        item = ChecklistItem(
            project_id=project_id,
            item_key=item_key,
            item_name=item_name,
            category=category,
            status=status,
            risk_level=risk_level,
        )
        db_session.add(item)
        db_session.commit()
        db_session.refresh(item)
        return item
    return _make


# ── Pre-built convenience fixtures ────────────────────────────────────────────

@pytest.fixture
def sample_company(company_factory):
    return company_factory(name="Universal Integrated Corp", slug="universal-integrated")


@pytest.fixture
def sample_user(user_factory, sample_company):
    return user_factory(
        company_id=sample_company.id,
        email="admin@uic.com",
        password="secure1234",
        full_name="Josh Tsai",
        role="admin",
    )


@pytest.fixture
def sample_project(project_factory, sample_company, sample_user):
    return project_factory(
        company_id=sample_company.id,
        created_by=sample_user.id,
        name="Fenogal Registration",
        slug="fenogal",
        schema_type="drug_registration_extension",
    )


@pytest.fixture
def all_pending_data():
    """7-item drug extension data — all items pending."""
    return {f"item{i}_status": "pending" for i in range(1, 8)}


@pytest.fixture
def all_completed_data():
    """7-item drug extension data — all items completed."""
    return {f"item{i}_status": "completed" for i in range(1, 8)}


@pytest.fixture
def mixed_data():
    """Realistic TFDA drug extension scenario (5/7 completed, 1 blocked)."""
    return {
        "item1_status": "completed",
        "item1_notes": "License renewal submitted",
        "item2_status": "completed",
        "item2_notes": "GMP letter obtained",
        "item3_status": "completed",
        "item3_notes": "Specification change approved",
        "item4_status": "completed",
        "item4_notes": "API GMP certificate verified",
        "item5_status": "blocked",
        "item5_notes": "QR code verification failed",
        "item6_status": "completed",
        "item6_notes": "Risk assessment report approved",
        "item7_status": "pending",
        "item7_notes": "Waiting for all documents",
    }
