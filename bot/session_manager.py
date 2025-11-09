"""
Session manager for bot sessions.
This file re-exports SessionManager from utils.context_manager for convenience.
See SPEC.md Section 4.3 for session management details.
"""

from utils.context_manager import SessionManager, SessionContext

__all__ = ['SessionManager', 'SessionContext']

