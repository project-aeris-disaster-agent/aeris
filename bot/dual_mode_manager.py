"""
Dual-mode Telegram client manager.
Manages both bot account and user account clients simultaneously.
"""

import asyncio
import logging
from typing import Optional
from bot.telethon_client import DisasterResponseBot
from bot.message_handler import MessageHandler
from bot.session_manager import SessionManager

logger = logging.getLogger(__name__)


class DualModeTelegramManager:
    """
    Manages both bot account and user account Telegram clients.
    Allows responding in group chats and direct messages as regular user.
    """
    
    def __init__(self):
        """Initialize dual-mode manager."""
        self.bot_client: Optional[DisasterResponseBot] = None
        self.user_client: Optional[DisasterResponseBot] = None
        self.session_manager = SessionManager(expiry_hours=24)
        self.message_handler = MessageHandler(self.session_manager)
    
    async def start(self, use_bot: bool = True, use_user: bool = True):
        """
        Start bot and/or user account clients.
        
        Args:
            use_bot: Start bot account client
            use_user: Start user account client
        """
        tasks = []
        
        if use_bot:
            logger.info("Starting bot account client...")
            self.bot_client = DisasterResponseBot(use_user_account=False)
            self.bot_client.register_message_handler(
                self.message_handler.handle_message,
                group_chats=False
            )
            tasks.append(self.bot_client.start())
        
        if use_user:
            logger.info("Starting user account client...")
            self.user_client = DisasterResponseBot(use_user_account=True)
            self.user_client.register_message_handler(
                self.message_handler.handle_message,
                group_chats=True  # Enable group chat handling for user account
            )
            tasks.append(self.user_client.start())
        
        # Start both clients concurrently
        if tasks:
            await asyncio.gather(*tasks)
            logger.info("All clients started successfully")
    
    async def stop(self):
        """Stop all clients."""
        tasks = []
        
        if self.bot_client:
            tasks.append(self.bot_client.stop())
        
        if self.user_client:
            tasks.append(self.user_client.stop())
        
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
            logger.info("All clients stopped")
    
    async def run_until_disconnected(self):
        """Run until all clients disconnect."""
        tasks = []
        
        if self.bot_client:
            tasks.append(self.bot_client.client.run_until_disconnected())
        
        if self.user_client:
            tasks.append(self.user_client.client.run_until_disconnected())
        
        if tasks:
            # Run both clients concurrently
            await asyncio.gather(*tasks, return_exceptions=True)

