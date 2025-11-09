"""
OpenAI API client for LLM integration.
Replaces OpenRouter integration with direct OpenAI API access.
"""

import os
import logging
import httpx
from typing import Optional, List, Dict, Any
from utils.helpers import get_env

logger = logging.getLogger(__name__)


class OpenAIClient:
    """
    Client for OpenAI API integration.
    Supports OpenAI models (gpt-4o, gpt-4o-mini, gpt-4-turbo, etc.)
    """
    
    def __init__(self):
        """Initialize OpenAI client."""
        self.api_key = get_env("OPENAI_API_KEY", required=True)
        self.api_url = "https://api.openai.com/v1/chat/completions"
        self.default_model = get_env("OPENAI_MODEL", default="gpt-4o-mini")
        
        self.client = httpx.AsyncClient(
            timeout=60.0,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
        )
        
        logger.info(f"OpenAI client initialized with model: {self.default_model}")
    
    async def chat(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> Optional[str]:
        """
        Send chat completion request to OpenAI.
        
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
            logger.debug(f"Sending request to OpenAI: model={model}, messages={len(messages)}")
            
            response = await self.client.post(self.api_url, json=payload)
            response.raise_for_status()
            
            data = response.json()
            
            # Extract response text
            if "choices" in data and len(data["choices"]) > 0:
                content = data["choices"][0]["message"]["content"]
                logger.debug(f"Received response from OpenAI: {len(content)} chars")
                return content
            else:
                logger.error(f"No choices in OpenAI response: {data}")
                return None
                
        except httpx.HTTPStatusError as e:
            logger.error(f"OpenAI API error: {e.response.status_code} - {e.response.text}")
            return None
        except Exception as e:
            logger.error(f"Error calling OpenAI API: {e}", exc_info=True)
            return None
    
    async def test_connection(self) -> bool:
        """
        Test OpenAI API connection.
        
        Returns:
            True if connection successful, False otherwise
        """
        try:
            test_messages = [
                {"role": "user", "content": "Say 'test' if you can read this."}
            ]
            
            response = await self.chat(test_messages, temperature=0.1)
            
            if response and "test" in response.lower():
                logger.info("OpenAI connection test successful")
                return True
            else:
                logger.warning(f"OpenAI test returned unexpected response: {response}")
                return False
                
        except Exception as e:
            logger.error(f"OpenAI connection test failed: {e}")
            return False
    
    async def close(self):
        """Close the HTTP client."""
        await self.client.aclose()

