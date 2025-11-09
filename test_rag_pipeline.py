"""
Test script for RAG pipeline verification.
Tests knowledge base retrieval after ingestion.
"""

import sys
import os
from pathlib import Path

# Fix Windows console encoding for emojis
if sys.platform == 'win32':
    os.system('chcp 65001 >nul 2>&1')
    sys.stdout.reconfigure(encoding='utf-8') if hasattr(sys.stdout, 'reconfigure') else None

# Add project root to path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from llm.knowledge_base import KnowledgeBase
from llm.chunking import ContentChunker
import json

def test_knowledge_base_retrieval():
    """Test knowledge base retrieval functionality."""
    print("=" * 60)
    print("RAG Pipeline Test - Knowledge Base Retrieval")
    print("=" * 60)
    
    # Initialize knowledge base
    kb = KnowledgeBase()
    
    # Check metadata
    metadata = kb.get_knowledge_base_metadata()
    print(f"\n📊 Knowledge Base Status:")
    print(f"   Total documents: {metadata.get('total_documents', 0)}")
    print(f"   PDFs: {len(metadata.get('pdfs', []))}")
    print(f"   URLs: {len(metadata.get('urls', []))}")
    
    if metadata.get('total_documents', 0) == 0:
        print("\n⚠️  No documents found in knowledge base!")
        print("   Please upload a PDF via the Streamlit admin interface first.")
        return False
    
    # Test retrieval with sample queries
    test_queries = [
        "emergency evacuation procedures",
        "disaster response protocols",
        "shelter locations",
        "medical assistance"
    ]
    
    print("\n🔍 Testing Retrieval:")
    print("-" * 60)
    
    for query in test_queries:
        print(f"\nQuery: '{query}'")
        results = kb.get_relevant_content(query, max_results=3)
        
        if results:
            print(f"   Found {len(results)} relevant chunks:")
            for i, result in enumerate(results, 1):
                print(f"   {i}. Score: {result.get('score', 0):.2f}")
                print(f"      Source: {result.get('source', 'Unknown')}")
                print(f"      Title: {result.get('title', 'Unknown')}")
                content_preview = result.get('content', '')[:100]
                print(f"      Preview: {content_preview}...")
        else:
            print("   No relevant chunks found")
    
    print("\n" + "=" * 60)
    return True

def test_chunk_loading():
    """Test loading chunks from index files."""
    print("\n📦 Testing Chunk Loading:")
    print("-" * 60)
    
    kb = KnowledgeBase()
    metadata = kb.get_knowledge_base_metadata()
    
    chunker = ContentChunker()
    
    # Test loading PDF chunks
    for pdf in metadata.get('pdfs', []):
        chunk_file = pdf.get('chunk_index_file')
        if chunk_file:
            # Handle relative paths
            if not Path(chunk_file).is_absolute():
                chunk_file = Path("knowledge_base") / chunk_file
            
            print(f"\n📄 PDF: {pdf.get('title', pdf.get('filename', 'Unknown'))}")
            print(f"   Chunk file: {chunk_file}")
            
            if Path(chunk_file).exists():
                chunks = chunker.load_chunks(str(chunk_file))
                print(f"   ✅ Loaded {len(chunks)} chunks")
                if chunks:
                    print(f"   Sample chunk: {chunks[0].get('content', '')[:80]}...")
            else:
                print(f"   ❌ Chunk file not found: {chunk_file}")

if __name__ == "__main__":
    print("\n🚀 Starting RAG Pipeline Tests...\n")
    
    # Test 1: Knowledge base retrieval
    retrieval_success = test_knowledge_base_retrieval()
    
    # Test 2: Chunk loading
    if retrieval_success:
        test_chunk_loading()
    
    print("\n✅ Testing complete!")
    print("\nNext steps:")
    print("1. Upload a PDF via Streamlit admin (http://localhost:8501)")
    print("2. Run this test again to verify retrieval")
    print("3. Test RAG integration in message handler")

