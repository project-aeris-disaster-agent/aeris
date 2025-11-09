"""
Test script for Emergency Response System.
Tests emergency detection, rescue info collection, and prompt building.
"""

import asyncio
import logging
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from bot.emergency_detector import EmergencyDetector
from bot.rescue_info_collector import RescueInfoCollector
from llm.prompt_builder import CharacterCard, PromptBuilder
from utils.context_manager import SessionContext

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def test_emergency_detection():
    """Test emergency detection with various scenarios."""
    print("\n" + "=" * 60)
    print("TEST 1: Emergency Detection")
    print("=" * 60)
    
    detector = EmergencyDetector()
    
    test_cases = [
        {
            "message": "no, im in an abandooned building, with no electricity, its flooded outside and water is rising. i need rescue",
            "expected_emergency": True,
            "expected_type": "rescue",
            "expected_urgency": "high"
        },
        {
            "message": "I'm stuck in a building and water is rising",
            "expected_emergency": True,
            "expected_type": "flood",
            "expected_urgency": "high"
        },
        {
            "message": "What's the weather like today?",
            "expected_emergency": False,
            "expected_type": None,
            "expected_urgency": "medium"
        },
        {
            "message": "I need help! I'm trapped!",
            "expected_emergency": True,
            "expected_type": "rescue",
            "expected_urgency": "high"
        }
    ]
    
    all_passed = True
    for i, test_case in enumerate(test_cases, 1):
        print(f"\nTest Case {i}:")
        print(f"  Message: {test_case['message'][:60]}...")
        
        is_emergency, details = detector.detect_emergency(test_case['message'])
        
        # Check results
        passed = True
        if is_emergency != test_case['expected_emergency']:
            print(f"  [FAIL] Expected emergency={test_case['expected_emergency']}, got {is_emergency}")
            passed = False
        
        if is_emergency:
            if details.get('type') != test_case['expected_type']:
                print(f"  [WARN] Expected type={test_case['expected_type']}, got {details.get('type')}")
            
            if details.get('urgency') != test_case['expected_urgency']:
                print(f"  [WARN] Expected urgency={test_case['expected_urgency']}, got {details.get('urgency')}")
            
            print(f"  [OK] Emergency detected: {details}")
        else:
            print(f"  [OK] No emergency (as expected)")
        
        if not passed:
            all_passed = False
    
    if all_passed:
        print("\n[OK] All emergency detection tests passed!")
    else:
        print("\n[FAIL] Some emergency detection tests failed")
    
    return all_passed


def test_rescue_info_collection():
    """Test rescue information collection."""
    print("\n" + "=" * 60)
    print("TEST 2: Rescue Information Collection")
    print("=" * 60)
    
    collector = RescueInfoCollector()
    
    # Create mock conversation history
    conversation_history = [
        {"role": "user", "content": "no, im in an abandooned building, with no electricity, its flooded outside and water is rising. i need rescue"},
    ]
    
    emergency_details = {
        'type': 'rescue',
        'urgency': 'high',
        'needs_rescue': True,
        'has_location': True,
        'has_condition': True
    }
    
    print("\nCollecting rescue information...")
    rescue_info = collector.collect_info(
        user_id="123456789",
        emergency_details=emergency_details,
        conversation_history=conversation_history
    )
    
    print("\n[OK] Collected Information:")
    print(f"  User ID: {rescue_info['user_id']}")
    print(f"  Emergency Type: {rescue_info['emergency_type']}")
    print(f"  Urgency: {rescue_info['urgency']}")
    print(f"  Location: {rescue_info.get('location', 'Not collected yet')}")
    print(f"  Condition: {rescue_info.get('condition', 'Not collected yet')}")
    print(f"  Contact Info: {rescue_info.get('contact_info', 'Not collected yet')}")
    print(f"  Status: {rescue_info['status']}")
    
    # Check if critical fields are present
    required_fields = ['user_id', 'emergency_type', 'urgency', 'timestamp', 'status']
    missing_fields = [field for field in required_fields if field not in rescue_info]
    
    if missing_fields:
        print(f"\n[FAIL] Missing required fields: {missing_fields}")
        return False
    else:
        print("\n[OK] All required fields present")
        return True


def test_emergency_prompt_building():
    """Test emergency prompt building."""
    print("\n" + "=" * 60)
    print("TEST 3: Emergency Prompt Building")
    print("=" * 60)
    
    try:
        # Load character card
        card_path = Path(__file__).parent / "characters" / "aeris.character.json"
        if not card_path.exists():
            print(f"[FAIL] Character card not found: {card_path}")
            return False
        
        character_card = CharacterCard(str(card_path))
        prompt_builder = PromptBuilder(character_card)
        
        # Create mock conversation
        conversation_history = [
            {"role": "user", "content": "no, im in an abandooned building, with no electricity, its flooded outside and water is rising. i need rescue"},
        ]
        
        emergency_details = {
            'type': 'rescue',
            'urgency': 'high',
            'needs_rescue': True
        }
        
        print("\nBuilding emergency prompt...")
        messages = prompt_builder.build_messages(
            conversation_history=conversation_history,
            context={},
            user_query="no, im in an abandooned building, with no electricity, its flooded outside and water is rising. i need rescue",
            is_emergency=True,
            emergency_details=emergency_details
        )
        
        # Check if emergency protocol is in system message
        system_message = None
        for msg in messages:
            if msg['role'] == 'system':
                system_message = msg['content']
                break
        
        if not system_message:
            print("❌ No system message found")
            return False
        
        # Check for emergency protocol indicators (updated for simplified protocol)
        protocol_indicators = [
            "EMERGENCY SITUATION DETECTED",
            "Calm and reassure",
            "Collect location",
            "Provide immediate actions",
            "SPECIFIC, ACTIONABLE advice",
            "Respond directly to the user now"
        ]
        
        print("\nChecking for emergency protocol in prompt...")
        found_indicators = []
        for indicator in protocol_indicators:
            if indicator in system_message:
                found_indicators.append(indicator)
                print(f"  [OK] Found: {indicator}")
            else:
                print(f"  [FAIL] Missing: {indicator}")
        
        if len(found_indicators) == len(protocol_indicators):
            print("\n[OK] Emergency protocol correctly included in prompt!")
            return True
        else:
            print(f"\n[WARN] Only {len(found_indicators)}/{len(protocol_indicators)} protocol indicators found")
            return False
            
    except Exception as e:
        print(f"\n[FAIL] Error testing prompt building: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_full_integration():
    """Test full integration with mock LLM call."""
    print("\n" + "=" * 60)
    print("TEST 4: Full Integration (Mock)")
    print("=" * 60)
    
    try:
        from bot.emergency_detector import EmergencyDetector
        from bot.rescue_info_collector import RescueInfoCollector
        from llm.prompt_builder import CharacterCard, PromptBuilder
        
        # Initialize components
        detector = EmergencyDetector()
        collector = RescueInfoCollector()
        
        card_path = Path(__file__).parent / "characters" / "aeris.character.json"
        character_card = CharacterCard(str(card_path))
        prompt_builder = PromptBuilder(character_card)
        
        # Test message
        test_message = "no, im in an abandooned building, with no electricity, its flooded outside and water is rising. i need rescue"
        
        print(f"\nProcessing message: {test_message}")
        
        # Step 1: Detect emergency
        print("\n1. Detecting emergency...")
        is_emergency, emergency_details = detector.detect_emergency(test_message)
        
        if not is_emergency:
            print("[FAIL] Emergency not detected!")
            return False
        
        print(f"[OK] Emergency detected: {emergency_details}")
        
        # Step 2: Collect info
        print("\n2. Collecting rescue information...")
        conversation_history = [{"role": "user", "content": test_message}]
        rescue_info = collector.collect_info(
            user_id="123456789",
            emergency_details=emergency_details,
            conversation_history=conversation_history
        )
        print(f"[OK] Info collected: {rescue_info['emergency_type']} - {rescue_info['urgency']}")
        
        # Step 3: Build prompt
        print("\n3. Building emergency prompt...")
        messages = prompt_builder.build_messages(
            conversation_history=conversation_history,
            context={},
            user_query=test_message,
            is_emergency=True,
            emergency_details=emergency_details
        )
        print(f"[OK] Prompt built: {len(messages)} messages")
        
        # Step 4: Check prompt quality
        system_msg = next((m['content'] for m in messages if m['role'] == 'system'), '')
        
        checks = {
            "Emergency protocol present": "EMERGENCY SITUATION DETECTED" in system_msg,
            "De-escalation steps": "Calm and reassure" in system_msg,
            "Information collection": "Collect location" in system_msg,
            "Actionable guidance": "SPECIFIC, ACTIONABLE" in system_msg,
            "Direct response instruction": "Respond directly to the user" in system_msg,
        }
        
        print("\n4. Validating prompt quality...")
        all_checks_passed = True
        for check_name, passed in checks.items():
            status = "[OK]" if passed else "[FAIL]"
            print(f"  {status} {check_name}")
            if not passed:
                all_checks_passed = False
        
        if all_checks_passed:
            print("\n[OK] Full integration test passed!")
            return True
        else:
            print("\n[WARN] Some checks failed")
            return False
            
    except Exception as e:
        print(f"\n[FAIL] Error in integration test: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Run all tests."""
    print("\n" + "=" * 60)
    print("EMERGENCY RESPONSE SYSTEM TEST SUITE")
    print("=" * 60)
    
    results = {}
    
    # Test 1: Emergency Detection
    results['detection'] = test_emergency_detection()
    
    # Test 2: Rescue Info Collection
    results['collection'] = test_rescue_info_collection()
    
    # Test 3: Prompt Building
    results['prompt'] = test_emergency_prompt_building()
    
    # Test 4: Full Integration
    results['integration'] = asyncio.run(test_full_integration())
    
    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    
    for test_name, passed in results.items():
        status = "[PASS]" if passed else "[FAIL]"
        print(f"{status} - {test_name.title()}")
    
    all_passed = all(results.values())
    
    if all_passed:
        print("\n[SUCCESS] All tests passed! Emergency response system is working correctly.")
        print("\nNext steps:")
        print("1. Start the bot: python main.py")
        print("2. Send emergency message to test in real Telegram")
        print("3. Check logs for emergency detection and info collection")
    else:
        print("\n[WARN] Some tests failed. Please review the output above.")
    
    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())

