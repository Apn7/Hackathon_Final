"""
Supabase client configuration for FastAPI backend.
Uses service role key for admin operations.
"""

import os
from functools import lru_cache
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()


class Settings:
    """Application settings loaded from environment variables."""
    
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "")
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    STORAGE_BUCKET: str = os.getenv("STORAGE_BUCKET", "course-materials")
    MAX_FILE_SIZE_MB: int = int(os.getenv("MAX_FILE_SIZE_MB", "50"))
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    
    # Allowed file extensions
    ALLOWED_EXTENSIONS: set = {
        'pdf', 'pptx', 'ppt', 'docx', 'doc',  # Documents
        'py', 'js', 'ts', 'cpp', 'c', 'java', 'html', 'css',  # Code
        'md', 'txt', 'json', 'yaml', 'yml',  # Text
        'zip', 'tar', 'gz'  # Archives
    }


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


def get_supabase_client() -> Client:
    """
    Get Supabase client with anon key.
    Used for user-authenticated operations.
    """
    settings = get_settings()
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)


def get_supabase_admin_client() -> Client:
    """
    Get Supabase client with service role key.
    Used for admin operations that bypass RLS.
    """
    settings = get_settings()
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
