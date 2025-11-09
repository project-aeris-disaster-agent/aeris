"""Test more specific storm forecast queries."""
from llm.knowledge_base import KnowledgeBase

kb = KnowledgeBase()

queries = [
    "when will the storm leave the philippines",
    "forecast track UWAN exit philippines",
    "120 hour forecast UWAN outside PAR",
    "storm track forecast when will it leave"
]

print("=" * 60)
print("Testing Different Query Formulations")
print("=" * 60)

for query in queries:
    print(f"\n{'='*60}")
    print(f"Query: '{query}'")
    print("=" * 60)
    results = kb.get_relevant_content(query, max_results=3)
    print(f"Found {len(results)} results")
    
    for i, r in enumerate(results, 1):
        print(f"\n[{i}] Score: {r['score']:.4f}")
        content = r.get('content', '')
        # Look for forecast track keywords
        has_forecast = any(kw in content.lower() for kw in ['forecast', 'track', '120-hour', 'outside par', 'exit'])
        has_date = any(kw in content.lower() for kw in ['november', 'december', 'hour', 'am', 'pm'])
        print(f"    Has forecast keywords: {has_forecast}")
        print(f"    Has dates/times: {has_date}")
        print(f"    Content preview: {content[:200]}...")

