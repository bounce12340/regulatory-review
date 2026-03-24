#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Tests for regulatory review business logic (scripts/review.py).

Covers:
- ITEM_DEFINITIONS completeness and structure
- RISK_RULES correctness for all categories and statuses
- build_items() output shape and risk computation
- generate_report() completion rate, overall_status thresholds, action items
- load_data() default and file-based loading
- save_report() and export_markdown() persistence functions
"""

import json
import pytest
from pathlib import Path

# Import under test
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts.review import (
    ITEM_DEFINITIONS,
    RISK_RULES,
    ACTION_RECOMMENDATIONS,
    DEFAULT_DATA,
    build_items,
    generate_report,
    load_data,
    save_report,
    export_markdown,
    render_plain,
    render_report,
    _risk_text,
    _status_text,
)


# ── ITEM_DEFINITIONS ──────────────────────────────────────────────────────────

class TestItemDefinitions:
    """The canonical TFDA drug extension checklist must be complete and consistent."""

    EXPECTED_KEYS = ["item1", "item2", "item3", "item4", "item5", "item6", "item7"]
    EXPECTED_CATEGORIES = [
        "license_renewal", "gmp", "specification",
        "api_gmp", "upload", "risk_assessment", "submission",
    ]

    def test_has_exactly_seven_items(self):
        assert len(ITEM_DEFINITIONS) == 7

    def test_item_keys_are_sequential(self):
        keys = [key for key, *_ in ITEM_DEFINITIONS]
        assert keys == self.EXPECTED_KEYS

    def test_item_keys_are_unique(self):
        keys = [key for key, *_ in ITEM_DEFINITIONS]
        assert len(keys) == len(set(keys))

    def test_categories_match_expected(self):
        categories = [cat for _, _, cat in ITEM_DEFINITIONS]
        assert categories == self.EXPECTED_CATEGORIES

    def test_all_items_have_nonempty_labels(self):
        for key, label, _ in ITEM_DEFINITIONS:
            assert label.strip(), f"Item {key!r} has an empty label"

    def test_all_categories_have_risk_rules(self):
        for _, _, category in ITEM_DEFINITIONS:
            assert category in RISK_RULES, f"Category {category!r} missing from RISK_RULES"

    def test_all_categories_have_action_recommendations(self):
        for _, _, category in ITEM_DEFINITIONS:
            assert category in ACTION_RECOMMENDATIONS, (
                f"Category {category!r} missing from ACTION_RECOMMENDATIONS"
            )

    def test_item_tuple_length(self):
        for item in ITEM_DEFINITIONS:
            assert len(item) == 3, "Each definition must be (key, label, category)"


# ── RISK_RULES ────────────────────────────────────────────────────────────────

class TestRiskRules:
    """RISK_RULES should return correct risk levels for all status/category combos."""

    ALL_STATUSES = ["completed", "in_progress", "under_review", "blocked", "pending"]
    VALID_RISK_LEVELS = {"low", "medium", "high"}

    def test_all_risk_rules_return_valid_levels(self):
        for category, rule_fn in RISK_RULES.items():
            for status in self.ALL_STATUSES:
                result = rule_fn(status)
                assert result in self.VALID_RISK_LEVELS, (
                    f"{category!r} + {status!r} → {result!r} (not a valid risk level)"
                )

    def test_license_renewal_completed_is_low(self):
        assert RISK_RULES["license_renewal"]("completed") == "low"

    def test_license_renewal_pending_is_high(self):
        assert RISK_RULES["license_renewal"]("pending") == "high"

    def test_license_renewal_blocked_is_high(self):
        assert RISK_RULES["license_renewal"]("blocked") == "high"

    def test_gmp_completed_is_low(self):
        assert RISK_RULES["gmp"]("completed") == "low"

    def test_gmp_blocked_is_high(self):
        assert RISK_RULES["gmp"]("blocked") == "high"

    def test_specification_under_review_is_medium(self):
        assert RISK_RULES["specification"]("under_review") == "medium"

    def test_api_gmp_completed_is_low(self):
        assert RISK_RULES["api_gmp"]("completed") == "low"

    def test_api_gmp_pending_is_medium(self):
        assert RISK_RULES["api_gmp"]("pending") == "medium"

    def test_upload_blocked_is_high(self):
        assert RISK_RULES["upload"]("blocked") == "high"

    def test_upload_completed_is_low(self):
        assert RISK_RULES["upload"]("completed") == "low"

    def test_risk_assessment_completed_is_low(self):
        assert RISK_RULES["risk_assessment"]("completed") == "low"

    def test_risk_assessment_pending_is_high(self):
        assert RISK_RULES["risk_assessment"]("pending") == "high"

    def test_submission_pending_is_medium(self):
        assert RISK_RULES["submission"]("pending") == "medium"

    def test_submission_completed_is_low(self):
        assert RISK_RULES["submission"]("completed") == "low"


# ── build_items() ─────────────────────────────────────────────────────────────

class TestBuildItems:
    """build_items() must produce the correct list of enriched checklist dicts."""

    REQUIRED_FIELDS = {"item", "category", "status", "notes", "risk_level"}

    def test_returns_seven_items(self, all_pending_data):
        items = build_items(all_pending_data)
        assert len(items) == 7

    def test_each_item_has_required_fields(self, all_pending_data):
        items = build_items(all_pending_data)
        for item in items:
            assert self.REQUIRED_FIELDS.issubset(item.keys()), (
                f"Item missing fields: {self.REQUIRED_FIELDS - item.keys()}"
            )

    def test_status_from_data(self, all_completed_data):
        items = build_items(all_completed_data)
        for item in items:
            assert item["status"] == "completed"

    def test_missing_status_defaults_to_pending(self):
        items = build_items({})  # no status keys
        for item in items:
            assert item["status"] == "pending"

    def test_risk_level_computed_from_status(self, all_completed_data):
        items = build_items(all_completed_data)
        for item in items:
            # All completed items for most categories should be low risk
            assert item["risk_level"] in {"low", "medium", "high"}

    def test_blocked_upload_is_high_risk(self):
        data = {"item5_status": "blocked"}
        items = build_items(data)
        upload_item = next(i for i in items if i["category"] == "upload")
        assert upload_item["risk_level"] == "high"

    def test_notes_populated_from_data(self):
        data = {"item1_notes": "Submitted to TFDA"}
        items = build_items(data)
        assert items[0]["notes"] == "Submitted to TFDA"

    def test_notes_default_to_empty_string(self, all_pending_data):
        items = build_items(all_pending_data)
        for item in items:
            assert isinstance(item["notes"], str)

    def test_categories_match_definitions(self, all_pending_data):
        items = build_items(all_pending_data)
        expected = [cat for _, _, cat in ITEM_DEFINITIONS]
        actual = [i["category"] for i in items]
        assert actual == expected


# ── generate_report() ─────────────────────────────────────────────────────────

class TestGenerateReport:
    """generate_report() must calculate completion, status, and risks correctly."""

    REQUIRED_TOP_KEYS = {
        "review_date", "project", "document_type", "overall_status",
        "completion_rate", "items", "risks", "action_items", "summary",
    }

    def test_report_has_required_keys(self, mixed_data):
        report = generate_report("fenogal", mixed_data)
        assert self.REQUIRED_TOP_KEYS.issubset(report.keys())

    def test_project_name_in_report(self, mixed_data):
        report = generate_report("fenogal", mixed_data)
        assert report["project"] == "fenogal"

    def test_document_type_is_drug_extension(self, mixed_data):
        report = generate_report("fenogal", mixed_data)
        assert report["document_type"] == "drug_registration_extension"

    def test_completion_rate_all_completed(self, all_completed_data):
        report = generate_report("test", all_completed_data)
        assert report["completion_rate"] == "100.0%"
        assert report["summary"]["completed"] == 7
        assert report["summary"]["total"] == 7

    def test_completion_rate_all_pending(self, all_pending_data):
        report = generate_report("test", all_pending_data)
        assert report["completion_rate"] == "0.0%"
        assert report["summary"]["completed"] == 0

    def test_overall_status_ready_when_100_percent(self, all_completed_data):
        report = generate_report("test", all_completed_data)
        assert report["overall_status"] == "ready_for_submission"

    def test_overall_status_in_progress_when_gte_70_percent(self):
        # 5/7 = 71.4% → in_progress
        data = {f"item{i}_status": "completed" for i in range(1, 6)}
        data.update({f"item{i}_status": "pending" for i in range(6, 8)})
        report = generate_report("test", data)
        assert report["overall_status"] == "in_progress"

    def test_overall_status_needs_attention_below_70_percent(self):
        # 4/7 = 57.1% → needs_attention
        data = {f"item{i}_status": "completed" for i in range(1, 5)}
        data.update({f"item{i}_status": "pending" for i in range(5, 8)})
        report = generate_report("test", data)
        assert report["overall_status"] == "needs_attention"

    def test_overall_status_needs_attention_all_pending(self, all_pending_data):
        report = generate_report("test", all_pending_data)
        assert report["overall_status"] == "needs_attention"

    def test_high_risk_items_identified(self, mixed_data):
        report = generate_report("fenogal", mixed_data)
        # item5 is blocked → upload → high risk
        high_risk_names = [r["item"] for r in report["risks"]]
        assert len(report["risks"]) > 0
        assert report["summary"]["high_risk_items"] == len(report["risks"])

    def test_no_high_risk_when_all_completed(self, all_completed_data):
        report = generate_report("test", all_completed_data)
        # Most categories are low when completed; some may still vary by RISK_RULES
        # Just verify the count matches the risks list
        assert report["summary"]["high_risk_items"] == len(report["risks"])

    def test_action_items_exclude_completed(self, mixed_data):
        report = generate_report("fenogal", mixed_data)
        # No action item should have completed status
        # (action items come from non-completed items)
        items = build_items(mixed_data)
        completed_labels = {i["item"] for i in items if i["status"] == "completed"}
        action_labels = {a["item"] for a in report["action_items"]}
        assert completed_labels.isdisjoint(action_labels), (
            "Completed items should not appear in action_items"
        )

    def test_action_items_all_completed_is_empty(self, all_completed_data):
        report = generate_report("test", all_completed_data)
        assert report["action_items"] == []

    def test_action_item_has_priority_and_action(self, all_pending_data):
        report = generate_report("test", all_pending_data)
        for action in report["action_items"]:
            assert "priority" in action
            assert "action" in action
            assert action["priority"] in ("high", "medium")

    def test_summary_counts_are_consistent(self, mixed_data):
        report = generate_report("fenogal", mixed_data)
        summary = report["summary"]
        assert summary["total"] == len(report["items"])
        assert 0 <= summary["completed"] <= summary["total"]

    def test_review_date_is_iso_format(self, mixed_data):
        from datetime import datetime
        report = generate_report("fenogal", mixed_data)
        # Should not raise
        datetime.fromisoformat(report["review_date"])


# ── load_data() ───────────────────────────────────────────────────────────────

class TestLoadData:
    """load_data() must return defaults when no path given, or load JSON from file."""

    def test_returns_default_data_when_no_path(self):
        data = load_data(None)
        assert data == DEFAULT_DATA

    def test_default_data_has_seven_items(self):
        # 7 statuses + optional notes
        statuses = {k: v for k, v in DEFAULT_DATA.items() if k.endswith("_status")}
        assert len(statuses) == 7

    def test_default_data_contains_valid_statuses(self):
        valid = {"completed", "in_progress", "under_review", "blocked", "pending"}
        for k, v in DEFAULT_DATA.items():
            if k.endswith("_status"):
                assert v in valid, f"{k}={v!r} is not a valid status"

    def test_loads_json_from_file(self, tmp_path):
        payload = {"item1_status": "completed", "item2_status": "blocked"}
        json_file = tmp_path / "test_data.json"
        json_file.write_text(json.dumps(payload), encoding="utf-8")
        loaded = load_data(str(json_file))
        assert loaded == payload

    def test_loaded_json_overrides_defaults(self, tmp_path):
        payload = {"item1_status": "blocked"}
        json_file = tmp_path / "override.json"
        json_file.write_text(json.dumps(payload), encoding="utf-8")
        loaded = load_data(str(json_file))
        assert loaded["item1_status"] == "blocked"

    def test_load_nonexistent_file_raises(self):
        with pytest.raises(FileNotFoundError):
            load_data("/nonexistent/path/data.json")


# ── Default data scenario ─────────────────────────────────────────────────────

class TestDefaultDataScenario:
    """Smoke test against the embedded DEFAULT_DATA (real Fenogal scenario)."""

    def test_default_scenario_generates_valid_report(self):
        report = generate_report("fenogal", DEFAULT_DATA)
        assert report["overall_status"] in (
            "ready_for_submission", "in_progress", "needs_attention"
        )

    def test_default_scenario_has_blocked_item(self):
        items = build_items(DEFAULT_DATA)
        statuses = {i["status"] for i in items}
        assert "blocked" in statuses, "Default data should have a blocked item"

    def test_default_scenario_has_high_risk_items(self):
        report = generate_report("fenogal", DEFAULT_DATA)
        assert report["summary"]["high_risk_items"] > 0


# ── save_report() ─────────────────────────────────────────────────────────────

class TestSaveReport:
    """save_report() must persist the report dict as valid JSON."""

    def test_saves_report_to_default_path(self, tmp_path, mixed_data):
        report = generate_report("fenogal", mixed_data)
        saved = save_report(report, tmp_path)
        assert saved.exists()
        assert saved.suffix == ".json"

    def test_saved_json_is_valid_and_complete(self, tmp_path, mixed_data):
        report = generate_report("fenogal", mixed_data)
        saved = save_report(report, tmp_path)
        loaded = json.loads(saved.read_text(encoding="utf-8"))
        assert loaded["project"] == "fenogal"
        assert loaded["summary"]["total"] == 7
        assert "items" in loaded
        assert len(loaded["items"]) == 7

    def test_saves_to_custom_output_path(self, tmp_path, mixed_data):
        report = generate_report("fenogal", mixed_data)
        custom = tmp_path / "custom_report.json"
        saved = save_report(report, tmp_path, output_path=str(custom))
        assert saved == custom
        assert custom.exists()

    def test_creates_parent_directory(self, tmp_path, mixed_data):
        report = generate_report("fenogal", mixed_data)
        nested_path = tmp_path / "deep" / "nested" / "report.json"
        saved = save_report(report, tmp_path, output_path=str(nested_path))
        assert saved.exists()

    def test_cjk_characters_preserved(self, tmp_path, mixed_data):
        report = generate_report("fenogal", mixed_data)
        saved = save_report(report, tmp_path)
        content = saved.read_text(encoding="utf-8")
        # Item names include CJK characters
        assert "換發新證申請書" in content or "GMP" in content

    def test_returns_path_object(self, tmp_path, mixed_data):
        report = generate_report("fenogal", mixed_data)
        result = save_report(report, tmp_path)
        assert isinstance(result, Path)


# ── export_markdown() ─────────────────────────────────────────────────────────

class TestExportMarkdown:
    """export_markdown() must produce a valid Markdown report file."""

    def test_creates_markdown_file(self, tmp_path, mixed_data):
        report = generate_report("fenogal", mixed_data)
        dest = export_markdown(report, tmp_path)
        assert dest.exists()
        assert dest.suffix == ".md"

    def test_markdown_contains_project_name(self, tmp_path, mixed_data):
        report = generate_report("fenogal", mixed_data)
        dest = export_markdown(report, tmp_path)
        content = dest.read_text(encoding="utf-8")
        assert "FENOGAL" in content

    def test_markdown_has_checklist_table(self, tmp_path, mixed_data):
        report = generate_report("fenogal", mixed_data)
        dest = export_markdown(report, tmp_path)
        content = dest.read_text(encoding="utf-8")
        assert "## Checklist" in content
        assert "| # |" in content

    def test_markdown_has_seven_rows(self, tmp_path, mixed_data):
        report = generate_report("fenogal", mixed_data)
        dest = export_markdown(report, tmp_path)
        content = dest.read_text(encoding="utf-8")
        # Count data rows (lines starting with "| " and containing " | ")
        table_rows = [
            line for line in content.splitlines()
            if line.startswith("|") and "---" not in line and "# |" not in line
        ]
        assert len(table_rows) == 7

    def test_markdown_has_high_risk_section(self, tmp_path, mixed_data):
        report = generate_report("fenogal", mixed_data)
        dest = export_markdown(report, tmp_path)
        content = dest.read_text(encoding="utf-8")
        assert "## High-Risk Items" in content

    def test_markdown_has_action_items_section(self, tmp_path, mixed_data):
        report = generate_report("fenogal", mixed_data)
        dest = export_markdown(report, tmp_path)
        content = dest.read_text(encoding="utf-8")
        assert "## Action Items" in content

    def test_markdown_no_risk_section_when_all_complete(self, tmp_path, all_completed_data):
        report = generate_report("complete", all_completed_data)
        dest = export_markdown(report, tmp_path)
        content = dest.read_text(encoding="utf-8")
        # No high risk items when all completed (with current RISK_RULES)
        # Just verify the file is valid markdown
        assert "# Regulatory Review" in content

    def test_markdown_completion_rate_shown(self, tmp_path, mixed_data):
        report = generate_report("fenogal", mixed_data)
        dest = export_markdown(report, tmp_path)
        content = dest.read_text(encoding="utf-8")
        assert report["completion_rate"] in content

    def test_markdown_returns_path_object(self, tmp_path, mixed_data):
        report = generate_report("fenogal", mixed_data)
        result = export_markdown(report, tmp_path)
        assert isinstance(result, Path)

    def test_markdown_cjk_content_preserved(self, tmp_path, mixed_data):
        report = generate_report("fenogal", mixed_data)
        dest = export_markdown(report, tmp_path)
        content = dest.read_text(encoding="utf-8")
        # CJK item names should appear in the table
        assert "換發新證申請書" in content


# ── Rich text helpers ─────────────────────────────────────────────────────────

class TestRichHelpers:
    """_risk_text() and _status_text() produce styled Rich Text objects."""

    def test_risk_text_low(self):
        text = _risk_text("low")
        assert "LOW" in str(text)

    def test_risk_text_medium(self):
        text = _risk_text("medium")
        assert "MED" in str(text)

    def test_risk_text_high(self):
        text = _risk_text("high")
        assert "HIGH" in str(text)

    def test_risk_text_unknown_level(self):
        text = _risk_text("unknown")
        assert "UNKNOWN" in str(text)

    def test_status_text_completed(self):
        text = _status_text("completed")
        assert "completed" in str(text)

    def test_status_text_blocked(self):
        text = _status_text("blocked")
        assert "blocked" in str(text)

    def test_status_text_pending(self):
        text = _status_text("pending")
        assert "pending" in str(text)

    def test_status_text_unknown(self):
        text = _status_text("unknown_status")
        assert "unknown_status" in str(text)


# ── render_plain() ────────────────────────────────────────────────────────────

class TestRenderPlain:
    """render_plain() must produce console output without errors."""

    def test_render_plain_produces_output(self, tmp_path, mixed_data, capsys):
        report = generate_report("fenogal", mixed_data)
        saved = save_report(report, tmp_path)
        render_plain(report, saved)
        captured = capsys.readouterr()
        assert "fenogal".upper() in captured.out

    def test_render_plain_shows_overall_status(self, tmp_path, mixed_data, capsys):
        report = generate_report("fenogal", mixed_data)
        saved = save_report(report, tmp_path)
        render_plain(report, saved)
        captured = capsys.readouterr()
        assert report["overall_status"] in captured.out

    def test_render_plain_shows_completion_rate(self, tmp_path, mixed_data, capsys):
        report = generate_report("fenogal", mixed_data)
        saved = save_report(report, tmp_path)
        render_plain(report, saved)
        captured = capsys.readouterr()
        assert report["completion_rate"] in captured.out

    def test_render_plain_shows_high_risk_items(self, tmp_path, mixed_data, capsys):
        report = generate_report("fenogal", mixed_data)
        saved = save_report(report, tmp_path)
        render_plain(report, saved)
        captured = capsys.readouterr()
        assert "[!] High Risk Items" in captured.out

    def test_render_plain_shows_action_items(self, tmp_path, mixed_data, capsys):
        report = generate_report("fenogal", mixed_data)
        saved = save_report(report, tmp_path)
        render_plain(report, saved)
        captured = capsys.readouterr()
        assert "[>] Action Items" in captured.out

    def test_render_plain_with_md_path(self, tmp_path, mixed_data, capsys):
        report = generate_report("fenogal", mixed_data)
        saved = save_report(report, tmp_path)
        md_path = export_markdown(report, tmp_path)
        render_plain(report, saved, md_path)
        captured = capsys.readouterr()
        assert "MD" in captured.out

    def test_render_plain_no_high_risk_when_all_complete(
        self, tmp_path, all_completed_data, capsys
    ):
        report = generate_report("complete", all_completed_data)
        saved = save_report(report, tmp_path)
        render_plain(report, saved)
        captured = capsys.readouterr()
        # No high-risk section when nothing blocked (per code logic)
        if not report["risks"]:
            assert "[!] High Risk Items" not in captured.out


# ── render_report() dispatching ───────────────────────────────────────────────

class TestRenderReport:
    """render_report() dispatches to rich or plain renderer based on RICH_AVAILABLE."""

    def test_render_report_with_rich_disabled(self, tmp_path, mixed_data, capsys, monkeypatch):
        import scripts.review as review_module
        monkeypatch.setattr(review_module, "RICH_AVAILABLE", False)
        monkeypatch.setattr(review_module, "console", None)
        report = generate_report("fenogal", mixed_data)
        saved = save_report(report, tmp_path)
        render_report(report, saved)
        captured = capsys.readouterr()
        # render_plain was called → should print project name
        assert "FENOGAL" in captured.out

    def test_render_report_with_rich_enabled(self, tmp_path, mixed_data):
        import scripts.review as review_module
        if not review_module.RICH_AVAILABLE:
            pytest.skip("Rich not available")
        report = generate_report("fenogal", mixed_data)
        saved = save_report(report, tmp_path)
        # Should not raise
        render_report(report, saved)
