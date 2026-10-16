#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Tests for the optional Future AGI tracing hook (ai/tracing.py).

The first group runs everywhere and pins the "off by default, never breaks
the app" contract. The span tests need opentelemetry-sdk (installed by
requirements-tracing.txt) and are skipped without it; they drive a real
Anthropic SDK call through a mocked HTTP transport into an in-memory span
exporter, so nothing leaves the machine.
"""

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

import ai.tracing as tracing

FI_ENV_VARS = (
    "FI_API_KEY", "FI_SECRET_KEY", "FI_PROJECT_NAME", "FI_BASE_URL",
    "FI_HIDE_INPUTS", "FI_HIDE_OUTPUTS",
)

PROMPT_MARKER = "UNIQUE-DOCUMENT-TEXT-1234"
ANALYSIS = {
    "document_type": "drug_registration_extension",
    "completeness_score": 80,
    "gaps": [],
    "risk_assessment": "low",
    "summary": "SUMMARY-MARKER",
    "action_items": [],
}


@pytest.fixture(autouse=True)
def clean_tracing_state(monkeypatch):
    for name in FI_ENV_VARS:
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setattr(tracing, "_enabled", None)
    monkeypatch.setattr(tracing, "_tracer", None)


# ── Mocked Anthropic SDK ────────────────────────────────────────────────────

def _sse(event, data):
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def _anthropic_stream_body(text):
    message = {
        "id": "msg_test", "type": "message", "role": "assistant",
        "model": "claude-opus-4-6", "content": [], "stop_reason": None,
        "stop_sequence": None, "usage": {"input_tokens": 120, "output_tokens": 1},
    }
    return "".join([
        _sse("message_start", {"type": "message_start", "message": message}),
        _sse("content_block_start", {"type": "content_block_start", "index": 0,
                                     "content_block": {"type": "text", "text": ""}}),
        _sse("content_block_delta", {"type": "content_block_delta", "index": 0,
                                     "delta": {"type": "text_delta", "text": text}}),
        _sse("content_block_stop", {"type": "content_block_stop", "index": 0}),
        _sse("message_delta", {"type": "message_delta",
                               "delta": {"stop_reason": "end_turn", "stop_sequence": None},
                               "usage": {"output_tokens": 42}}),
        _sse("message_stop", {"type": "message_stop"}),
    ])


def _mocked_client(status=200):
    anthropic = pytest.importorskip("anthropic")
    try:  # anthropic>=1.x ships its own httpx fork and rejects plain httpx objects
        import httpx2 as httpx
    except ImportError:
        import httpx

    from ai.llm_client import MultiProviderLLMClient

    def handler(request):
        if status != 200:
            return httpx.Response(status, json={"type": "error", "error": {
                "type": "api_error", "message": "upstream failed"}})
        return httpx.Response(200, headers={"content-type": "text/event-stream"},
                              text=_anthropic_stream_body(json.dumps(ANALYSIS)))

    client = MultiProviderLLMClient(api_key="sk-ant-test")
    client._client = anthropic.Anthropic(
        api_key="sk-ant-test", max_retries=0,
        http_client=httpx.Client(transport=httpx.MockTransport(handler)),
    )
    return client


def _analyze(client):
    return client.analyze_document(
        doc_text=PROMPT_MARKER, project_type="drug_registration_extension",
        requirements_text="item1: 許可證", filename="test.pdf",
    )


# ── Off by default ──────────────────────────────────────────────────────────

@pytest.mark.unit
def test_disabled_without_credentials():
    assert tracing.tracing_configured() is False
    assert tracing.enable_tracing() is False


@pytest.mark.unit
def test_one_credential_is_not_enough(monkeypatch):
    monkeypatch.setenv("FI_API_KEY", "key-only")
    assert tracing.enable_tracing() is False


@pytest.mark.unit
def test_result_is_cached(monkeypatch):
    assert tracing.enable_tracing() is False
    # Credentials appearing later do not re-run registration in this process.
    monkeypatch.setenv("FI_API_KEY", "k")
    monkeypatch.setenv("FI_SECRET_KEY", "s")
    assert tracing.enable_tracing() is False


@pytest.mark.unit
def test_missing_package_disables_instead_of_raising(monkeypatch):
    monkeypatch.setenv("FI_API_KEY", "k")
    monkeypatch.setenv("FI_SECRET_KEY", "s")
    monkeypatch.setitem(sys.modules, "fi_instrumentation", None)  # import fails
    assert tracing.enable_tracing() is False


@pytest.mark.unit
def test_register_failure_disables_instead_of_raising(monkeypatch):
    fi_instrumentation = pytest.importorskip("fi_instrumentation")

    def boom(**kwargs):
        raise RuntimeError("collector unreachable")

    monkeypatch.setenv("FI_API_KEY", "k")
    monkeypatch.setenv("FI_SECRET_KEY", "s")
    monkeypatch.setattr(fi_instrumentation, "register", boom)
    assert tracing.enable_tracing() is False


@pytest.mark.unit
def test_analysis_unchanged_when_tracing_is_off():
    result = _analyze(_mocked_client())
    assert result["completeness_score"] == 80
    assert tracing._tracer is None


# ── Span contents ───────────────────────────────────────────────────────────

@pytest.fixture
def exporter(monkeypatch):
    """Route llm_span() into an in-memory exporter instead of Future AGI."""
    pytest.importorskip("opentelemetry.sdk")
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import SimpleSpanProcessor
    from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter

    memory = InMemorySpanExporter()
    provider = TracerProvider()
    provider.add_span_processor(SimpleSpanProcessor(memory))
    monkeypatch.setattr(tracing, "_enabled", True)
    monkeypatch.setattr(tracing, "_tracer", provider.get_tracer("test"))
    return memory


def _only_span(memory):
    spans = memory.get_finished_spans()
    assert len(spans) == 1
    return spans[0]


@pytest.mark.unit
def test_analysis_records_one_llm_span(exporter):
    result = _analyze(_mocked_client())

    assert result["completeness_score"] == 80  # the app result is untouched
    span = _only_span(exporter)
    attrs = span.attributes
    assert span.name == "tfda_gap_analysis"
    assert attrs["gen_ai.span.kind"] == "LLM"
    assert attrs["gen_ai.provider.name"] == "anthropic"
    assert attrs["gen_ai.request.model"] == "claude-opus-4-6"
    assert attrs["gen_ai.usage.input_tokens"] == 120
    assert attrs["gen_ai.usage.output_tokens"] == 42
    assert attrs["gen_ai.usage.total_tokens"] == 162
    assert PROMPT_MARKER in attrs["input.value"]
    assert "SUMMARY-MARKER" in attrs["output.value"]


@pytest.mark.unit
def test_hide_flags_keep_document_and_response_text_out(exporter, monkeypatch):
    monkeypatch.setenv("FI_HIDE_INPUTS", "true")
    monkeypatch.setenv("FI_HIDE_OUTPUTS", "true")
    _analyze(_mocked_client())

    attrs = _only_span(exporter).attributes
    values = " ".join(str(v) for v in attrs.values())
    assert PROMPT_MARKER not in values
    assert "SUMMARY-MARKER" not in values
    assert "input.value" not in attrs and "output.value" not in attrs
    assert attrs["gen_ai.usage.input_tokens"] == 120  # metadata still sent


@pytest.mark.unit
def test_failed_call_marks_span_and_reraises(exporter):
    anthropic = pytest.importorskip("anthropic")
    from opentelemetry.trace import StatusCode

    with pytest.raises(anthropic.APIStatusError):
        _analyze(_mocked_client(status=500))

    span = _only_span(exporter)
    assert span.status.status_code == StatusCode.ERROR
    assert "output.value" not in span.attributes


@pytest.mark.unit
def test_zero_usage_is_left_off_the_span(exporter):
    # Gemini's legacy text API reports no usage; don't claim a 0-token call.
    with tracing.llm_span("x", provider="gemini", model="gemini-2.0-flash", prompt="p") as span:
        span.record("out", 0, 0)
    attrs = _only_span(exporter).attributes
    assert "gen_ai.usage.input_tokens" not in attrs
    assert attrs["output.value"] == "out"
