"""
Content chunking utilities for RAG system.
Splits documents into searchable chunks for retrieval.
"""

import logging
from typing import List, Dict, Any, Optional
from pathlib import Path
import json
import re

logger = logging.getLogger(__name__)


class ContentChunker:
    """
    Chunks text content into searchable pieces for RAG retrieval.
    """
    
    def __init__(self, chunk_size: int = 800, chunk_overlap: int = 100):
        """
        Initialize chunker.
        
        Args:
            chunk_size: Target size of each chunk in characters
            chunk_overlap: Number of characters to overlap between chunks
        """
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        logger.info(f"ContentChunker initialized: chunk_size={chunk_size}, overlap={chunk_overlap}")
    
    def chunk_text(
        self,
        text: str,
        source: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Split text into chunks with metadata.
        
        Args:
            text: Text content to chunk
            source: Source identifier (filename, URL, etc.)
            metadata: Additional metadata to attach to each chunk
            
        Returns:
            List of chunk dictionaries with content and metadata
        """
        if not text or not text.strip():
            logger.warning(f"Empty text provided for chunking: {source}")
            return []
        
        chunks = []
        text_length = len(text)
        
        # If text is smaller than chunk size, return single chunk
        if text_length <= self.chunk_size:
            chunk = {
                "chunk_id": f"{source}_0",
                "source": source,
                "content": text.strip(),
                "chunk_index": 0,
                "start_char": 0,
                "end_char": text_length,
                "metadata": metadata or {}
            }
            chunks.append(chunk)
            logger.info(f"Created 1 chunk from {source} ({text_length} chars)")
            return chunks
        
        # Split into chunks with overlap
        start = 0
        chunk_index = 0
        max_chunks = (text_length // (self.chunk_size - self.chunk_overlap)) + 10  # Safety limit
        
        while start < text_length and chunk_index < max_chunks:
            # Calculate end position
            end = min(start + self.chunk_size, text_length)
            
            # Extract chunk
            chunk_text = text[start:end]
            
            # Try to break at sentence boundary if not at end
            if end < text_length:
                # Look for sentence endings within last 200 chars
                sentence_end = max(
                    chunk_text.rfind('.'),
                    chunk_text.rfind('!'),
                    chunk_text.rfind('?'),
                    chunk_text.rfind('\n')
                )
                
                if sentence_end > len(chunk_text) - 200 and sentence_end >= 0:
                    # Break at sentence boundary
                    chunk_text = chunk_text[:sentence_end + 1]
                    end = start + len(chunk_text)
            
            # Ensure we make progress (prevent infinite loop)
            if end <= start:
                # Force minimum progress
                end = start + min(100, text_length - start)
                chunk_text = text[start:end]
            
            # Create chunk
            chunk = {
                "chunk_id": f"{source}_{chunk_index}",
                "source": source,
                "content": chunk_text.strip(),
                "chunk_index": chunk_index,
                "start_char": start,
                "end_char": end,
                "char_count": len(chunk_text),
                "metadata": metadata or {}
            }
            
            chunks.append(chunk)
            
            # Move start position (with overlap)
            new_start = end - self.chunk_overlap
            # Ensure we always advance
            start = max(new_start, start + 1)
            chunk_index += 1
        
        logger.info(f"Created {len(chunks)} chunks from {source} ({text_length} chars)")
        return chunks
    
    def chunk_file(
        self,
        file_path: str,
        source: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Chunk text from a file.
        
        Args:
            file_path: Path to text file
            source: Source identifier (defaults to filename)
            metadata: Additional metadata
            
        Returns:
            List of chunk dictionaries
        """
        file_path_obj = Path(file_path)
        
        if not file_path_obj.exists():
            logger.error(f"File not found: {file_path}")
            return []
        
        if source is None:
            source = file_path_obj.stem
        
        try:
            # Read file with error handling for encoding issues
            file_size = file_path_obj.stat().st_size
            logger.info(f"Reading file for chunking: {file_path} (size: {file_size:,} bytes)")
            
            # For very large files (>10MB), warn but proceed
            if file_size > 10 * 1024 * 1024:
                logger.warning(f"Large file detected ({file_size:,} bytes). This may take a while.")
            
            # Try UTF-8 first, fallback to latin-1 if needed
            try:
                with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                    text = f.read()
            except UnicodeDecodeError:
                logger.warning(f"UTF-8 decode failed, trying latin-1: {file_path}")
                with open(file_path, 'r', encoding='latin-1', errors='replace') as f:
                    text = f.read()
            
            if not text or not text.strip():
                logger.warning(f"File appears to be empty or contains no readable text: {file_path}")
                return []
            
            logger.info(f"Read {len(text):,} characters from file, starting chunking...")
            chunks = self.chunk_text(text, source, metadata)
            logger.info(f"Chunking complete: {len(chunks)} chunks created")
            
            return chunks
            
        except MemoryError as me:
            logger.error(f"Out of memory while processing {file_path}. File may be too large.")
            logger.error(f"MemoryError details: {me}", exc_info=True)
            return []
        except Exception as e:
            logger.error(f"Error chunking file {file_path}: {type(e).__name__}: {e}", exc_info=True)
            return []
    
    def save_chunks(
        self,
        chunks: List[Dict[str, Any]],
        output_file: str,
        index_format: str = "json"
    ) -> str:
        """
        Save chunks to index file.
        Uses JSONL format for large files to reduce memory usage.
        
        Args:
            chunks: List of chunk dictionaries
            output_file: Path to save index file
            index_format: Format to save ('json' or 'jsonl')
            
        Returns:
            Path to saved index file
        """
        output_path = Path(output_file)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        logger.info(f"Saving {len(chunks)} chunks to {output_path}")
        
        # For large numbers of chunks, use JSONL format (more memory efficient)
        if len(chunks) > 1000 and index_format == "json":
            logger.info(f"Large number of chunks ({len(chunks)}), using JSONL format for efficiency")
            index_format = "jsonl"
            output_path = output_path.with_suffix('.jsonl')
        
        try:
            if index_format == "json":
                # Use compact JSON for smaller files
                with open(output_path, 'w', encoding='utf-8') as f:
                    json.dump(chunks, f, indent=2, ensure_ascii=False)
            elif index_format == "jsonl":
                # Stream write for memory efficiency
                with open(output_path, 'w', encoding='utf-8') as f:
                    for chunk in chunks:
                        f.write(json.dumps(chunk, ensure_ascii=False) + '\n')
            else:
                raise ValueError(f"Unsupported index format: {index_format}")
            
            file_size = output_path.stat().st_size
            logger.info(f"Saved {len(chunks)} chunks to {output_path} ({file_size:,} bytes)")
            return str(output_path)
            
        except MemoryError:
            logger.error(f"Out of memory while saving chunks. Try using JSONL format or reducing chunk count.")
            raise
        except Exception as e:
            logger.error(f"Error saving chunks to {output_path}: {e}", exc_info=True)
            raise
    
    def load_chunks(self, index_file: str) -> List[Dict[str, Any]]:
        """
        Load chunks from index file.
        
        Args:
            index_file: Path to index file
            
        Returns:
            List of chunk dictionaries
        """
        index_path = Path(index_file)
        
        if not index_path.exists():
            logger.warning(f"Index file not found: {index_file}")
            return []
        
        try:
            with open(index_path, 'r', encoding='utf-8') as f:
                if index_path.suffix == '.jsonl':
                    chunks = [json.loads(line) for line in f if line.strip()]
                else:
                    chunks = json.load(f)
            
            logger.info(f"Loaded {len(chunks)} chunks from {index_file}")
            return chunks
            
        except Exception as e:
            logger.error(f"Error loading chunks from {index_file}: {e}", exc_info=True)
            return []

