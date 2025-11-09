"""
Test script to debug OpenAI API response and find correct model name.
"""

import asyncio
import sys
import os
import codecs
from pathlib import Path

# Fix Unicode encoding for Windows console
os.system('chcp 65001 >nul 2>&1')
sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')

sys.path.insert(0, str(Path(__file__).parent))

from llm.openai_client import OpenAIClient
from utils.helpers import get_env
import logging

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

async def test_openai_models():
    """Test different OpenAI model names to find the correct one."""
    print("=" * 60)
    print("TESTING OPENAI API - FINDING CORRECT MODEL NAME")
    print("=" * 60)
    
    # Get current model
    current_model = get_env("OPENAI_MODEL", required=False)
    print(f"\nCurrent model in .env: {current_model}")
    
    # Test models to try
    test_models = [
        "gpt-5",
        "gpt-5-2025-08-07",
        "gpt-4o",
        "gpt-4o-mini",
        "gpt-4-turbo",
    ]
    
    client = OpenAIClient()
    print(f"\nAPI Provider: OpenAI")
    print(f"Default Model: {client.default_model}")
    
    test_messages = [
        {"role": "user", "content": "Say 'hello' if you can read this."}
    ]
    
    print("\n" + "=" * 60)
    print("TESTING DIFFERENT MODEL NAMES")
    print("=" * 60)
    
    for model in test_models:
        print(f"\n--- Testing model: {model} ---")
        try:
            # For GPT-5, don't use temperature
            if "gpt-5" in model.lower():
                response = await client.chat(
                    messages=test_messages,
                    model=model,
                    max_tokens=50
                )
            else:
                response = await client.chat(
                    messages=test_messages,
                    model=model,
                    temperature=0.7,
                    max_tokens=50
                )
            
            if response:
                print(f"[OK] Model '{model}' works!")
                print(f"Response: {response[:100]}")
            else:
                print(f"[FAIL] Model '{model}' returned empty response")
                
        except Exception as e:
            print(f"[ERROR] Model '{model}' failed: {e}")
            import traceback
            traceback.print_exc()
    
    await client.close()
    
    print("\n" + "=" * 60)
    print("RECOMMENDATION")
    print("=" * 60)
    print("Use the model name that worked above in your .env file")

if __name__ == "__main__":
    asyncio.run(test_openai_models())

