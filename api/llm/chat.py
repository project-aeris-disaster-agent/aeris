"""
LLM chat API endpoint for Vercel serverless function.
Aeris Chat frontend integration with full LLM support.

API Contract:
- Endpoint: POST /api/llm/chat
- Request: {"messages": [{"role": "user", "content": "..."}]}
- Response: {"message": "AI response"}
- Auth: Authorization: Bearer {LLM_API_KEY}
"""

import json
import os
import logging
import asyncio
from typing import Dict, Any, List, Optional
from pathlib import Path

# Import your existing LLM components
try:
    from llm.openai_client import OpenAIClient
    from llm.prompt_builder import CharacterCard, PromptBuilder
    LLM_AVAILABLE = True
except ImportError as e:
    LLM_AVAILABLE = False
    logging.warning(f"LLM components not available: {e}")

logger = logging.getLogger(__name__)

# Global LLM components (cached across invocations)
_llm_client: Optional[OpenAIClient] = None
_prompt_builder: Optional[PromptBuilder] = None


def get_llm_components():
    """Get or initialize LLM components (cached)."""
    global _llm_client, _prompt_builder
    
    if _llm_client is None or _prompt_builder is None:
        try:
            # Initialize OpenAI client
            _llm_client = OpenAIClient()
            
            # Load character card
            # Path resolution: api/llm/chat.py -> project root -> characters/
            current_file = Path(__file__)
            project_root = current_file.parent.parent.parent
            card_path = project_root / "characters" / "aeris.character.json"
            
            if not card_path.exists():
                raise FileNotFoundError(f"Character card not found: {card_path}")
            
            character_card = CharacterCard(str(card_path))
            _prompt_builder = PromptBuilder(character_card, use_knowledge_base=True)
            
            logger.info("✅ LLM components initialized")
        except Exception as e:
            logger.error(f"Failed to initialize LLM components: {e}", exc_info=True)
            raise
    
    return _llm_client, _prompt_builder


def verify_api_key(request) -> bool:
    """Verify Authorization Bearer token."""
    # Vercel request headers can be accessed via request.headers
    headers = getattr(request, 'headers', {})
    
    # Try both capitalized and lowercase header names
    auth_header = headers.get("Authorization") or headers.get("authorization")
    
    if not auth_header:
        logger.warning("Missing Authorization header")
        return False
    
    if not auth_header.startswith("Bearer "):
        logger.warning(f"Invalid Authorization format: {auth_header[:20]}...")
        return False
    
    token = auth_header.replace("Bearer ", "").strip()
    expected_token = os.getenv("LLM_API_KEY")
    
    if not expected_token:
        logger.error("LLM_API_KEY not configured in environment")
        return False
    
    if token != expected_token:
        logger.warning(f"Invalid API key attempt: {token[:10]}...")
        return False
    
    return True


def parse_request_body(request) -> Dict[str, Any]:
    """Parse request body from Vercel request object."""
    # Vercel request body handling (similar to webhook.py pattern)
    try:
        body = getattr(request, 'body', None)
        
        if body is None:
            return {}
        
        # Handle bytes (decode to string)
        if isinstance(body, bytes):
            body = body.decode('utf-8')
        
        # Handle dict (already parsed)
        if isinstance(body, dict):
            return body
        
        # Handle string (parse JSON)
        if isinstance(body, str):
            return json.loads(body) if body else {}
        
        return {}
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in body: {e}")
        return {}
    except Exception as e:
        logger.error(f"Error parsing request body: {e}")
        return {}


def handler(request):
    """
    LLM chat endpoint handler for Aeris Chat frontend.
    
    Request format:
    {
        "messages": [
            {"role": "user", "content": "Hello!"},
            {"role": "assistant", "content": "Hi there!"}
        ]
    }
    
    Response format:
    {
        "message": "AI response here"
    }
    """
    # Method check
    method = getattr(request, 'method', 'GET')
    if method != 'POST':
        return {
            "statusCode": 405,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": "Method not allowed"})
        }
    
    # API key validation
    if not verify_api_key(request):
        return {
            "statusCode": 401,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": "Unauthorized"})
        }
    
    # Parse request body
    try:
        data = parse_request_body(request)
        
        # Validate request structure
        if not isinstance(data, dict) or "messages" not in data:
            return {
                "statusCode": 400,
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps({"error": "Invalid request. Expected 'messages' array"})
            }
        
        messages = data["messages"]
        if not isinstance(messages, list) or len(messages) == 0:
            return {
                "statusCode": 400,
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps({"error": "messages must be a non-empty array"})
            }
        
        # Validate message format
        for i, msg in enumerate(messages):
            if not isinstance(msg, dict):
                return {
                    "statusCode": 400,
                    "headers": {"Content-Type": "application/json"},
                    "body": json.dumps({"error": f"Message {i} must be an object"})
                }
            
            if "role" not in msg or "content" not in msg:
                return {
                    "statusCode": 400,
                    "headers": {"Content-Type": "application/json"},
                    "body": json.dumps({"error": f"Message {i} must have 'role' and 'content' fields"})
                }
            
            if msg["role"] not in ["user", "assistant", "system"]:
                return {
                    "statusCode": 400,
                    "headers": {"Content-Type": "application/json"},
                    "body": json.dumps({"error": f"Message {i}: role must be 'user', 'assistant', or 'system'"})
                }
            
            if not isinstance(msg["content"], str) or not msg["content"].strip():
                return {
                    "statusCode": 400,
                    "headers": {"Content-Type": "application/json"},
                    "body": json.dumps({"error": f"Message {i}: content cannot be empty"})
                }
        
        # Ensure last message is from user
        if messages[-1]["role"] != "user":
            return {
                "statusCode": 400,
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps({"error": "Last message must be from user"})
            }
        
    except json.JSONDecodeError as e:
        logger.error(f"JSON decode error: {e}")
        return {
            "statusCode": 400,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": "Invalid JSON"})
        }
    except Exception as e:
        logger.error(f"Error parsing request: {e}", exc_info=True)
        return {
            "statusCode": 400,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": "Bad request"})
        }
    
    # Process chat request
    try:
        if not LLM_AVAILABLE:
            logger.error("LLM components not available")
            return {
                "statusCode": 500,
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps({"error": "LLM components not available"})
            }
        
        # Get LLM components
        llm_client, prompt_builder = get_llm_components()
        
        # Convert to format expected by prompt builder
        conversation_history = [
            {"role": msg["role"], "content": msg["content"]}
            for msg in messages
        ]
        
        user_query = messages[-1]["content"]
        
        logger.info(f"Processing chat: {len(conversation_history)} messages, query: '{user_query[:100]}'")
        
        # Build messages with character personality and RAG
        built_messages = prompt_builder.build_messages(
            conversation_history=conversation_history,
            context={},  # No session context for web API
            user_query=user_query,
            is_emergency=False,  # Could add emergency detection here if needed
            emergency_details=None
        )
        
        # Call LLM (run async in sync context for Vercel)
        # Vercel serverless functions need to handle async properly
        loop = None
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        
        try:
            response = loop.run_until_complete(
                llm_client.chat(
                    messages=built_messages,
                    temperature=0.7,
                    max_tokens=650
                )
            )
        finally:
            # Don't close the loop as it might be reused
            pass
        
        if not response:
            logger.error("No response from LLM")
            return {
                "statusCode": 500,
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps({"error": "Failed to generate response"})
            }
        
        logger.info(f"✅ Generated response: {len(response)} chars")
        
        # Return response (support multiple field names for compatibility)
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({
                "message": response,
                "content": response,  # Alternative field name
                "response": response   # Alternative field name
            })
        }
        
    except Exception as e:
        logger.error(f"Error processing chat request: {e}", exc_info=True)
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": "Internal server error"})
        }

