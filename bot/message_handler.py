"""
Message handler for processing incoming Telegram messages.
See SPEC.md Section 5.1 for message flow details.
"""

import logging
from telethon import events
from typing import Optional

from bot.session_manager import SessionManager
from utils.context_manager import SessionContext

logger = logging.getLogger(__name__)

# Lazy import for LLM components (optional)
try:
    from llm.openrouter_client import OpenRouterClient
    from llm.prompt_builder import CharacterCard, PromptBuilder
    LLM_AVAILABLE = True
except ImportError:
    LLM_AVAILABLE = False
    logger.warning("LLM components not available. Using basic echo mode.")


class MessageHandler:
    """
    Handles incoming messages and routes them to appropriate processors.
    """
    
    def __init__(self, session_manager: SessionManager, use_llm: bool = True):
        """
        Initialize message handler.
        
        Args:
            session_manager: SessionManager instance for managing user sessions
            use_llm: Whether to use LLM for responses (default: True)
        """
        self.session_manager = session_manager
        self.use_llm = use_llm and LLM_AVAILABLE
        
        # Initialize LLM components if available
        self.llm_client = None
        self.prompt_builder = None
        
        if self.use_llm:
            try:
                self.llm_client = OpenRouterClient()
                
                # Load character card
                import os
                from pathlib import Path
                card_path = Path(__file__).parent.parent / "characters" / "aeris.character.json"
                
                if card_path.exists():
                    character_card = CharacterCard(str(card_path))
                    self.prompt_builder = PromptBuilder(character_card)
                    logger.info(f"Loaded character card: {character_card.get_name()}")
                else:
                    logger.warning(f"Character card not found: {card_path}. Using default personality.")
                    self.use_llm = False
                    
            except Exception as e:
                logger.error(f"Failed to initialize LLM: {e}", exc_info=True)
                self.use_llm = False
    
    async def handle_message(self, event: events.NewMessage.Event):
        """
        Main message handler entry point.
        Handles both private messages and group chat messages.
        
        Args:
            event: Telethon NewMessage event
        """
        try:
            user_id = str(event.sender_id)
            message_text = event.message.text or ""
            chat_id = event.chat_id
            
            # Determine if this is a group chat or private message
            is_group = not event.is_private
            chat_title = getattr(event.chat, 'title', None) if is_group else None
            
            if is_group:
                logger.info(f"Received group message in '{chat_title}' from user {user_id}: {message_text[:100]}")
            else:
                logger.info(f"Received private message from user {user_id}: {message_text[:100]}")
            
            # Create session key that includes chat context for group chats
            session_key = f"{chat_id}_{user_id}" if is_group else user_id
            
            # Get or create session
            session = self.session_manager.get_session(session_key)
            
            # Update metadata with chat information
            if is_group:
                session.update_metadata(
                    chat_id=str(chat_id),
                    chat_title=chat_title,
                    is_group=True
                )
            
            # Add user message to context
            session.add_message("user", message_text)
            
            # Process message based on content
            response = await self.process_message(message_text, session, is_group=is_group)
            
            # Add assistant response to context
            session.add_message("assistant", response)
            
            # Send response
            # In group chats, reply to the original message
            if is_group:
                await event.reply(response)
            else:
                await event.respond(response)
            
        except Exception as e:
            logger.error(f"Error handling message: {e}", exc_info=True)
            try:
                if event.is_private:
                    await event.respond(
                        "I'm sorry, I encountered an error processing your message. "
                        "Please try again."
                    )
                else:
                    await event.reply(
                        "I'm sorry, I encountered an error processing your message. "
                        "Please try again."
                    )
            except:
                pass  # Ignore errors when sending error message
    
    async def process_message(self, message: str, session: SessionContext, is_group: bool = False) -> str:
        """
        Process message and generate response.
        
        Uses LLM with character personality if available, otherwise falls back to basic echo.
        
        Args:
            message: User message text
            session: User session context
            is_group: Whether this is a group chat message
            
        Returns:
            Response text
        """
        message_lower = message.strip().lower()
        
        # Handle commands first (always use command handler)
        if message_lower.startswith('/'):
            return await self.handle_command(message_lower, session)
        
        # Use LLM if available
        if self.use_llm and self.llm_client and self.prompt_builder:
            return await self.handle_with_llm(message, session, is_group)
        
        # Fallback to basic echo
        return await self.handle_conversation(message, session)
    
    async def handle_with_llm(self, message: str, session: SessionContext, is_group: bool = False) -> str:
        """
        Handle message using LLM with character personality.
        
        Args:
            message: User message
            session: Session context
            is_group: Whether this is a group chat
            
        Returns:
            LLM-generated response
        """
        try:
            # Get conversation history
            conversation_history = session.get_conversation_history(max_messages=10)
            
            # Add current user message
            conversation_history.append({"role": "user", "content": message})
            
            # Get context metadata
            context = session.context.get("metadata", {})
            
            # Build messages with character personality
            messages = self.prompt_builder.build_messages(
                conversation_history=conversation_history,
                context=context
            )
            
            # Call LLM
            # 300-500 words ≈ 400-650 tokens (rough estimate: 1 word ≈ 1.3 tokens)
            # Set max_tokens to ~650 to allow for 500 words
            response = await self.llm_client.chat(
                messages=messages,
                temperature=0.7,
                max_tokens=650  # Allows for ~500 words
            )
            
            if response:
                return response.strip()
            else:
                logger.warning("LLM returned empty response, falling back to echo")
                return await self.handle_conversation(message, session)
                
        except Exception as e:
            logger.error(f"Error in LLM processing: {e}", exc_info=True)
            # Fallback to basic response
            return await self.handle_conversation(message, session)
    
    async def handle_command(self, command: str, session: SessionContext) -> str:
        """
        Handle bot commands.
        
        Args:
            command: Command string (lowercase, with /)
            session: User session context
            
        Returns:
            Response text
        """
        if command == '/start':
            return (
                "👋 Welcome to the Disaster Response Bot!\n\n"
                "I'm here to help during disaster situations. I can provide:\n"
                "• Emergency announcements and updates\n"
                "• Latest news and information\n"
                "• Accurate data from trusted sources\n"
                "• Emergency assistance guidance\n"
                "• Emotional support and de-escalation\n"
                "• Financial assistance navigation\n"
                "• Family finder services\n\n"
                "Type /help for more information or just start chatting!"
            )
        
        elif command == '/help':
            return (
                "📋 Available Commands:\n\n"
                "/start - Start the bot\n"
                "/help - Show this help message\n"
                "/news - Get latest disaster-related news\n"
                "/reset - Reset your session\n\n"
                "You can also chat with me naturally, and I'll do my best to help!"
            )
        
        elif command == '/reset':
            self.session_manager.reset_session(session.user_id)
            return "✅ Your session has been reset. How can I help you?"
        
        elif command == '/news':
            return (
                "📰 News feature coming soon!\n\n"
                "In Phase 2, I'll be able to fetch real-time disaster news "
                "from multiple sources including Twitter/X via GROK API."
            )
        
        else:
            return f"I don't recognize the command '{command}'. Type /help for available commands."
    
    async def handle_conversation(self, message: str, session: SessionContext) -> str:
        """
        Handle regular conversation messages.
        
        Phase 1: Basic echo with acknowledgment
        Phase 2: Will integrate LLM for intelligent responses
        
        Args:
            message: User message
            session: User session context
            
        Returns:
            Response text
        """
        # Phase 1: Simple acknowledgment
        # This will be replaced with LLM integration in Phase 2
        return (
            f"I received your message: \"{message}\"\n\n"
            "I'm currently in Phase 1 setup. In Phase 2, I'll be able to "
            "provide intelligent responses using AI. For now, I can help with "
            "basic commands. Type /help to see what I can do!"
        )

