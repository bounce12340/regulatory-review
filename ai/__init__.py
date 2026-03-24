"""AI Document Analysis module for Regulatory Review Tool — Phase 4."""

# Only import modules that don't require optional dependencies
from .upload_handler import DocumentParser, ParsedDocument

# Lazy imports for modules with heavy dependencies
# Use: from ai.llm_client import TFDAAnalysisClient
# Use: from ai.regulatory_kb import get_knowledge_base

__all__ = [
    "DocumentParser",
    "ParsedDocument",
]
