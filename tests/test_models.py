#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Tests for SQLAlchemy ORM models (database/models.py).

Covers:
- Company CRUD operations and constraints
- User CRUD, roles, and unique email constraint
- Project creation, relationships, and status transitions
- ChecklistItem status transitions and risk levels
- Cascade delete behavior
"""

import pytest
from datetime import datetime
from sqlalchemy.exc import IntegrityError

from database.models import Company, User, Project, ChecklistItem


# ── Company ───────────────────────────────────────────────────────────────────

class TestCompanyModel:

    def test_create_company(self, db_session):
        company = Company(name="Test Pharma Co", slug="test-pharma", plan="basic")
        db_session.add(company)
        db_session.commit()
        assert company.id is not None

    def test_company_defaults(self, db_session):
        company = Company(name="Default Corp", slug="default-corp")
        db_session.add(company)
        db_session.commit()
        db_session.refresh(company)
        assert company.plan == "basic"
        assert company.is_active is True
        assert isinstance(company.created_at, datetime)

    def test_company_repr(self, db_session):
        company = Company(name="Repr Corp", slug="repr-corp")
        db_session.add(company)
        db_session.commit()
        assert "repr-corp" in repr(company)
        assert "Company" in repr(company)

    def test_company_slug_unique_constraint(self, db_session):
        c1 = Company(name="Company A", slug="shared-slug")
        c2 = Company(name="Company B", slug="shared-slug")
        db_session.add(c1)
        db_session.commit()
        db_session.add(c2)
        with pytest.raises(IntegrityError):
            db_session.commit()

    def test_company_plan_values(self, db_session):
        for plan in ("basic", "pro", "enterprise"):
            company = Company(name=f"Corp {plan}", slug=f"corp-{plan}", plan=plan)
            db_session.add(company)
        db_session.commit()
        companies = db_session.query(Company).all()
        plans = {c.plan for c in companies}
        assert {"basic", "pro", "enterprise"}.issubset(plans)

    def test_company_deactivate(self, db_session):
        company = Company(name="Inactive Corp", slug="inactive-corp", is_active=True)
        db_session.add(company)
        db_session.commit()
        company.is_active = False
        db_session.commit()
        db_session.refresh(company)
        assert company.is_active is False

    def test_company_update_name(self, db_session, sample_company):
        original_id = sample_company.id
        sample_company.name = "Updated Corp Name"
        db_session.commit()
        db_session.refresh(sample_company)
        assert sample_company.name == "Updated Corp Name"
        assert sample_company.id == original_id

    def test_company_delete(self, db_session):
        company = Company(name="Delete Me", slug="delete-me")
        db_session.add(company)
        db_session.commit()
        db_session.delete(company)
        db_session.commit()
        result = db_session.query(Company).filter_by(slug="delete-me").first()
        assert result is None


# ── User ──────────────────────────────────────────────────────────────────────

class TestUserModel:

    def test_create_user(self, db_session, sample_company):
        user = User(
            company_id=sample_company.id,
            email="newuser@test.com",
            password_hash="$2b$12$fakehash",
            full_name="New User",
            role="member",
        )
        db_session.add(user)
        db_session.commit()
        assert user.id is not None

    def test_user_defaults(self, db_session, sample_company):
        user = User(
            company_id=sample_company.id,
            email="defaults@test.com",
            password_hash="hash",
            full_name="Default User",
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        assert user.role == "member"
        assert user.is_active is True
        assert user.last_login is None
        assert isinstance(user.created_at, datetime)

    def test_user_email_unique_constraint(self, db_session, sample_company):
        u1 = User(company_id=sample_company.id, email="dup@test.com",
                  password_hash="h1", full_name="User 1")
        u2 = User(company_id=sample_company.id, email="dup@test.com",
                  password_hash="h2", full_name="User 2")
        db_session.add(u1)
        db_session.commit()
        db_session.add(u2)
        with pytest.raises(IntegrityError):
            db_session.commit()

    def test_user_roles(self, db_session, sample_company):
        for role in ("admin", "member", "viewer"):
            user = User(
                company_id=sample_company.id,
                email=f"{role}@test.com",
                password_hash="hash",
                full_name=f"{role.title()} User",
                role=role,
            )
            db_session.add(user)
        db_session.commit()
        for role in ("admin", "member", "viewer"):
            u = db_session.query(User).filter_by(email=f"{role}@test.com").first()
            assert u.role == role

    def test_user_last_login_updatable(self, db_session, sample_user):
        now = datetime.utcnow()
        sample_user.last_login = now
        db_session.commit()
        db_session.refresh(sample_user)
        assert sample_user.last_login is not None

    def test_user_deactivate(self, db_session, sample_user):
        sample_user.is_active = False
        db_session.commit()
        db_session.refresh(sample_user)
        assert sample_user.is_active is False

    def test_user_repr(self, db_session, sample_user):
        r = repr(sample_user)
        assert "User" in r
        assert sample_user.email in r

    def test_user_belongs_to_company(self, db_session, sample_user, sample_company):
        assert sample_user.company_id == sample_company.id

    def test_users_in_different_companies_can_share_email_domain(
        self, db_session, company_factory, user_factory
    ):
        c1 = company_factory(name="Corp 1", slug="corp-1")
        c2 = company_factory(name="Corp 2", slug="corp-2")
        u1 = user_factory(company_id=c1.id, email="alice@corp1.com")
        u2 = user_factory(company_id=c2.id, email="bob@corp2.com")
        assert u1.company_id != u2.company_id


# ── Project ───────────────────────────────────────────────────────────────────

class TestProjectModel:

    def test_create_project(self, db_session, sample_company, sample_user):
        project = Project(
            company_id=sample_company.id,
            created_by=sample_user.id,
            name="Gastrilex Registration",
            slug="gastrilex",
            schema_type="food_registration",
        )
        db_session.add(project)
        db_session.commit()
        assert project.id is not None

    def test_project_defaults(self, db_session, sample_company):
        project = Project(
            company_id=sample_company.id,
            name="Default Project",
            slug="default-project",
        )
        db_session.add(project)
        db_session.commit()
        db_session.refresh(project)
        assert project.schema_type == "drug_registration_extension"
        assert project.status == "active"
        assert isinstance(project.created_at, datetime)

    def test_project_schema_types(self, db_session, sample_company):
        schema_types = [
            "drug_registration_extension",
            "food_registration",
            "medical_device_registration",
        ]
        for stype in schema_types:
            project = Project(
                company_id=sample_company.id,
                name=f"Project {stype}",
                slug=f"proj-{stype[:8]}",
                schema_type=stype,
            )
            db_session.add(project)
        db_session.commit()
        for stype in schema_types:
            p = db_session.query(Project).filter_by(slug=f"proj-{stype[:8]}").first()
            assert p.schema_type == stype

    def test_project_status_transitions(self, db_session, sample_project):
        for status in ("active", "archived", "completed"):
            sample_project.status = status
            db_session.commit()
            db_session.refresh(sample_project)
            assert sample_project.status == status

    def test_project_repr(self, sample_project):
        r = repr(sample_project)
        assert "Project" in r
        assert sample_project.slug in r

    def test_project_with_deadline(self, db_session, sample_company):
        deadline = datetime(2026, 6, 30)
        project = Project(
            company_id=sample_company.id,
            name="Deadline Project",
            slug="deadline-proj",
            deadline=deadline,
        )
        db_session.add(project)
        db_session.commit()
        db_session.refresh(project)
        assert project.deadline == deadline

    def test_project_description(self, db_session, sample_company):
        desc = "TFDA drug registration extension for Fenogal"
        project = Project(
            company_id=sample_company.id,
            name="Described Project",
            slug="described-proj",
            description=desc,
        )
        db_session.add(project)
        db_session.commit()
        db_session.refresh(project)
        assert project.description == desc


# ── ChecklistItem ─────────────────────────────────────────────────────────────

class TestChecklistItemModel:

    def test_create_checklist_item(self, db_session, sample_project):
        item = ChecklistItem(
            project_id=sample_project.id,
            item_key="item1",
            item_name="換發新證申請書",
            category="license_renewal",
            status="pending",
            risk_level="high",
        )
        db_session.add(item)
        db_session.commit()
        assert item.id is not None

    def test_checklist_item_defaults(self, db_session, sample_project):
        item = ChecklistItem(
            project_id=sample_project.id,
            item_key="item2",
            item_name="GMP Letter",
        )
        db_session.add(item)
        db_session.commit()
        db_session.refresh(item)
        assert item.status == "pending"
        assert item.risk_level == "medium"

    def test_all_valid_statuses(self, db_session, sample_project):
        valid_statuses = ["completed", "in_progress", "under_review", "blocked", "pending"]
        for i, status in enumerate(valid_statuses, 1):
            item = ChecklistItem(
                project_id=sample_project.id,
                item_key=f"item{i}",
                item_name=f"Item {i}",
                status=status,
            )
            db_session.add(item)
        db_session.commit()
        items = db_session.query(ChecklistItem).filter_by(
            project_id=sample_project.id
        ).all()
        actual_statuses = {i.status for i in items}
        assert actual_statuses == set(valid_statuses)

    def test_all_valid_risk_levels(self, db_session, sample_project):
        for i, risk in enumerate(["low", "medium", "high"], 1):
            item = ChecklistItem(
                project_id=sample_project.id,
                item_key=f"risk{i}",
                item_name=f"Risk Item {i}",
                risk_level=risk,
            )
            db_session.add(item)
        db_session.commit()
        items = (
            db_session.query(ChecklistItem)
            .filter(ChecklistItem.item_key.like("risk%"))
            .all()
        )
        actual = {i.risk_level for i in items}
        assert actual == {"low", "medium", "high"}

    def test_status_transition_pending_to_completed(self, checklist_factory, sample_project, db_session):
        item = checklist_factory(project_id=sample_project.id, status="pending")
        item.status = "completed"
        item.risk_level = "low"
        db_session.commit()
        db_session.refresh(item)
        assert item.status == "completed"
        assert item.risk_level == "low"

    def test_status_transition_blocked_to_in_progress(self, checklist_factory, sample_project, db_session):
        item = checklist_factory(project_id=sample_project.id, status="blocked")
        item.status = "in_progress"
        db_session.commit()
        db_session.refresh(item)
        assert item.status == "in_progress"

    def test_notes_update(self, checklist_factory, sample_project, db_session):
        item = checklist_factory(project_id=sample_project.id)
        item.notes = "QR code verified successfully"
        db_session.commit()
        db_session.refresh(item)
        assert item.notes == "QR code verified successfully"

    def test_checklist_item_repr(self, checklist_factory, sample_project):
        item = checklist_factory(project_id=sample_project.id, item_key="item3")
        r = repr(item)
        assert "ChecklistItem" in r
        assert "item3" in r

    def test_multiple_items_per_project(self, db_session, sample_project):
        for i in range(1, 8):
            item = ChecklistItem(
                project_id=sample_project.id,
                item_key=f"item{i}",
                item_name=f"Checklist Item {i}",
            )
            db_session.add(item)
        db_session.commit()
        items = db_session.query(ChecklistItem).filter_by(
            project_id=sample_project.id
        ).all()
        assert len(items) == 7


# ── Cascade Deletes ───────────────────────────────────────────────────────────

class TestCascadeDeletes:

    def test_delete_company_cascades_to_users(
        self, db_session, company_factory, user_factory
    ):
        company = company_factory(name="Delete Corp", slug="delete-corp")
        user = user_factory(company_id=company.id, email="orphan@test.com")
        company_id = company.id
        user_id = user.id

        db_session.delete(company)
        db_session.commit()

        assert db_session.get(Company, company_id) is None
        assert db_session.get(User, user_id) is None

    def test_delete_company_cascades_to_projects(
        self, db_session, company_factory, project_factory
    ):
        company = company_factory(name="Corp With Projects", slug="corp-with-proj")
        project = project_factory(company_id=company.id, name="Orphan Project",
                                  slug="orphan-proj")
        company_id = company.id
        project_id = project.id

        db_session.delete(company)
        db_session.commit()

        assert db_session.get(Company, company_id) is None
        assert db_session.get(Project, project_id) is None

    def test_delete_project_cascades_to_checklist_items(
        self, db_session, sample_project, checklist_factory
    ):
        item = checklist_factory(project_id=sample_project.id)
        project_id = sample_project.id
        item_id = item.id

        db_session.delete(sample_project)
        db_session.commit()

        assert db_session.get(Project, project_id) is None
        assert db_session.get(ChecklistItem, item_id) is None

    def test_delete_company_cascades_to_projects_and_items(
        self, db_session, company_factory, project_factory, checklist_factory
    ):
        company = company_factory(name="Full Cascade Corp", slug="full-cascade")
        project = project_factory(company_id=company.id, name="Cascade Project",
                                  slug="cascade-proj")
        item = checklist_factory(project_id=project.id)

        company_id = company.id
        project_id = project.id
        item_id = item.id

        db_session.delete(company)
        db_session.commit()

        assert db_session.get(Company, company_id) is None
        assert db_session.get(Project, project_id) is None
        assert db_session.get(ChecklistItem, item_id) is None
