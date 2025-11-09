"""Test RAG prompt injection to see what the LLM receives."""
import os
import sys
import codecs

# Fix Windows console encoding
os.system('chcp 65001 >nul 2>&1')
if sys.stdout.encoding != 'utf-8':
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')

from llm.prompt_builder import PromptBuilder, CharacterCard
from pathlib import Path

# Load character card
card_path = Path("characters/aeris.character.json")
character_card = CharacterCard(str(card_path))

# Create prompt builder
prompt_builder = PromptBuilder(character_card, use_knowledge_base=True)

# Test query
user_query = "tell me about UWAN"

# Build messages
messages = prompt_builder.build_messages(
    conversation_history=[],
    context={},
    user_query=user_query
)

print("=" * 60)
print("PROMPT STRUCTURE FOR LLM")
print("=" * 60)

for i, msg in enumerate(messages):
    role = msg['role']
    content = msg['content']
    
    print(f"\n[{i+1}] ROLE: {role.upper()}")
    print("-" * 60)
    
    if role == 'system':
        # Show first and last parts of system messages
        if len(content) > 1000:
            try:
                print(content[:500])
                print("\n... [TRUNCATED] ...\n")
                print(content[-500:])
            except UnicodeEncodeError:
                # Fallback: encode problematic characters
                print(content[:500].encode('utf-8', errors='replace').decode('utf-8'))
                print("\n... [TRUNCATED] ...\n")
                print(content[-500:].encode('utf-8', errors='replace').decode('utf-8'))
        else:
            try:
                print(content)
            except UnicodeEncodeError:
                print(content.encode('utf-8', errors='replace').decode('utf-8'))
    else:
        preview = content[:200] + "..." if len(content) > 200 else content
        try:
            print(preview)
        except UnicodeEncodeError:
            print(preview.encode('utf-8', errors='replace').decode('utf-8'))
    
    print("-" * 60)

print(f"\nTotal messages: {len(messages)}")
print(f"Total system content length: {sum(len(m['content']) for m in messages if m['role'] == 'system')} characters")

# Check if RAG context is present
rag_messages = [m for m in messages if m['role'] == 'system' and 'CRITICAL INFORMATION' in m['content']]
print(f"\nRAG context messages: {len(rag_messages)}")
if rag_messages:
    print("✅ RAG context is being injected!")
else:
    print("❌ RAG context NOT found in messages!")

