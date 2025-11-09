"""Test temporal awareness implementation."""
import logging
from llm.prompt_builder import PromptBuilder, CharacterCard
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_temporal_awareness():
    """Test that temporal awareness is properly injected into prompts."""
    print("=" * 60)
    print("Testing Temporal Awareness Implementation")
    print("=" * 60)
    
    # Load character card
    card_path = Path("characters/aeris.character.json")
    if not card_path.exists():
        print(f"[FAIL] Character card not found: {card_path}")
        return False
    
    character_card = CharacterCard(str(card_path))
    prompt_builder = PromptBuilder(character_card, use_knowledge_base=True)
    
    # Test query that requires temporal awareness
    test_query = "when will the storm leave the philippines"
    
    print(f"\n1. Testing temporal awareness for query: '{test_query}'")
    print("-" * 60)
    
    # Build messages
    messages = prompt_builder.build_messages(
        conversation_history=[],
        context={},
        user_query=test_query,
        is_emergency=False
    )
    
    # Extract system message
    system_msg = next((m['content'] for m in messages if m['role'] == 'system'), '')
    
    # Check for temporal awareness
    checks = {
        "Current Date and Time section": "Current Date and Time" in system_msg,
        "Today's date present": "Today:" in system_msg or "Today's date:" in system_msg,
        "Current time present": "Time:" in system_msg or "Current time:" in system_msg,
        "Day of week present": "day_of_week" in system_msg.lower() or "Monday" in system_msg or "Tuesday" in system_msg or "Wednesday" in system_msg or "Thursday" in system_msg or "Friday" in system_msg or "Saturday" in system_msg or "Sunday" in system_msg,
        "Timezone information": "TZ:" in system_msg or "Timezone:" in system_msg,
        "Temporal awareness instructions": "TEMPORAL AWARENESS" in system_msg or "temporal awareness" in system_msg.lower(),
        "Date interpretation instructions": "interpret relative dates" in system_msg.lower() or "relative dates" in system_msg.lower(),
        "Specific date requirement": "specific dates" in system_msg.lower() or "Provide specific dates" in system_msg,
    }
    
    print("\n2. Validating temporal awareness injection:")
    print("-" * 60)
    all_passed = True
    for check_name, passed in checks.items():
        status = "[OK]" if passed else "[FAIL]"
        print(f"  {status} {check_name}")
        if not passed:
            all_passed = False
    
    # Show temporal context section
    print("\n3. Temporal Context Section:")
    print("-" * 60)
    if "Current Date and Time" in system_msg:
        # Extract temporal section
        start_idx = system_msg.find("Current Date and Time")
        end_idx = system_msg.find("##", start_idx + 1)  # Next section
        if end_idx == -1:
            end_idx = start_idx + 500  # Show first 500 chars if no next section
        
        temporal_section = system_msg[start_idx:end_idx]
        print(temporal_section[:800])  # Show first 800 chars
    else:
        print("[FAIL] Temporal context section not found!")
    
    # Test the _get_current_time_info method directly
    print("\n4. Testing _get_current_time_info() method:")
    print("-" * 60)
    try:
        time_info = prompt_builder._get_current_time_info()
        print(f"  Date: {time_info['date']}")
        print(f"  Time: {time_info['time']}")
        print(f"  Day of week: {time_info['day_of_week']}")
        print(f"  Timezone: {time_info['timezone']}")
        print(f"  Timezone name: {time_info.get('timezone_name', 'N/A')}")
        print(f"  ISO format: {time_info['datetime_iso']}")
        print("[OK] Time info method works correctly")
    except Exception as e:
        print(f"[FAIL] Error getting time info: {e}")
        import traceback
        traceback.print_exc()
        all_passed = False
    
    print("\n" + "=" * 60)
    if all_passed:
        print("[SUCCESS] Temporal awareness implementation verified!")
        print("\nThe agent now knows:")
        print("  - Current date and time")
        print("  - How to interpret relative dates in RAG content")
        print("  - How to answer temporal questions accurately")
        return True
    else:
        print("[FAIL] Some checks failed - review output above")
        return False

if __name__ == "__main__":
    success = test_temporal_awareness()
    exit(0 if success else 1)

