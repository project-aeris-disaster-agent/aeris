"""
Knowledge base manager for PDF and URL ingestion.
Prepares system for Streamlit-based training data ingestion.
"""

import logging
from typing import List, Dict, Any, Optional
from pathlib import Path
import json
import re

logger = logging.getLogger(__name__)

# Lazy import for chunking
try:
    from llm.chunking import ContentChunker
    CHUNKING_AVAILABLE = True
except ImportError:
    CHUNKING_AVAILABLE = False
    logger.warning("Content chunking not available")


class KnowledgeBase:
    """
    Manages knowledge base data from PDFs and URLs.
    Will be integrated with Streamlit admin interface for data ingestion.
    """
    
    def __init__(self, knowledge_base_dir: str = "knowledge_base"):
        """
        Initialize knowledge base manager.
        
        Args:
            knowledge_base_dir: Directory to store knowledge base files
        """
        self.knowledge_base_dir = Path(knowledge_base_dir)
        self.knowledge_base_dir.mkdir(exist_ok=True)
        
        # Subdirectories for different data types
        self.pdfs_dir = self.knowledge_base_dir / "pdfs"
        self.urls_dir = self.knowledge_base_dir / "urls"
        self.processed_dir = self.knowledge_base_dir / "processed"
        self.chunks_dir = self.knowledge_base_dir / "chunks"
        
        # Create directories
        for dir_path in [self.pdfs_dir, self.urls_dir, self.processed_dir, self.chunks_dir]:
            dir_path.mkdir(exist_ok=True)
        
        logger.info(f"Knowledge base initialized at {self.knowledge_base_dir}")
    
    def get_knowledge_base_metadata(self) -> Dict[str, Any]:
        """
        Get metadata about ingested knowledge base documents.
        
        Returns:
            Dictionary with metadata about PDFs and URLs
        """
        metadata = {
            "pdfs": [],
            "urls": [],
            "total_documents": 0
        }
        
        # Scan for PDF metadata files
        metadata_file = self.knowledge_base_dir / "metadata.json"
        if metadata_file.exists():
            try:
                with open(metadata_file, 'r', encoding='utf-8') as f:
                    metadata = json.load(f)
            except Exception as e:
                logger.error(f"Error loading metadata: {e}")
        
        return metadata
    
    def add_to_system_prompt(self, system_prompt: str) -> str:
        """
        Add knowledge base context to system prompt.
        
        Args:
            system_prompt: Base system prompt
            
        Returns:
            Enhanced system prompt with knowledge base context
        """
        metadata = self.get_knowledge_base_metadata()
        
        if metadata.get("total_documents", 0) > 0:
            kb_context = "\n\n## Knowledge Base:\n"
            kb_context += f"You have access to {metadata['total_documents']} documents in the knowledge base:\n"
            
            if metadata.get("pdfs"):
                kb_context += f"- {len(metadata['pdfs'])} PDF documents\n"
                # List PDF sources
                sources = set()
                for pdf in metadata['pdfs']:
                    if pdf.get('source'):
                        sources.add(pdf['source'])
                if sources:
                    kb_context += f"  Sources: {', '.join(sources)}\n"
            
            if metadata.get("urls"):
                kb_context += f"- {len(metadata['urls'])} URL sources\n"
                # List URL sources
                sources = set()
                for url_item in metadata['urls']:
                    if url_item.get('source'):
                        sources.add(url_item['source'])
                if sources:
                    kb_context += f"  Sources: {', '.join(sources)}\n"
            
            kb_context += "\nUse this knowledge base to provide accurate, up-to-date information. "
            kb_context += "When referencing information from the knowledge base, you can mention the source if relevant. "
            kb_context += "The knowledge base contains disaster response protocols, procedures, and official guidance."
            
            return system_prompt + kb_context
        
        return system_prompt
    
    def get_relevant_content(self, query: str, max_results: int = 5) -> List[Dict[str, Any]]:
        """
        Get relevant content chunks from knowledge base based on query.
        Searches actual content, not just metadata.
        
        Args:
            query: Search query
            max_results: Maximum number of chunks to return
            
        Returns:
            List of relevant chunk dictionaries with content and source
        """
        metadata = self.get_knowledge_base_metadata()
        results = []
        
        # Extract keywords from query
        query_lower = query.lower()
        query_terms = set(re.findall(r'\b\w+\b', query_lower))
        
        # Search PDF chunks
        for pdf in metadata.get("pdfs", []):
            chunk_index_file = pdf.get("chunk_index_file")
            if not chunk_index_file:
                continue
            
            # Handle both absolute and relative paths
            if Path(chunk_index_file).is_absolute():
                chunk_file_path = Path(chunk_index_file)
            else:
                chunk_file_path = Path(chunk_index_file)
                if not chunk_file_path.exists():
                    chunk_file_path = self.knowledge_base_dir / chunk_index_file
            
            if not chunk_file_path.exists():
                continue
            
            try:
                if CHUNKING_AVAILABLE:
                    chunker = ContentChunker()
                    chunks = chunker.load_chunks(str(chunk_file_path))
                else:
                    # Fallback: load JSON directly
                    with open(chunk_file_path, 'r', encoding='utf-8') as f:
                        chunks = json.load(f)
                
                # Score chunks by relevance
                for chunk in chunks:
                    content = chunk.get("content", "").lower()
                    score = self._score_chunk(content, query_terms)
                    
                    if score > 0:
                        results.append({
                            "type": "pdf",
                            "chunk": chunk,
                            "source": pdf.get("source", "Unknown"),
                            "title": pdf.get("title", pdf.get("filename", "Unknown")),
                            "category": pdf.get("category"),
                            "score": score,
                            "content": chunk.get("content", ""),
                            "chunk_id": chunk.get("chunk_id")
                        })
            except Exception as e:
                logger.warning(f"Error loading chunks from {chunk_file_path}: {e}")
                continue
        
        # Search URL chunks
        for url_item in metadata.get("urls", []):
            chunk_index_file = url_item.get("chunk_index_file")
            if not chunk_index_file:
                continue
            
            # Handle both absolute and relative paths
            if Path(chunk_index_file).is_absolute():
                chunk_file_path = Path(chunk_index_file)
            else:
                chunk_file_path = Path(chunk_index_file)
                if not chunk_file_path.exists():
                    chunk_file_path = self.knowledge_base_dir / chunk_index_file
            
            if not chunk_file_path.exists():
                continue
            
            try:
                if CHUNKING_AVAILABLE:
                    chunker = ContentChunker()
                    chunks = chunker.load_chunks(str(chunk_file_path))
                else:
                    # Fallback: load JSON directly
                    with open(chunk_file_path, 'r', encoding='utf-8') as f:
                        chunks = json.load(f)
                
                # Score chunks by relevance
                for chunk in chunks:
                    content = chunk.get("content", "").lower()
                    score = self._score_chunk(content, query_terms)
                    
                    if score > 0:
                        results.append({
                            "type": "url",
                            "chunk": chunk,
                            "source": url_item.get("source", "Unknown"),
                            "title": url_item.get("title", url_item.get("url", "Unknown")),
                            "url": url_item.get("url"),
                            "category": url_item.get("category"),
                            "score": score,
                            "content": chunk.get("content", ""),
                            "chunk_id": chunk.get("chunk_id")
                        })
            except Exception as e:
                logger.warning(f"Error loading chunks from {chunk_file_path}: {e}")
                continue
        
        # Sort by score (highest first) and return top results
        results.sort(key=lambda x: x.get("score", 0), reverse=True)
        return results[:max_results]
    
    def _score_chunk(self, content: str, query_terms: set) -> float:
        """
        Score a chunk based on query term matches.
        
        Args:
            content: Chunk content (lowercase)
            query_terms: Set of query terms (lowercase)
            
        Returns:
            Relevance score (higher = more relevant)
        """
        if not content or not query_terms:
            return 0.0
        
        score = 0.0
        content_words = set(re.findall(r'\b\w+\b', content))
        
        # Count matching terms
        matches = len(query_terms.intersection(content_words))
        
        if matches == 0:
            return 0.0
        
        # Base score: number of matching terms
        score = matches
        
        # Bonus: exact phrase matches
        content_lower = content.lower()
        for term in query_terms:
            if len(term) > 3:  # Only check longer terms
                count = content_lower.count(term)
                score += count * 0.5
        
        # Normalize by query length
        score = score / max(len(query_terms), 1)
        
        return score


# Future: This will be expanded when Streamlit admin interface is built
# For now, this provides the structure for knowledge base integration

