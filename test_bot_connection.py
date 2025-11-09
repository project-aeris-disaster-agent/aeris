"""
Quick test to verify bot can connect to Telegram.
This is a simple connection test before running the full bot.
"""

import asyncio
import logging
from dotenv import load_dotenv
from bot.telethon_client import DisasterResponseBot

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def test_connection():
    """Test bot connection to Telegram."""
    try:
        logger.info("Testing Telegram bot connection...")
        bot = DisasterResponseBot()
        
        await bot.start()
        logger.info("[OK] Bot connected successfully!")
        
        # Get bot info
        me = await bot.client.get_me()
        logger.info(f"[OK] Bot running as @{me.username}")
        logger.info(f"[OK] Bot ID: {me.id}")
        
        await bot.stop()
        logger.info("[OK] Connection test completed!")
        return True
        
    except Exception as e:
        logger.error(f"[FAIL] Connection test failed: {e}", exc_info=True)
        return False


if __name__ == "__main__":
    print("=" * 50)
    print("Telegram Bot Connection Test")
    print("=" * 50)
    print()
    
    success = asyncio.run(test_connection())
    
    print()
    print("=" * 50)
    if success:
        print("[OK] Connection test passed! Bot is ready.")
        print("You can now run: python main.py")
    else:
        print("[FAIL] Connection test failed!")
        print("Please check your .env configuration.")
    print("=" * 50)

