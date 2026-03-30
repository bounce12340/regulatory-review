#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Multi-provider LLM client for TFDA regulatory gap analysis.
Supports: Anthropic (Claude), OpenAI (GPT-4), Google (Gemini).
"""

from __future__ import annotations

import json
import os
from typing import Optional

SYSTEM_PROMPT = """你是一位資深的台灣 TFDA（食品藥物管理署）法規事務專家，
擁有超過 15 年藥品、食品及醫療器材查驗登記的實務經驗。

你的任務是分析查驗登記申請文件，找出與 TFDA 法規要求之間的缺口，並提供具體的補正建議。

分析準則：
1. 嚴格依照 TFDA 現行法規要求進行比對
2. 識別文件類型（藥品/食品/器材查驗登記）
3. 逐一核查每個法規要求項目的完整性
4. 標註缺失、不完整或格式不符的項目
5. 評估每個缺口的嚴重程度（high/medium/low）
6. 提供具體、可執行的補正建議
7. 評估整體風險等級及預估審查時程

回應語言：繁體中文
專業術語：使用 RA（Regulatory Affairs）標準術�
輸出格式：嚴格遵循指定的 JSON 格式"""


def _build_analysis_prompt(doc_text: str, project_type: str,
                            requirements_text: str, filename: str) -> str:
    return f"""請分析以下法規申請文件，並與 TFDA 要求進行比對，生成缺口分析報告。

## 文件資訊
- 檔案名稱：{filename}
- 申請類型：{project_type}

## TFDA 法規要求清單
{requirements_text}

## 待分析文件內容
{doc_text}

---

請根據以上文件內容，對每個 TFDA 要求項目進行分析，並以下列 JSON 格式回應：

```json
{{
  "document_type": "<申請類型，如 drug_registration_extension>",
  "detected_type_zh": "<中文說明，如 藥品查驗登記展延>",
  "completeness_score": <0-100 整數，代表文件完整性百分比>,
  "gaps": [
    {{
      "requirement_key": "<項目 key，如 item1>",
      "requirement": "<要求項目名稱>",
      "status": "<present|missing|incomplete|non_compliant>",
      "severity": "<high|medium|low>",
      "explanation": "<說明為何缺失或不符合要求，50 字以內>",
      "recommendation": "<具體補正建議，50 字以內>"
    }}
  ],
  "compliant_items": ["<已符合的項目 key 列表>"],
  "risk_assessment": "<high|medium|low>",
  "estimated_review_time": "<預估審查時間，如 8-12_hours>",
  "summary": "<整體評估摘要，100 字以內>",
  "action_items": [
    "<優先處理項目 1>",
    "<優先處理項目 2>"
  ]
}}
```

重要：
- 只回傳 JSON，不需要其他說明文字
- 若文件內容不足以判斷某項目，標記為 incomplete 而非 missing
- severity 判斷基準：high=必要項目完全缺失, medium=部分不符合, low=格式/細節問題
- 請務必分析所有要求項目，不可遺漏"""


def _detect_provider(api_key: str) -> str:
    """Detect provider from API key format."""
    if not api_key:
        return "anthropic"  # default
    key_lower = api_key.lower()
    if key_lower.startswith("sk-ant"):
        return "anthropic"
    if key_lower.startswith("ai"):
        return "gemini"
    return "openai"  # sk-... and others default to OpenAI


class MultiProviderLLMClient:
    """
    Unified LLM client that routes to Anthropic / OpenAI / Gemini
    based on the api_key prefix or explicit provider parameter.
    """

    # Pricing per 1M tokens (input / output) — NTD at ~32
    PRICING = {
        "anthropic": {"input": 5.0, "output": 25.0},   # Claude Opus 4.6
        "openai":    {"input": 2.5, "output": 10.0},   # GPT-4 Turbo
        "gemini":    {"input": 0.0, "output": 0.0},    # pay-as-you-go
    }

    MAX_INPUT_CHARS = 80_000

    def __init__(self, api_key: Optional[str] = None, provider: Optional[str] = None):
        self._api_key = api_key or os.getenv("ANTHROPIC_API_KEY", "")
        self._provider = provider or _detect_provider(self._api_key)
        self._client = None
        self._last_input_tokens = 0
        self._last_output_tokens = 0

    def _get_client(self):
        if self._client is None:
            key = self._api_key
            if not key:
                raise ValueError(
                    f"No API key set for provider {self._provider}. "
                    "Please provide an API key."
                )
            if self._provider == "anthropic":
                import anthropic
                self._client = anthropic.Anthropic(api_key=key)
            elif self._provider == "openai":
                import openai
                self._client = openai.OpenAI(api_key=key)
            elif self._provider == "gemini":
                import google.generativeai as gemini
                gemini.configure(api_key=key)
                self._client = gemini
            else:
                raise ValueError(f"Unknown provider: {self._provider}")
        return self._client

    def analyze_document(
        self,
        doc_text: str,
        project_type: str,
        requirements_text: str,
        filename: str = "document",
    ) -> dict:
        client = self._get_client()

        if len(doc_text) > self.MAX_INPUT_CHARS:
            doc_text = (
                doc_text[: self.MAX_INPUT_CHARS]
                + "\n\n[文件過長，已截斷至前 80,000 字元進行分析]"
            )

        prompt = _build_analysis_prompt(doc_text, project_type,
                                        requirements_text, filename)

        if self._provider == "anthropic":
            result_text = self._call_anthropic(client, prompt)
        elif self._provider == "openai":
            result_text = self._call_openai(client, prompt)
        elif self._provider == "gemini":
            result_text = self._call_gemini(client, prompt)
        else:
            raise ValueError(f"Unknown provider: {self._provider}")

        return self._parse_json_response(result_text)

    def _call_anthropic(self, client, prompt: str) -> str:
        result_text = ""
        with client.messages.stream(
            model="claude-opus-4-6",
            max_tokens=8192,
            thinking={"type": "adaptive"},
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        ) as stream:
            for text in stream.text_stream:
                result_text += text
            final = stream.get_final_message()
            self._last_input_tokens = final.usage.input_tokens
            self._last_output_tokens = final.usage.output_tokens
        return result_text

    def _call_openai(self, client, prompt: str) -> str:
        response = client.chat.completions.create(
            model="gpt-4-turbo",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            max_tokens=8192,
            temperature=0,
        )
        msg = response.choices[0].message
        self._last_input_tokens = response.usage.prompt_tokens
        self._last_output_tokens = response.usage.completion_tokens
        return msg.content or ""

    def _call_gemini(self, client, prompt: str) -> str:
        model = client.get_model("gemini-2.0-flash")
        response = client.generate_text(
            model=model,
            prompt=prompt,
            temperature=0,
            max_output_tokens=8192,
        )
        # Gemini returns text directly
        self._last_input_tokens = 0  # not exposed
        self._last_output_tokens = 0
        return response.result or ""

    def estimate_cost_ntd(self) -> float:
        pricing = self.PRICING.get(self._provider, {"input": 0, "output": 0})
        input_cost = self._last_input_tokens / 1_000_000 * pricing["input"]
        output_cost = self._last_output_tokens / 1_000_000 * pricing["output"]
        return round((input_cost + output_cost) * 32, 2)

    @property
    def last_token_usage(self) -> dict:
        return {
            "input_tokens": self._last_input_tokens,
            "output_tokens": self._last_output_tokens,
        }

    # ── Internal helpers ───────────────────────────────────────────────────

    @staticmethod
    def _parse_json_response(text: str) -> dict:
        text = text.strip()
        if "```json" in text:
            start = text.find("```json") + 7
            end = text.rfind("```")
            text = text[start:end].strip()
        elif "```" in text:
            start = text.find("```") + 3
            end = text.rfind("```")
            text = text[start:end].strip()
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return {
                "document_type": "unknown",
                "completeness_score": 0,
                "gaps": [],
                "risk_assessment": "high",
                "summary": f"JSON 解析失敗。原始回應：{text[:300]}",
                "action_items": ["請重新分析"],
                "_parse_error": True,
            }


# Backwards compatibility alias
TFDAAnalysisClient = MultiProviderLLMClient
