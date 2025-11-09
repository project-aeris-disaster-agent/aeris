"""Test RAG retrieval and prompt building for storm queries."""
import logging
from llm.knowledge_base import KnowledgeBase
from llm.prompt_builder import PromptBuilder, CharacterCard

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Test query
test_query = "when will the storm leave the philippines"

print("=" * 60)
print("Testing RAG Retrieval and Prompt Building")
print("=" * 60)

# Test 1: RAG Retrieval
print(f"\n1. Testing RAG retrieval for: '{test_query}'")
kb = KnowledgeBase()
results = kb.get_relevant_content(test_query, max_results=5)

print(f"\nFound {len(results)} results:")
for i, r in enumerate(results, 1):
    print(f"\n[{i}] Score: {r['score']:.4f}")
    print(f"    Source: {r.get('source', 'Unknown')}")
    print(f"    Title: {r.get('title', 'Unknown')}")
    print(f"    Content preview: {r.get('content', '')[:300]}...")

# Test 2: Prompt Building
print("\n" + "=" * 60)
print("2. Testing Prompt Building with RAG")
print("=" * 60)

character_card = CharacterCard("characters/aeris.character.json")
prompt_builder = PromptBuilder(character_card, use_knowledge_base=True)

messages = prompt_builder.build_messages(
    conversation_history=[],
    user_query=test_query,
    is_emergency=False
)

# Check system message
system_msg = next((m['content'] for m in messages if m['role'] == 'system'), '')
has_rag = 'Relevant Information from Knowledge Base' in system_msg
has_prohibition = 'NEVER refer users to external websites' in system_msg or 'NEVER refer' in system_msg

print(f"\nRAG Context Injected: {has_rag}")
print(f"External Reference Prohibition: {has_prohibition}")

if has_rag:
    # Extract RAG section
    rag_start = system_msg.find('## Relevant Information from Knowledge Base')
    if rag_start != -1:
        rag_end = system_msg.find('\n\n**CRITICAL INSTRUCTIONS', rag_start)
        if rag_end == -1:
            rag_end = system_msg.find('\n\n**Add character', rag_start)
        if rag_end == -1:
            rag_end = min(rag_start + 2000, len(system_msg))
        
        rag_section = system_msg[rag_start:rag_end]
        print(f"\nRAG Context Preview (first 500 chars):")
        print(rag_section[:500] + "...")
        
        # Check for critical instructions
        if 'CRITICAL INSTRUCTIONS' in system_msg:
            instructions_start = system_msg.find('**CRITICAL INSTRUCTIONS')
            instructions_end = system_msg.find('\n\n', instructions_start + 100)
            if instructions_end == -1:
                instructions_end = instructions_start + 800
            instructions = system_msg[instructions_start:instructions_end]
            print(f"\nCritical Instructions:")
            print(instructions)

print("\n" + "=" * 60)
print("Test Complete")
print("=" * 60)

