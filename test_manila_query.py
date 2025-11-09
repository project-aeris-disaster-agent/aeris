"""Test what's actually being sent to LLM for Manila landfall query."""
import os
import sys
import codecs
import asyncio

# Fix Windows console encoding
os.system('chcp 65001 >nul 2>&1')
if sys.stdout.encoding != 'utf-8':
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')

from llm.prompt_builder import PromptBuilder, CharacterCard
from llm.openai_client import OpenAIClient
from pathlib import Path

async def test_query():
    # Load character card
    card_path = Path("characters/aeris.character.json")
    character_card = CharacterCard(str(card_path))
    
    # Create prompt builder
    prompt_builder = PromptBuilder(character_card, use_knowledge_base=True)
    
    # Test query
    user_query = "im in manila, what time will it arrive and hit landfall here?"
    
    # Build messages
    messages = prompt_builder.build_messages(
        conversation_history=[],
        context={},
        user_query=user_query
    )
    
    print("=" * 60)
    print("MESSAGES BEING SENT TO LLM")
    print("=" * 60)
    
    for i, msg in enumerate(messages):
        role = msg['role']
        content = msg['content']
        
        print(f"\n[{i+1}] ROLE: {role.upper()}")
        print("-" * 60)
        
        if role == 'system':
            # Check if this is RAG context
            if 'CRITICAL INFORMATION' in content:
                print(">>> THIS IS RAG CONTEXT <<<")
                print(content[:500])
                print("\n... [TRUNCATED] ...\n")
                print(content[-500:])
            else:
                print(content[:500])
                print("\n... [TRUNCATED] ...\n")
                print(content[-500:])
        else:
            print(content)
        
        print("-" * 60)
    
    # Check RAG injection
    rag_messages = [m for m in messages if m['role'] == 'system' and 'CRITICAL INFORMATION' in m.get('content', '')]
    print(f"\n✅ RAG context messages: {len(rag_messages)}")
    
    # Test actual LLM call
    print("\n" + "=" * 60)
    print("TESTING ACTUAL LLM CALL")
    print("=" * 60)
    
    try:
        llm_client = OpenAIClient()
        response = await llm_client.chat(
            messages=messages,
            temperature=0.7,
            max_tokens=650
        )
        
        print(f"\nLLM Response ({len(response)} chars):")
        print("-" * 60)
        print(response)
        print("-" * 60)
        
        # Check if response references knowledge base
        keywords = ['uwan', 'tropical', 'cyclone', 'storm', 'pagasa', 'landfall', 'manila', 'isabela', 'aurora']
        found_keywords = [kw for kw in keywords if kw in response.lower()]
        if found_keywords:
            print(f"\n✅ Response references: {found_keywords}")
        else:
            print(f"\n❌ Response does NOT reference knowledge base keywords!")
            print("This indicates the LLM is ignoring RAG context.")
        
        await llm_client.close()
        
    except Exception as e:
        print(f"\n❌ Error calling LLM: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_query())

