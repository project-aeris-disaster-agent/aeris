"""
Character card loader and prompt builder.
Implements elizaOS character card format for personality training.
"""

import json
import logging
from typing import Dict, Any, List, Optional
from pathlib import Path
from datetime import datetime

logger = logging.getLogger(__name__)

# Try to import pytz for timezone support, fallback to UTC if unavailable
try:
    import pytz
    PYTZ_AVAILABLE = True
except ImportError:
    PYTZ_AVAILABLE = False
    logger.warning("pytz not available - temporal awareness will use UTC instead of Philippines timezone")

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
        
        # Build system content - START with temporal awareness (critical for date/time questions)
        system_parts = []
        
        # Add TEMPORAL AWARENESS FIRST (critical for interpreting dates in RAG content)
        current_time = self._get_current_time_info()
        temporal_context = f"\n## Current Date and Time:\n"
        temporal_context += f"Today: {current_time['date']} ({current_time['day_of_week']}) | Time: {current_time['time']} | TZ: {current_time['timezone']}\n\n"
        temporal_context += "**TEMPORAL AWARENESS:** Use the current date above to:\n"
        temporal_context += "- Interpret relative dates ('tomorrow', 'in 2 days') in knowledge base\n"
        temporal_context += "- Calculate absolute dates from relative references\n"
        temporal_context += "- Answer 'when' questions using current date context\n"
        temporal_context += "- Provide specific dates (e.g., 'November 11') not vague terms\n\n"
        system_parts.append(temporal_context)
        
        # Add RAG context SECOND (most critical information)
        if user_query and self.use_knowledge_base and self.knowledge_base:
            try:
                # Detect if query is about weather/storms/cyclones - retrieve more chunks
                weather_keywords = ['storm', 'typhoon', 'cyclone', 'hurricane', 'weather', 'forecast', 'track', 'leave', 'exit', 'uwan', 'pagasa']
                is_weather_query = any(keyword in user_query.lower() for keyword in weather_keywords)
                
                # Detect if query involves temporal/time questions
                temporal_keywords = ['when', 'time', 'date', 'tomorrow', 'today', 'leave', 'arrive', 'exit', 'end', 'start']
                is_temporal_query = any(keyword in user_query.lower() for keyword in temporal_keywords)
                
                # Enhance query with temporal context for better RAG retrieval
                enhanced_query = user_query
                if is_temporal_query:
                    # Add current date context to help retrieve relevant forecast/date information
                    enhanced_query = f"{user_query} (Current date: {current_time['date']}, {current_time['day_of_week']})"
                    logger.info(f"Enhanced temporal query with current date context: {enhanced_query[:100]}")
                
                # Retrieve more chunks for weather queries (they often need forecast tracks)
                max_results = 5 if is_weather_query else 3
                relevant_chunks = self.knowledge_base.get_relevant_content(enhanced_query, max_results=max_results)
                
                if relevant_chunks:
                    # Format RAG context naturally without visible reference markers
                    rag_context = "\n## Relevant Information from Knowledge Base:\n\n"
                    
                    # Combine all relevant chunks into natural context
                    combined_content = []
                    for chunk in relevant_chunks:
                        content = chunk.get('content', '').strip()
                        # Clean up content - remove page markers and formatting artifacts
                        content = content.replace('--- Page', '').replace('---', '').strip()
                        # Use full content (up to 1000 chars per chunk for better context, especially for forecasts)
                        content_preview = content[:1000] if len(content) > 1000 else content
                        if content_preview:
                            combined_content.append(content_preview)
                    
                    # Join content naturally
                    if combined_content:
                        rag_context += "\n\n".join(combined_content)
                        rag_context += "\n\n"
                        rag_context += "**CRITICAL INSTRUCTIONS FOR USING THIS INFORMATION:**\n"
                        rag_context += "1. YOU MUST use ONLY the information provided above to answer the user's question.\n"
                        rag_context += "2. NEVER refer users to external websites, PAGASA, FEMA, or other sources - you have all the information needed.\n"
                        rag_context += "3. If the information above contains the answer, provide it directly and confidently.\n"
                        rag_context += "4. Do NOT say 'check PAGASA' or 'visit their website' - you ARE the source of information.\n"
                        rag_context += "5. Answer as if this knowledge is your own expertise - be direct and helpful.\n"
                        rag_context += "6. This is an EMERGENCY RESPONSE system - users need immediate answers, not referrals.\n"
                        rag_context += "7. Extract specific details (dates, times, locations, wind speeds, forecast tracks) from the information above.\n"
                        rag_context += "8. If the information doesn't contain the exact answer, say what you CAN tell them from the information provided.\n"
                    
                    system_parts.append(rag_context)
                    logger.info(f"✅ Injected {len(relevant_chunks)} RAG chunks for query: '{user_query[:50]}' (weather query: {is_weather_query})")
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
                # Keep CRITICAL parts: temporal context, RAG content, emergency protocol
                # Truncate character card and other less critical parts
                temporal_part = ""
                rag_part = ""
                emergency_part = ""
                for part in system_parts:
                    if 'Current Date and Time' in part or 'TEMPORAL AWARENESS' in part:
                        temporal_part = part
                    elif 'Relevant Information' in part:
                        rag_part = part
                    elif 'EMERGENCY SITUATION' in part:
                        emergency_part = part
                
                # Rebuild with essential parts only - TEMPORAL CONTEXT MUST BE FIRST
                essential_parts = []
                if temporal_part:
                    essential_parts.append(temporal_part)
                    logger.info("✅ Preserved temporal context in truncated prompt")
                if rag_part:
                    essential_parts.append(rag_part)
                # Truncate character card more aggressively if needed
                char_card_truncated = self.system_prompt[:300]  # Reduced from 500 to 300
                essential_parts.append(char_card_truncated)
                if emergency_part:
                    essential_parts.append(emergency_part)
                combined_system = "\n".join(essential_parts)
                
                # If still too long, truncate RAG content (last resort)
                if len(combined_system) > 5000:
                    logger.warning("Prompt still too long after truncation - truncating RAG content")
                    if rag_part and len(rag_part) > 2000:
                        # Keep first 1500 chars of RAG content
                        rag_truncated = rag_part[:1500] + "\n\n[... RAG content truncated ...]"
                        essential_parts = []
                        if temporal_part:
                            essential_parts.append(temporal_part)
                        essential_parts.append(rag_truncated)
                        essential_parts.append(char_card_truncated)
                        if emergency_part:
                            essential_parts.append(emergency_part)
                        combined_system = "\n".join(essential_parts)
        
        # Add final instruction - SIMPLIFIED to avoid confusion
        if is_emergency:
            combined_system += "\n\nRespond directly to the user as AERIS. Help them through this emergency."
        else:
            combined_system += "\n\nRespond directly to the user as AERIS."
        
        # Check if RAG context was provided
        rag_added = any('Relevant Information from Knowledge Base' in part for part in system_parts)
        if rag_added:
            # STRONG instructions when RAG is available
            combined_system += "\n\n**CRITICAL:** RAG context was provided above. "
            combined_system += "YOU MUST use it to answer the user's question. "
            combined_system += "NEVER refer users to external websites (PAGASA, FEMA, etc.) - you have the information. "
            combined_system += "Provide direct, actionable answers from your knowledge base. "
            combined_system += "This is an emergency response system - users need immediate help, not website referrals."
        else:
            # Standard instruction when no RAG
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
    
    def _get_current_time_info(self) -> Dict[str, Any]:
        """
        Get current date and time information in Philippines timezone.
        Falls back to UTC if pytz is not available.
        
        Returns:
            Dictionary with date, time, day_of_week, and timezone info
        """
        if PYTZ_AVAILABLE:
            # Philippines timezone
            ph_tz = pytz.timezone('Asia/Manila')
            now = datetime.now(ph_tz)
            timezone_str = 'PHT (UTC+8)'
            timezone_name = 'Philippines Standard Time'
        else:
            # Fallback to UTC
            now = datetime.utcnow()
            timezone_str = 'UTC'
            timezone_name = 'UTC'
            logger.warning("Using UTC instead of Philippines timezone - install pytz for accurate local time")
        
        # Format date and time
        date_str = now.strftime('%B %d, %Y')  # e.g., "November 10, 2024"
        time_str = now.strftime('%I:%M %p')  # e.g., "07:30 AM"
        day_of_week = now.strftime('%A')  # e.g., "Monday"
        
        return {
            'date': date_str,
            'time': time_str,
            'day_of_week': day_of_week,
            'timezone': timezone_str,
            'timezone_name': timezone_name,
            'datetime_iso': now.isoformat(),
            'datetime_obj': now  # Keep datetime object for calculations if needed
        }

