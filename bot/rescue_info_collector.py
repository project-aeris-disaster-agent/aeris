"""
Rescue information collection and storage module.
Collects critical information for rescue operations and stores to Supabase.
"""

import logging
import uuid
from typing import Dict, Optional, Any
from datetime import datetime

logger = logging.getLogger(__name__)

# Lazy import for Supabase
try:
    from family_finder.database import get_supabase
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    logger.warning("Supabase not available - rescue info will not be stored")


class RescueInfoCollector:
    """
    Collects and stores rescue information for emergency situations.
    """
    
    REQUIRED_FIELDS = ['location', 'condition', 'contact_info']
    OPTIONAL_FIELDS = ['number_of_people', 'medical_needs', 'additional_info']
    
    def __init__(self):
        """Initialize rescue info collector."""
        self.supabase = None
        if SUPABASE_AVAILABLE:
            try:
                self.supabase = get_supabase()
                logger.info("Rescue info collector initialized with Supabase")
            except Exception as e:
                logger.warning(f"Failed to initialize Supabase for rescue info: {e}")
                self.supabase = None
    
    def collect_info(self, user_id: str, emergency_details: Dict[str, Any], 
                    conversation_history: list) -> Dict[str, Any]:
        """
        Collect rescue information from emergency details and conversation.
        
        Args:
            user_id: Telegram user ID
            emergency_details: Emergency detection details
            conversation_history: Conversation history for context
            
        Returns:
            Collected information dictionary
        """
        info = {
            'user_id': user_id,
            'timestamp': datetime.now().isoformat(),
            'emergency_type': emergency_details.get('type', 'unknown'),
            'urgency': emergency_details.get('urgency', 'medium'),
            'location': None,
            'condition': None,
            'contact_info': None,
            'number_of_people': None,
            'medical_needs': None,
            'additional_info': None,
            'status': 'active'
        }
        
        # Extract information from conversation history
        all_messages = ' '.join([
            msg.get('content', '') for msg in conversation_history[-10:]
            if msg.get('role') == 'user'
        ])
        
        # Try to extract location
        location_keywords = ['in', 'at', 'location', 'address', 'building', 'area']
        for msg in conversation_history[-5:]:
            content = msg.get('content', '').lower()
            if any(keyword in content for keyword in location_keywords):
                # Extract location context
                if 'abandoned building' in content:
                    info['location'] = 'abandoned building'
                elif 'building' in content:
                    info['location'] = 'building (location needs clarification)'
        
        # Extract condition
        condition_parts = []
        if 'flood' in all_messages.lower() or 'flooded' in all_messages.lower():
            condition_parts.append('flooding')
        if 'no electricity' in all_messages.lower() or 'no power' in all_messages.lower():
            condition_parts.append('no electricity')
        if 'water rising' in all_messages.lower() or 'water is rising' in all_messages.lower():
            condition_parts.append('water rising')
        
        if condition_parts:
            info['condition'] = ', '.join(condition_parts)
        
        # Contact info (Telegram ID is available)
        info['contact_info'] = f"Telegram ID: {user_id}"
        
        return info
    
    def store_rescue_info(self, rescue_info: Dict[str, Any]) -> Optional[str]:
        """
        Store rescue information to Supabase database.
        
        Args:
            rescue_info: Collected rescue information
            
        Returns:
            Case reference ID if successful, None otherwise
        """
        if not self.supabase:
            logger.warning("Supabase not available - rescue info not stored")
            return None
        
        try:
            # Generate case reference
            case_ref = f"RESCUE-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"
            
            # Prepare data for storage
            # Note: We'll create a rescue_reports table or use existing structure
            # For now, we'll store in a way that can be retrieved for rescue operations
            
            # Check if we should use missing_persons table or create rescue_reports
            # For rescue operations, we'll store as a rescue case
            
            rescue_data = {
                'case_reference': case_ref,
                'reporter_telegram_id': int(rescue_info['user_id']),
                'reporter_name': None,  # Will be collected
                'reporter_contact': rescue_info.get('contact_info'),
                'last_known_address': rescue_info.get('location'),
                'notes': self._format_rescue_notes(rescue_info),
                'status': 'active',
                'created_at': rescue_info['timestamp']
            }
            
            # Try to insert into missing_persons table (we'll adapt this)
            # Or create a new rescue_reports table
            # For now, store in notes field with special prefix
            
            result = self.supabase.get_client().table('missing_persons').insert({
                'case_reference': case_ref,
                'reporter_telegram_id': int(rescue_info['user_id']),
                'reporter_contact': rescue_info.get('contact_info'),
                'last_known_address': rescue_info.get('location'),
                'notes': f"[RESCUE CASE] {self._format_rescue_notes(rescue_info)}",
                'status': 'active',
                'missing_person_name': 'RESCUE_REQUEST',  # Special marker
            }).execute()
            
            logger.info(f"Stored rescue info with case reference: {case_ref}")
            return case_ref
            
        except Exception as e:
            logger.error(f"Error storing rescue info: {e}", exc_info=True)
            return None
    
    def _format_rescue_notes(self, info: Dict[str, Any]) -> str:
        """Format rescue information as notes."""
        notes_parts = [
            f"Emergency Type: {info.get('emergency_type', 'unknown')}",
            f"Urgency: {info.get('urgency', 'medium')}",
            f"Condition: {info.get('condition', 'not specified')}",
        ]
        
        if info.get('number_of_people'):
            notes_parts.append(f"Number of people: {info.get('number_of_people')}")
        if info.get('medical_needs'):
            notes_parts.append(f"Medical needs: {info.get('medical_needs')}")
        if info.get('additional_info'):
            notes_parts.append(f"Additional: {info.get('additional_info')}")
        
        return " | ".join(notes_parts)
    
    def update_rescue_info(self, case_ref: str, updates: Dict[str, Any]) -> bool:
        """
        Update existing rescue information.
        
        Args:
            case_ref: Case reference ID
            updates: Dictionary of fields to update
            
        Returns:
            True if successful, False otherwise
        """
        if not self.supabase:
            return False
        
        try:
            self.supabase.get_client().table('missing_persons').update(updates).eq(
                'case_reference', case_ref
            ).execute()
            
            logger.info(f"Updated rescue info for case: {case_ref}")
            return True
            
        except Exception as e:
            logger.error(f"Error updating rescue info: {e}", exc_info=True)
            return False

