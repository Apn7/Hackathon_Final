"""
Authentication middleware for FastAPI.
Verifies Supabase JWT tokens and extracts user role.
"""

from fastapi import HTTPException, Depends, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
from config import get_supabase_admin_client

security = HTTPBearer()


class AuthenticatedUser:
    """Represents an authenticated user from Supabase."""
    
    def __init__(self, user_id: str, email: str, role: str):
        self.user_id = user_id
        self.email = email
        self.role = role
    
    @property
    def is_admin(self) -> bool:
        return self.role == "admin"


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> AuthenticatedUser:
    """
    Dependency to get the current authenticated user.
    Validates JWT token and fetches user role from profiles.
    """
    token = credentials.credentials
    
    try:
        supabase = get_supabase_admin_client()
        
        # Verify the JWT token and get user
        user_response = supabase.auth.get_user(token)
        
        if not user_response or not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        
        user = user_response.user
        
        # Get user role from profiles table
        profile_response = supabase.table("profiles").select("role").eq("id", user.id).single().execute()
        
        if not profile_response.data:
            raise HTTPException(status_code=404, detail="User profile not found")
        
        role = profile_response.data.get("role", "student")
        
        return AuthenticatedUser(
            user_id=str(user.id),
            email=user.email,
            role=role
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")


async def require_admin(
    user: AuthenticatedUser = Depends(get_current_user)
) -> AuthenticatedUser:
    """
    Dependency that requires the user to be an admin.
    Use this for admin-only endpoints.
    """
    if not user.is_admin:
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )
    return user


# Optional: Get user without requiring authentication
async def get_optional_user(
    authorization: Optional[str] = Header(None)
) -> Optional[AuthenticatedUser]:
    """
    Optional authentication - returns user if valid token provided, None otherwise.
    """
    if not authorization or not authorization.startswith("Bearer "):
        return None
    
    try:
        token = authorization.replace("Bearer ", "")
        supabase = get_supabase_admin_client()
        user_response = supabase.auth.get_user(token)
        
        if not user_response or not user_response.user:
            return None
        
        user = user_response.user
        profile_response = supabase.table("profiles").select("role").eq("id", user.id).single().execute()
        
        if not profile_response.data:
            return None
        
        return AuthenticatedUser(
            user_id=str(user.id),
            email=user.email,
            role=profile_response.data.get("role", "student")
        )
    except:
        return None
