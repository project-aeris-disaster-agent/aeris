"""
RAG Knowledge Base Migration Script
Migrates JSON chunk files to ChromaDB vector store using LlamaIndex.

Phases:
- Phase 2: Data Loading and Schema Identification
- Phase 3: Embedding and Indexing (ChromaDB + Sentence Transformers)
"""

import json
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
from llama_index.core import Document, VectorStoreIndex, StorageContext
from llama_index.core.schema import MetadataMode
from llama_index.vector_stores.chroma import ChromaVectorStore
from llama_index.embeddings.huggingface import HuggingFaceEmbedding
import chromadb
from chromadb.config import Settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def load_json_chunks(chunks_dir: str = "knowledge_base/chunks") -> List[Dict[str, Any]]:
    """
    Load all JSON chunk files from the specified directory.
    
    Args:
        chunks_dir: Path to directory containing JSON chunk files
        
    Returns:
        List of all chunks from all JSON files
    """
    chunks_path = Path(chunks_dir)
    if not chunks_path.exists():
        raise FileNotFoundError(f"Chunks directory not found: {chunks_dir}")
    
    all_chunks = []
    json_files = list(chunks_path.glob("*.json"))
    
    logger.info(f"Found {len(json_files)} JSON chunk files in {chunks_dir}")
    
    for json_file in json_files:
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                chunks = json.load(f)
                if isinstance(chunks, list):
                    all_chunks.extend(chunks)
                    logger.info(f"Loaded {len(chunks)} chunks from {json_file.name}")
                else:
                    logger.warning(f"Unexpected format in {json_file.name}, skipping")
        except Exception as e:
            logger.error(f"Error loading {json_file}: {e}")
            continue
    
    logger.info(f"Total chunks loaded: {len(all_chunks)}")
    return all_chunks


def convert_chunks_to_documents(chunks: List[Dict[str, Any]]) -> List[Document]:
    """
    Convert JSON chunk dictionaries to LlamaIndex Document objects.
    
    Preserves all metadata from the original chunks.
    
    Args:
        chunks: List of chunk dictionaries from JSON files
        
    Returns:
        List of LlamaIndex Document objects
    """
    documents = []
    
    for chunk in chunks:
        # Extract content (required field)
        content = chunk.get("content", "")
        if not content:
            logger.warning(f"Skipping chunk with empty content: {chunk.get('chunk_id', 'unknown')}")
            continue
        
        # Extract metadata
        chunk_metadata = chunk.get("metadata", {})
        
        # Build comprehensive metadata dictionary
        metadata = {
            # Original chunk fields
            "chunk_id": chunk.get("chunk_id", ""),
            "source": chunk.get("source", ""),
            "chunk_index": chunk.get("chunk_index", -1),
            "start_char": chunk.get("start_char", -1),
            "end_char": chunk.get("end_char", -1),
            "char_count": chunk.get("char_count", 0),
            
            # Nested metadata fields
            "title": chunk_metadata.get("title", ""),
            "type": chunk_metadata.get("type", ""),
            "category": chunk_metadata.get("category", ""),
            "description": chunk_metadata.get("description", ""),
            "source_url": chunk_metadata.get("source", ""),  # Renamed to avoid conflict
        }
        
        # Create LlamaIndex Document
        doc = Document(
            text=content,
            metadata=metadata,
            id_=chunk.get("chunk_id", None)  # Use chunk_id as document ID for deduplication
        )
        
        documents.append(doc)
    
    logger.info(f"Converted {len(documents)} chunks to LlamaIndex Documents")
    return documents


def setup_chromadb(persist_dir: str = "chroma_db_store", collection_name: str = "aeris_knowledge_base") -> tuple:
    """
    Initialize ChromaDB client and create/get collection.
    
    Args:
        persist_dir: Directory to persist ChromaDB data
        collection_name: Name of the ChromaDB collection
        
    Returns:
        Tuple of (chroma_client, chroma_collection)
    """
    # Create persist directory if it doesn't exist
    persist_path = Path(persist_dir)
    persist_path.mkdir(exist_ok=True)
    
    # Initialize ChromaDB client with persistence
    chroma_client = chromadb.PersistentClient(
        path=str(persist_path),
        settings=Settings(
            anonymized_telemetry=False,
            allow_reset=True
        )
    )
    
    # Get or create collection
    try:
        chroma_collection = chroma_client.get_collection(name=collection_name)
        logger.info(f"Found existing collection: {collection_name}")
    except Exception:
        chroma_collection = chroma_client.create_collection(name=collection_name)
        logger.info(f"Created new collection: {collection_name}")
    
    return chroma_client, chroma_collection


def create_vector_index(
    documents: List[Document],
    chroma_collection,
    embed_model_name: str = "sentence-transformers/all-MiniLM-L6-v2"
) -> VectorStoreIndex:
    """
    Create a VectorStoreIndex from documents using ChromaDB and HuggingFace embeddings.
    
    Args:
        documents: List of LlamaIndex Document objects
        chroma_collection: ChromaDB collection object
        embed_model_name: Name of the HuggingFace embedding model
        
    Returns:
        VectorStoreIndex ready for querying
    """
    logger.info(f"Initializing embedding model: {embed_model_name}")
    
    # Initialize HuggingFace embedding model
    embed_model = HuggingFaceEmbedding(
        model_name=embed_model_name,
        device="cpu"  # Use "cuda" if GPU available
    )
    
    logger.info("Creating ChromaDB vector store...")
    
    # Create ChromaDB vector store
    vector_store = ChromaVectorStore(chroma_collection=chroma_collection)
    
    # Create storage context
    storage_context = StorageContext.from_defaults(vector_store=vector_store)
    
    logger.info(f"Indexing {len(documents)} documents...")
    logger.info("This may take a few minutes for large document sets...")
    
    # Create index from documents
    index = VectorStoreIndex.from_documents(
        documents,
        storage_context=storage_context,
        embed_model=embed_model,
        show_progress=True
    )
    
    logger.info("Indexing complete!")
    return index


def migrate_to_chromadb(
    chunks_dir: str = "knowledge_base/chunks",
    persist_dir: str = "chroma_db_store",
    collection_name: str = "aeris_knowledge_base",
    embed_model_name: str = "sentence-transformers/all-MiniLM-L6-v2"
) -> VectorStoreIndex:
    """
    Complete migration pipeline: Load JSON chunks → Convert to Documents → Index in ChromaDB.
    
    Args:
        chunks_dir: Directory containing JSON chunk files
        persist_dir: Directory to persist ChromaDB data
        collection_name: Name of the ChromaDB collection
        embed_model_name: Name of the HuggingFace embedding model
        
    Returns:
        VectorStoreIndex ready for querying
    """
    logger.info("=" * 60)
    logger.info("RAG Knowledge Base Migration to ChromaDB")
    logger.info("=" * 60)
    
    # Phase 2: Load and convert chunks
    logger.info("\n" + "=" * 60)
    logger.info("Phase 2: Loading JSON Chunks")
    logger.info("=" * 60)
    chunks = load_json_chunks(chunks_dir)
    
    if not chunks:
        raise ValueError("No chunks found! Please verify the chunks directory path.")
    
    documents = convert_chunks_to_documents(chunks)
    
    # Phase 3: Setup ChromaDB and create index
    logger.info("\n" + "=" * 60)
    logger.info("Phase 3: Embedding and Indexing")
    logger.info("=" * 60)
    
    chroma_client, chroma_collection = setup_chromadb(persist_dir, collection_name)
    index = create_vector_index(documents, chroma_collection, embed_model_name)
    
    logger.info("\n" + "=" * 60)
    logger.info("Migration Complete!")
    logger.info("=" * 60)
    logger.info(f"ChromaDB store persisted to: {persist_dir}")
    logger.info(f"Collection name: {collection_name}")
    logger.info(f"Total documents indexed: {len(documents)}")
    logger.info("\nYou can now use the verification script to test semantic search.")
    
    return index


def main():
    """
    Main function: Run the complete migration process.
    """
    try:
        index = migrate_to_chromadb()
        return index
    except Exception as e:
        logger.error(f"Migration failed: {e}", exc_info=True)
        raise


if __name__ == "__main__":
    index = main()

