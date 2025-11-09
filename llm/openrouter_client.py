"""
OpenRouter API client for LLM integration.
See SPEC.md Section 2.2 and 4.1.4 for OpenRouter details.
"""

import os
import logging
import httpx
from typing import Optional, List, Dict, Any
from utils.helpers import get_env

logger = logging.getLogger(__name__)


class OpenRouterClient:
    """
    Client for OpenRouter API integration.
    Supports multiple models and conversation management.
    """
    
    def __init__(self):
        """Initialize OpenRouter client."""
        self.api_key = get_env("OPENROUTER_API_KEY", required=True)
        self.api_url = "https://openrouter.ai/api/v1/chat/completions"
        self.default_model = get_env("OPENROUTER_MODEL", default="openai/gpt-4o-mini")
        
        self.client = httpx.AsyncClient(
            timeout=60.0,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "HTTP-Referer": get_env("OPENROUTER_REFERER", default="https://github.com/disaster-response-bot"),
                "X-Title": "Disaster Response Bot"
            }
        )
        
        logger.info(f"OpenRouter client initialized with model: {self.default_model}")
    
    async def chat(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> Optional[str]:
        """
        Send chat completion request to OpenRouter.
        
        Args:
            messages: List of message dicts with 'role' and 'content'
            model: Model to use (defaults to self.default_model)
            temperature: Sampling temperature (0.0-2.0)
            max_tokens: Maximum tokens in response
            **kwargs: Additional parameters
            
        Returns:
            Response text or None if error
        """
        model = model or self.default_model
        
        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            **kwargs
        }
        
        if max_tokens:
            payload["max_tokens"] = max_tokens
        
        try:
            logger.debug(f"Sending request to OpenRouter: model={model}, messages={len(messages)}")
            
            response = await self.client.post(self.api_url, json=payload)
            response.raise_for_status()
            
            data = response.json()
            
            # Extract response text
            if "choices" in data and len(data["choices"]) > 0:
                content = data["choices"][0]["message"]["content"]
                logger.debug(f"Received response from OpenRouter: {len(content)} chars")
                return content
            else:
                logger.error(f"No choices in OpenRouter response: {data}")
                return None
                
        except httpx.HTTPStatusError as e:
            logger.error(f"OpenRouter API error: {e.response.status_code} - {e.response.text}")
            return None
        except Exception as e:
            logger.error(f"Error calling OpenRouter API: {e}", exc_info=True)
            return None
    
    async def test_connection(self) -> bool:
        """
        Test OpenRouter API connection.
        
        Returns:
            True if connection successful, False otherwise
        """
        try:
            test_messages = [
                {"role": "user", "content": "Say 'test' if you can read this."}
            ]
            
            response = await self.chat(test_messages, temperature=0.1)
            
            if response and "test" in response.lower():
                logger.info("OpenRouter connection test successful")
                return True
            else:
                logger.warning(f"OpenRouter test returned unexpected response: {response}")
                return False
                
        except Exception as e:
            logger.error(f"OpenRouter connection test failed: {e}")
            return False
    
    async def close(self):
        """Close the HTTP client."""
        await self.client.aclose()

