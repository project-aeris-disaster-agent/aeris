"""
Context management for maintaining conversation history and session state.
See SPEC.md Section 4.3 for session management details.
"""

import time
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


class SessionContext:
    """
    Manages user session context including conversation history and metadata.
    See SPEC.md Section 4.3.1 for session structure.
    """
    
    def __init__(
        self,
        user_id: str,
        session_id: Optional[str] = None,
        expiry_hours: int = 24
    ):
        """
        Initialize a new session context.
        
        Args:
            user_id: Telegram user ID
            session_id: Unique session identifier (auto-generated if None)
            expiry_hours: Hours until session expires (default 24)
        """
        self.user_id = user_id
        self.session_id = session_id or f"session_{user_id}_{int(time.time())}"
        self.created_at = datetime.now()
        self.last_activity = datetime.now()
        self.expires_at = self.created_at + timedelta(hours=expiry_hours)
        
        # Context structure per SPEC.md Section 4.3.1
        self.context = {
            "messages": [],
            "metadata": {
                "location": None,
                "disaster_context": None,
                "support_type": None
            }
        }
        
        # State for flow management
        self.state = {
            "current_flow": None,
            "variables": {}
        }
    
    def add_message(self, role: str, content: str) -> None:
        """
        Add a message to conversation history.
        
        Args:
            role: Message role ('user' or 'assistant')
            content: Message content
        """
        message = {
            "role": role,
            "content": content,
            "timestamp": datetime.now().isoformat()
        }
        
        self.context["messages"].append(message)
        self.last_activity = datetime.now()
        
        # Maintain message limit (10-15 messages per SPEC.md Section 4.3.3)
        max_messages = 15
        if len(self.context["messages"]) > max_messages:
            # Remove oldest messages, keeping the most recent
            self.context["messages"] = self.context["messages"][-max_messages:]
        
        logger.debug(f"Added {role} message to session {self.session_id}")
    
    def get_conversation_history(self, max_messages: int = 15) -> List[Dict[str, str]]:
        """
        Get conversation history formatted for LLM.
        
        Args:
            max_messages: Maximum number of messages to return
            
        Returns:
            List of message dictionaries with role and content
        """
        messages = self.context["messages"][-max_messages:]
        return [
            {"role": msg["role"], "content": msg["content"]}
            for msg in messages
        ]
    
    def update_metadata(self, **kwargs) -> None:
        """Update context metadata."""
        self.context["metadata"].update(kwargs)
        self.last_activity = datetime.now()
    
    def set_state(self, flow: Optional[str] = None, **variables) -> None:
        """
        Set session state for flow management.
        
        Args:
            flow: Current flow identifier
            **variables: State variables to set
        """
        if flow is not None:
            self.state["current_flow"] = flow
        self.state["variables"].update(variables)
        self.last_activity = datetime.now()
    
    def is_expired(self) -> bool:
        """Check if session has expired."""
        return datetime.now() > self.expires_at
    
    def extend_expiry(self, hours: int = 24) -> None:
        """Extend session expiry time."""
        self.expires_at = datetime.now() + timedelta(hours=hours)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert session to dictionary for storage."""
        return {
            "user_id": self.user_id,
            "session_id": self.session_id,
            "created_at": self.created_at.isoformat(),
            "last_activity": self.last_activity.isoformat(),
            "expires_at": self.expires_at.isoformat(),
            "context": self.context,
            "state": self.state
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "SessionContext":
        """Create SessionContext from dictionary."""
        session = cls(
            user_id=data["user_id"],
            session_id=data["session_id"]
        )
        session.created_at = datetime.fromisoformat(data["created_at"])
        session.last_activity = datetime.fromisoformat(data["last_activity"])
        session.expires_at = datetime.fromisoformat(data["expires_at"])
        session.context = data["context"]
        session.state = data["state"]
        return session


class SessionManager:
    """
    Manages multiple user sessions in memory.
    See SPEC.md Section 4.3.2 for storage details.
    """
    
    def __init__(self, expiry_hours: int = 24):
        """
        Initialize session manager.
        
        Args:
            expiry_hours: Default session expiry in hours
        """
        self.sessions: Dict[str, SessionContext] = {}
        self.expiry_hours = expiry_hours
    
    def get_session(self, user_id: str) -> SessionContext:
        """
        Get or create a session for a user.
        
        Args:
            user_id: Telegram user ID
            
        Returns:
            SessionContext instance
        """
        # Check if session exists and is not expired
        if user_id in self.sessions:
            session = self.sessions[user_id]
            if not session.is_expired():
                session.extend_expiry(self.expiry_hours)
                return session
            else:
                # Remove expired session
                del self.sessions[user_id]
        
        # Create new session
        session = SessionContext(user_id, expiry_hours=self.expiry_hours)
        self.sessions[user_id] = session
        logger.info(f"Created new session for user {user_id}")
        return session
    
    def cleanup_expired(self) -> int:
        """
        Remove expired sessions.
        
        Returns:
            Number of sessions removed
        """
        expired_users = [
            user_id for user_id, session in self.sessions.items()
            if session.is_expired()
        ]
        
        for user_id in expired_users:
            del self.sessions[user_id]
        
        if expired_users:
            logger.info(f"Cleaned up {len(expired_users)} expired sessions")
        
        return len(expired_users)
    
    def reset_session(self, user_id: str) -> None:
        """Reset a user's session."""
        if user_id in self.sessions:
            del self.sessions[user_id]
            logger.info(f"Reset session for user {user_id}")

