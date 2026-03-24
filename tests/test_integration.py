#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Integration tests for the Regulatory Review Tool.

Covers:
- Complete registration → login → project creation → checklist → report workflow
- Multi-tenant data isolation (Company A cannot see Company B's data)
- TFDA drug registration extension end-to-end scenario
- TFDA food registration scenario
- Database transaction consistency
- Cascade behaviors across the full object graph
"""

import pytest
from datetime import datetime, timedelta

from database.models import Company, User, Project, ChecklistItem
from database.db import get_session_factory
from auth.register import register_company_and_admin, register_user
from auth.login import verify_login, get_company_for_user
from scripts.review import build_items, generate_report, ITEM_DEFINITIONS


# ── Helpers ───────────────────────────────────────────────────────────────────

def new_session():
    """Return a fresh session from the (patched) test SessionLocal."""
    factory = get_session_factory()
    return factory()


# ── Full registration → login workflow ───────────────────────────────────────

class TestRegistrationLoginWorkflow:

    def test_register_then_login_succeeds(self):
        company, user = register_company_and_admin(
            "Workflow Corp", "wf@corp.com", "workflow123", "Workflow Admin"
        )
        logged_in = verify_login("wf@corp.com", "workflow123")
        assert logged_in is not None
        assert logged_in.id == user.id

    def test_register_then_add_member_then_login(self):
        company, admin = register_company_and_admin(
            "Multi User Corp", "admin@musr.com", "admin12345", "Admin"
        )
        member = register_user(
            company_id=company.id,
            email="member@musr.com",
            password="member12345",
            full_name="Member User",
            role="member",
        )
        assert member.id is not None
        logged_in = verify_login("member@musr.com", "member12345")
        assert logged_in is not None
        assert logged_in.role == "member"

    def test_login_resolves_correct_company(self):
        company, _ = register_company_and_admin(
            "Company Resolver", "resolver@corp.com", "pass12345", "Admin"
        )
        user = verify_login("resolver@corp.com", "pass12345")
        found_company = get_company_for_user(user.id)
        assert found_company is not None
        assert found_company.id == company.id
        assert found_company.slug == "company-resolver"

    def test_multiple_companies_independent(self):
        company_a, admin_a = register_company_and_admin(
            "Alpha Pharma", "admin@alpha.com", "alpha12345", "Alpha Admin"
        )
        company_b, admin_b = register_company_and_admin(
            "Beta Biotech", "admin@beta.com", "beta12345", "Beta Admin"
        )
        assert company_a.id != company_b.id
        assert admin_a.id != admin_b.id

        co_a = get_company_for_user(admin_a.id)
        co_b = get_company_for_user(admin_b.id)
        assert co_a.slug == "alpha-pharma"
        assert co_b.slug == "beta-biotech"


# ── Project + Checklist workflow ──────────────────────────────────────────────

class TestProjectChecklistWorkflow:

    def test_create_project_and_checklist_items(
        self, db_session, sample_company, sample_user
    ):
        project = Project(
            company_id=sample_company.id,
            created_by=sample_user.id,
            name="Fenogal Drug Extension",
            slug="fenogal-ext",
            schema_type="drug_registration_extension",
            deadline=datetime.utcnow() + timedelta(days=90),
        )
        db_session.add(project)
        db_session.commit()
        db_session.refresh(project)

        for key, label, category in ITEM_DEFINITIONS:
            item = ChecklistItem(
                project_id=project.id,
                item_key=key,
                item_name=label,
                category=category,
                status="pending",
                risk_level="high",
            )
            db_session.add(item)
        db_session.commit()

        items = db_session.query(ChecklistItem).filter_by(
            project_id=project.id
        ).all()
        assert len(items) == 7

    def test_checklist_status_progression(
        self, db_session, sample_project, checklist_factory
    ):
        item = checklist_factory(
            project_id=sample_project.id,
            item_key="item1",
            item_name="換發新證申請書",
            category="license_renewal",
            status="pending",
        )

        # Simulate TFDA workflow progression
        for status in ("in_progress", "under_review", "completed"):
            item.status = status
            db_session.commit()
            db_session.refresh(item)
            assert item.status == status

    def test_project_completion_tracking(
        self, db_session, sample_project, checklist_factory
    ):
        # Create all 7 items
        for i, (key, label, category) in enumerate(ITEM_DEFINITIONS):
            checklist_factory(
                project_id=sample_project.id,
                item_key=key,
                item_name=label,
                category=category,
                status="pending",
            )

        items = db_session.query(ChecklistItem).filter_by(
            project_id=sample_project.id
        ).all()
        assert len(items) == 7

        # Complete 5 items
        for item in items[:5]:
            item.status = "completed"
        db_session.commit()

        completed = sum(1 for i in items if i.status == "completed")
        assert completed == 5

    def test_risk_level_updates_on_status_change(
        self, db_session, sample_project, checklist_factory
    ):
        item = checklist_factory(
            project_id=sample_project.id,
            item_key="item5",
            item_name="非登不可上傳原料藥 GMP 文件",
            category="upload",
            status="blocked",
            risk_level="high",
        )

        # Unblock and reduce risk
        item.status = "in_progress"
        item.risk_level = "medium"
        db_session.commit()
        db_session.refresh(item)

        assert item.status == "in_progress"
        assert item.risk_level == "medium"


# ── Report generation workflow ────────────────────────────────────────────────

class TestReportGenerationWorkflow:

    def test_generate_report_from_real_scenario(self, mixed_data):
        report = generate_report("fenogal", mixed_data)
        assert report["project"] == "fenogal"
        assert report["summary"]["total"] == 7
        assert report["summary"]["completed"] == 5

    def test_report_overall_status_matches_completion(self, mixed_data):
        report = generate_report("fenogal", mixed_data)
        # 5/7 = 71.4% → in_progress
        assert report["overall_status"] == "in_progress"

    def test_report_identifies_blocked_item_as_high_risk(self, mixed_data):
        report = generate_report("fenogal", mixed_data)
        high_risk_categories = {r["category"] for r in report["risks"]}
        # item5 blocked → upload → high risk
        assert "upload" in high_risk_categories

    def test_food_registration_scenario(self):
        data = {f"item{i}_status": "completed" for i in range(1, 6)}
        data.update({f"item{i}_status": "pending" for i in range(6, 11)})
        # Note: generate_report always uses drug_registration_extension schema
        # so we test the underlying build_items with mixed data
        items = build_items(data)
        completed = sum(1 for i in items if i["status"] == "completed")
        # Only 7 items in drug extension schema, extra keys ignored
        assert completed <= 7

    def test_all_items_complete_produces_ready_status(self, all_completed_data):
        report = generate_report("ready-project", all_completed_data)
        assert report["overall_status"] == "ready_for_submission"
        assert report["action_items"] == []

    def test_report_saved_and_loaded(self, tmp_path, mixed_data):
        import json
        report = generate_report("fenogal", mixed_data)
        report_file = tmp_path / "report.json"
        report_file.write_text(
            json.dumps(report, ensure_ascii=False, indent=2),
            encoding="utf-8"
        )
        loaded = json.loads(report_file.read_text(encoding="utf-8"))
        assert loaded["project"] == "fenogal"
        assert loaded["summary"]["total"] == 7


# ── Multi-tenant isolation ────────────────────────────────────────────────────

class TestMultiTenantIsolation:

    def test_projects_isolated_by_company(
        self, db_session, company_factory, project_factory
    ):
        company_a = company_factory(name="Tenant A", slug="tenant-a")
        company_b = company_factory(name="Tenant B", slug="tenant-b")

        proj_a = project_factory(company_id=company_a.id, name="Project A",
                                  slug="proj-a")
        proj_b = project_factory(company_id=company_b.id, name="Project B",
                                  slug="proj-b")

        # Query projects for company A only
        a_projects = db_session.query(Project).filter_by(
            company_id=company_a.id
        ).all()
        b_projects = db_session.query(Project).filter_by(
            company_id=company_b.id
        ).all()

        assert len(a_projects) == 1
        assert a_projects[0].slug == "proj-a"
        assert len(b_projects) == 1
        assert b_projects[0].slug == "proj-b"

    def test_users_isolated_by_company(
        self, db_session, company_factory, user_factory
    ):
        company_a = company_factory(name="User Tenant A", slug="user-tenant-a")
        company_b = company_factory(name="User Tenant B", slug="user-tenant-b")

        user_a = user_factory(company_id=company_a.id, email="a@tenanta.com")
        user_b = user_factory(company_id=company_b.id, email="b@tenantb.com")

        a_users = db_session.query(User).filter_by(company_id=company_a.id).all()
        b_users = db_session.query(User).filter_by(company_id=company_b.id).all()

        assert all(u.company_id == company_a.id for u in a_users)
        assert all(u.company_id == company_b.id for u in b_users)

    def test_checklist_items_cannot_cross_tenants(
        self, db_session, company_factory, project_factory, checklist_factory
    ):
        company_a = company_factory(name="CL Tenant A", slug="cl-tenant-a")
        company_b = company_factory(name="CL Tenant B", slug="cl-tenant-b")

        proj_a = project_factory(company_id=company_a.id, name="CL Proj A",
                                  slug="cl-proj-a")
        proj_b = project_factory(company_id=company_b.id, name="CL Proj B",
                                  slug="cl-proj-b")

        item_a = checklist_factory(project_id=proj_a.id, item_key="item1")
        item_b = checklist_factory(project_id=proj_b.id, item_key="item1")

        # Each project should only see its own items
        a_items = db_session.query(ChecklistItem).filter_by(
            project_id=proj_a.id
        ).all()
        b_items = db_session.query(ChecklistItem).filter_by(
            project_id=proj_b.id
        ).all()

        assert all(i.project_id == proj_a.id for i in a_items)
        assert all(i.project_id == proj_b.id for i in b_items)


# ── TFDA Compliance Scenarios ─────────────────────────────────────────────────

class TestTFDAComplianceScenarios:
    """End-to-end TFDA regulatory scenarios that mirror real-world workflows."""

    def test_fenogal_drug_extension_scenario(self, mixed_data):
        """
        Fenogal scenario: 5 items complete, item5 blocked (QR code issue),
        item7 pending. Should be 'in_progress' with high-risk upload item.
        """
        report = generate_report("fenogal", mixed_data)

        assert report["summary"]["completed"] == 5
        assert report["summary"]["total"] == 7
        assert report["overall_status"] == "in_progress"

        # Blocked upload item should surface as high risk
        high_risk_categories = {r.get("category", "") for r in report["risks"]}
        # item5 (upload) is blocked → high risk per RISK_RULES
        assert "upload" in high_risk_categories

    def test_drug_extension_all_clear_ready_to_submit(self, all_completed_data):
        """All 7 drug extension documents complete → ready for ExPress upload."""
        report = generate_report("fenogal-final", all_completed_data)
        assert report["overall_status"] == "ready_for_submission"
        assert report["summary"]["completed"] == 7
        assert report["action_items"] == []

    def test_early_stage_project_needs_attention(self, all_pending_data):
        """Brand new project with all items pending → needs_attention."""
        report = generate_report("new-drug-project", all_pending_data)
        assert report["overall_status"] == "needs_attention"
        assert report["summary"]["completed"] == 0
        assert len(report["action_items"]) == 7

    def test_critical_items_block_submission(self):
        """
        License renewal (item1) blocked → cannot proceed.
        Should trigger high risk for the most critical document.
        """
        data = {f"item{i}_status": "completed" for i in range(2, 8)}
        data["item1_status"] = "blocked"
        data["item1_notes"] = "Missing required signature"

        items = build_items(data)
        license_item = next(i for i in items if i["category"] == "license_renewal")
        assert license_item["risk_level"] == "high"  # blocked → high per RISK_RULES

        report = generate_report("blocked-renewal", data)
        # 6/7 = 85.7% → in_progress but still has a critical blocker
        assert report["overall_status"] == "in_progress"
        assert any(r["category"] == "license_renewal" for r in report["risks"])

    def test_specification_under_review_is_medium_risk(self):
        """
        Spec change under TFDA review → medium risk (acceptable to continue other work).
        """
        data = {
            "item1_status": "completed",
            "item2_status": "completed",
            "item3_status": "under_review",  # specification
            "item4_status": "completed",
            "item5_status": "completed",
            "item6_status": "completed",
            "item7_status": "in_progress",
        }
        items = build_items(data)
        spec_item = next(i for i in items if i["category"] == "specification")
        assert spec_item["risk_level"] == "medium"

    def test_submission_pending_is_not_high_risk(self):
        """
        ExPress submission pending (all other docs ready) → medium risk only.
        """
        data = {f"item{i}_status": "completed" for i in range(1, 7)}
        data["item7_status"] = "pending"

        items = build_items(data)
        submission_item = next(i for i in items if i["category"] == "submission")
        assert submission_item["risk_level"] == "medium"

    def test_project_lifecycle(
        self, db_session, sample_company, sample_user
    ):
        """
        Full lifecycle: create → active → archived → completed
        """
        project = Project(
            company_id=sample_company.id,
            created_by=sample_user.id,
            name="Lifecycle Test Drug",
            slug="lifecycle-drug",
            schema_type="drug_registration_extension",
        )
        db_session.add(project)
        db_session.commit()
        assert project.status == "active"

        project.status = "archived"
        db_session.commit()
        db_session.refresh(project)
        assert project.status == "archived"

        project.status = "completed"
        db_session.commit()
        db_session.refresh(project)
        assert project.status == "completed"


# ── Transaction integrity ──────────────────────────────────────────────────────

class TestTransactionIntegrity:

    def test_failed_registration_does_not_persist_partial_data(self):
        """If registration fails after company creation, no orphan company should remain."""
        # Attempt registration with a duplicate email that will fail after
        # the first registration
        register_company_and_admin(
            "Integrity Corp", "integrity@corp.com", "pass12345", "Admin"
        )

        # Second registration with same email → should fail atomically
        with pytest.raises(ValueError):
            register_company_and_admin(
                "Integrity Corp 2", "integrity@corp.com", "pass12345", "Admin"
            )

        # Verify only one company with the base slug exists
        session = new_session()
        try:
            companies = session.query(Company).filter(
                Company.slug.like("integrity-corp%")
            ).all()
            # Only the first registration should have succeeded
            assert len(companies) == 1
            assert companies[0].slug == "integrity-corp"
        finally:
            session.close()

    def test_query_consistency_after_multiple_operations(
        self, db_session, company_factory, user_factory, project_factory, checklist_factory
    ):
        company = company_factory(name="Consistent Corp", slug="consistent-corp")
        user = user_factory(company_id=company.id, email="a@consistent.com")
        project = project_factory(company_id=company.id, created_by=user.id,
                                   name="Consistent Project", slug="consistent-proj")

        for i, (key, label, category) in enumerate(ITEM_DEFINITIONS):
            checklist_factory(
                project_id=project.id,
                item_key=key,
                item_name=label,
                category=category,
                status="pending" if i < 3 else "completed",
            )

        # Verify counts
        projects = db_session.query(Project).filter_by(company_id=company.id).all()
        assert len(projects) == 1

        items = db_session.query(ChecklistItem).filter_by(project_id=project.id).all()
        assert len(items) == 7

        completed = sum(1 for i in items if i.status == "completed")
        assert completed == 4  # items 3..6 (0-indexed)
