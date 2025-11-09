"""
PDF processing utilities for knowledge base ingestion.
Extracts text from PDFs for LLM training.
"""

import logging
from pathlib import Path
from typing import Optional, Dict, Any
import json

logger = logging.getLogger(__name__)

try:
    import PyPDF2
    PDF_AVAILABLE = True
except ImportError:
    PDF_AVAILABLE = False
    logger.warning("PyPDF2 not installed. PDF processing will be limited.")


class PDFProcessor:
    """
    Processes PDF files for knowledge base ingestion.
    """
    
    def __init__(self):
        """Initialize PDF processor."""
        if not PDF_AVAILABLE:
            logger.warning("PyPDF2 not available. Install with: pip install PyPDF2")
    
    def extract_text(self, pdf_path: str) -> Optional[str]:
        """
        Extract text from PDF file.
        
        Args:
            pdf_path: Path to PDF file
            
        Returns:
            Extracted text or None if error
        """
        if not PDF_AVAILABLE:
            logger.error("PyPDF2 not available for PDF processing")
            return None
        
        try:
            text_parts = []
            
            with open(pdf_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                
                for page_num, page in enumerate(pdf_reader.pages):
                    try:
                        text = page.extract_text()
                        if text.strip():
                            text_parts.append(f"--- Page {page_num + 1} ---\n{text}")
                    except Exception as e:
                        logger.warning(f"Error extracting text from page {page_num + 1}: {e}")
                        continue
            
            full_text = "\n\n".join(text_parts)
            logger.info(f"Extracted {len(full_text)} characters from PDF: {pdf_path}")
            
            return full_text
            
        except Exception as e:
            logger.error(f"Error processing PDF {pdf_path}: {e}", exc_info=True)
            return None
    
    def save_extracted_text(self, pdf_path: str, output_dir: str = "knowledge_base/processed") -> Optional[str]:
        """
        Extract text from PDF and save to processed directory.
        
        Args:
            pdf_path: Path to PDF file
            output_dir: Directory to save extracted text
            
        Returns:
            Path to saved text file or None if error
        """
        text = self.extract_text(pdf_path)
        if not text:
            return None
        
        # Create output directory
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        # Save extracted text
        pdf_name = Path(pdf_path).stem
        text_file = output_path / f"{pdf_name}.txt"
        
        with open(text_file, 'w', encoding='utf-8') as f:
            f.write(text)
        
        logger.info(f"Saved extracted text to: {text_file}")
        return str(text_file)

