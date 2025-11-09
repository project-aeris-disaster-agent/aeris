"""
Test RAG context formatting to ensure no reference leakage.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from llm.prompt_builder import CharacterCard, PromptBuilder

def test_rag_formatting():
    """Test that RAG context is formatted without visible references."""
    print("=" * 60)
    print("TESTING RAG CONTEXT FORMATTING")
    print("=" * 60)
    
    # Load character card
    card_path = Path("characters/aeris.character.json")
    character_card = CharacterCard(str(card_path))
    prompt_builder = PromptBuilder(character_card)
    
    # Test query
    user_query = "no, im in an abandooned building, with no electricity, its flooded outside and water is rising. i need rescue"
    
    # Build messages
    messages = prompt_builder.build_messages(
        conversation_history=[],
        context={},
        user_query=user_query,
        is_emergency=True,
        emergency_details={'type': 'flood', 'urgency': 'high', 'needs_rescue': True}
    )
    
    # Check system message
    system_msg = next((m['content'] for m in messages if m['role'] == 'system'), '')
    
    print("\nChecking for reference markers...")
    
    # Check for problematic patterns
    checks = {
        "[REFERENCE": "[REFERENCE" not in system_msg,
        "Document: TCH": "Document: TCH" not in system_msg,
        "Document: TCB": "Document: TCB" not in system_msg,
        "CRITICAL INFORMATION": "CRITICAL INFORMATION" not in system_msg,
        "Do NOT mention references": "Do NOT mention references" in system_msg or "do NOT mention references" in system_msg,
        "Relevant Information": "Relevant Information" in system_msg or "relevant information" in system_msg
    }
    
    all_passed = True
    for check_name, passed in checks.items():
        status = "[OK]" if passed else "[FAIL]"
        print(f"  {status} {check_name}")
        if not passed:
            all_passed = False
    
    print("\n" + "=" * 60)
    print("RAG CONTEXT PREVIEW (first 500 chars):")
    print("=" * 60)
    try:
        print(system_msg[:500].encode('utf-8', errors='replace').decode('utf-8'))
    except:
        print(system_msg[:500])
    print("\n... [TRUNCATED] ...\n")
    
    print("=" * 60)
    print("RAG CONTEXT PREVIEW (last 500 chars):")
    print("=" * 60)
    try:
        print(system_msg[-500:].encode('utf-8', errors='replace').decode('utf-8'))
    except:
        print(system_msg[-500:])
    
    if all_passed:
        print("\n[SUCCESS] RAG context formatted correctly - no reference leakage!")
    else:
        print("\n[FAIL] Some checks failed - references may leak!")
    
    return all_passed

if __name__ == "__main__":
    success = test_rag_formatting()
    sys.exit(0 if success else 1)

