"""
URL scraping utilities for knowledge base ingestion.
Fetches and processes content from URLs for LLM training.
"""

import logging
from pathlib import Path
from typing import Optional, Dict, Any
import json

logger = logging.getLogger(__name__)

try:
    import requests
    from bs4 import BeautifulSoup
    SCRAPING_AVAILABLE = True
except ImportError:
    SCRAPING_AVAILABLE = False
    logger.warning("BeautifulSoup4 not installed. URL scraping will be limited.")


class URLScraper:
    """
    Scrapes content from URLs for knowledge base ingestion.
    """
    
    def __init__(self):
        """Initialize URL scraper."""
        if not SCRAPING_AVAILABLE:
            logger.warning("BeautifulSoup4 not available. Install with: pip install beautifulsoup4 requests")
    
    def scrape_url(self, url: str) -> Optional[Dict[str, Any]]:
        """
        Scrape content from URL.
        
        Args:
            url: URL to scrape
            
        Returns:
            Dictionary with title, content, and metadata or None if error
        """
        if not SCRAPING_AVAILABLE:
            logger.error("BeautifulSoup4 not available for URL scraping")
            return None
        
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            
            response = requests.get(url, headers=headers, timeout=30)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Extract title
            title = soup.find('title')
            title_text = title.get_text().strip() if title else url
            
            # Remove script and style elements
            for script in soup(["script", "style"]):
                script.decompose()
            
            # Extract main content
            # Try to find main content area
            main_content = soup.find('main') or soup.find('article') or soup.find('body')
            
            if main_content:
                text = main_content.get_text(separator='\n', strip=True)
            else:
                text = soup.get_text(separator='\n', strip=True)
            
            # Clean up text
            lines = [line.strip() for line in text.split('\n') if line.strip()]
            cleaned_text = '\n'.join(lines)
            
            result = {
                "url": url,
                "title": title_text,
                "content": cleaned_text,
                "content_length": len(cleaned_text),
                "status_code": response.status_code
            }
            
            logger.info(f"Scraped {len(cleaned_text)} characters from URL: {url}")
            
            return result
            
        except Exception as e:
            logger.error(f"Error scraping URL {url}: {e}", exc_info=True)
            return None
    
    def save_scraped_content(self, url: str, output_dir: str = "knowledge_base/processed") -> Optional[str]:
        """
        Scrape URL and save content to processed directory.
        
        Args:
            url: URL to scrape
            output_dir: Directory to save scraped content
            
        Returns:
            Path to saved text file or None if error
        """
        result = self.scrape_url(url)
        if not result:
            return None
        
        # Create output directory
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        # Save scraped content
        # Create filename from URL
        from urllib.parse import urlparse
        parsed = urlparse(url)
        filename = parsed.netloc.replace('.', '_') + parsed.path.replace('/', '_')
        if not filename or filename == '_':
            filename = 'scraped_content'
        
        text_file = output_path / f"{filename}.txt"
        
        content = f"URL: {url}\nTitle: {result['title']}\n\n{result['content']}"
        
        with open(text_file, 'w', encoding='utf-8') as f:
            f.write(content)
        
        logger.info(f"Saved scraped content to: {text_file}")
        return str(text_file)

