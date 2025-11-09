"""
Admin API endpoint for emergency announcements.
See SPEC.md Section 3.1 for announcement details.
"""

import json
import logging

logger = logging.getLogger(__name__)


def handler(request):
    """
    Admin announcements endpoint handler.
    
    Phase 4 will implement full admin interface with Streamlit.
    For Phase 1, this is a placeholder.
    
    Args:
        request: Vercel request object
        
    Returns:
        Response dictionary
    """
    if request.method != 'POST':
        return {
            "statusCode": 405,
            "body": json.dumps({"error": "Method not allowed"})
        }
    
    try:
        data = request.json if hasattr(request, 'json') else {}
        
        logger.info("Admin announcements endpoint called (Phase 1 placeholder)")
        
        return {
            "statusCode": 200,
            "body": json.dumps({
                "message": "Admin interface coming in Phase 4",
                "status": "placeholder"
            })
        }
    except Exception as e:
        logger.error(f"Error in admin announcements endpoint: {e}")
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }

