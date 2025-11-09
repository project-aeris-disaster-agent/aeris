# Streamlit Admin Interface Setup

## Overview

The Streamlit admin interface allows you to:
- 📄 Upload PDFs to train AERIS
- 🔗 Add URLs to scrape disaster response information
- 📋 View and manage knowledge base contents
- 📢 Create emergency announcements (Phase 4)
- 📊 View analytics (Phase 4)

## Quick Start

### 1. Install Additional Dependencies

```bash
pip install PyPDF2
```

(BeautifulSoup4 and requests are already in requirements.txt)

### 2. Set Admin Password

Add to your `.env` file:
```bash
ADMIN_SECRET_KEY=your_secret_password_here
```

### 3. Run Admin Interface

```bash
streamlit run admin/streamlit_app.py
```

Or use the helper script:
```bash
python run_admin.py
```

The interface will open in your browser at `http://localhost:8501`

## Features

### Knowledge Base Management

**Upload PDF:**
1. Go to "Knowledge Base" → "Upload PDF" tab
2. Select a PDF file
3. Fill in metadata (title, source, category, etc.)
4. Click "Process and Add to Knowledge Base"

**Add URL:**
1. Go to "Knowledge Base" → "Add URL" tab
2. Enter URL
3. Fill in metadata
4. Click "Add URL to Knowledge Base"

**View Knowledge Base:**
- See all uploaded PDFs and URLs
- View metadata for each document
- Track total documents

## Current Status

✅ **Implemented:**
- PDF upload interface
- URL addition interface
- Knowledge base metadata management
- File storage structure

⏳ **Next Steps (To Be Implemented):**
- PDF text extraction and processing
- URL content scraping
- Integration with LLM prompts
- Content indexing and search

## File Structure

```
knowledge_base/
├── pdfs/              # Uploaded PDF files
├── urls/              # URL metadata
├── processed/          # Extracted text content
└── metadata.json      # Knowledge base metadata
```

## Security

- Admin interface requires password authentication
- Set `ADMIN_SECRET_KEY` in `.env` file
- Never commit `.env` file to git

## Future Enhancements

- PDF text extraction (PyPDF2 integration)
- URL content scraping (BeautifulSoup integration)
- Content indexing for fast retrieval
- Integration with LLM prompts
- Content search functionality
- Auto-refresh for URLs
- Content deduplication

