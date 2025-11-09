"""
Test LLM response generation with new API/model.
"""

import asyncio
import sys
import os
import codecs
from pathlib import Path

# Fix Unicode encoding for Windows console
os.system('chcp 65001 >nul 2>&1')
sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')

sys.path.insert(0, str(Path(__file__).parent))

from bot.message_handler import MessageHandler
from bot.session_manager import SessionManager
from utils.context_manager import SessionContext

async def test_llm_response():
    """Test LLM response generation."""
    print("=" * 60)
    print("TESTING LLM RESPONSE GENERATION")
    print("=" * 60)
    
    # Initialize message handler
    session_manager = SessionManager()
    message_handler = MessageHandler(session_manager, use_llm=True)
    
    print(f"\nLLM Enabled: {message_handler.use_llm}")
    print(f"LLM Client: {message_handler.llm_client is not None}")
    print(f"Prompt Builder: {message_handler.prompt_builder is not None}")
    
    if not message_handler.use_llm or not message_handler.llm_client:
        print("\n❌ LLM not initialized!")
        return False
    
    # Create test session
    session = SessionContext("test_user_123")
    
    # Test message
    test_message = "is manila safe @agent_aeris"
    
    print(f"\nTest Message: {test_message}")
    print("\nProcessing message...")
    
    try:
        response = await message_handler.process_message(test_message, session, is_group=False)
        
        print("\n" + "=" * 60)
        print("RESPONSE RECEIVED:")
        print("=" * 60)
        # Encode response safely for printing
        try:
            print(response.encode('utf-8', errors='replace').decode('utf-8'))
        except:
            print(response)
        print("=" * 60)
        
        # Check if it's Phase 1 fallback
        if "Phase 1 setup" in response or "I'm currently in Phase 1" in response:
            print("\n[FAIL] PROBLEM: Got Phase 1 fallback response!")
            print("This means LLM processing failed or was skipped.")
            return False
        else:
            print("\n[OK] SUCCESS: Got LLM-generated response!")
            print(f"Response length: {len(response)} characters")
            return True
            
    except Exception as e:
        print(f"\n[FAIL] ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = asyncio.run(test_llm_response())
    sys.exit(0 if success else 1)

