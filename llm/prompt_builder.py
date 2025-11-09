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
        Build system prompt from character card - SIMPLIFIED.
        
        Returns:
            Formatted system prompt string
        """
        parts = []
        
        # System instruction (core identity)
        if "system" in self.card_data:
            parts.append(self.card_data["system"])
        
        # Brief bio summary (first 2-3 sentences only)
        if "bio" in self.card_data and self.card_data["bio"]:
            bio_list = self.card_data["bio"] if isinstance(self.card_data["bio"], list) else [self.card_data["bio"]]
            # Take only first 2 bio items for brevity
            brief_bio = "\n".join(bio_list[:2])
            parts.append(f"\n{brief_bio}")
        
        # Minimal style guidance (only most critical)
        if "style" in self.card_data:
            style = self.card_data["style"]
            if "all" in style:
                # Take only first 3 most important rules
                key_rules = style["all"][:3]
                parts.append("\nKey principles:")
                for rule in key_rules:
                    parts.append(f"- {rule}")
        
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
        context: Optional[Dict[str, Any]] = None,
        user_query: Optional[str] = None,
        is_emergency: bool = False,
        emergency_details: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, str]]:
        """
        Build message list for LLM API call.
        
        Args:
            conversation_history: List of previous messages with 'role' and 'content'
            context: Optional context metadata (disaster type, location, etc.)
            user_query: Current user query for RAG retrieval (optional)
            is_emergency: Whether this is an emergency situation
            emergency_details: Emergency detection details if is_emergency is True
            
        Returns:
            Formatted message list with system prompt and conversation
        """
        messages = []
        
        # Build system content - START with RAG context if available (most important)
        system_parts = []
        
        # Add RAG context FIRST (most critical information)
        if user_query and self.use_knowledge_base and self.knowledge_base:
            try:
                relevant_chunks = self.knowledge_base.get_relevant_content(user_query, max_results=3)
                if relevant_chunks:
                    # Format RAG context naturally without visible reference markers
                    rag_context = "\n## Relevant Information from Knowledge Base:\n\n"
                    
                    # Combine all relevant chunks into natural context
                    combined_content = []
                    for chunk in relevant_chunks:
                        content = chunk.get('content', '').strip()
                        # Clean up content - remove page markers and formatting artifacts
                        content = content.replace('--- Page', '').replace('---', '').strip()
                        # Use full content (up to 800 chars per chunk for better context)
                        content_preview = content[:800] if len(content) > 800 else content
                        if content_preview:
                            combined_content.append(content_preview)
                    
                    # Join content naturally
                    if combined_content:
                        rag_context += "\n\n".join(combined_content)
                        rag_context += "\n\n"
                        rag_context += "Use this information to answer the user's question naturally and conversationally. "
                        rag_context += "Do NOT mention references, document names, or that you're using a knowledge base. "
                        rag_context += "Just use the information naturally in your response as if it's your own knowledge.\n"
                    
                    system_parts.append(rag_context)
                    logger.info(f"✅ Injected {len(relevant_chunks)} RAG chunks for query: '{user_query[:50]}'")
            except Exception as e:
                logger.error(f"❌ Error retrieving knowledge base content: {e}", exc_info=True)
        
        # Add character personality and system prompt
        system_content = self.system_prompt
        
        # Add knowledge base metadata ONLY if RAG content wasn't added (avoid duplication)
        if self.use_knowledge_base and self.knowledge_base:
            # Only add metadata summary if we didn't add RAG content above
            rag_added = any('Relevant Information from Knowledge Base' in part for part in system_parts)
            if not rag_added:
                system_content = self.knowledge_base.add_to_system_prompt(system_content)
        
        system_parts.append(system_content)
        
        # Add EMERGENCY RESPONSE PROTOCOL if this is an emergency
        if is_emergency:
            emergency_protocol = self._build_emergency_protocol(emergency_details)
            system_parts.append(emergency_protocol)
        
        # Add minimal response guidelines (only if not emergency - emergency protocol handles emergencies)
        if not is_emergency:
            guidelines = "\n\n## How to Respond:\n"
            guidelines += "Respond naturally as AERIS - warm, personal, like texting a trusted friend.\n"
            guidelines += "Use emojis strategically. Keep responses helpful and actionable.\n"
            system_parts.append(guidelines)
        
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
                system_parts.append("\n\n## Current Context:\n" + "\n".join(context_parts))
        
        # Combine all system parts into ONE system message
        combined_system = "\n".join(system_parts)
        
        # Check prompt length and warn if too long
        if len(combined_system) > 3000:
            logger.warning(f"System prompt is very long ({len(combined_system)} chars) - may cause confusion")
            # Truncate if extremely long (emergency measure)
            if len(combined_system) > 5000:
                logger.error("System prompt exceeds 5000 chars - truncating to prevent hallucinations")
                # Keep RAG content and emergency protocol, truncate character card
                rag_part = ""
                emergency_part = ""
                for part in system_parts:
                    if 'Relevant Information' in part:
                        rag_part = part
                    elif 'EMERGENCY SITUATION' in part:
                        emergency_part = part
                
                # Rebuild with essential parts only
                essential_parts = []
                if rag_part:
                    essential_parts.append(rag_part)
                essential_parts.append(self.system_prompt[:500])  # Truncated character card
                if emergency_part:
                    essential_parts.append(emergency_part)
                combined_system = "\n".join(essential_parts)
        
        # Add final instruction - SIMPLIFIED to avoid confusion
        if is_emergency:
            combined_system += "\n\nRespond directly to the user as AERIS. Help them through this emergency."
        else:
            combined_system += "\n\nRespond directly to the user as AERIS."
        
        # Single clear instruction (avoid multiple "Do NOT" statements)
        combined_system += "\n\nUse the information above naturally. Do not mention references or knowledge base."
        
        messages.append({
            "role": "system",
            "content": combined_system
        })
        
        # Add conversation history
        messages.extend(conversation_history)
        
        return messages
    
    def _build_emergency_protocol(self, emergency_details: Optional[Dict[str, Any]]) -> str:
        """
        Build emergency response protocol instructions - SIMPLIFIED AND DIRECT.
        
        Args:
            emergency_details: Emergency detection details
            
        Returns:
            Emergency protocol string
        """
        protocol = "\n\n## EMERGENCY SITUATION DETECTED\n"
        protocol += "You are responding to a life-threatening emergency. Follow these steps:\n\n"
        
        protocol += "1. **Calm and reassure**: Start with 'I hear you, I'm here with you.' Be empathetic.\n"
        protocol += "2. **Collect location**: Ask 'Where exactly are you? What building or address?'\n"
        protocol += "3. **Assess safety**: Ask 'Are you safe right now? Can you move to higher ground?'\n"
        protocol += "4. **Provide immediate actions**: Use RAG knowledge to give specific steps like 'Move to highest floor' or 'Stay away from windows'\n"
        protocol += "5. **Collect contact info**: Ask for phone number for rescue teams\n"
        protocol += "6. **Stay hopeful**: Say 'Help is coming' and 'We'll get through this together'\n\n"
        
        protocol += "**IMPORTANT**: Give SPECIFIC, ACTIONABLE advice. Do NOT repeat generic safety tips.\n"
        protocol += "Respond directly to the user now - be their companion and guide them through this.\n\n"
        
        return protocol

