"""
RAG Storage Documentation

Where RAG Memory is Stored:
===========================

1. knowledge_base/pdfs/
   - Original PDF files uploaded by admins
   - Format: Original PDF files (.pdf)

2. knowledge_base/processed/
   - Extracted text from PDFs and URLs
   - Format: Plain text files (.txt)
   - Example: TCB#1_uwan.txt

3. knowledge_base/chunks/
   - Chunked content for RAG retrieval
   - Format: JSON (.json) or JSONL (.jsonl) files
   - Each file contains chunks with:
     * chunk_id: Unique identifier
     * source: Original filename/URL
     * content: Text content (800 chars per chunk)
     * metadata: Document metadata (title, source, category, etc.)
   - Example: TCB#1_uwan_chunks.json

4. knowledge_base/metadata.json
   - Master index of all documents
   - Contains:
     * List of all PDFs with metadata
     * List of all URLs with metadata
     * Total document count
     * References to chunk files

How RAG Memory Works:
=====================

1. Upload Flow:
   PDF/URL → Extract Text → Chunk Text → Save Chunks → Update Metadata

2. Retrieval Flow:
   User Query → Search Chunks → Score by Relevance → Return Top Results

3. Storage Structure:
   {
     "pdfs": [
       {
         "filename": "TCB#1_uwan.pdf",
         "title": "TCB#1_uwan.pdf",
         "source": "PAGASA",
         "chunk_index_file": "chunks/TCB#1_uwan_chunks.json",
         "chunk_count": 16
       }
     ],
     "urls": [],
     "total_documents": 1
   }

File Locations:
===============

- PDFs: knowledge_base/pdfs/TCB#1_uwan.pdf
- Extracted Text: knowledge_base/processed/TCB#1_uwan.txt
- Chunks: knowledge_base/chunks/TCB#1_uwan_chunks.json
- Metadata: knowledge_base/metadata.json

