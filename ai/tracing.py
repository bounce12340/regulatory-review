#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Optional Future AGI tracing for the LLM gap-analysis calls.

Off unless both FI_API_KEY and FI_SECRET_KEY are set and
requirements-tracing.txt is installed; otherwise llm_span() is a no-op and
the app behaves exactly as before.

The span is recorded by hand around MultiProviderLLMClient's single model
call rather than by patching the provider SDKs, so it covers Anthropic,
OpenAI and Gemini alike and does not depend on which SDK versions are
installed (traceAI's Anthropic instrumentor does not support anthropic>=1.0).

Settings (environment variables):
    FI_API_KEY / FI_SECRET_KEY   Future AGI credentials (required to enable)
    FI_PROJECT_NAME              Project shown in Future AGI (default: regulatory-review)
    FI_BASE_URL                  Collector base URL (SDK default: https://api.futureagi.com)
    FI_HIDE_INPUTS / FI_HIDE_OUTPUTS
                                 "true" keeps the prompt (which contains the
                                 uploaded document text) / the model response
                                 out of the span; model, tokens and timing are
                                 still sent.
"""

from __future__ import annotations

import logging
import os
from contextlib import contextmanager

logger = logging.getLogger(__name__)

DEFAULT_PROJECT_NAME = "regulatory-review"

# None = not attempted yet; True/False = result of the one attempt. Streamlit
# reruns the script on every interaction, so this must stay process-wide.
_enabled: bool | None = None
_tracer = None


def tracing_configured() -> bool:
    """True when the Future AGI credentials are present in the environment."""
    return bool(os.getenv("FI_API_KEY")) and bool(os.getenv("FI_SECRET_KEY"))


def enable_tracing() -> bool:
    """Register the Future AGI tracer once. Returns whether tracing is active.

    Never raises: a missing package or a registration failure is logged and
    the app keeps running untraced.
    """
    global _enabled, _tracer
    if _enabled is not None:
        return _enabled
    _enabled = False
    if not tracing_configured():
        return False

    try:
        from fi_instrumentation import register
        from fi_instrumentation.fi_types import ProjectType
    except ImportError:
        logger.warning(
            "FI_API_KEY is set but fi-instrumentation-otel is not installed; "
            "install requirements-tracing.txt to enable Future AGI tracing."
        )
        return False

    try:
        tracer_provider = register(
            project_name=os.getenv("FI_PROJECT_NAME") or DEFAULT_PROJECT_NAME,
            project_type=ProjectType.OBSERVE,
        )
        _tracer = tracer_provider.get_tracer(__name__)
    except Exception as exc:  # network/config errors must not break analysis
        logger.warning("Future AGI tracing disabled: register() failed: %s", exc)
        return False

    _enabled = True
    logger.info("Future AGI tracing enabled.")
    return True


def _hidden(env_var: str) -> bool:
    return os.getenv(env_var, "").strip().lower() in ("1", "true", "yes")


class _NoopSpan:
    def record(self, output_text: str, input_tokens: int, output_tokens: int) -> None:
        pass


class _LlmSpan:
    def __init__(self, span):
        self._span = span

    def record(self, output_text: str, input_tokens: int, output_tokens: int) -> None:
        span = self._span
        if not _hidden("FI_HIDE_OUTPUTS"):
            span.set_attribute("output.value", output_text)
            span.set_attribute("output.mime_type", "text/plain")
        # Gemini reports no usage here (0/0); leave the counts off rather than
        # claim a zero-token call.
        if input_tokens or output_tokens:
            span.set_attribute("gen_ai.usage.input_tokens", input_tokens)
            span.set_attribute("gen_ai.usage.output_tokens", output_tokens)
            span.set_attribute("gen_ai.usage.total_tokens", input_tokens + output_tokens)


@contextmanager
def llm_span(name: str, *, provider: str, model: str, prompt: str):
    """Record one LLM call as a Future AGI LLM span (no-op when disabled).

    Yields an object whose record(output_text, input_tokens, output_tokens)
    fills in the result; an exception inside the block marks the span failed
    and is re-raised unchanged.
    """
    if not enable_tracing() or _tracer is None:
        yield _NoopSpan()
        return

    from opentelemetry.trace import Status, StatusCode

    with _tracer.start_as_current_span(name, record_exception=False) as span:
        span.set_attribute("gen_ai.span.kind", "LLM")
        span.set_attribute("gen_ai.operation.name", "chat")
        span.set_attribute("gen_ai.provider.name", provider)
        span.set_attribute("gen_ai.request.model", model)
        if not _hidden("FI_HIDE_INPUTS"):
            span.set_attribute("input.value", prompt)
            span.set_attribute("input.mime_type", "text/plain")
        try:
            yield _LlmSpan(span)
        except Exception as exc:
            span.record_exception(exc)
            span.set_status(Status(StatusCode.ERROR, type(exc).__name__))
            raise
