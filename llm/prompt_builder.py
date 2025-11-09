"""
Character card loader and prompt builder.
Implements elizaOS character card format for personality training.
"""

import json
import logging
from typing import Dict, Any, List, Optional
from pathlib import Path

logger = logging.getLogger(__name__)

# Lazy import for knowledge base
try:
    from llm.knowledge_base import KnowledgeBase
    KB_AVAILABLE = True
except ImportError:
    KB_AVAILABLE = False
    logger.warning("Knowledge base not available")


class CharacterCard:
    """
    Loads and manages character card JSON for personality training.
    Based on elizaOS character card format.
    """
    
    def __init__(self, card_path: str):
        """
        Initialize character card from JSON file.
        
        Args:
            card_path: Path to character card JSON file
        """
        self.card_path = Path(card_path)
        self.card_data: Dict[str, Any] = {}
        self.load()
    
    def load(self):
        """Load character card from JSON file."""
        try:
            with open(self.card_path, 'r', encoding='utf-8') as f:
                self.card_data = json.load(f)
            logger.info(f"Loaded character card: {self.card_data.get('name', 'Unknown')}")
        except FileNotFoundError:
            logger.error(f"Character card not found: {self.card_path}")
            raise
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in character card: {e}")
            raise
    
    def get_system_prompt(self) -> str:
        """
        Build system prompt from character card.
        
        Returns:
            Formatted system prompt string
        """
        parts = []
        
        # System instruction
        if "system" in self.card_data:
            parts.append(self.card_data["system"])
        
        # Bio
        if "bio" in self.card_data and self.card_data["bio"]:
            bio_text = "\n".join(self.card_data["bio"]) if isinstance(self.card_data["bio"], list) else self.card_data["bio"]
            parts.append(f"\n## About {self.card_data.get('name', 'the agent')}:\n{bio_text}")
        
        # Style guidelines
        if "style" in self.card_data:
            style = self.card_data["style"]
            
            # All style rules
            if "all" in style:
                parts.append("\n## Style Guidelines:")
                for rule in style["all"]:
                    parts.append(f"- {rule}")
            
            # Chat-specific rules
            if "chat" in style:
                parts.append("\n## Chat Behavior:")
                for rule in style["chat"]:
                    parts.append(f"- {rule}")
        
        # Topics of interest (for context)
        if "topics" in self.card_data and self.card_data["topics"]:
            topics = self.card_data["topics"][:10]  # Limit to first 10
            parts.append(f"\n## Relevant Topics: {', '.join(topics)}")
        
        return "\n".join(parts)
    
    def get_examples(self) -> List[Dict[str, str]]:
        """
        Get conversation examples from character card.
        
        Returns:
            List of example conversations formatted for LLM
        """
        examples = []
        
        if "messageExamples" in self.card_data:
            for example_conversation in self.card_data["messageExamples"]:
                # Convert example to message format
                conversation = []
                for msg in example_conversation:
                    role = "assistant" if msg.get("user") == self.card_data.get("name", "assistant") else "user"
                    content = msg.get("content", {}).get("text", "")
                    if content:
                        conversation.append({"role": role, "content": content})
                
                if conversation:
                    examples.extend(conversation)
        
        return examples
    
    def get_name(self) -> str:
        """Get character name."""
        return self.card_data.get("name", "Assistant")
    
    def get_model_provider(self) -> Optional[str]:
        """Get preferred model provider."""
        return self.card_data.get("modelProvider")


class PromptBuilder:
    """
    Builds prompts for LLM with character personality and context.
    """
    
    def __init__(self, character_card: CharacterCard, use_knowledge_base: bool = True):
        """
        Initialize prompt builder with character card.
        
        Args:
            character_card: CharacterCard instance
            use_knowledge_base: Whether to include knowledge base content
        """
        self.character_card = character_card
        self.system_prompt = character_card.get_system_prompt()
        self.use_knowledge_base = use_knowledge_base and KB_AVAILABLE
        
        # Initialize knowledge base if available
        self.knowledge_base = None
        if self.use_knowledge_base:
            try:
                self.knowledge_base = KnowledgeBase()
                logger.info("Knowledge base initialized for prompt builder")
            except Exception as e:
                logger.warning(f"Failed to initialize knowledge base: {e}")
                self.use_knowledge_base = False
        
        logger.info("Prompt builder initialized")
    
    def build_messages(
        self,
        conversation_history: List[Dict[str, str]],
        context: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, str]]:
        """
        Build message list for LLM API call.
        
        Args:
            conversation_history: List of previous messages with 'role' and 'content'
            context: Optional context metadata (disaster type, location, etc.)
            
        Returns:
            Formatted message list with system prompt and conversation
        """
        messages = []
        
        # Add system prompt
        system_content = self.system_prompt
        
        # Add knowledge base context if available
        if self.use_knowledge_base and self.knowledge_base:
            system_content = self.knowledge_base.add_to_system_prompt(system_content)
        
        # Add response formatting and length guidelines
        system_content += "\n\n## Response Guidelines:\n"
        system_content += "- Keep responses between 300-500 words\n"
        system_content += "- Use emojis strategically to organize information (🫂 for comfort, ⚠️ for warnings, 📋 for lists, ✅ for confirmations, 💙 for support)\n"
        system_content += "- Format with clear sections using emojis, line breaks, and **bold** text\n"
        system_content += "- Use bullet points (•) or numbered lists (1️⃣ 2️⃣ 3️⃣) for step-by-step guidance\n"
        system_content += "- Be personal, warm, and conversational - like texting a trusted friend\n"
        system_content += "- Use 'I' and 'you' - be direct and personal\n"
        system_content += "- When referencing knowledge base information, cite the source if relevant\n"
        
        # Add context if provided
        if context:
            context_parts = []
            if context.get("disaster_context"):
                context_parts.append(f"Current disaster context: {context['disaster_context']}")
            if context.get("location"):
                context_parts.append(f"User location: {context['location']}")
            if context.get("support_type"):
                context_parts.append(f"Support type: {context['support_type']}")
            
            if context_parts:
                system_content += "\n\n## Current Context:\n" + "\n".join(context_parts)
        
        messages.append({
            "role": "system",
            "content": system_content
        })
        
        # Add conversation history
        messages.extend(conversation_history)
        
        return messages

