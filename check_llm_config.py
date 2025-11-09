"""
Diagnostic script to check why LLM isn't being used.
"""

import sys
import os
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from utils.helpers import get_env, setup_logging
import logging

setup_logging("INFO")
logger = logging.getLogger(__name__)

def check_llm_config():
    """Check LLM configuration."""
    print("=" * 60)
    print("LLM CONFIGURATION DIAGNOSTIC")
    print("=" * 60)
    
    # Check environment variables
    print("\n1. CHECKING ENVIRONMENT VARIABLES")
    print("-" * 60)
    
    openai_key = get_env("OPENAI_API_KEY", required=False)
    openai_model = get_env("OPENAI_MODEL", required=False)
    
    checks = {
        "OPENAI_API_KEY": openai_key is not None and openai_key != "your_openai_key" and len(openai_key) > 10,
        "OPENAI_MODEL": openai_model is not None and openai_model != "",
    }
    
    all_ok = True
    for var, ok in checks.items():
        status = "[OK]" if ok else "[FAIL]"
        value = get_env(var, required=False)
        if var == "OPENAI_API_KEY" and value:
            # Mask the key
            display_value = value[:10] + "..." if len(value) > 10 else "***"
        else:
            display_value = value or "Not set"
        print(f"{status} {var}: {display_value}")
        if not ok:
            all_ok = False
    
    if not all_ok:
        print("\n❌ Missing or invalid LLM credentials!")
        print("Please check your .env file")
        return False
    
    # Check imports
    print("\n2. CHECKING IMPORTS")
    print("-" * 60)
    
    try:
        from llm.openai_client import OpenAIClient
        print("[OK] OpenAIClient imported successfully")
    except Exception as e:
        print(f"[FAIL] Failed to import OpenAIClient: {e}")
        return False
    
    try:
        from llm.prompt_builder import CharacterCard, PromptBuilder
        print("[OK] PromptBuilder imported successfully")
    except Exception as e:
        print(f"[FAIL] Failed to import PromptBuilder: {e}")
        return False
    
    # Test LLM client initialization
    print("\n3. TESTING LLM CLIENT INITIALIZATION")
    print("-" * 60)
    
    try:
        from llm.openai_client import OpenAIClient
        client = OpenAIClient()
        print(f"[OK] LLM client initialized")
        print(f"[OK] Model: {client.default_model}")
        print(f"[OK] API URL: {client.api_url}")
    except Exception as e:
        print(f"[FAIL] Failed to initialize LLM client: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    # Test character card loading
    print("\n4. TESTING CHARACTER CARD LOADING")
    print("-" * 60)
    
    try:
        from llm.prompt_builder import CharacterCard
        card_path = Path("characters/aeris.character.json")
        if not card_path.exists():
            print(f"[FAIL] Character card not found: {card_path}")
            return False
        
        character_card = CharacterCard(str(card_path))
        print(f"[OK] Character card loaded: {character_card.get_name()}")
    except Exception as e:
        print(f"[FAIL] Failed to load character card: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    # Test prompt builder initialization
    print("\n5. TESTING PROMPT BUILDER INITIALIZATION")
    print("-" * 60)
    
    try:
        from llm.prompt_builder import CharacterCard, PromptBuilder
        card_path = Path("characters/aeris.character.json")
        character_card = CharacterCard(str(card_path))
        prompt_builder = PromptBuilder(character_card)
        print(f"[OK] Prompt builder initialized")
        print(f"[OK] Knowledge base enabled: {prompt_builder.use_knowledge_base}")
    except Exception as e:
        print(f"[FAIL] Failed to initialize prompt builder: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    # Test message handler initialization
    print("\n6. TESTING MESSAGE HANDLER INITIALIZATION")
    print("-" * 60)
    
    try:
        from bot.message_handler import MessageHandler
        from bot.session_manager import SessionManager
        
        session_manager = SessionManager()
        message_handler = MessageHandler(session_manager, use_llm=True)
        
        print(f"[OK] Message handler initialized")
        print(f"[OK] LLM enabled: {message_handler.use_llm}")
        print(f"[OK] LLM client exists: {message_handler.llm_client is not None}")
        print(f"[OK] Prompt builder exists: {message_handler.prompt_builder is not None}")
        
        if not message_handler.use_llm:
            print("\n⚠️ LLM is DISABLED in message handler!")
            print("This is why you're getting Phase 1 responses.")
            return False
        
        if message_handler.llm_client is None:
            print("\n⚠️ LLM client is None!")
            print("Check initialization errors above.")
            return False
        
        if message_handler.prompt_builder is None:
            print("\n⚠️ Prompt builder is None!")
            print("Check initialization errors above.")
            return False
        
    except Exception as e:
        print(f"[FAIL] Failed to initialize message handler: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    print("\n" + "=" * 60)
    print("✅ ALL CHECKS PASSED - LLM SHOULD BE WORKING")
    print("=" * 60)
    print("\nIf bot still shows Phase 1 responses:")
    print("1. Restart the bot (stop and start again)")
    print("2. Check bot logs for initialization errors")
    print("3. Verify .env file is being loaded correctly")
    
    return True

if __name__ == "__main__":
    success = check_llm_config()
    sys.exit(0 if success else 1)

