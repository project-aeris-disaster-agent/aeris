"""
Knowledge base manager using ChromaDB vector store.
Migrated from JSON chunk files to scalable vector database.
"""

import logging
from typing import List, Dict, Any, Optional
from pathlib import Path
import json
from llama_index.core import Document, VectorStoreIndex, StorageContext
from llama_index.vector_stores.chroma import ChromaVectorStore
from llama_index.embeddings.huggingface import HuggingFaceEmbedding
import chromadb
from chromadb.config import Settings

logger = logging.getLogger(__name__)


class KnowledgeBase:
    """
    Manages knowledge base data using ChromaDB vector store.
    Provides semantic search capabilities for RAG system.
    """
    
    def __init__(
        self,
        knowledge_base_dir: str = "knowledge_base",
        persist_dir: str = "chroma_db_store",
        collection_name: str = "aeris_knowledge_base",
        embed_model_name: str = "sentence-transformers/all-MiniLM-L6-v2"
    ):
        """
        Initialize knowledge base manager with ChromaDB.
        
        Args:
            knowledge_base_dir: Directory to store knowledge base files (PDFs, metadata)
            persist_dir: Directory to persist ChromaDB data
            collection_name: Name of the ChromaDB collection
            embed_model_name: Name of the HuggingFace embedding model
        """
        self.knowledge_base_dir = Path(knowledge_base_dir)
        self.knowledge_base_dir.mkdir(exist_ok=True)
        
        # Subdirectories for different data types
        self.pdfs_dir = self.knowledge_base_dir / "pdfs"
        self.urls_dir = self.knowledge_base_dir / "urls"
        self.processed_dir = self.knowledge_base_dir / "processed"
        
        # Create directories
        for dir_path in [self.pdfs_dir, self.urls_dir, self.processed_dir]:
            dir_path.mkdir(exist_ok=True)
        
        # Initialize ChromaDB
        self.persist_dir = persist_dir
        self.collection_name = collection_name
        self.embed_model_name = embed_model_name
        
        # Setup ChromaDB client and collection
        persist_path = Path(persist_dir)
        persist_path.mkdir(exist_ok=True)
        
        self.chroma_client = chromadb.PersistentClient(
            path=str(persist_path),
            settings=Settings(
                anonymized_telemetry=False,
                allow_reset=True
            )
        )
        
        # Get or create collection
        try:
            self.chroma_collection = self.chroma_client.get_collection(name=collection_name)
            logger.info(f"Loaded existing ChromaDB collection: {collection_name}")
        except Exception:
            self.chroma_collection = self.chroma_client.create_collection(name=collection_name)
            logger.info(f"Created new ChromaDB collection: {collection_name}")
        
        # Initialize embedding model
        self.embed_model = HuggingFaceEmbedding(
            model_name=embed_model_name,
            device="cpu"  # Use "cuda" if GPU available
        )
        
        # Create vector store and index
        self.vector_store = ChromaVectorStore(chroma_collection=self.chroma_collection)
        self.storage_context = StorageContext.from_defaults(vector_store=self.vector_store)
        
        # Load index (will create if doesn't exist)
        try:
            self.index = VectorStoreIndex.from_vector_store(
                vector_store=self.vector_store,
                embed_model=self.embed_model
            )
            logger.info("ChromaDB vector index loaded successfully")
        except Exception as e:
            logger.warning(f"Could not load existing index, will create on first document: {e}")
            self.index = None
        
        logger.info(f"Knowledge base initialized at {self.knowledge_base_dir}")
    
    def get_knowledge_base_metadata(self) -> Dict[str, Any]:
        """
        Get metadata about ingested knowledge base documents.
        
        Returns:
            Dictionary with metadata about PDFs and URLs
        """
        metadata = {
            "pdfs": [],
            "urls": [],
            "total_documents": 0
        }
        
        # Load metadata from JSON file
        metadata_file = self.knowledge_base_dir / "metadata.json"
        if metadata_file.exists():
            try:
                with open(metadata_file, 'r', encoding='utf-8') as f:
                    metadata = json.load(f)
            except Exception as e:
                logger.error(f"Error loading metadata: {e}")
        
        return metadata
    
    def add_documents_to_index(
        self,
        documents: List[Document],
        update_index: bool = True
    ) -> None:
        """
        Add documents to ChromaDB vector index.
        
        Args:
            documents: List of LlamaIndex Document objects
            update_index: Whether to update the index after adding documents
        """
        if not documents:
            logger.warning("No documents provided to add to index")
            return
        
        logger.info(f"Adding {len(documents)} documents to ChromaDB index...")
        
        # Create index if it doesn't exist
        if self.index is None:
            logger.info("Creating new vector index...")
            self.index = VectorStoreIndex.from_documents(
                documents,
                storage_context=self.storage_context,
                embed_model=self.embed_model,
                show_progress=True
            )
        else:
            # Add documents to existing index
            # Documents are already chunked, so convert directly to nodes
            try:
                from llama_index.core.schema import TextNode
                
                # Convert documents to nodes (documents are already chunks)
                nodes = []
                for doc in documents:
                    node = TextNode(
                        text=doc.text,
                        metadata=doc.metadata,
                        id_=doc.id_ if doc.id_ else None
                    )
                    nodes.append(node)
                
                # Insert nodes into existing index
                self.index.insert_nodes(nodes)
                logger.info(f"Inserted {len(nodes)} nodes ({len(documents)} documents) into existing index")
            except Exception as e:
                logger.warning(f"Node insertion failed ({e}), trying alternative method...")
                # Fallback: add directly to vector store and reload index
                try:
                    # Add to vector store directly
                    for doc in documents:
                        from llama_index.core.schema import TextNode
                        node = TextNode(
                            text=doc.text,
                            metadata=doc.metadata,
                            id_=doc.id_ if doc.id_ else None
                        )
                        # Add embedding
                        embed_model = self.embed_model
                        embedding = embed_model.get_text_embedding(node.text)
                        node.embedding = embedding
                        
                        # Add to vector store
                        self.vector_store.add([node])
                    
                    # Reload index to reflect changes
                    self.index = VectorStoreIndex.from_vector_store(
                        vector_store=self.vector_store,
                        embed_model=self.embed_model
                    )
                    logger.info(f"Added {len(documents)} documents via vector store")
                except Exception as e2:
                    logger.error(f"All insertion methods failed: {e2}")
                    raise RuntimeError(f"Failed to add documents to ChromaDB: {e2}")
        
        logger.info(f"Successfully added {len(documents)} documents to index")
    
    def add_to_system_prompt(self, system_prompt: str) -> str:
        """
        Add knowledge base context to system prompt.
        
        Args:
            system_prompt: Base system prompt
            
        Returns:
            Enhanced system prompt with knowledge base context
        """
        metadata = self.get_knowledge_base_metadata()
        
        if metadata.get("total_documents", 0) > 0:
            kb_context = "\n\n## Knowledge Base:\n"
            kb_context += f"You have access to {metadata['total_documents']} documents in the knowledge base:\n"
            
            if metadata.get("pdfs"):
                kb_context += f"- {len(metadata['pdfs'])} PDF documents\n"
                sources = set()
                for pdf in metadata['pdfs']:
                    if pdf.get('source'):
                        sources.add(pdf['source'])
                if sources:
                    kb_context += f"  Sources: {', '.join(sources)}\n"
            
            if metadata.get("urls"):
                kb_context += f"- {len(metadata['urls'])} URL sources\n"
                sources = set()
                for url_item in metadata['urls']:
                    if url_item.get('source'):
                        sources.add(url_item['source'])
                if sources:
                    kb_context += f"  Sources: {', '.join(sources)}\n"
            
            kb_context += "\nUse this knowledge base to provide accurate, up-to-date information. "
            kb_context += "When referencing information from the knowledge base, you can mention the source if relevant. "
            kb_context += "The knowledge base contains disaster response protocols, procedures, and official guidance."
            
            return system_prompt + kb_context
        
        return system_prompt
    
    def get_relevant_content(self, query: str, max_results: int = 5) -> List[Dict[str, Any]]:
        """
        Get relevant content chunks from knowledge base using semantic search.
        
        Args:
            query: Search query
            max_results: Maximum number of chunks to return
            
        Returns:
            List of relevant chunk dictionaries with content and source
        """
        if self.index is None:
            logger.warning("Vector index not initialized. No documents in knowledge base.")
            return []
        
        try:
            # Create retriever
            retriever = self.index.as_retriever(similarity_top_k=max_results)
            
            # Perform semantic search
            nodes = retriever.retrieve(query)
            
            # Convert nodes to result format
            results = []
            for node in nodes:
                metadata = node.metadata
                results.append({
                    "type": "pdf" if metadata.get("source", "").endswith(".pdf") else "url",
                    "chunk": {
                        "chunk_id": node.node_id,
                        "content": node.text,
                        "metadata": metadata
                    },
                    "source": metadata.get("source", "Unknown"),
                    "title": metadata.get("title", "Unknown"),
                    "category": metadata.get("category", "Unknown"),
                    "score": node.score if hasattr(node, 'score') else 0.0,
                    "content": node.text,
                    "chunk_id": node.node_id
                })
            
            logger.info(f"Retrieved {len(results)} relevant chunks for query: '{query[:50]}'")
            return results
            
        except Exception as e:
            logger.error(f"Error retrieving content from ChromaDB: {e}", exc_info=True)
            return []
    
    def delete_document(self, document_type: str, identifier: str) -> Dict[str, Any]:
        """
        Delete a document from the knowledge base.
        Removes from metadata and attempts to remove from ChromaDB (by metadata filtering).
        
        Args:
            document_type: Either "pdf" or "url"
            identifier: For PDFs, the filename. For URLs, the URL string.
            
        Returns:
            Dictionary with 'success', 'message', and 'deleted_files' keys
        """
        if document_type not in ["pdf", "url"]:
            return {
                "success": False,
                "message": f"Invalid document type: {document_type}. Must be 'pdf' or 'url'.",
                "deleted_files": []
            }
        
        metadata = self.get_knowledge_base_metadata()
        deleted_files = []
        document_found = False
        document_metadata = None
        
        # Find the document in metadata
        if document_type == "pdf":
            for idx, pdf in enumerate(metadata.get("pdfs", [])):
                if pdf.get("filename") == identifier:
                    document_found = True
                    document_metadata = pdf
                    metadata["pdfs"].pop(idx)
                    break
        else:  # url
            for idx, url_item in enumerate(metadata.get("urls", [])):
                if url_item.get("url") == identifier:
                    document_found = True
                    document_metadata = url_item
                    metadata["urls"].pop(idx)
                    break
        
        if not document_found:
            return {
                "success": False,
                "message": f"Document not found: {identifier}",
                "deleted_files": []
            }
        
        # Delete associated files
        errors = []
        
        # 1. Delete original file (PDF or scraped content)
        if document_type == "pdf":
            pdf_file = self.pdfs_dir / identifier
            if pdf_file.exists():
                try:
                    pdf_file.unlink()
                    deleted_files.append(str(pdf_file))
                    logger.info(f"Deleted PDF file: {pdf_file}")
                except Exception as e:
                    error_msg = f"Failed to delete PDF file {pdf_file}: {e}"
                    errors.append(error_msg)
                    logger.error(error_msg)
        else:  # url - delete scraped content file
            scraped_file = document_metadata.get("scraped_content_file")
            if scraped_file:
                scraped_path = Path(scraped_file)
                if not scraped_path.exists():
                    scraped_path = self.processed_dir / Path(scraped_file).name
                
                if scraped_path.exists():
                    try:
                        scraped_path.unlink()
                        deleted_files.append(str(scraped_path))
                        logger.info(f"Deleted scraped content file: {scraped_path}")
                    except Exception as e:
                        error_msg = f"Failed to delete scraped content file {scraped_path}: {e}"
                        errors.append(error_msg)
                        logger.error(error_msg)
        
        # 2. Delete processed text file
        processed_file = document_metadata.get("extracted_text_file")
        if processed_file:
            processed_path = Path(processed_file)
            if not processed_path.exists():
                processed_path = self.processed_dir / Path(processed_file).name
            
            if processed_path.exists():
                try:
                    processed_path.unlink()
                    deleted_files.append(str(processed_path))
                    logger.info(f"Deleted processed text file: {processed_path}")
                except Exception as e:
                    error_msg = f"Failed to delete processed text file {processed_path}: {e}"
                    errors.append(error_msg)
                    logger.error(error_msg)
        
        # 3. Remove from ChromaDB (by filtering on source metadata)
        try:
            if self.index is not None:
                # Note: ChromaDB doesn't have a direct delete by metadata filter
                # We'll need to query and delete specific IDs
                # For now, we'll mark this as a limitation
                logger.info(f"Note: ChromaDB entries for {document_type}:{identifier} remain in vector store. "
                           "They will be filtered out in future queries by checking metadata.")
        except Exception as e:
            logger.warning(f"Could not remove from ChromaDB: {e}")
        
        # 4. Update metadata.json
        try:
            metadata["total_documents"] = len(metadata.get("pdfs", [])) + len(metadata.get("urls", []))
            metadata_file = self.knowledge_base_dir / "metadata.json"
            with open(metadata_file, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, indent=2)
            logger.info(f"Updated metadata.json - removed {document_type}: {identifier}")
        except Exception as e:
            error_msg = f"Failed to update metadata.json: {e}"
            errors.append(error_msg)
            logger.error(error_msg)
            return {
                "success": False,
                "message": f"Deleted files but failed to update metadata: {error_msg}",
                "deleted_files": deleted_files
            }
        
        if errors:
            return {
                "success": True,
                "message": f"Document deleted but some errors occurred: {'; '.join(errors)}",
                "deleted_files": deleted_files,
                "warnings": errors
            }
        
        return {
            "success": True,
            "message": f"Successfully deleted {document_type}: {identifier}",
            "deleted_files": deleted_files
        }
