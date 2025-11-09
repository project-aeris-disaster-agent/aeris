"""Test RAG retrieval for UWAN query."""
from llm.knowledge_base import KnowledgeBase
import logging

logging.basicConfig(level=logging.INFO)

kb = KnowledgeBase()
query = "UWAN"

print(f"Testing RAG retrieval for query: '{query}'")
print("=" * 60)

results = kb.get_relevant_content(query, max_results=3)

print(f"\nFound {len(results)} results")
print("=" * 60)

for i, r in enumerate(results, 1):
    print(f"\nResult {i}:")
    print(f"  Score: {r['score']:.2f}")
    print(f"  Title: {r.get('title', 'Unknown')}")
    print(f"  Source: {r.get('source', 'Unknown')}")
    print(f"  Content preview: {r['content'][:300]}...")

