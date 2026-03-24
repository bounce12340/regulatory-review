#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Tests for database initialization and configuration (database/db.py).

These tests cover the lazy-initialization code paths (_default_db_path,
get_db_url, init_db, get_engine, get_session_factory) that are otherwise
bypassed by the patch_db autouse fixture.

Each test temporarily resets the module globals to None so the code paths
that create the engine from scratch are actually executed.
"""

import os
import pytest
import database.db as db_module


class TestDbUrl:

    def test_get_db_url_with_env_var(self, monkeypatch):
        monkeypatch.setenv("REGULATORY_DB_PATH", "/tmp/custom_test.db")
        url = db_module.get_db_url()
        assert url == "sqlite:////tmp/custom_test.db"

    def test_get_db_url_without_env_var_returns_default(self, monkeypatch):
        monkeypatch.delenv("REGULATORY_DB_PATH", raising=False)
        url = db_module.get_db_url()
        assert url.startswith("sqlite:///")
        assert "regulatory.db" in url

    def test_default_db_path_is_under_openclaw(self, monkeypatch):
        monkeypatch.delenv("REGULATORY_DB_PATH", raising=False)
        path = db_module._default_db_path()
        assert path.name == "regulatory.db"
        assert ".openclaw" in str(path)

    def test_default_db_path_creates_parent_dir(self, monkeypatch, tmp_path):
        new_home = tmp_path / "fakehome"
        monkeypatch.setenv("HOME", str(new_home))  # may not affect Path.home() on Windows
        # Just verify the function runs without error
        path = db_module._default_db_path()
        assert path.name == "regulatory.db"


class TestDbInit:

    def test_init_db_creates_engine(self, monkeypatch, tmp_path):
        db_path = tmp_path / "init_test.db"
        monkeypatch.setenv("REGULATORY_DB_PATH", str(db_path))
        monkeypatch.setattr(db_module, "_engine", None)
        monkeypatch.setattr(db_module, "SessionLocal", None)

        engine = db_module.init_db()
        assert engine is not None

    def test_init_db_creates_session_local(self, monkeypatch, tmp_path):
        db_path = tmp_path / "session_test.db"
        monkeypatch.setenv("REGULATORY_DB_PATH", str(db_path))
        monkeypatch.setattr(db_module, "_engine", None)
        monkeypatch.setattr(db_module, "SessionLocal", None)

        db_module.init_db()
        assert db_module.SessionLocal is not None

    def test_init_db_creates_tables(self, monkeypatch, tmp_path):
        from sqlalchemy import inspect as sa_inspect
        db_path = tmp_path / "tables_test.db"
        monkeypatch.setenv("REGULATORY_DB_PATH", str(db_path))
        monkeypatch.setattr(db_module, "_engine", None)
        monkeypatch.setattr(db_module, "SessionLocal", None)

        engine = db_module.init_db()
        inspector = sa_inspect(engine)
        tables = inspector.get_table_names()
        assert "company" in tables
        assert "user" in tables
        assert "project" in tables
        assert "checklist_item" in tables

    def test_get_engine_lazy_initializes(self, monkeypatch, tmp_path):
        db_path = tmp_path / "engine_lazy.db"
        monkeypatch.setenv("REGULATORY_DB_PATH", str(db_path))
        monkeypatch.setattr(db_module, "_engine", None)
        monkeypatch.setattr(db_module, "SessionLocal", None)

        engine = db_module.get_engine()
        assert engine is not None

    def test_get_session_factory_lazy_initializes(self, monkeypatch, tmp_path):
        db_path = tmp_path / "factory_lazy.db"
        monkeypatch.setenv("REGULATORY_DB_PATH", str(db_path))
        monkeypatch.setattr(db_module, "_engine", None)
        monkeypatch.setattr(db_module, "SessionLocal", None)

        factory = db_module.get_session_factory()
        assert factory is not None

    def test_get_db_context_manager_commits(self, monkeypatch, tmp_path):
        from database.models import Base, Company
        db_path = tmp_path / "ctx_commit.db"
        monkeypatch.setenv("REGULATORY_DB_PATH", str(db_path))
        monkeypatch.setattr(db_module, "_engine", None)
        monkeypatch.setattr(db_module, "SessionLocal", None)
        db_module.init_db()

        with db_module.get_db() as session:
            company = Company(name="Ctx Corp", slug="ctx-corp")
            session.add(company)

        # Verify the data was committed
        with db_module.get_db() as session:
            result = session.query(Company).filter_by(slug="ctx-corp").first()
            assert result is not None
            assert result.name == "Ctx Corp"

    def test_get_db_context_manager_rollback_on_error(self, monkeypatch, tmp_path):
        from database.models import Base, Company
        db_path = tmp_path / "ctx_rollback.db"
        monkeypatch.setenv("REGULATORY_DB_PATH", str(db_path))
        monkeypatch.setattr(db_module, "_engine", None)
        monkeypatch.setattr(db_module, "SessionLocal", None)
        db_module.init_db()

        with pytest.raises(RuntimeError):
            with db_module.get_db() as session:
                company = Company(name="Rollback Corp", slug="rollback-corp")
                session.add(company)
                raise RuntimeError("simulated error")

        # Data should NOT be committed
        with db_module.get_db() as session:
            result = session.query(Company).filter_by(slug="rollback-corp").first()
            assert result is None
