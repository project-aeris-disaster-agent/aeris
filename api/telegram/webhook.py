"""
Telegram webhook handler for Vercel serverless function.
See SPEC.md Section 7.1.1 for API structure.

Note: For Phase 1, this is a basic handler.
Full implementation will integrate with bot message handler in Phase 2.
For production, consider using Telegram Bot API webhooks with proper message processing.
"""

import json
import logging
from typing import Dict, Any

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def process_update(update: Dict[str, Any]) -> Dict[str, Any]:
    """
    Process Telegram update.
    
    Args:
        update: Telegram update object
        
    Returns:
        Response dictionary
    """
    # Phase 1: Basic acknowledgment
    # Phase 2: Will integrate with MessageHandler and LLM
    
    if 'message' in update:
        message = update['message']
        user_id = message.get('from', {}).get('id')
        message_text = message.get('text', '')
        logger.info(f"Processing message from user {user_id}: {message_text[:100]}")
        
        # Return acknowledgment
        return {
            "status": "received",
            "message_id": message.get('message_id'),
            "user_id": user_id
        }
    
    return {"status": "processed"}


def handler(request):
    """
    Vercel serverless function handler for Telegram webhook.
    
    Vercel Python runtime provides a request object with:
    - request.method: HTTP method
    - request.body: Request body (bytes)
    - request.headers: Request headers
    
    Args:
        request: Vercel request object
        
    Returns:
        Response dictionary with statusCode and body
    """
    try:
        # Handle GET requests (health check)
        if request.method == 'GET':
            return {
                "statusCode": 200,
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps({
                    "status": "ok",
                    "service": "telegram-webhook",
                    "phase": 1
                })
            }
        
        # Handle POST requests (webhook updates)
        if request.method == 'POST':
            # Parse request body
            try:
                body = request.body
                if isinstance(body, bytes):
                    body = body.decode('utf-8')
                data = json.loads(body) if body else {}
            except (json.JSONDecodeError, AttributeError) as e:
                logger.error(f"Error parsing request body: {e}")
                return {
                    "statusCode": 400,
                    "headers": {"Content-Type": "application/json"},
                    "body": json.dumps({"error": "Invalid JSON"})
                }
            
            logger.info(f"Received webhook update: {data.get('update_id')}")
            
            # Process update
            response = process_update(data)
            
            return {
                "statusCode": 200,
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps(response)
            }
        
        # Method not allowed
        return {
            "statusCode": 405,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": "Method not allowed"})
        }
        
    except Exception as e:
        logger.error(f"Error processing webhook: {e}", exc_info=True)
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": "Internal server error"})
        }

