#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Regulation vector store.
Uses ChromaDB when available; falls back to keyword-based TF-IDF scoring.
"""

from __future__ import annotations

import re
import math
from collections import Counter
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple


@dataclass
class RegRequirement:
    key: str
    label: str
    label_en: str
    category: str
    required: bool
    action: str
    schema_type: str   # "drug_registration_extension" | "food_registration" | ...


class RegulationVectorStore:
    """
    Stores TFDA regulatory requirements and provides similarity search.

    Priority:
      1. ChromaDB (persistent, embedding-based)
      2. In-memory keyword TF-IDF (always available)
    """

    _CHROMA_COLLECTION = "tfda_regulations"

    def __init__(self, persist_dir: Optional[str] = None):
        self._requirements: List[RegRequirement] = []
        self._chroma_client = None
        self._chroma_collection = None
        self._persist_dir = persist_dir
        self._tfidf_index: Dict[str, List[float]] = {}
        self._vocab: List[str] = []

        self._try_init_chroma()

    # ── Public API ─────────────────────────────────────────────────────────

    def load_from_schema(self, schemas: dict, schema_type: Optional[str] = None) -> None:
        """Populate store from regulatory_schemas.yaml structure."""
        schema_map = schemas.get("schemas", {})
        target_types = [schema_type] if schema_type else list(schema_map.keys())

        self._requirements.clear()
        for stype in target_types:
            schema = schema_map.get(stype, {})
            for item in schema.get("items", []):
                self._requirements.append(RegRequirement(
                    key=item["key"],
                    label=item["label"],
                    label_en=item.get("action", item["label"]),
                    category=item.get("category", "general"),
                    required=item.get("required", True),
                    action=item.get("action", ""),
                    schema_type=stype,
                ))

        if self._chroma_client:
            self._index_chroma()
        else:
            self._build_tfidf_index()

    def search(self, query: str, top_k: int = 5,
               schema_type: Optional[str] = None) -> List[Tuple[RegRequirement, float]]:
        """Return top-k requirements most relevant to the query."""
        candidates = [r for r in self._requirements
                      if schema_type is None or r.schema_type == schema_type]
        if not candidates:
            return []

        if self._chroma_collection:
            return self._search_chroma(query, top_k, schema_type)
        return self._search_tfidf(query, top_k, candidates)

    def get_all(self, schema_type: Optional[str] = None) -> List[RegRequirement]:
        if schema_type:
            return [r for r in self._requirements if r.schema_type == schema_type]
        return list(self._requirements)

    # ── ChromaDB ───────────────────────────────────────────────────────────

    def _try_init_chroma(self) -> None:
        try:
            import chromadb  # type: ignore
            if self._persist_dir:
                self._chroma_client = chromadb.PersistentClient(path=self._persist_dir)
            else:
                self._chroma_client = chromadb.EphemeralClient()
            self._chroma_collection = self._chroma_client.get_or_create_collection(
                name=self._CHROMA_COLLECTION,
                metadata={"hnsw:space": "cosine"},
            )
        except Exception:
            # ChromaDB not installed or failed — use TF-IDF fallback
            self._chroma_client = None
            self._chroma_collection = None

    def _index_chroma(self) -> None:
        if not self._chroma_collection:
            return
        try:
            # Rebuild collection
            ids = [f"{r.schema_type}_{r.key}" for r in self._requirements]
            docs = [f"{r.label} {r.action} {r.category}" for r in self._requirements]
            metas = [{"schema_type": r.schema_type, "key": r.key,
                      "required": str(r.required)} for r in self._requirements]
            self._chroma_collection.upsert(ids=ids, documents=docs, metadatas=metas)
        except Exception:
            pass

    def _search_chroma(self, query: str, top_k: int,
                       schema_type: Optional[str]) -> List[Tuple[RegRequirement, float]]:
        where = {"schema_type": schema_type} if schema_type else None
        try:
            results = self._chroma_collection.query(
                query_texts=[query],
                n_results=min(top_k, len(self._requirements)),
                where=where,
            )
            ids = results["ids"][0]
            distances = results["distances"][0]
            out = []
            for rid, dist in zip(ids, distances):
                req = next((r for r in self._requirements
                            if f"{r.schema_type}_{r.key}" == rid), None)
                if req:
                    out.append((req, 1.0 - dist))  # cosine similarity
            return out
        except Exception:
            # Fall back to TF-IDF on chroma error
            candidates = [r for r in self._requirements
                          if schema_type is None or r.schema_type == schema_type]
            return self._search_tfidf(query, top_k, candidates)

    # ── TF-IDF fallback ────────────────────────────────────────────────────

    def _tokenize(self, text: str) -> List[str]:
        text = text.lower()
        # Keep CJK characters as individual tokens; split latin on non-alpha
        tokens = re.findall(r'[\u4e00-\u9fff]|[a-z]+', text)
        return tokens

    def _build_tfidf_index(self) -> None:
        docs = [f"{r.label} {r.action} {r.category}" for r in self._requirements]
        if not docs:
            return

        # Build vocabulary
        vocab_counter: Counter = Counter()
        tokenized = [self._tokenize(d) for d in docs]
        for tokens in tokenized:
            vocab_counter.update(set(tokens))
        self._vocab = [t for t, _ in vocab_counter.most_common(500)]
        vocab_index = {t: i for i, t in enumerate(self._vocab)}

        N = len(docs)
        idf = {}
        for term in self._vocab:
            df = sum(1 for tokens in tokenized if term in tokens)
            idf[term] = math.log((N + 1) / (df + 1)) + 1.0

        def tfidf_vec(tokens: List[str]) -> List[float]:
            tf = Counter(tokens)
            total = max(len(tokens), 1)
            vec = [0.0] * len(self._vocab)
            for term, idx in vocab_index.items():
                vec[idx] = (tf[term] / total) * idf[term]
            norm = math.sqrt(sum(v * v for v in vec)) or 1.0
            return [v / norm for v in vec]

        self._tfidf_index = {
            f"{r.schema_type}_{r.key}": tfidf_vec(tokens)
            for r, tokens in zip(self._requirements, tokenized)
        }
        self._tfidf_idf = idf
        self._vocab_index = vocab_index

    def _search_tfidf(self, query: str, top_k: int,
                      candidates: List[RegRequirement]) -> List[Tuple[RegRequirement, float]]:
        if not self._vocab:
            # No index yet — return all with equal score
            return [(r, 1.0) for r in candidates[:top_k]]

        q_tokens = self._tokenize(query)
        q_vec = [0.0] * len(self._vocab)
        tf = Counter(q_tokens)
        total = max(len(q_tokens), 1)
        for term, idx in self._vocab_index.items():
            idf = self._tfidf_idf.get(term, 1.0)
            q_vec[idx] = (tf[term] / total) * idf
        norm = math.sqrt(sum(v * v for v in q_vec)) or 1.0
        q_vec = [v / norm for v in q_vec]

        scored = []
        for r in candidates:
            rid = f"{r.schema_type}_{r.key}"
            d_vec = self._tfidf_index.get(rid, [])
            if not d_vec:
                continue
            score = sum(a * b for a, b in zip(q_vec, d_vec))
            scored.append((r, score))

        scored.sort(key=lambda x: x[1], reverse=True)
        return scored[:top_k]
