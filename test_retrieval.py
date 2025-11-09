"""Test RAG retrieval - run from project root directory"""
from llm.knowledge_base import KnowledgeBase

kb = KnowledgeBase()

# Test queries
queries = [
    "tropical cyclone",
    "wind signals",
    "PAGASA",
    "storm warning"
]

print("=" * 60)
print("RAG Retrieval Test")
print("=" * 60)

for query in queries:
    print(f"\n🔍 Query: '{query}'")
    results = kb.get_relevant_content(query, max_results=2)
    
    if results:
        print(f"   Found {len(results)} relevant chunks:")
        for i, r in enumerate(results, 1):
            print(f"   {i}. Score: {r['score']:.2f}")
            print(f"      Source: {r.get('source', 'Unknown')}")
            print(f"      Title: {r.get('title', 'Unknown')}")
            preview = r['content'][:80].replace('\n', ' ')
            print(f"      Preview: {preview}...")
    else:
        print("   No results found")

print("\n" + "=" * 60)
print("✅ RAG Pipeline Test Complete!")

