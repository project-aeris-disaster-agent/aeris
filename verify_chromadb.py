"""
RAG Knowledge Base Verification Script
Tests semantic search against the ChromaDB vector store.

Phase 4: Verification and Retriever Test
This script loads the ChromaDB index and performs semantic queries to verify
the migration was successful and the vector database is operational.
"""

import logging
from pathlib import Path
from llama_index.core import VectorStoreIndex, StorageContext
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


def load_vector_index(
    persist_dir: str = "chroma_db_store",
    collection_name: str = "aeris_knowledge_base",
    embed_model_name: str = "sentence-transformers/all-MiniLM-L6-v2"
) -> VectorStoreIndex:
    """
    Load the existing ChromaDB vector index.
    
    Args:
        persist_dir: Directory where ChromaDB data is persisted
        collection_name: Name of the ChromaDB collection
        embed_model_name: Name of the HuggingFace embedding model (must match migration)
        
    Returns:
        VectorStoreIndex ready for querying
    """
    logger.info("=" * 60)
    logger.info("Loading ChromaDB Vector Index")
    logger.info("=" * 60)
    
    # Verify persist directory exists
    persist_path = Path(persist_dir)
    if not persist_path.exists():
        raise FileNotFoundError(
            f"ChromaDB persist directory not found: {persist_dir}\n"
            "Please run migrate_to_chromadb.py first to create the index."
        )
    
    # Initialize ChromaDB client
    chroma_client = chromadb.PersistentClient(
        path=str(persist_path),
        settings=Settings(
            anonymized_telemetry=False,
            allow_reset=True
        )
    )
    
    # Get collection
    try:
        chroma_collection = chroma_client.get_collection(name=collection_name)
        logger.info(f"Loaded collection: {collection_name}")
    except Exception as e:
        raise FileNotFoundError(
            f"Collection '{collection_name}' not found in ChromaDB.\n"
            "Please run migrate_to_chromadb.py first to create the index."
        ) from e
    
    # Initialize embedding model (must match migration)
    logger.info(f"Initializing embedding model: {embed_model_name}")
    embed_model = HuggingFaceEmbedding(
        model_name=embed_model_name,
        device="cpu"
    )
    
    # Create vector store from existing collection
    vector_store = ChromaVectorStore(chroma_collection=chroma_collection)
    storage_context = StorageContext.from_defaults(vector_store=vector_store)
    
    # Load index from storage
    logger.info("Loading index from ChromaDB...")
    index = VectorStoreIndex.from_vector_store(
        vector_store=vector_store,
        embed_model=embed_model
    )
    
    logger.info("Index loaded successfully!")
    return index


def test_semantic_search(
    index: VectorStoreIndex,
    query: str,
    top_k: int = 5
) -> None:
    """
    Perform a semantic search query and display results.
    Uses retriever (no LLM required) to test vector search functionality.
    
    Args:
        index: VectorStoreIndex to query
        query: Search query string
        top_k: Number of top results to return
    """
    logger.info("\n" + "=" * 60)
    logger.info(f"Semantic Search Query: '{query}'")
    logger.info("=" * 60)
    
    # Create retriever (no LLM needed for retrieval testing)
    retriever = index.as_retriever(similarity_top_k=top_k)
    
    # Perform retrieval
    logger.info("Searching vector database...")
    nodes = retriever.retrieve(query)
    
    # Display results
    logger.info("\n" + "-" * 60)
    logger.info(f"Retrieved {len(nodes)} Chunks:")
    logger.info("-" * 60)
    
    if not nodes:
        logger.warning("No results found for this query.")
        return
    
    for i, node in enumerate(nodes, 1):
        logger.info(f"\n[{i}] Relevance Score: {node.score:.4f}")
        logger.info(f"Chunk ID: {node.node_id}")
        logger.info(f"Source: {node.metadata.get('source', 'Unknown')}")
        logger.info(f"Title: {node.metadata.get('title', 'Unknown')}")
        logger.info(f"Category: {node.metadata.get('category', 'Unknown')}")
        logger.info(f"Content Preview: {node.text[:200]}...")


def run_verification_tests(
    persist_dir: str = "chroma_db_store",
    collection_name: str = "aeris_knowledge_base",
    embed_model_name: str = "sentence-transformers/all-MiniLM-L6-v2"
) -> None:
    """
    Run a series of verification tests to ensure the vector database is working correctly.
    
    Args:
        persist_dir: Directory where ChromaDB data is persisted
        collection_name: Name of the ChromaDB collection
        embed_model_name: Name of the HuggingFace embedding model
    """
    logger.info("=" * 60)
    logger.info("Phase 4: Verification and Retriever Test")
    logger.info("=" * 60)
    
    # Load index
    index = load_vector_index(persist_dir, collection_name, embed_model_name)
    
    # Test queries
    test_queries = [
        "What is the wind speed of tropical storm UWAN?",
        "What areas are affected by wind signals?",
        "What is the forecast track for the typhoon?",
        "What are the coastal flooding warnings?",
        "What evacuation instructions are provided?"
    ]
    
    logger.info("\n" + "=" * 60)
    logger.info("Running Verification Tests")
    logger.info("=" * 60)
    
    for i, query in enumerate(test_queries, 1):
        logger.info(f"\n\nTest Query {i}/{len(test_queries)}")
        try:
            test_semantic_search(index, query, top_k=3)
        except Exception as e:
            logger.error(f"Error executing query '{query}': {e}", exc_info=True)
    
    logger.info("\n" + "=" * 60)
    logger.info("Verification Complete!")
    logger.info("=" * 60)
    logger.info("\nThe vector database is operational and ready for use.")
    logger.info("You can now integrate this into your Streamlit application.")


def interactive_query_mode(
    persist_dir: str = "chroma_db_store",
    collection_name: str = "aeris_knowledge_base",
    embed_model_name: str = "sentence-transformers/all-MiniLM-L6-v2"
) -> None:
    """
    Interactive mode for testing custom queries.
    
    Args:
        persist_dir: Directory where ChromaDB data is persisted
        collection_name: Name of the ChromaDB collection
        embed_model_name: Name of the HuggingFace embedding model
    """
    logger.info("=" * 60)
    logger.info("Interactive Query Mode")
    logger.info("=" * 60)
    logger.info("Enter queries to test semantic search (type 'exit' to quit)\n")
    
    # Load index
    index = load_vector_index(persist_dir, collection_name, embed_model_name)
    
    while True:
        try:
            query = input("\nEnter your query: ").strip()
            if query.lower() in ['exit', 'quit', 'q']:
                logger.info("Exiting interactive mode.")
                break
            
            if not query:
                continue
            
            test_semantic_search(index, query, top_k=5)
        except KeyboardInterrupt:
            logger.info("\nExiting interactive mode.")
            break
        except Exception as e:
            logger.error(f"Error: {e}", exc_info=True)


def main():
    """
    Main function: Run verification tests.
    """
    import sys
    
    # Check if interactive mode requested
    if len(sys.argv) > 1 and sys.argv[1] == "--interactive":
        interactive_query_mode()
    else:
        run_verification_tests()


if __name__ == "__main__":
    main()

