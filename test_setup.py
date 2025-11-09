"""
Test script for Supabase connection.
Run this to verify Supabase setup is working.
"""

import sys
import logging
import os
from dotenv import load_dotenv

# Fix Windows console encoding for emoji
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

# Load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_supabase():
    """Test Supabase connection."""
    try:
        from family_finder.database import get_supabase
        
        logger.info("Testing Supabase connection...")
        supabase = get_supabase()
        
        if supabase.test_connection():
            logger.info("[OK] Supabase connection successful!")
            return True
        else:
            logger.error("[FAIL] Supabase connection failed!")
            return False
            
    except ImportError as e:
        logger.warning(f"[SKIP] Supabase not installed or configured: {e}")
        logger.info("  Supabase is optional for Phase 1 testing")
        return None  # Not a failure, just not configured
    except Exception as e:
        logger.error(f"[FAIL] Error testing Supabase: {e}")
        return False

def test_telegram_config():
    """Test Telegram configuration."""
    try:
        from utils.helpers import get_env
        
        logger.info("Testing Telegram configuration...")
        
        bot_token = get_env("TELEGRAM_BOT_TOKEN")
        api_id = get_env("TELEGRAM_API_ID")
        api_hash = get_env("TELEGRAM_API_HASH")
        
        if bot_token and api_id and api_hash:
            logger.info("[OK] Telegram configuration found!")
            logger.info(f"  Bot Token: {'*' * 20}...{bot_token[-10:]}")
            logger.info(f"  API ID: {api_id}")
            logger.info(f"  API Hash: {'*' * 20}...{api_hash[-10:]}")
            return True
        else:
            logger.error("[FAIL] Missing Telegram configuration!")
            logger.error(f"  Bot Token: {'[OK]' if bot_token else '[MISSING]'}")
            logger.error(f"  API ID: {'[OK]' if api_id else '[MISSING]'}")
            logger.error(f"  API Hash: {'[OK]' if api_hash else '[MISSING]'}")
            return False
            
    except Exception as e:
        logger.error(f"[FAIL] Error testing Telegram config: {e}")
        return False

if __name__ == "__main__":
    print("=" * 50)
    print("Phase 1 Setup Verification")
    print("=" * 50)
    print()
    
    # Test Telegram config
    telegram_ok = test_telegram_config()
    print()
    
    # Test Supabase connection (optional for Phase 1)
    supabase_ok = test_supabase()
    print()
    
    # Summary
    print("=" * 50)
    if telegram_ok:
        if supabase_ok is None:
            print("[OK] Telegram configured! Supabase optional for Phase 1.")
            print("Ready to test bot locally!")
        elif supabase_ok:
            print("[OK] All tests passed! Ready for Phase 1 testing.")
        else:
            print("[WARN] Telegram OK, but Supabase test failed.")
            print("You can still test the bot locally.")
    else:
        print("[FAIL] Telegram configuration missing!")
        print("Please configure .env file with Telegram credentials.")
        sys.exit(1)

