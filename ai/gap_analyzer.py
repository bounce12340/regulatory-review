#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gap analysis engine — orchestrates document parsing, RAG retrieval,
and LLM analysis to produce TFDA compliance gap reports.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional

import yaml

from .upload_handler import DocumentParser
from .llm_client import TFDAAnalysisClient
from .vector_store import RegulationVectorStore, RegRequirement


# ── Schema type aliases ─────────────────────────────────────────────────────

SCHEMA_TYPE_MAP = {
    "drug_registration_extension": "藥品查驗登記展延",
    "food_registration": "食品查驗登記",
    "medical_device_registration": "醫療器材查驗登記",
}

SCHEMA_DISPLAY_NAMES = {
    "藥品查驗登記展延": "drug_registration_extension",
    "食品查驗登記": "food_registration",
    "醫療器材查驗登記": "medical_device_registration",
    # English
    "Drug Registration Extension": "drug_registration_extension",
    "Food Registration": "food_registration",
    "Medical Device Registration": "medical_device_registration",
}


@dataclass
class GapItem:
    requirement_key: str
    requirement: str
    status: str            # present | missing | incomplete | non_compliant
    severity: str          # high | medium | low
    explanation: str
    recommendation: str


@dataclass
class GapReport:
    filename: str
    project_type: str
    project_type_zh: str
    completeness_score: int
    gaps: List[GapItem] = field(default_factory=list)
    compliant_items: List[str] = field(default_factory=list)
    risk_assessment: str = "unknown"
    estimated_review_time: str = "N/A"
    summary: str = ""
    action_items: List[str] = field(default_factory=list)
    token_usage: Dict[str, int] = field(default_factory=dict)
    cost_ntd: float = 0.0
    error: Optional[str] = None

    # ── Derived properties ──────────────────────────────────────────────

    @property
    def high_gaps(self) -> List[GapItem]:
        return [g for g in self.gaps if g.severity == "high"]

    @property
    def medium_gaps(self) -> List[GapItem]:
        return [g for g in self.gaps if g.severity == "medium"]

    @property
    def low_gaps(self) -> List[GapItem]:
        return [g for g in self.gaps if g.severity == "low"]

    def to_dict(self) -> dict:
        return {
            "filename": self.filename,
            "project_type": self.project_type,
            "project_type_zh": self.project_type_zh,
            "completeness_score": self.completeness_score,
            "gaps": [
                {
                    "requirement_key": g.requirement_key,
                    "requirement": g.requirement,
                    "status": g.status,
                    "severity": g.severity,
                    "explanation": g.explanation,
                    "recommendation": g.recommendation,
                }
                for g in self.gaps
            ],
            "compliant_items": self.compliant_items,
            "risk_assessment": self.risk_assessment,
            "estimated_review_time": self.estimated_review_time,
            "summary": self.summary,
            "action_items": self.action_items,
            "token_usage": self.token_usage,
            "cost_ntd": self.cost_ntd,
        }

    def to_markdown(self) -> str:
        lines = [
            f"# TFDA 法規缺口分析報告",
            f"",
            f"**文件**：{self.filename}",
            f"**申請類型**：{self.project_type_zh}",
            f"**完整度評分**：{self.completeness_score}/100",
            f"**風險等級**：{self.risk_assessment.upper()}",
            f"**預估審查時間**：{self.estimated_review_time}",
            f"",
            f"## 摘要",
            f"{self.summary}",
            f"",
            f"## 缺口清單",
        ]
        if not self.gaps:
            lines.append("無發現缺口 — 文件符合所有要求。")
        else:
            sev_icon = {"high": "🔴", "medium": "🟡", "low": "🟢"}
            for g in self.gaps:
                icon = sev_icon.get(g.severity, "⚪")
                lines += [
                    f"",
                    f"### {icon} {g.requirement}",
                    f"- **狀態**：{g.status}",
                    f"- **嚴重程度**：{g.severity}",
                    f"- **說明**：{g.explanation}",
                    f"- **建議**：{g.recommendation}",
                ]
        lines += [
            f"",
            f"## 優先處理項目",
        ]
        for i, item in enumerate(self.action_items, 1):
            lines.append(f"{i}. {item}")
        return "\n".join(lines)


class GapAnalyzer:
    """
    Orchestrates document parsing → requirement retrieval → LLM gap analysis.
    """

    _SCHEMA_PATH = Path(__file__).parent.parent / "config" / "regulatory_schemas.yaml"

    def __init__(self, api_key: Optional[str] = None):
        self._parser = DocumentParser()
        self._llm = TFDAAnalysisClient(api_key=api_key)
        self._vector_store = RegulationVectorStore()
        self._schemas: dict = {}
        self._load_schemas()

    # ── Public API ──────────────────────────────────────────────────────────

    def analyze(
        self,
        file_bytes: bytes,
        filename: str,
        project_type: str,
    ) -> GapReport:
        """
        Full pipeline: parse → retrieve relevant reqs → LLM analysis.

        Args:
            file_bytes: Raw file content.
            filename: Original filename (used for type detection).
            project_type: Schema key or display name (e.g. "food_registration").

        Returns:
            GapReport with full analysis.
        """
        # Normalise project_type to internal schema key
        schema_key = SCHEMA_DISPLAY_NAMES.get(project_type, project_type)
        schema_type_zh = SCHEMA_TYPE_MAP.get(schema_key, project_type)

        # 1. Parse document
        doc = self._parser.parse(file_bytes, filename)
        if doc.error:
            return GapReport(
                filename=filename,
                project_type=schema_key,
                project_type_zh=schema_type_zh,
                completeness_score=0,
                error=f"文件解析失敗：{doc.error}",
            )

        # 2. Load requirements into vector store for this schema type
        self._vector_store.load_from_schema(self._schemas, schema_key)
        requirements = self._vector_store.get_all(schema_key)

        # 3. Build requirements text for the prompt
        requirements_text = self._format_requirements(requirements)

        # 4. Prepare document text — use full text (up to LLM limit)
        doc_text = doc.raw_text.strip() or "(文件內容為空)"

        # 5. Call LLM
        try:
            raw = self._llm.analyze_document(
                doc_text=doc_text,
                project_type=schema_key,
                requirements_text=requirements_text,
                filename=filename,
            )
        except Exception as exc:
            return GapReport(
                filename=filename,
                project_type=schema_key,
                project_type_zh=schema_type_zh,
                completeness_score=0,
                error=f"LLM 分析失敗：{exc}",
            )

        # 6. Parse LLM response into GapReport
        return self._build_report(raw, filename, schema_key, schema_type_zh)

    def get_available_schema_types(self) -> List[str]:
        return list(self._schemas.get("schemas", {}).keys())

    # ── Internals ───────────────────────────────────────────────────────────

    def _load_schemas(self) -> None:
        try:
            with open(self._SCHEMA_PATH, encoding="utf-8") as f:
                self._schemas = yaml.safe_load(f) or {}
        except Exception:
            self._schemas = {}

    @staticmethod
    def _format_requirements(requirements: List[RegRequirement]) -> str:
        lines = []
        for r in requirements:
            req_str = f"必要" if r.required else "選填"
            lines.append(
                f"- [{r.key}] {r.label} ({r.category}) [{req_str}]\n"
                f"  補正建議參考：{r.action}"
            )
        return "\n".join(lines)

    def _build_report(
        self, raw: dict, filename: str,
        schema_key: str, schema_type_zh: str,
    ) -> GapReport:
        gaps = []
        for g in raw.get("gaps", []):
            gaps.append(GapItem(
                requirement_key=g.get("requirement_key", ""),
                requirement=g.get("requirement", ""),
                status=g.get("status", "unknown"),
                severity=g.get("severity", "medium"),
                explanation=g.get("explanation", ""),
                recommendation=g.get("recommendation", ""),
            ))

        report = GapReport(
            filename=filename,
            project_type=raw.get("document_type", schema_key),
            project_type_zh=raw.get("detected_type_zh", schema_type_zh),
            completeness_score=int(raw.get("completeness_score", 0)),
            gaps=gaps,
            compliant_items=raw.get("compliant_items", []),
            risk_assessment=raw.get("risk_assessment", "unknown"),
            estimated_review_time=raw.get("estimated_review_time", "N/A"),
            summary=raw.get("summary", ""),
            action_items=raw.get("action_items", []),
            token_usage=self._llm.last_token_usage,
            cost_ntd=self._llm.estimate_cost_ntd(),
        )
        return report
