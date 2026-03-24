#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Regulatory Knowledge Base Manager
Handles TFDA regulatory document upload, parsing, and vector storage.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any

import chromadb
from chromadb.config import Settings

# Import local modules
from .upload_handler import DocumentParser, ParsedDocument


@dataclass
class RegulatoryDocument:
    """Represents a regulatory document in the knowledge base."""
    id: str
    title: str                    # e.g., "藥品查驗登記審查準則"
    document_type: str            # "drug" | "food" | "medical_device" | "general"
    source: str                   # "TFDA" | "other"
    upload_date: datetime
    file_path: Optional[Path] = None
    total_pages: int = 0
    total_chunks: int = 0
    status: str = "pending"      # "pending" | "processing" | "completed" | "error"
    error_message: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        data = asdict(self)
        data['upload_date'] = self.upload_date.isoformat()
        data['file_path'] = str(self.file_path) if self.file_path else None
        return data
    
    @classmethod
    def from_dict(cls, data: dict) -> "RegulatoryDocument":
        """Create from dictionary."""
        data['upload_date'] = datetime.fromisoformat(data['upload_date'])
        if data.get('file_path'):
            data['file_path'] = Path(data['file_path'])
        return cls(**data)


class RegulatoryKnowledgeBase:
    """
    Manages TFDA regulatory documents with vector storage for RAG.
    """
    
    def __init__(self, persist_directory: Optional[str] = None):
        """
        Initialize the knowledge base.
        
        Args:
            persist_directory: Directory to persist ChromaDB data
        """
        if persist_directory is None:
            persist_directory = str(Path.home() / ".regulatory_kb" / "chroma_db")
        
        self.persist_directory = Path(persist_directory)
        self.persist_directory.mkdir(parents=True, exist_ok=True)
        
        # Initialize ChromaDB
        self.chroma_client = chromadb.PersistentClient(
            path=str(self.persist_directory),
            settings=Settings(anonymized_telemetry=False)
        )
        
        # Get or create collection for regulatory documents
        self.collection = self.chroma_client.get_or_create_collection(
            name="regulatory_documents",
            metadata={"description": "TFDA regulatory documents for RAG"}
        )
        
        # Document registry
        self.registry_path = self.persist_directory / "document_registry.json"
        self.documents: Dict[str, RegulatoryDocument] = {}
        self._load_registry()
        
        # Document parser
        self.parser = DocumentParser()
    
    def _load_registry(self):
        """Load document registry from disk."""
        if self.registry_path.exists():
            try:
                with open(self.registry_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    for doc_id, doc_data in data.items():
                        self.documents[doc_id] = RegulatoryDocument.from_dict(doc_data)
            except Exception as e:
                print(f"Warning: Failed to load registry: {e}")
                self.documents = {}
    
    def _save_registry(self):
        """Save document registry to disk."""
        try:
            data = {doc_id: doc.to_dict() for doc_id, doc in self.documents.items()}
            with open(self.registry_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"Warning: Failed to save registry: {e}")
    
    def add_document(
        self,
        file_bytes: bytes,
        filename: str,
        title: str,
        document_type: str = "general",
        source: str = "TFDA"
    ) -> RegulatoryDocument:
        """
        Add a new regulatory document to the knowledge base.
        
        Args:
            file_bytes: Raw file bytes
            filename: Original filename
            title: Document title
            document_type: Type of document (drug/food/medical_device/general)
            source: Source of the document
            
        Returns:
            RegulatoryDocument object
        """
        # Generate unique ID
        doc_id = hashlib.md5(f"{filename}_{datetime.now().isoformat()}".encode()).hexdigest()[:12]
        
        # Create document record
        doc = RegulatoryDocument(
            id=doc_id,
            title=title,
            document_type=document_type,
            source=source,
            upload_date=datetime.now(),
            status="processing"
        )
        
        self.documents[doc_id] = doc
        self._save_registry()
        
        try:
            # Parse document
            parsed = self.parser.parse(file_bytes, filename)
            
            if parsed.error:
                doc.status = "error"
                doc.error_message = parsed.error
                self._save_registry()
                return doc
            
            # Update document info
            doc.total_pages = parsed.page_count
            doc.total_chunks = len(parsed.chunks)
            doc.status = "completed"
            
            # Add chunks to vector store
            self._add_chunks_to_vector_store(doc_id, parsed, title, document_type)
            
            self._save_registry()
            return doc
            
        except Exception as e:
            doc.status = "error"
            doc.error_message = str(e)
            self._save_registry()
            return doc
    
    def _add_chunks_to_vector_store(
        self,
        doc_id: str,
        parsed: ParsedDocument,
        title: str,
        document_type: str
    ):
        """Add document chunks to ChromaDB."""
        ids = []
        documents = []
        metadatas = []
        
        for idx, chunk in enumerate(parsed.chunks):
            chunk_id = f"{doc_id}_chunk_{idx}"
            ids.append(chunk_id)
            documents.append(chunk)
            metadatas.append({
                "doc_id": doc_id,
                "doc_title": title,
                "doc_type": document_type,
                "chunk_index": idx,
                "total_chunks": len(parsed.chunks),
                "source_file": parsed.filename
            })
        
        # Add to ChromaDB
        self.collection.add(
            ids=ids,
            documents=documents,
            metadatas=metadatas
        )
    
    def search(
        self,
        query: str,
        document_type: Optional[str] = None,
        n_results: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Search the knowledge base for relevant regulatory content.
        
        Args:
            query: Search query
            document_type: Filter by document type (optional)
            n_results: Number of results to return
            
        Returns:
            List of search results with content and metadata
        """
        # Build where clause if filtering by type
        where_clause = None
        if document_type:
            where_clause = {"doc_type": document_type}
        
        # Query ChromaDB
        results = self.collection.query(
            query_texts=[query],
            n_results=n_results,
            where=where_clause
        )
        
        # Format results
        formatted_results = []
        if results['ids'] and results['ids'][0]:
            for i in range(len(results['ids'][0])):
                formatted_results.append({
                    "id": results['ids'][0][i],
                    "content": results['documents'][0][i],
                    "metadata": results['metadatas'][0][i],
                    "distance": results['distances'][0][i] if results['distances'] else None
                })
        
        return formatted_results
    
    def get_document(self, doc_id: str) -> Optional[RegulatoryDocument]:
        """Get a document by ID."""
        return self.documents.get(doc_id)
    
    def list_documents(
        self,
        document_type: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[RegulatoryDocument]:
        """
        List all documents in the knowledge base.
        
        Args:
            document_type: Filter by type
            status: Filter by status
            
        Returns:
            List of RegulatoryDocument objects
        """
        docs = list(self.documents.values())
        
        if document_type:
            docs = [d for d in docs if d.document_type == document_type]
        
        if status:
            docs = [d for d in docs if d.status == status]
        
        # Sort by upload date (newest first)
        docs.sort(key=lambda x: x.upload_date, reverse=True)
        
        return docs
    
    def delete_document(self, doc_id: str) -> bool:
        """
        Delete a document from the knowledge base.
        
        Args:
            doc_id: Document ID to delete
            
        Returns:
            True if deleted, False if not found
        """
        if doc_id not in self.documents:
            return False
        
        # Delete from ChromaDB
        try:
            # Delete all chunks for this document
            self.collection.delete(
                where={"doc_id": doc_id}
            )
        except Exception as e:
            print(f"Warning: Failed to delete from vector store: {e}")
        
        # Delete from registry
        del self.documents[doc_id]
        self._save_registry()
        
        return True
    
    def get_stats(self) -> Dict[str, Any]:
        """Get knowledge base statistics."""
        total_docs = len(self.documents)
        completed_docs = sum(1 for d in self.documents.values() if d.status == "completed")
        error_docs = sum(1 for d in self.documents.values() if d.status == "error")
        
        # Count by type
        type_counts = {}
        for doc in self.documents.values():
            type_counts[doc.document_type] = type_counts.get(doc.document_type, 0) + 1
        
        return {
            "total_documents": total_docs,
            "completed": completed_docs,
            "error": error_docs,
            "by_type": type_counts,
            "vector_count": self.collection.count()
        }


# Singleton instance
_kb_instance: Optional[RegulatoryKnowledgeBase] = None

def get_knowledge_base(persist_directory: Optional[str] = None) -> RegulatoryKnowledgeBase:
    """Get or create the singleton knowledge base instance."""
    global _kb_instance
    if _kb_instance is None:
        _kb_instance = RegulatoryKnowledgeBase(persist_directory)
    return _kb_instance
