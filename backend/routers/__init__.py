"""
Routers package for FastAPI.
"""

from .materials import router as materials_router
from .search import router as search_router
from .chat import router as chat_router

__all__ = ["materials_router", "search_router", "chat_router"]

