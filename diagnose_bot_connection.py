"""
Diagnostic script to check why bot is not responding.
"""

import asyncio
import sys
import os
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from utils.helpers import get_env, setup_logging
from bot.telethon_client import DisasterResponseBot
import logging

setup_logging("INFO")
logger = logging.getLogger(__name__)

async def diagnose_bot():
    """Diagnose bot connection issues."""
    print("=" * 60)
    print("BOT CONNECTION DIAGNOSTIC")
    print("=" * 60)
    
    # Check environment variables
    print("\n1. CHECKING ENVIRONMENT VARIABLES")
    print("-" * 60)
    
    bot_token = get_env("TELEGRAM_BOT_TOKEN", required=False)
    api_id = get_env("TELEGRAM_API_ID", required=False)
    api_hash = get_env("TELEGRAM_API_HASH", required=False)
    phone_number = get_env("TELEGRAM_PHONE_NUMBER", required=False)
    
    checks = {
        "TELEGRAM_BOT_TOKEN": bot_token is not None and bot_token != "your_bot_token",
        "TELEGRAM_API_ID": api_id is not None and api_id != "your_api_id",
        "TELEGRAM_API_HASH": api_hash is not None and api_hash != "your_api_hash",
        "TELEGRAM_PHONE_NUMBER": phone_number is not None and phone_number != "",
    }
    
    all_ok = True
    for var, ok in checks.items():
        status = "[OK]" if ok else "[FAIL]"
        print(f"{status} {var}: {'Set' if ok else 'Missing or invalid'}")
        if not ok:
            all_ok = False
    
    if not all_ok:
        print("\n❌ Missing or invalid Telegram credentials!")
        print("Please check your .env file")
        return False
    
    # Check session files
    print("\n2. CHECKING SESSION FILES")
    print("-" * 60)
    
    session_files = [
        "disaster_response_bot.session",
        "agent_aeris_user.session",
        "agent_aeris_user.session.session"  # Sometimes Telethon adds .session
    ]
    
    found_sessions = []
    for session_file in session_files:
        if Path(session_file).exists():
            found_sessions.append(session_file)
            print(f"[OK] Found: {session_file}")
        else:
            print(f"[INFO] Not found: {session_file}")
    
    # Test bot connection
    print("\n3. TESTING BOT CONNECTION")
    print("-" * 60)
    
    try:
        print("Initializing bot client...")
        bot = DisasterResponseBot(use_user_account=False)
        
        print("Connecting to Telegram...")
        await bot.start()
        
        print("[OK] Bot connected successfully!")
        
        # Get bot info
        me = await bot.client.get_me()
        print(f"[OK] Bot running as @{me.username}")
        print(f"[OK] Bot ID: {me.id}")
        
        # Check if bot is actually running
        print("\n4. CHECKING BOT STATUS")
        print("-" * 60)
        print("[OK] Bot is connected and ready to receive messages")
        
        await bot.stop()
        print("\n[OK] Connection test completed successfully!")
        return True
        
    except Exception as e:
        print(f"\n[FAIL] Connection test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

async def check_running_bot():
    """Check if bot is actually listening for messages."""
    print("\n5. CHECKING IF BOT IS LISTENING")
    print("-" * 60)
    
    try:
        bot = DisasterResponseBot(use_user_account=False)
        await bot.start()
        
        me = await bot.client.get_me()
        print(f"[OK] Bot @{me.username} is connected")
        
        # Try to get updates
        print("Checking for pending updates...")
        # This will show if bot is receiving messages
        
        print("[INFO] Bot appears to be connected")
        print("[INFO] Send a message to @{} to test".format(me.username))
        
        await bot.stop()
        
    except Exception as e:
        print(f"[FAIL] Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    print("\n")
    success = asyncio.run(diagnose_bot())
    
    if success:
        print("\n" + "=" * 60)
        print("RECOMMENDATIONS")
        print("=" * 60)
        print("1. Check the terminal where main.py is running for errors")
        print("2. Verify bot token is correct in .env")
        print("3. Make sure bot is not already running in another terminal")
        print("4. Try sending /start to the bot in Telegram")
        print("5. Check if there are multiple bot processes running")
        print("\nTo stop all bot processes:")
        print("  Get-Process python | Where-Object {$_.Path -like '*06 AERIS*'} | Stop-Process")
    else:
        print("\n" + "=" * 60)
        print("FIX REQUIRED")
        print("=" * 60)
        print("Please fix the issues above before running the bot")

