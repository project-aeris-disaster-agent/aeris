"""
Emergency detection module for identifying rescue and emergency situations.
"""

import re
import logging
from typing import Dict, Optional, Tuple, Any

logger = logging.getLogger(__name__)


class EmergencyDetector:
    """
    Detects emergency situations from user messages.
    """
    
    # Emergency keywords and patterns
    EMERGENCY_KEYWORDS = {
        'rescue': ['rescue', 'need rescue', 'help me', 'stuck', 'trapped', 'stranded'],
        'flood': ['flood', 'flooded', 'flooding', 'water rising', 'water is rising', 'rising water'],
        'building': ['building', 'abandoned building', 'structure', 'inside'],
        'no_power': ['no electricity', 'no power', 'blackout', 'power outage', 'dark'],
        'danger': ['danger', 'dangerous', 'unsafe', 'emergency', 'urgent', 'critical'],
        'location': ['location', 'where', 'address', 'place', 'area', 'here', 'there']
    }
    
    # Rescue request patterns
    RESCUE_PATTERNS = [
        r'need rescue',
        r'need help',
        r'stuck',
        r'trapped',
        r'stranded',
        r'can.*get out',
        r'can.*leave',
        r'help.*escape',
        r'rescue.*me',
        r'get.*out',
        r'save.*me'
    ]
    
    def __init__(self):
        """Initialize emergency detector."""
        self.rescue_patterns = [re.compile(pattern, re.IGNORECASE) for pattern in self.RESCUE_PATTERNS]
    
    def detect_emergency(self, message: str) -> Tuple[bool, Dict[str, Any]]:
        """
        Detect if message indicates an emergency situation.
        
        Args:
            message: User message text
            
        Returns:
            Tuple of (is_emergency, emergency_details)
        """
        message_lower = message.lower()
        is_emergency = False
        details = {
            'type': None,
            'urgency': 'medium',
            'keywords_found': [],
            'needs_rescue': False,
            'has_location': False,
            'has_condition': False
        }
        
        # Check for rescue requests
        for pattern in self.rescue_patterns:
            if pattern.search(message):
                is_emergency = True
                details['needs_rescue'] = True
                details['urgency'] = 'high'
                details['type'] = 'rescue'
                break
        
        # Check for emergency keywords
        found_keywords = []
        for category, keywords in self.EMERGENCY_KEYWORDS.items():
            for keyword in keywords:
                if keyword in message_lower:
                    found_keywords.append(keyword)
                    is_emergency = True
                    
                    if category == 'rescue':
                        details['needs_rescue'] = True
                        details['urgency'] = 'high'
                        details['type'] = 'rescue'
                    elif category == 'flood':
                        details['type'] = 'flood'
                        details['urgency'] = 'high'
                    elif category == 'location':
                        details['has_location'] = True
                    elif category == 'danger':
                        if details['urgency'] != 'high':
                            details['urgency'] = 'high'
        
        details['keywords_found'] = found_keywords
        
        # Check if message contains location information
        location_indicators = ['in', 'at', 'near', 'location', 'address', 'building', 'here', 'there']
        if any(indicator in message_lower for indicator in location_indicators):
            details['has_location'] = True
        
        # Check if message describes condition
        condition_indicators = ['flooded', 'no electricity', 'no power', 'dark', 'water rising', 'rising']
        if any(indicator in message_lower for indicator in condition_indicators):
            details['has_condition'] = True
        
        return is_emergency, details
    
    def extract_emergency_info(self, message: str, conversation_history: list) -> Dict[str, Optional[str]]:
        """
        Extract emergency information from message and conversation history.
        
        Args:
            message: Current user message
            conversation_history: Previous conversation messages
            
        Returns:
            Dictionary with extracted information
        """
        info = {
            'location': None,
            'condition': None,
            'urgency_level': None,
            'contact_info': None,
            'number_of_people': None,
            'medical_needs': None
        }
        
        message_lower = message.lower()
        
        # Extract location mentions
        location_patterns = [
            r'in (?:an? )?([a-z]+(?: [a-z]+)*) (?:building|area|place|location)',
            r'at ([a-z]+(?: [a-z]+)*)',
            r'(?:abandoned|old|empty) (?:building|structure)',
            r'location[:\s]+([^\n]+)',
            r'address[:\s]+([^\n]+)'
        ]
        
        for pattern in location_patterns:
            match = re.search(pattern, message_lower)
            if match:
                info['location'] = match.group(1) if match.groups() else 'unknown location'
                break
        
        # Extract condition information
        if 'flood' in message_lower or 'flooded' in message_lower:
            info['condition'] = 'flooding'
        if 'no electricity' in message_lower or 'no power' in message_lower:
            info['condition'] = (info['condition'] or '') + ', no power'
        if 'water rising' in message_lower or 'water is rising' in message_lower:
            info['condition'] = (info['condition'] or '') + ', water rising'
        
        # Check conversation history for additional context
        for msg in conversation_history[-5:]:  # Check last 5 messages
            if msg.get('role') == 'user':
                content = msg.get('content', '').lower()
                if not info['location'] and any(word in content for word in ['location', 'address', 'where', 'here', 'there']):
                    # Try to extract location from previous messages
                    pass
        
        return info

