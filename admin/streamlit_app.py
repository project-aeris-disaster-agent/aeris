"""
Streamlit admin interface for Disaster Response Bot.
Features:
- PDF and URL ingestion for knowledge base training
- Emergency announcement creation and management
- Broadcast management
- Analytics dashboard

See SPEC.md Section 2.3 and Phase 4 for details.
"""

import streamlit as st
import os
import logging
from pathlib import Path
from typing import Optional
import json
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Configure page
st.set_page_config(
    page_title="AERIS Admin Dashboard",
    page_icon="🚨",
    layout="wide"
)

# Initialize session state
if 'initialized' not in st.session_state:
    st.session_state.initialized = True

logger = logging.getLogger(__name__)


def check_admin_auth():
    """Check admin authentication."""
    admin_key = os.getenv("ADMIN_SECRET_KEY")
    
    if not admin_key:
        st.error("⚠️ Admin secret key not configured!")
        st.info("Please add `ADMIN_SECRET_KEY=your_password` to your `.env` file")
        st.code("ADMIN_SECRET_KEY=6666", language="bash")
        st.stop()
        return False
    
    # Simple password check
    if 'authenticated' not in st.session_state:
        st.sidebar.title("🔐 Admin Login")
        password = st.sidebar.text_input("Enter Admin Password", type="password", key="admin_password")
        
        if st.sidebar.button("Login", type="primary"):
            if password == admin_key:
                st.session_state.authenticated = True
                st.rerun()
            else:
                st.sidebar.error("❌ Incorrect password")
                st.stop()
        else:
            st.stop()
    
    return True


def main():
    """Main Streamlit application."""
    st.title("🚨 AERIS Disaster Response Bot - Admin Dashboard")
    
    # Check authentication
    if not check_admin_auth():
        return
    
    # Sidebar navigation
    st.sidebar.title("Navigation")
    page = st.sidebar.selectbox(
        "Choose a page",
        ["Knowledge Base", "Announcements", "Analytics", "Settings"]
    )
    
    if page == "Knowledge Base":
        show_knowledge_base_page()
    elif page == "Announcements":
        show_announcements_page()
    elif page == "Analytics":
        show_analytics_page()
    elif page == "Settings":
        show_settings_page()


def show_knowledge_base_page():
    """Knowledge Base management page for PDF/URL ingestion."""
    st.header("📚 Knowledge Base Management")
    st.markdown("Upload PDFs or add URLs to train AERIS with disaster response data.")
    
    # Tabs for different ingestion methods
    tab1, tab2, tab3 = st.tabs(["📄 Upload PDF", "🔗 Add URL", "📋 View Knowledge Base"])
    
    with tab1:
        st.subheader("Upload PDF Document")
        st.markdown("Upload PDF files containing disaster response protocols, procedures, or information.")
        
        uploaded_file = st.file_uploader(
            "Choose a PDF file",
            type=['pdf'],
            help="Upload PDF documents to add to the knowledge base"
        )
        
        if uploaded_file is not None:
            # Display file info
            st.info(f"📄 File: {uploaded_file.name} ({uploaded_file.size:,} bytes)")
            
            # Metadata inputs
            col1, col2 = st.columns(2)
            with col1:
                doc_title = st.text_input("Document Title", value=uploaded_file.name, key="pdf_title")
                doc_type = st.selectbox(
                    "Document Type",
                    ["Protocol", "Procedure", "Guide", "Reference", "Other"],
                    key="pdf_type"
                )
            with col2:
                doc_source = st.text_input("Source/Organization", placeholder="e.g., FEMA, Red Cross", key="pdf_source")
                doc_category = st.selectbox(
                    "Category",
                    ["Emergency Response", "Evacuation", "Shelter", "Medical", "Family Reunification", "Other"],
                    key="pdf_category"
                )
            
            doc_description = st.text_area("Description (optional)", placeholder="Brief description of the document content", key="pdf_description")
            
            # Process button
            if st.button("📥 Process and Add to Knowledge Base", type="primary", key="pdf_process_btn"):
                with st.spinner("Processing PDF..."):
                    try:
                        # Save PDF
                        knowledge_base_dir = Path("knowledge_base/pdfs")
                        knowledge_base_dir.mkdir(parents=True, exist_ok=True)
                        
                        file_path = knowledge_base_dir / uploaded_file.name
                        with open(file_path, "wb") as f:
                            f.write(uploaded_file.getbuffer())
                        
                        # Extract text from PDF
                        from admin.pdf_processor import PDFProcessor
                        pdf_processor = PDFProcessor()
                        
                        progress_bar = st.progress(0)
                        status_text = st.empty()
                        
                        status_text.text("📄 Extracting text from PDF...")
                        progress_bar.progress(20)
                        
                        extracted_text_file = pdf_processor.save_extracted_text(
                            str(file_path),
                            output_dir="knowledge_base/processed"
                        )
                        
                        if not extracted_text_file:
                            st.warning("⚠️ Could not extract text from PDF. PDF saved but not indexed.")
                        else:
                            status_text.text("✂️ Chunking content...")
                            progress_bar.progress(60)
                            
                            try:
                                # Chunk the extracted text
                                from llm.chunking import ContentChunker
                                chunker = ContentChunker(chunk_size=800, chunk_overlap=100)
                                
                                # Check file size first
                                text_file_path = Path(extracted_text_file)
                                if text_file_path.exists():
                                    file_size = text_file_path.stat().st_size
                                    status_text.text(f"✂️ Chunking content... (File size: {file_size:,} bytes)")
                                
                                chunks = chunker.chunk_file(
                                    extracted_text_file,
                                    source=uploaded_file.name,
                                    metadata={
                                        "title": doc_title,
                                        "type": doc_type,
                                        "source": doc_source,
                                        "category": doc_category,
                                        "description": doc_description
                                    }
                                )
                                
                                if not chunks:
                                    st.warning("⚠️ No chunks created from PDF content.")
                                    progress_bar.progress(100)
                                    status_text.empty()
                                    return
                                
                                status_text.text(f"💾 Saving {len(chunks)} chunks...")
                                progress_bar.progress(75)
                                
                                # Save chunks to index (use JSONL for large files)
                                chunks_dir = Path("knowledge_base/chunks")
                                chunks_dir.mkdir(parents=True, exist_ok=True)
                                
                                chunk_index_file = chunks_dir / f"{Path(uploaded_file.name).stem}_chunks.json"
                                
                                # Use JSONL format if many chunks (more memory efficient)
                                format_type = "jsonl" if len(chunks) > 1000 else "json"
                                if format_type == "jsonl":
                                    chunk_index_file = chunk_index_file.with_suffix('.jsonl')
                                
                                chunker.save_chunks(chunks, str(chunk_index_file), index_format=format_type)
                                
                            except Exception as chunk_error:
                                st.error(f"❌ Error during chunking: {chunk_error}")
                                logger.error(f"Chunking error: {chunk_error}", exc_info=True)
                                progress_bar.progress(100)
                                status_text.empty()
                                return
                            
                            if chunks:
                                
                                # Store relative path in metadata (relative to knowledge_base directory)
                                # Convert to string and normalize path separators
                                chunk_path_str = str(chunk_index_file).replace("\\", "/")
                                if chunk_path_str.startswith("knowledge_base/"):
                                    chunk_index_relative = chunk_path_str.replace("knowledge_base/", "")
                                else:
                                    # Extract just the filename and subdirectory
                                    chunk_index_relative = f"chunks/{chunk_index_file.name}"
                                
                                status_text.text("💾 Saving metadata...")
                                progress_bar.progress(90)
                                
                                # Save metadata
                                metadata_file = Path("knowledge_base/metadata.json")
                                metadata = {}
                                if metadata_file.exists():
                                    with open(metadata_file, 'r') as f:
                                        metadata = json.load(f)
                                
                                if "pdfs" not in metadata:
                                    metadata["pdfs"] = []
                                
                                metadata["pdfs"].append({
                                    "filename": uploaded_file.name,
                                    "title": doc_title,
                                    "type": doc_type,
                                    "source": doc_source,
                                    "category": doc_category,
                                    "description": doc_description,
                                    "size": uploaded_file.size,
                                    "uploaded_at": str(Path(file_path).stat().st_mtime),
                                    "extracted_text_file": extracted_text_file,
                                    "chunk_index_file": chunk_index_relative,
                                    "chunk_count": len(chunks)
                                })
                                metadata["total_documents"] = len(metadata.get("pdfs", [])) + len(metadata.get("urls", []))
                                
                                with open(metadata_file, 'w') as f:
                                    json.dump(metadata, f, indent=2)
                                
                                progress_bar.progress(100)
                                status_text.empty()
                                
                                st.success(f"✅ PDF '{doc_title}' processed successfully!")
                                st.info(f"📊 Extracted {len(chunks)} chunks from {uploaded_file.name}")
                            else:
                                st.warning("⚠️ No chunks created from PDF content.")
                        
                    except Exception as e:
                        st.error(f"❌ Error processing PDF: {e}")
                        logger.error(f"Error processing PDF: {e}", exc_info=True)
    
    with tab2:
        st.subheader("Add URL Source")
        st.markdown("Add URLs to scrape and ingest disaster response information.")
        
        url = st.text_input("URL", placeholder="https://example.com/disaster-guide", key="url_input")
        url_title = st.text_input("Title (optional)", placeholder="Leave empty to auto-detect", key="url_title")
        
        col1, col2 = st.columns(2)
        with col1:
            url_source = st.text_input("Source/Organization", placeholder="e.g., FEMA, Red Cross", key="url_source")
            url_category = st.selectbox(
                "Category",
                ["Emergency Response", "Evacuation", "Shelter", "Medical", "News", "Other"],
                key="url_category"
            )
        with col2:
            url_type = st.selectbox(
                "Content Type",
                ["Official Guide", "News Article", "Resource Page", "Documentation", "Other"],
                key="url_type"
            )
            auto_refresh = st.checkbox("Auto-refresh", help="Periodically check for updates", key="url_auto_refresh")
        
        url_description = st.text_area("Description (optional)", placeholder="What information does this URL contain?", key="url_description")
        
        if st.button("🔗 Add URL to Knowledge Base", type="primary", key="url_add_btn"):
            if url:
                with st.spinner("Adding URL..."):
                    try:
                        # Scrape URL content
                        from admin.url_scraper import URLScraper
                        url_scraper = URLScraper()
                        
                        progress_bar = st.progress(0)
                        status_text = st.empty()
                        
                        status_text.text("🌐 Scraping URL content...")
                        progress_bar.progress(20)
                        
                        scraped_content_file = url_scraper.save_scraped_content(
                            url,
                            output_dir="knowledge_base/processed"
                        )
                        
                        if not scraped_content_file:
                            st.warning("⚠️ Could not scrape URL content. URL saved but not indexed.")
                        else:
                            status_text.text("✂️ Chunking content...")
                            progress_bar.progress(60)
                            
                            # Chunk the scraped content
                            from llm.chunking import ContentChunker
                            chunker = ContentChunker(chunk_size=800, chunk_overlap=100)
                            
                            chunks = chunker.chunk_file(
                                scraped_content_file,
                                source=url,
                                metadata={
                                    "title": url_title or url,
                                    "type": url_type,
                                    "source": url_source,
                                    "category": url_category,
                                    "description": url_description,
                                    "auto_refresh": auto_refresh
                                }
                            )
                            
                            if chunks:
                                # Save chunks to index
                                chunks_dir = Path("knowledge_base/chunks")
                                chunks_dir.mkdir(parents=True, exist_ok=True)
                                
                                # Create safe filename from URL
                                from urllib.parse import urlparse
                                parsed = urlparse(url)
                                safe_filename = parsed.netloc.replace('.', '_') + parsed.path.replace('/', '_')
                                if not safe_filename or safe_filename == '_':
                                    safe_filename = 'url_content'
                                
                                chunk_index_file = chunks_dir / f"{safe_filename}_chunks.json"
                                chunker.save_chunks(chunks, str(chunk_index_file))
                                
                                # Store relative path in metadata (relative to knowledge_base directory)
                                # Convert to string and normalize path separators
                                chunk_path_str = str(chunk_index_file).replace("\\", "/")
                                if chunk_path_str.startswith("knowledge_base/"):
                                    chunk_index_relative = chunk_path_str.replace("knowledge_base/", "")
                                else:
                                    # Extract just the filename and subdirectory
                                    chunk_index_relative = f"chunks/{chunk_index_file.name}"
                                
                                status_text.text("💾 Saving metadata...")
                                progress_bar.progress(90)
                                
                                # Save URL metadata
                                metadata_file = Path("knowledge_base/metadata.json")
                                metadata = {}
                                if metadata_file.exists():
                                    with open(metadata_file, 'r') as f:
                                        metadata = json.load(f)
                                
                                if "urls" not in metadata:
                                    metadata["urls"] = []
                                
                                metadata["urls"].append({
                                    "url": url,
                                    "title": url_title or url,
                                    "type": url_type,
                                    "source": url_source,
                                    "category": url_category,
                                    "description": url_description,
                                    "auto_refresh": auto_refresh,
                                    "added_at": str(Path().cwd()),
                                    "scraped_content_file": scraped_content_file,
                                    "chunk_index_file": chunk_index_relative,
                                    "chunk_count": len(chunks)
                                })
                                metadata["total_documents"] = len(metadata.get("pdfs", [])) + len(metadata.get("urls", []))
                                
                                with open(metadata_file, 'w') as f:
                                    json.dump(metadata, f, indent=2)
                                
                                progress_bar.progress(100)
                                status_text.empty()
                                
                                st.success(f"✅ URL processed successfully!")
                                st.info(f"📊 Extracted {len(chunks)} chunks from {url}")
                            else:
                                st.warning("⚠️ No chunks created from URL content.")
                        
                    except Exception as e:
                        st.error(f"❌ Error processing URL: {e}")
                        logger.error(f"Error processing URL: {e}", exc_info=True)
            else:
                st.error("Please enter a URL")
    
    with tab3:
        st.subheader("Knowledge Base Contents")
        
        metadata_file = Path("knowledge_base/metadata.json")
        if metadata_file.exists():
            with open(metadata_file, 'r') as f:
                metadata = json.load(f)
            
            total = metadata.get("total_documents", 0)
            st.metric("Total Documents", total)
            
            col1, col2 = st.columns(2)
            
            with col1:
                st.subheader("📄 PDFs")
                pdfs = metadata.get("pdfs", [])
                if pdfs:
                    for pdf in pdfs:
                        with st.expander(f"📄 {pdf.get('title', pdf.get('filename', 'Unknown'))}"):
                            st.write(f"**Source:** {pdf.get('source', 'N/A')}")
                            st.write(f"**Type:** {pdf.get('type', 'N/A')}")
                            st.write(f"**Category:** {pdf.get('category', 'N/A')}")
                            if pdf.get('description'):
                                st.write(f"**Description:** {pdf.get('description')}")
                else:
                    st.info("No PDFs uploaded yet")
            
            with col2:
                st.subheader("🔗 URLs")
                urls = metadata.get("urls", [])
                if urls:
                    for url_item in urls:
                        with st.expander(f"🔗 {url_item.get('title', url_item.get('url', 'Unknown'))}"):
                            st.write(f"**URL:** {url_item.get('url')}")
                            st.write(f"**Source:** {url_item.get('source', 'N/A')}")
                            st.write(f"**Type:** {url_item.get('type', 'N/A')}")
                            st.write(f"**Category:** {url_item.get('category', 'N/A')}")
                            if url_item.get('description'):
                                st.write(f"**Description:** {url_item.get('description')}")
                else:
                    st.info("No URLs added yet")
        else:
            st.info("Knowledge base is empty. Upload PDFs or add URLs to get started.")


def show_announcements_page():
    """Emergency announcements management page."""
    st.header("📢 Emergency Announcements")
    st.info("Announcement management coming soon in Phase 4")


def show_analytics_page():
    """Analytics dashboard page."""
    st.header("📊 Analytics Dashboard")
    st.info("Analytics dashboard coming soon in Phase 4")


def show_settings_page():
    """Settings page."""
    st.header("⚙️ Settings")
    st.info("Settings page coming soon")


if __name__ == "__main__":
    main()

