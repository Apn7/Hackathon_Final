"""
Pydantic models for course materials API.
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class CategoryEnum(str, Enum):
    """Course material category."""
    THEORY = "theory"
    LAB = "lab"


class ContentTypeEnum(str, Enum):
    """Type of course content."""
    LECTURE_SLIDE = "lecture_slide"
    LAB_CODE = "lab_code"
    NOTE = "note"
    REFERENCE = "reference"
    OTHER = "other"


# ============================================
# Request Models
# ============================================

class MaterialCreate(BaseModel):
    """Request model for creating a course material (metadata only, file handled separately)."""
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    category: CategoryEnum
    topic: Optional[str] = Field(None, max_length=255)
    week_number: Optional[int] = Field(None, ge=1, le=52)
    tags: List[str] = Field(default_factory=list)
    content_type: Optional[ContentTypeEnum] = None


class MaterialUpdate(BaseModel):
    """Request model for updating material metadata."""
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    topic: Optional[str] = Field(None, max_length=255)
    week_number: Optional[int] = Field(None, ge=1, le=52)
    tags: Optional[List[str]] = None
    content_type: Optional[ContentTypeEnum] = None
    # Note: category change not allowed (would require file move)


# ============================================
# Response Models
# ============================================

class MaterialResponse(BaseModel):
    """Response model for a course material."""
    id: str
    title: str
    description: Optional[str]
    file_path: str
    file_name: str
    file_type: str
    file_size_bytes: Optional[int]
    category: str
    topic: Optional[str]
    week_number: Optional[int]
    tags: List[str]
    content_type: Optional[str]
    file_url: Optional[str] = None  # Presigned download URL
    uploaded_by: Optional[str]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class MaterialListResponse(BaseModel):
    """Response model for listing materials."""
    materials: List[MaterialResponse]
    total: int
    page: int = 1
    page_size: int = 20


class UploadResponse(BaseModel):
    """Response model for file upload."""
    id: str
    file_path: str
    message: str


class MessageResponse(BaseModel):
    """Generic message response."""
    message: str
    success: bool = True


class ErrorResponse(BaseModel):
    """Error response model."""
    error: str
    detail: Optional[str] = None
    success: bool = False
