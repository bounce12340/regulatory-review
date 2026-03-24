#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SQLAlchemy ORM models for Regulatory Review multi-tenant system.

Tables:
  company        – tenant isolation unit
  user           – per-company user account
  project        – regulatory project owned by a company
  checklist_item – individual checklist item state for a project
"""

from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Boolean,
    ForeignKey, Enum as SAEnum,
)
from sqlalchemy.orm import relationship, DeclarativeBase


class Base(DeclarativeBase):
    pass


# ── Company (Tenant) ──────────────────────────────────────────────────────────

class Company(Base):
    __tablename__ = "company"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    name       = Column(String(200), nullable=False)
    slug       = Column(String(100), unique=True, nullable=False)   # URL-safe identifier
    plan       = Column(String(50), default="basic")                # basic / pro / enterprise
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active  = Column(Boolean, default=True)

    # Relationships
    users    = relationship("User",    back_populates="company", cascade="all, delete-orphan")
    projects = relationship("Project", back_populates="company", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Company id={self.id} slug={self.slug!r}>"


# ── User ──────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "user"

    id            = Column(Integer, primary_key=True, autoincrement=True)
    company_id    = Column(Integer, ForeignKey("company.id", ondelete="CASCADE"), nullable=False)
    email         = Column(String(254), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name     = Column(String(200), nullable=False)
    role          = Column(
        SAEnum("admin", "member", "viewer", name="user_role"),
        default="member",
        nullable=False,
    )
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)
    is_active  = Column(Boolean, default=True)

    # Relationships
    company  = relationship("Company", back_populates="users")
    projects = relationship("Project", back_populates="created_by_user")

    def __repr__(self):
        return f"<User id={self.id} email={self.email!r} role={self.role!r}>"


# ── Project ───────────────────────────────────────────────────────────────────

class Project(Base):
    __tablename__ = "project"

    id              = Column(Integer, primary_key=True, autoincrement=True)
    company_id      = Column(Integer, ForeignKey("company.id", ondelete="CASCADE"), nullable=False)
    created_by      = Column(Integer, ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    name            = Column(String(200), nullable=False)            # display name
    slug            = Column(String(100), nullable=False)            # lowercase identifier
    schema_type     = Column(String(100), default="drug_registration_extension")
    deadline        = Column(DateTime, nullable=True)
    description     = Column(Text, nullable=True)
    status          = Column(String(50), default="active")           # active / archived / completed
    created_at      = Column(DateTime, default=datetime.utcnow)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    company          = relationship("Company", back_populates="projects")
    created_by_user  = relationship("User",    back_populates="projects")
    checklist_items  = relationship("ChecklistItem", back_populates="project", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Project id={self.id} slug={self.slug!r} company_id={self.company_id}>"


# ── ChecklistItem ─────────────────────────────────────────────────────────────

class ChecklistItem(Base):
    __tablename__ = "checklist_item"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("project.id", ondelete="CASCADE"), nullable=False)
    item_key   = Column(String(100), nullable=False)    # e.g. "item1" — matches schema key
    item_name  = Column(String(500), nullable=False)    # display label
    category   = Column(String(100), nullable=True)
    status     = Column(
        SAEnum(
            "completed", "in_progress", "under_review", "blocked", "pending",
            name="item_status",
        ),
        default="pending",
        nullable=False,
    )
    notes      = Column(Text, nullable=True)
    risk_level = Column(
        SAEnum("low", "medium", "high", name="risk_level"),
        default="medium",
        nullable=False,
    )
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    updated_by = Column(Integer, ForeignKey("user.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    project = relationship("Project", back_populates="checklist_items")

    def __repr__(self):
        return f"<ChecklistItem id={self.id} key={self.item_key!r} status={self.status!r}>"
