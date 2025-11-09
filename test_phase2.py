"""
Test script for OpenAI API connection and character card.
Run this to verify Phase 2 setup is working.
"""

import asyncio
import sys
import logging
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def test_openai():
    """Test OpenAI API connection."""
    try:
        from llm.openai_client import OpenAIClient
        
        logger.info("Testing OpenAI connection...")
        client = OpenAIClient()
        
        success = await client.test_connection()
        
        await client.close()
        
        if success:
            logger.info("[OK] OpenAI connection successful!")
            return True
        else:
            logger.error("[FAIL] OpenAI connection test failed!")
            return False
            
    except ImportError as e:
        logger.error(f"[FAIL] Failed to import OpenAI client: {e}")
        return False
    except Exception as e:
        logger.error(f"[FAIL] Error testing OpenAI: {e}", exc_info=True)
        return False


def test_character_card():
    """Test character card loading."""
    try:
        from llm.prompt_builder import CharacterCard
        
        logger.info("Testing character card loading...")
        
        card_path = Path("characters/aeris.character.json")
        
        if not card_path.exists():
            logger.error(f"[FAIL] Character card not found: {card_path}")
            return False
        
        character_card = CharacterCard(str(card_path))
        
        # Test character card properties
        name = character_card.get_name()
        system_prompt = character_card.get_system_prompt()
        examples = character_card.get_examples()
        
        logger.info(f"[OK] Character card loaded: {name}")
        logger.info(f"  System prompt length: {len(system_prompt)} chars")
        logger.info(f"  Example conversations: {len(examples)} messages")
        
        # Test prompt builder
        from llm.prompt_builder import PromptBuilder
        prompt_builder = PromptBuilder(character_card)
        
        test_messages = [
            {"role": "user", "content": "Hello"}
        ]
        built_messages = prompt_builder.build_messages(test_messages)
        
        logger.info(f"[OK] Prompt builder working: {len(built_messages)} messages built")
        
        return True
        
    except Exception as e:
        logger.error(f"[FAIL] Error testing character card: {e}", exc_info=True)
        return False


async def test_full_integration():
    """Test full LLM integration with character card."""
    try:
        from llm.openai_client import OpenAIClient
        from llm.prompt_builder import CharacterCard, PromptBuilder
        from pathlib import Path
        
        logger.info("Testing full LLM integration...")
        
        # Load components
        client = OpenAIClient()
        card_path = Path("characters/aeris.character.json")
        character_card = CharacterCard(str(card_path))
        prompt_builder = PromptBuilder(character_card)
        
        # Test conversation
        test_conversation = [
            {"role": "user", "content": "I'm scared about the hurricane warning. What should I do?"}
        ]
        
        messages = prompt_builder.build_messages(test_conversation)
        
        logger.info("Sending test message to OpenAI...")
        response = await client.chat(messages, temperature=0.7)
        
        await client.close()
        
        if response:
            logger.info("[OK] Full integration test successful!")
            logger.info(f"Response preview: {response[:100]}...")
            return True
        else:
            logger.error("[FAIL] No response from OpenAI")
            return False
            
    except Exception as e:
        logger.error(f"[FAIL] Error in full integration test: {e}", exc_info=True)
        return False


if __name__ == "__main__":
    print("=" * 60)
    print("Phase 2 Setup Verification")
    print("=" * 60)
    print()
    
    # Test character card
    card_ok = test_character_card()
    print()
    
    # Test OpenAI connection
    openai_ok = asyncio.run(test_openai())
    print()
    
    # Test full integration
    if card_ok and openai_ok:
        integration_ok = asyncio.run(test_full_integration())
        print()
    else:
        integration_ok = False
        logger.warning("Skipping full integration test due to previous failures")
        print()
    
    # Summary
    print("=" * 60)
    if card_ok and openai_ok and integration_ok:
        print("[OK] All Phase 2 tests passed!")
        print("Ready to use LLM-powered responses!")
    elif card_ok and openai_ok:
        print("[WARN] Basic components work, but integration test failed.")
        print("Check OpenAI API key and model settings.")
    elif card_ok:
        print("[WARN] Character card works, but OpenAI connection failed.")
        print("Please configure OPENAI_API_KEY in .env")
    else:
        print("[FAIL] Some tests failed. Please check configuration.")
        sys.exit(1)
    print("=" * 60)

