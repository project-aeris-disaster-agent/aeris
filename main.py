"""
Main entry point for running the Disaster Response Telegram Bot locally.
For production deployment, use Vercel serverless functions.

Supports dual-mode operation:
- Bot account: @AgentAeries_bot (for bot-specific interactions)
- User account: @agent_aeris (for group chats and direct messages)

See SPEC.md for project details.
"""

import asyncio
import logging
import signal
import sys
import os
from bot.dual_mode_manager import DualModeTelegramManager
from utils.helpers import setup_logging, get_env

# Set up logging
setup_logging("INFO")
logger = logging.getLogger(__name__)

# Global manager instance for graceful shutdown
manager_instance = None


async def main():
    """Main async function to run the bot."""
    global manager_instance
    
    try:
        # Initialize components
        logger.info("Initializing Disaster Response Bot (Dual-Mode)...")
        
        # Determine which clients to start
        use_bot = get_env("TELEGRAM_BOT_TOKEN") is not None
        use_user = get_env("TELEGRAM_PHONE_NUMBER") is not None
        
        if not use_bot and not use_user:
            logger.error("No Telegram credentials configured!")
            logger.error("Please set either TELEGRAM_BOT_TOKEN or TELEGRAM_PHONE_NUMBER in .env")
            sys.exit(1)
        
        # Create dual-mode manager
        manager_instance = DualModeTelegramManager()
        
        # Start clients
        await manager_instance.start(use_bot=use_bot, use_user=use_user)
        
        logger.info("=" * 60)
        if use_bot:
            logger.info("Bot account: Running")
        if use_user:
            logger.info("User account: Running (group chats enabled)")
        logger.info("Press Ctrl+C to stop.")
        logger.info("=" * 60)
        
        # Keep running until disconnected
        await manager_instance.run_until_disconnected()
        
    except KeyboardInterrupt:
        logger.info("Received shutdown signal")
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)
    finally:
        if manager_instance:
            await manager_instance.stop()
        logger.info("All clients stopped")


def signal_handler(sig, frame):
    """Handle shutdown signals."""
    logger.info("Shutdown signal received")
    if bot_instance:
        asyncio.create_task(bot_instance.stop())
    sys.exit(0)


if __name__ == "__main__":
    # Register signal handlers for graceful shutdown
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Run the bot
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Bot stopped by user")

