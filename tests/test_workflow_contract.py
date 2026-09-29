"""Regression checks for the GitHub Actions quality-gate contract."""
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github/workflows/tests.yml"


def workflow():
    return yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))


def test_required_install_test_and_quality_gates_propagate_failures():
    jobs = workflow()["jobs"]
    steps = jobs["test"]["steps"] + jobs["lint"]["steps"]
    required_names = {
        "Install dependencies",
        "Run test suite",
        "Run flake8",
        "Check black formatting",
    }
    required = [step for step in steps if step.get("name") in required_names]
    assert {step["name"] for step in required} == required_names
    for step in required:
        assert step.get("continue-on-error") is not True, step["name"]
        assert "|| true" not in step.get("run", ""), step["name"]


def test_test_gate_keeps_explicit_optional_ai_skip_and_coverage_floor():
    job = workflow()["jobs"]["test"]
    install = next(s for s in job["steps"] if s.get("name") == "Install dependencies")
    tests = next(s for s in job["steps"] if s.get("name") == "Run test suite")
    assert "pip install -r requirements.txt" in install["run"]
    assert "pytest tests/" in tests["run"]
    assert "--cov-fail-under=80" in tests["run"]
    assert tests["env"]["SKIP_AI_TESTS"] == "1"
    assert "--cov-config=.coveragerc" not in tests["run"]
    assert not (ROOT / ".coveragerc").exists()


def test_optional_report_upload_does_not_gate_required_checks():
    steps = workflow()["jobs"]["test"]["steps"]
    codecov = next(s for s in steps if s.get("uses", "").startswith("codecov/"))
    artifact = next(s for s in steps if s.get("uses", "").startswith("actions/upload-artifact@"))
    assert codecov.get("if", "").startswith("always()")
    assert codecov.get("with", {}).get("fail_ci_if_error") is False
    assert artifact.get("if", "").startswith("always()")
    assert artifact.get("with", {}).get("if-no-files-found") == "ignore"
    assert all(step.get("continue-on-error") is not True for step in (codecov, artifact))


def test_lint_quality_commands_are_not_masked():
    steps = workflow()["jobs"]["lint"]["steps"]
    flake = next(s for s in steps if s.get("name") == "Run flake8")
    black = next(s for s in steps if s.get("name") == "Check black formatting")
    assert "flake8 scripts/ database/ auth/ ai/" in flake["run"]
    assert "black --check --line-length=110" in black["run"]
    assert "|| true" not in flake["run"] + black["run"]
