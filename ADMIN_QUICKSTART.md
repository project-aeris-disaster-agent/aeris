# Streamlit Admin Interface - Quick Start Guide

## ✅ Setup Complete!

The Streamlit admin interface is ready for PDF/URL ingestion.

## Quick Start

### 1. Install PyPDF2 (if not already installed)

```bash
pip install PyPDF2
```

### 2. Set Admin Password

Add to your `.env` file:
```bash
ADMIN_SECRET_KEY=your_secret_password_here
```

### 3. Run Admin Interface

```bash
streamlit run admin/streamlit_app.py
```

Or:
```bash
python run_admin.py
```

The interface will open at: `http://localhost:8501`

## Features Available

### ✅ Knowledge Base Management
- **Upload PDF**: Upload disaster response PDFs with metadata
- **Add URL**: Add URLs to scrape disaster information
- **View Knowledge Base**: See all uploaded documents

### ⏳ Coming Soon
- PDF text extraction (structure ready)
- URL content scraping (structure ready)
- Knowledge base integration with LLM (partially implemented)
- Emergency announcements
- Analytics dashboard

## How It Works

1. **Upload PDFs** → Stored in `knowledge_base/pdfs/`
2. **Add URLs** → Metadata stored in `knowledge_base/metadata.json`
3. **Knowledge Base** → Integrated into LLM system prompts
4. **AERIS** → Uses knowledge base for more accurate responses

## File Structure Created

```
knowledge_base/
├── pdfs/              # Uploaded PDF files
├── urls/              # URL metadata (future)
├── processed/          # Extracted text (future)
└── metadata.json      # Knowledge base metadata
```

## Next Steps

1. **Test Admin Interface**: Run Streamlit and upload a test PDF
2. **Integrate PDF Processing**: Extract text from PDFs (next step)
3. **Integrate URL Scraping**: Scrape content from URLs (next step)
4. **Enhance LLM Integration**: Use extracted content in prompts (next step)

## Testing

1. Start admin interface: `streamlit run admin/streamlit_app.py`
2. Enter admin password (from `.env`)
3. Go to "Knowledge Base" → "Upload PDF"
4. Upload a test PDF
5. Check `knowledge_base/metadata.json` to see it was added

## Integration Status

- ✅ Admin interface structure
- ✅ PDF upload interface
- ✅ URL addition interface
- ✅ Metadata management
- ✅ Knowledge base integration in prompts (basic)
- ⏳ PDF text extraction (structure ready)
- ⏳ URL content scraping (structure ready)
- ⏳ Content indexing and search

## Ready to Test!

Run the admin interface and start uploading PDFs/URLs to train AERIS!

