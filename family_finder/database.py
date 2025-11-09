"""
Supabase database connection and utilities.
See SPEC.md Section 4.1.6 for Supabase configuration details.
"""

import os
import logging
from typing import Optional, Dict, Any
from supabase import create_client, Client
from utils.helpers import get_env

logger = logging.getLogger(__name__)


class SupabaseClient:
    """
    Supabase client wrapper for database operations.
    Uses service role key for server-side operations (bypasses RLS).
    """
    
    def __init__(self):
        """Initialize Supabase client with service role key."""
        supabase_url = get_env("SUPABASE_URL", required=True)
        service_role_key = get_env("SUPABASE_SERVICE_ROLE_KEY", required=True)
        
        self.client: Client = create_client(supabase_url, service_role_key)
        logger.info("Supabase client initialized")
    
    def get_client(self) -> Client:
        """Get the Supabase client instance."""
        return self.client
    
    def test_connection(self) -> bool:
        """
        Test database connection.
        
        Returns:
            True if connection successful, False otherwise
        """
        try:
            # Simple query to test connection
            result = self.client.table("missing_persons").select("id").limit(1).execute()
            logger.info("Supabase connection test successful")
            return True
        except Exception as e:
            logger.error(f"Supabase connection test failed: {e}")
            return False


# Global Supabase client instance
_supabase_client: Optional[SupabaseClient] = None


def get_supabase() -> SupabaseClient:
    """
    Get or create Supabase client instance (singleton).
    
    Returns:
        SupabaseClient instance
    """
    global _supabase_client
    
    if _supabase_client is None:
        _supabase_client = SupabaseClient()
    
    return _supabase_client

