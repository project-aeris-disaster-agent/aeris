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


def process_single_pdf(uploaded_file, doc_title, doc_type, doc_source, doc_category, doc_description):
    """
    Process a single PDF file and add it to the knowledge base.
    
    Returns:
        dict with 'success', 'filename', 'chunks', 'error' keys
    """
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
        
        extracted_text_file = pdf_processor.save_extracted_text(
            str(file_path),
            output_dir="knowledge_base/processed"
        )
        
        if not extracted_text_file:
            return {
                "success": False,
                "filename": uploaded_file.name,
                "chunks": 0,
                "error": "Could not extract text from PDF"
            }
        
        # Chunk the extracted text
        from llm.chunking import ContentChunker
        from llama_index.core import Document
        
        chunker = ContentChunker(chunk_size=800, chunk_overlap=100)
        
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
            return {
                "success": False,
                "filename": uploaded_file.name,
                "chunks": 0,
                "error": "No chunks created from PDF content"
            }
        
        # Convert chunks to LlamaIndex Documents and add to ChromaDB
        import importlib
        import llm.knowledge_base
        importlib.reload(llm.knowledge_base)  # Force reload to avoid Streamlit cache issues
        from llm.knowledge_base import KnowledgeBase
        kb = KnowledgeBase()
        
        documents = []
        for chunk in chunks:
            # Build comprehensive metadata
            chunk_metadata = chunk.get("metadata", {})
            metadata = {
                "chunk_id": chunk.get("chunk_id", ""),
                "source": chunk.get("source", uploaded_file.name),
                "chunk_index": chunk.get("chunk_index", -1),
                "start_char": chunk.get("start_char", -1),
                "end_char": chunk.get("end_char", -1),
                "char_count": chunk.get("char_count", 0),
                "title": chunk_metadata.get("title", doc_title),
                "type": chunk_metadata.get("type", doc_type),
                "category": chunk_metadata.get("category", doc_category),
                "description": chunk_metadata.get("description", doc_description),
                "source_url": chunk_metadata.get("source", doc_source),
            }
            
            doc = Document(
                text=chunk.get("content", ""),
                metadata=metadata,
                id_=chunk.get("chunk_id", None)
            )
            documents.append(doc)
        
        # Add documents to ChromaDB
        kb.add_documents_to_index(documents)
        
        # Load and update metadata (no chunk_index_file needed anymore)
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
            "chunk_count": len(chunks)
        })
        
        metadata["total_documents"] = len(metadata.get("pdfs", [])) + len(metadata.get("urls", []))
        
        with open(metadata_file, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        return {
            "success": True,
            "filename": uploaded_file.name,
            "title": doc_title,
            "chunks": len(chunks),
            "error": None
        }
        
    except Exception as e:
        logger.error(f"Error processing PDF {uploaded_file.name}: {e}", exc_info=True)
        return {
            "success": False,
            "filename": uploaded_file.name,
            "chunks": 0,
            "error": str(e)
        }


def process_multiple_pdfs(uploaded_files, batch_source, batch_type, batch_category, batch_description, use_filename_as_title):
    """
    Process multiple PDF files in batch.
    """
    total_files = len(uploaded_files)
    results = []
    
    # Create progress container
    progress_container = st.container()
    status_container = st.container()
    results_container = st.container()
    
    with progress_container:
        overall_progress = st.progress(0)
        overall_status = st.empty()
    
    # Process each file
    for idx, uploaded_file in enumerate(uploaded_files, 1):
        # Determine title
        if use_filename_as_title:
            doc_title = Path(uploaded_file.name).stem
        else:
            doc_title = uploaded_file.name
        
        # Update overall progress
        progress_pct = (idx - 1) / total_files
        overall_progress.progress(progress_pct)
        overall_status.text(f"📄 Processing {idx}/{total_files}: {uploaded_file.name}")
        
        # Process single PDF
        result = process_single_pdf(
            uploaded_file,
            doc_title,
            batch_type,
            batch_source,
            batch_category,
            batch_description
        )
        
        results.append(result)
    
    # Final progress update
    overall_progress.progress(1.0)
    overall_status.empty()
    
    # Display results
    with results_container:
        st.markdown("### 📊 Processing Results")
        
        successful = [r for r in results if r["success"]]
        failed = [r for r in results if not r["success"]]
        
        # Summary metrics
        col1, col2, col3 = st.columns(3)
        with col1:
            st.metric("Total Files", total_files)
        with col2:
            st.metric("✅ Successful", len(successful), delta=f"{len(successful)}/{total_files}")
        with col3:
            st.metric("❌ Failed", len(failed), delta=f"-{len(failed)}" if failed else None)
        
        # Show successful files
        if successful:
            st.success(f"✅ Successfully processed {len(successful)} file(s)")
            with st.expander(f"✅ Successful Files ({len(successful)})"):
                for result in successful:
                    st.write(f"**{result['filename']}**")
                    st.write(f"  - Title: {result.get('title', result['filename'])}")
                    st.write(f"  - Chunks: {result['chunks']}")
                    st.write("")
        
        # Show failed files
        if failed:
            st.error(f"❌ Failed to process {len(failed)} file(s)")
            with st.expander(f"❌ Failed Files ({len(failed)})"):
                for result in failed:
                    st.write(f"**{result['filename']}**")
                    st.error(f"  Error: {result['error']}")
                    st.write("")
        
        # Total chunks summary
        total_chunks = sum(r["chunks"] for r in successful)
        if total_chunks > 0:
            st.info(f"📊 Total chunks extracted: {total_chunks:,}")
        
        # Refresh button
        if st.button("🔄 Refresh Knowledge Base View", key="refresh_kb"):
            st.rerun()


def show_knowledge_base_page():
    """Knowledge Base management page for PDF/URL ingestion."""
    st.header("📚 Knowledge Base Management")
    st.markdown("Upload PDFs or add URLs to train AERIS with disaster response data.")
    
    # Tabs for different ingestion methods
    tab1, tab2, tab3 = st.tabs(["📄 Upload PDF", "🔗 Add URL", "📋 View Knowledge Base"])
    
    with tab1:
        st.subheader("Upload PDF Documents")
        st.markdown("Upload one or multiple PDF files containing disaster response protocols, procedures, or information.")
        
        uploaded_files = st.file_uploader(
            "Choose PDF file(s)",
            type=['pdf'],
            accept_multiple_files=True,
            help="Upload one or multiple PDF documents to add to the knowledge base"
        )
        
        if uploaded_files:
            st.info(f"📚 {len(uploaded_files)} file(s) selected")
            
            # Show file list
            with st.expander(f"📋 View Selected Files ({len(uploaded_files)})"):
                for idx, file in enumerate(uploaded_files, 1):
                    st.write(f"{idx}. **{file.name}** ({file.size:,} bytes)")
            
            # Batch metadata inputs (applied to all files)
            st.markdown("### 📝 Batch Metadata (applied to all files)")
            col1, col2 = st.columns(2)
            with col1:
                batch_source = st.text_input("Source/Organization", placeholder="e.g., FEMA, Red Cross", key="batch_source", help="This will be applied to all files")
                batch_type = st.selectbox(
                    "Document Type",
                    ["Protocol", "Procedure", "Guide", "Reference", "Other"],
                    key="batch_type",
                    help="This will be applied to all files"
                )
            with col2:
                batch_category = st.selectbox(
                    "Category",
                    ["Emergency Response", "Evacuation", "Shelter", "Medical", "Family Reunification", "Other"],
                    key="batch_category",
                    help="This will be applied to all files"
                )
            
            batch_description = st.text_area("Description (optional)", placeholder="Brief description (applied to all files)", key="batch_description")
            
            # Option to use filename as title or custom title pattern
            use_filename_as_title = st.checkbox("Use filename as document title", value=True, key="use_filename_title")
            
            # Process button
            if st.button("📥 Process All PDFs and Add to Knowledge Base", type="primary", key="pdf_process_btn"):
                if not uploaded_files:
                    st.error("Please select at least one PDF file")
                else:
                    process_multiple_pdfs(uploaded_files, batch_source, batch_type, batch_category, batch_description, use_filename_as_title)
    
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
                            from llama_index.core import Document
                            
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
                                # Convert chunks to LlamaIndex Documents and add to ChromaDB
                                import importlib
                                import llm.knowledge_base
                                importlib.reload(llm.knowledge_base)  # Force reload to avoid Streamlit cache issues
                                from llm.knowledge_base import KnowledgeBase
                                kb = KnowledgeBase()
                                
                                documents = []
                                for chunk in chunks:
                                    chunk_metadata = chunk.get("metadata", {})
                                    metadata = {
                                        "chunk_id": chunk.get("chunk_id", ""),
                                        "source": chunk.get("source", url),
                                        "chunk_index": chunk.get("chunk_index", -1),
                                        "start_char": chunk.get("start_char", -1),
                                        "end_char": chunk.get("end_char", -1),
                                        "char_count": chunk.get("char_count", 0),
                                        "title": chunk_metadata.get("title", url_title or url),
                                        "type": chunk_metadata.get("type", url_type),
                                        "category": chunk_metadata.get("category", url_category),
                                        "description": chunk_metadata.get("description", url_description),
                                        "source_url": chunk_metadata.get("source", url_source),
                                        "auto_refresh": auto_refresh
                                    }
                                    
                                    doc = Document(
                                        text=chunk.get("content", ""),
                                        metadata=metadata,
                                        id_=chunk.get("chunk_id", None)
                                    )
                                    documents.append(doc)
                                
                                # Add documents to ChromaDB
                                kb.add_documents_to_index(documents)
                                
                                status_text.text("💾 Saving metadata...")
                                progress_bar.progress(90)
                                
                                # Save URL metadata (no chunk_index_file needed anymore)
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
        st.markdown("View all ingested knowledge and RAG chunks that your agent is working with.")
        
        metadata_file = Path("knowledge_base/metadata.json")
        if not metadata_file.exists():
            st.info("Knowledge base is empty. Upload PDFs or add URLs to get started.")
            return
        
        with open(metadata_file, 'r') as f:
            metadata = json.load(f)
        
        total = metadata.get("total_documents", 0)
        total_pdfs = len(metadata.get("pdfs", []))
        total_urls = len(metadata.get("urls", []))
        
        # Summary metrics
        col1, col2, col3 = st.columns(3)
        with col1:
            st.metric("📚 Total Documents", total)
        with col2:
            st.metric("📄 PDFs", total_pdfs)
        with col3:
            st.metric("🔗 URLs", total_urls)
        
        # Search and filter
        st.markdown("---")
        search_query = st.text_input("🔍 Search Knowledge", placeholder="Search through all chunks...", key="kb_search")
        
        # Document selector
        all_docs = []
        for pdf in metadata.get("pdfs", []):
            all_docs.append({
                "type": "PDF",
                "title": pdf.get('title', pdf.get('filename', 'Unknown')),
                "source": pdf.get('source', 'N/A'),
                "category": pdf.get('category', 'N/A'),
                "chunk_count": pdf.get('chunk_count', 0),
                "metadata": pdf
            })
        for url_item in metadata.get("urls", []):
            all_docs.append({
                "type": "URL",
                "title": url_item.get('title', url_item.get('url', 'Unknown')),
                "source": url_item.get('source', 'N/A'),
                "category": url_item.get('category', 'N/A'),
                "chunk_count": url_item.get('chunk_count', 0),
                "metadata": url_item
            })
        
        if not all_docs:
            st.info("No documents in knowledge base yet.")
            return
        
        # Document selector dropdown
        doc_options = [f"{doc['type']}: {doc['title']} ({doc['chunk_count']} chunks)" for doc in all_docs]
        selected_doc_idx = st.selectbox("📋 Select Document to View", range(len(doc_options)), format_func=lambda x: doc_options[x], key="doc_selector")
        
        selected_doc = all_docs[selected_doc_idx]
        
        st.markdown("---")
        
        # Show document info
        col1, col2, col3 = st.columns(3)
        with col1:
            st.write(f"**Type:** {selected_doc['type']}")
        with col2:
            st.write(f"**Source:** {selected_doc['source']}")
        with col3:
            st.write(f"**Category:** {selected_doc['category']}")
        
        st.write(f"**Total Chunks:** {selected_doc['chunk_count']} (stored in ChromaDB)")
        
        # Delete button for selected document
        st.markdown("---")
        st.markdown("### 🗑️ Delete Document")
        st.warning("⚠️ **Warning:** Deleting a document will permanently remove it and all its chunks from the knowledge base. This action cannot be undone.")
        
        # Get identifier for deletion
        if selected_doc['type'] == "PDF":
            delete_identifier = selected_doc['metadata'].get('filename')
        else:
            delete_identifier = selected_doc['metadata'].get('url')
        
        # Confirmation checkbox
        confirm_delete_key = f"confirm_delete_{selected_doc_idx}"
        if confirm_delete_key not in st.session_state:
            st.session_state[confirm_delete_key] = False
        
        confirm_delete = st.checkbox(
            f"I understand and want to delete this {selected_doc['type']}",
            key=f"delete_checkbox_{selected_doc_idx}",
            value=st.session_state[confirm_delete_key]
        )
        st.session_state[confirm_delete_key] = confirm_delete
        
        # Delete button
        delete_button_key = f"delete_btn_{selected_doc_idx}"
        if st.button("🗑️ Delete Document", type="primary", key=delete_button_key, disabled=not confirm_delete):
            if confirm_delete:
                with st.spinner("Deleting document and all associated files..."):
                    try:
                        from llm.knowledge_base import KnowledgeBase
                        kb = KnowledgeBase()
                        
                        result = kb.delete_document(
                            document_type=selected_doc['type'].lower(),
                            identifier=delete_identifier
                        )
                        
                        if result["success"]:
                            st.success(f"✅ {result['message']}")
                            if result.get("deleted_files"):
                                with st.expander("📋 Deleted Files"):
                                    for file_path in result["deleted_files"]:
                                        st.write(f"  - `{file_path}`")
                            
                            if result.get("warnings"):
                                st.warning("⚠️ Some warnings occurred:")
                                for warning in result["warnings"]:
                                    st.write(f"  - {warning}")
                            
                            # Clear confirmation state
                            st.session_state[confirm_delete_key] = False
                            # Auto-refresh to show updated knowledge base
                            st.rerun()
                        else:
                            st.error(f"❌ {result['message']}")
                    except Exception as e:
                        st.error(f"❌ Error deleting document: {e}")
                        logger.error(f"Error deleting document: {e}", exc_info=True)
            else:
                st.warning("Please confirm deletion by checking the checkbox.")
        
        st.markdown("---")
        
        # Display document info and search capabilities
        st.markdown("### 📖 Document Content")
        st.info(f"This document has {selected_doc['chunk_count']} chunks stored in ChromaDB vector database.")
        st.info("💡 **Note:** Chunks are now stored in ChromaDB for semantic search. Use the search box above to query the vector database.")
        
        # Semantic search for this document
        if search_query:
            st.markdown("### 🔍 Semantic Search Results")
            try:
                from llm.knowledge_base import KnowledgeBase
                kb = KnowledgeBase()
                
                # Add document filter to query
                doc_filter_query = f"{search_query} {selected_doc['title']}"
                results = kb.get_relevant_content(doc_filter_query, max_results=5)
                
                # Filter results to this document
                doc_results = [
                    r for r in results 
                    if r.get('source') == selected_doc['metadata'].get('filename') or 
                       r.get('source') == selected_doc['metadata'].get('url')
                ]
                
                if doc_results:
                    st.success(f"Found {len(doc_results)} relevant chunks for '{search_query}'")
                    for idx, result in enumerate(doc_results, 1):
                        with st.expander(f"📄 Result {idx} (Score: {result.get('score', 0):.4f})"):
                            st.markdown(f"**Source:** {result.get('source', 'Unknown')}")
                            st.markdown(f"**Title:** {result.get('title', 'Unknown')}")
                            st.markdown("**Content:**")
                            st.text_area(
                                "",
                                value=result.get('content', ''),
                                height=150,
                                key=f"search_result_{idx}",
                                disabled=True,
                                label_visibility="collapsed"
                            )
                else:
                    st.info(f"No chunks found matching '{search_query}' in this document.")
            except Exception as e:
                st.error(f"❌ Error searching ChromaDB: {e}")
                logger.error(f"Error searching ChromaDB: {e}", exc_info=True)
        else:
            st.info("💡 Enter a search query above to find relevant chunks from this document.")
        
        # Show all documents summary
        st.markdown("---")
        st.markdown("### 📚 All Documents Summary")
        
        col1, col2 = st.columns(2)
        
        with col1:
            st.subheader("📄 PDFs")
            pdfs = metadata.get("pdfs", [])
            if pdfs:
                for idx, pdf in enumerate(pdfs):
                    pdf_key = f"pdf_{idx}"
                    with st.expander(f"📄 {pdf.get('title', pdf.get('filename', 'Unknown'))}"):
                        st.write(f"**Source:** {pdf.get('source', 'N/A')}")
                        st.write(f"**Type:** {pdf.get('type', 'N/A')}")
                        st.write(f"**Category:** {pdf.get('category', 'N/A')}")
                        st.write(f"**Chunks:** {pdf.get('chunk_count', 0)}")
                        if pdf.get('description'):
                            st.write(f"**Description:** {pdf.get('description')}")
                        
                        # Delete button for PDF
                        st.markdown("---")
                        pdf_confirm_key = f"pdf_confirm_{idx}"
                        if pdf_confirm_key not in st.session_state:
                            st.session_state[pdf_confirm_key] = False
                        
                        pdf_confirm = st.checkbox(
                            "Confirm deletion",
                            key=f"pdf_delete_check_{idx}",
                            value=st.session_state[pdf_confirm_key]
                        )
                        st.session_state[pdf_confirm_key] = pdf_confirm
                        
                        if st.button("🗑️ Delete PDF", key=f"pdf_delete_btn_{idx}", disabled=not pdf_confirm):
                            if pdf_confirm:
                                with st.spinner("Deleting PDF and all associated files..."):
                                    try:
                                        from llm.knowledge_base import KnowledgeBase
                                        kb = KnowledgeBase()
                                        
                                        result = kb.delete_document(
                                            document_type="pdf",
                                            identifier=pdf.get('filename')
                                        )
                                        
                                        if result["success"]:
                                            st.success(f"✅ {result['message']}")
                                            st.rerun()
                                        else:
                                            st.error(f"❌ {result['message']}")
                                    except Exception as e:
                                        st.error(f"❌ Error deleting PDF: {e}")
                                        logger.error(f"Error deleting PDF: {e}", exc_info=True)
            else:
                st.info("No PDFs uploaded yet")
        
        with col2:
            st.subheader("🔗 URLs")
            urls = metadata.get("urls", [])
            if urls:
                for idx, url_item in enumerate(urls):
                    url_key = f"url_{idx}"
                    with st.expander(f"🔗 {url_item.get('title', url_item.get('url', 'Unknown'))}"):
                        st.write(f"**URL:** {url_item.get('url')}")
                        st.write(f"**Source:** {url_item.get('source', 'N/A')}")
                        st.write(f"**Type:** {url_item.get('type', 'N/A')}")
                        st.write(f"**Category:** {url_item.get('category', 'N/A')}")
                        st.write(f"**Chunks:** {url_item.get('chunk_count', 0)}")
                        if url_item.get('description'):
                            st.write(f"**Description:** {url_item.get('description')}")
                        
                        # Delete button for URL
                        st.markdown("---")
                        url_confirm_key = f"url_confirm_{idx}"
                        if url_confirm_key not in st.session_state:
                            st.session_state[url_confirm_key] = False
                        
                        url_confirm = st.checkbox(
                            "Confirm deletion",
                            key=f"url_delete_check_{idx}",
                            value=st.session_state[url_confirm_key]
                        )
                        st.session_state[url_confirm_key] = url_confirm
                        
                        if st.button("🗑️ Delete URL", key=f"url_delete_btn_{idx}", disabled=not url_confirm):
                            if url_confirm:
                                with st.spinner("Deleting URL and all associated files..."):
                                    try:
                                        from llm.knowledge_base import KnowledgeBase
                                        kb = KnowledgeBase()
                                        
                                        result = kb.delete_document(
                                            document_type="url",
                                            identifier=url_item.get('url')
                                        )
                                        
                                        if result["success"]:
                                            st.success(f"✅ {result['message']}")
                                            st.rerun()
                                        else:
                                            st.error(f"❌ {result['message']}")
                                    except Exception as e:
                                        st.error(f"❌ Error deleting URL: {e}")
                                        logger.error(f"Error deleting URL: {e}", exc_info=True)
            else:
                st.info("No URLs added yet")


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

