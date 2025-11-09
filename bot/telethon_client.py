"""
Telethon client implementation for Telegram bot and user account.
See SPEC.md Section 2.1 and 4.1.1 for details.

Supports dual-mode operation:
- Bot account: For bot-specific interactions
- User account: For group chats and direct messages as regular user
"""

import os
import logging
from typing import Optional
from telethon import TelegramClient, events
from telethon.errors import SessionPasswordNeededError

from utils.helpers import get_env

logger = logging.getLogger(__name__)


class DisasterResponseBot:
    """
    Main Telegram bot client using Telethon.
    Handles message reception, session management, and response delivery.
    Supports both bot account and user account modes.
    """
    
    def __init__(self, use_user_account: bool = False):
        """
        Initialize the Telegram client.
        
        Args:
            use_user_account: If True, use user account (phone auth) instead of bot token
        """
        # Get configuration from environment variables
        self.api_id = get_env("TELEGRAM_API_ID", required=True)
        self.api_hash = get_env("TELEGRAM_API_HASH", required=True)
        self.use_user_account = use_user_account
        
        if use_user_account:
            # User account mode - for group chats and direct messages
            self.phone_number = get_env("TELEGRAM_PHONE_NUMBER", required=True)
            session_name = get_env("TELEGRAM_USER_SESSION", default="agent_aeris_user")
            
            self.client = TelegramClient(
                session_name,
                int(self.api_id),
                self.api_hash
            )
            self.bot_token = None
            logger.info("Telethon user account client initialized")
        else:
            # Bot account mode
            self.bot_token = get_env("TELEGRAM_BOT_TOKEN", required=True)
            self.client = TelegramClient(
                'disaster_response_bot',
                int(self.api_id),
                self.api_hash
            )
            logger.info("Telethon bot client initialized")
        
        self.client.parse_mode = 'html'  # Enable HTML formatting
    
    async def start(self):
        """Start the client (bot or user account)."""
        try:
            if self.use_user_account:
                # User account authentication
                await self.client.start(phone=self.phone_number)
                logger.info("User account started successfully")
                
                # Get account info
                me = await self.client.get_me()
                username = getattr(me, 'username', 'No username')
                logger.info(f"User account running as @{username} (ID: {me.id})")
            else:
                # Bot account authentication
                await self.client.start(bot_token=self.bot_token)
                logger.info("Bot started successfully")
                
                # Get bot info
                me = await self.client.get_me()
                logger.info(f"Bot running as @{me.username}")
            
        except SessionPasswordNeededError:
            # Two-factor authentication required
            logger.warning("Two-factor authentication is enabled. Please enter your password.")
            password = input("Enter your 2FA password: ")
            await self.client.sign_in(password=password)
            logger.info("User account authenticated with 2FA")
        except Exception as e:
            logger.error(f"Failed to start client: {e}")
            raise
    
    async def stop(self):
        """Stop the bot client."""
        await self.client.disconnect()
        logger.info("Bot stopped")
    
    def register_message_handler(self, handler, group_chats: bool = False):
        """
        Register a message handler function.
        
        Args:
            handler: Async function that handles messages
                     Should accept (event: events.NewMessage.Event) -> None
            group_chats: If True, also handle group chat messages (user account only)
        """
        if group_chats and not self.use_user_account:
            logger.warning("Group chat handling requires user account mode")
            group_chats = False
        
        # Handle private messages (both bot and user account)
        @self.client.on(events.NewMessage(incoming=True, func=lambda e: e.is_private))
        async def private_message_handler(event):
            try:
                await handler(event)
            except Exception as e:
                logger.error(f"Error in private message handler: {e}", exc_info=True)
                try:
                    await event.respond(
                        "I'm sorry, I encountered an error processing your message. "
                        "Please try again."
                    )
                except:
                    pass  # Ignore errors when sending error message
        
        # Handle group chat messages (user account only)
        if group_chats:
            @self.client.on(events.NewMessage(incoming=True, func=lambda e: not e.is_private))
            async def group_message_handler(event):
                try:
                    # Only respond if bot is mentioned or message is a reply to bot
                    message_text = event.message.text or ""
                    me = await self.client.get_me()
                    
                    # Check if bot is mentioned or message is a reply
                    should_respond = (
                        f"@{me.username}" in message_text.lower() or
                        (event.message.reply_to and 
                         event.message.reply_to.from_id and
                         event.message.reply_to.from_id.user_id == me.id)
                    )
                    
                    if should_respond:
                        await handler(event)
                except Exception as e:
                    logger.error(f"Error in group message handler: {e}", exc_info=True)
    
    async def send_message(self, user_id: int, message: str, **kwargs):
        """
        Send a message to a user.
        
        Args:
            user_id: Telegram user ID
            message: Message text
            **kwargs: Additional arguments for send_message
        """
        try:
            await self.client.send_message(user_id, message, **kwargs)
        except Exception as e:
            logger.error(f"Failed to send message to {user_id}: {e}")
            raise
    
    async def broadcast_message(self, user_ids: list[int], message: str, **kwargs):
        """
        Broadcast a message to multiple users with rate limiting.
        See SPEC.md Section 3.1 for broadcast requirements.
        
        Args:
            user_ids: List of Telegram user IDs
            message: Message text
            **kwargs: Additional arguments for send_message
            
        Returns:
            Dictionary with delivery status for each user
        """
        results = {}
        
        for user_id in user_ids:
            try:
                await self.send_message(user_id, message, **kwargs)
                results[user_id] = {"status": "sent", "error": None}
            except Exception as e:
                results[user_id] = {"status": "failed", "error": str(e)}
                logger.error(f"Failed to send broadcast to {user_id}: {e}")
            
            # Rate limiting: small delay between messages
            # Telegram allows ~30 messages per second
            import asyncio
            await asyncio.sleep(0.05)  # ~20 messages per second
        
        return results
    
    async def get_user_info(self, user_id: int):
        """Get user information."""
        try:
            user = await self.client.get_entity(user_id)
            return {
                "id": user.id,
                "username": getattr(user, 'username', None),
                "first_name": getattr(user, 'first_name', None),
                "last_name": getattr(user, 'last_name', None)
            }
        except Exception as e:
            logger.error(f"Failed to get user info for {user_id}: {e}")
            return None

