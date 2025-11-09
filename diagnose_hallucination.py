"""
Comprehensive diagnostic script to investigate hallucination issues.
Checks for conflicting code, deprecated implementations, and prompt issues.
"""

import sys
import json
import asyncio
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from llm.prompt_builder import CharacterCard, PromptBuilder
from llm.openai_client import OpenAIClient
from bot.emergency_detector import EmergencyDetector

async def diagnose_hallucination():
    """Comprehensive diagnosis of hallucination issues."""
    print("=" * 80)
    print("HALLUCINATION DIAGNOSTIC REPORT")
    print("=" * 80)
    
    # Test query
    test_message = "no, im in an abandooned building, with no electricity, its flooded outside and water is rising. i need rescue"
    
    print("\n1. CHECKING PROMPT STRUCTURE")
    print("-" * 80)
    
    # Load character card
    card_path = Path("characters/aeris.character.json")
    character_card = CharacterCard(str(card_path))
    prompt_builder = PromptBuilder(character_card)
    
    # Detect emergency
    detector = EmergencyDetector()
    is_emergency, emergency_details = detector.detect_emergency(test_message)
    
    # Build messages
    messages = prompt_builder.build_messages(
        conversation_history=[],
        context={},
        user_query=test_message,
        is_emergency=is_emergency,
        emergency_details=emergency_details if is_emergency else None
    )
    
    print(f"Total messages: {len(messages)}")
    for i, msg in enumerate(messages):
        role = msg['role']
        content = msg['content']
        print(f"\nMessage {i+1} - Role: {role}")
        print(f"Length: {len(content)} characters")
        
        if role == 'system':
            # Check for problematic patterns
            issues = []
            if content.count('##') > 5:
                issues.append(f"Too many sections ({content.count('##')})")
            if 'IMPORTANT' in content and content.count('IMPORTANT') > 3:
                issues.append(f"Too many IMPORTANT markers ({content.count('IMPORTANT')})")
            if 'Do NOT' in content and content.count('Do NOT') > 3:
                issues.append(f"Too many Do NOT instructions ({content.count('Do NOT')})")
            if len(content) > 4000:
                issues.append(f"System prompt too long ({len(content)} chars)")
            
            if issues:
                print(f"⚠️  ISSUES FOUND:")
                for issue in issues:
                    print(f"   - {issue}")
            else:
                print("✅ No obvious structural issues")
            
            # Show first 300 and last 300 chars
            print(f"\nFirst 300 chars:")
            print(content[:300])
            print(f"\n... [TRUNCATED] ...\n")
            print(f"Last 300 chars:")
            print(content[-300:])
        else:
            print(f"Content: {content[:200]}...")
    
    print("\n\n2. CHECKING FOR CONFLICTING INSTRUCTIONS")
    print("-" * 80)
    
    system_msg = next((m['content'] for m in messages if m['role'] == 'system'), '')
    
    # Check for conflicting patterns
    conflicts = {
        "Multiple 'respond directly'": system_msg.count('respond directly') > 1,
        "Multiple 'Do NOT'": system_msg.count('Do NOT') > 3,
        "Conflicting response instructions": ('respond naturally' in system_msg and 'respond directly' in system_msg and system_msg.count('respond') > 3),
        "Too many sections": system_msg.count('##') > 8,
        "RAG context conflicts": ('Relevant Information' in system_msg and 'CRITICAL INFORMATION' in system_msg),
    }
    
    for check, found in conflicts.items():
        status = "⚠️  FOUND" if found else "✅ OK"
        print(f"{status} - {check}")
    
    print("\n\n3. CHECKING RAG INTEGRATION")
    print("-" * 80)
    
    if 'Relevant Information from Knowledge Base' in system_msg:
        print("✅ RAG context found in prompt")
        # Extract RAG section
        rag_start = system_msg.find('Relevant Information from Knowledge Base')
        rag_end = system_msg.find('\n\n', rag_start + 100)
        if rag_end > rag_start:
            rag_section = system_msg[rag_start:rag_start+500]
            print(f"\nRAG section preview:")
            print(rag_section)
    else:
        print("⚠️  No RAG context found - knowledge base may not be working")
    
    print("\n\n4. TESTING ACTUAL LLM CALL")
    print("-" * 80)
    
    try:
        llm_client = OpenAIClient()
        print(f"Model: {llm_client.default_model}")
        
        print("\nSending test request...")
        response = await llm_client.chat(
            messages=messages,
            temperature=0.5,
            max_tokens=800
        )
        
        if response:
            print(f"\n✅ Response received: {len(response)} characters")
            print(f"\nResponse preview:")
            print(response[:500])
            
            # Check for hallucinations
            hallucination_indicators = {
                "Repetitive content": response.count(response[:50]) > 3 if len(response) > 50 else False,
                "Unrelated content": 'moon' in response.lower() or 'house' in response.lower() if 'building' not in test_message.lower() else False,
                "Reference leakage": '[REFERENCE' in response or 'Document:' in response,
                "Too short": len(response) < 50,
                "Too repetitive": len(set(response.split())) < len(response.split()) * 0.3 if len(response.split()) > 10 else False
            }
            
            print("\nHallucination checks:")
            for check, found in hallucination_indicators.items():
                status = "⚠️  FOUND" if found else "✅ OK"
                print(f"{status} - {check}")
        else:
            print("❌ No response received from LLM")
        
        await llm_client.close()
        
    except Exception as e:
        print(f"❌ Error testing LLM: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n\n5. RECOMMENDATIONS")
    print("-" * 80)
    
    # Analyze and provide recommendations
    system_length = len(system_msg)
    if system_length > 4000:
        print("⚠️  System prompt is very long - may cause confusion")
        print("   Recommendation: Simplify and reduce to <3000 chars")
    
    if system_msg.count('##') > 8:
        print("⚠️  Too many sections in system prompt")
        print("   Recommendation: Consolidate sections")
    
    if system_msg.count('Do NOT') > 3:
        print("⚠️  Too many negative instructions")
        print("   Recommendation: Use positive instructions instead")
    
    if 'Relevant Information' not in system_msg:
        print("⚠️  RAG context not found")
        print("   Recommendation: Check knowledge base initialization")
    
    print("\n" + "=" * 80)
    print("DIAGNOSIS COMPLETE")
    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(diagnose_hallucination())

