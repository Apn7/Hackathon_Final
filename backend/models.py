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


# ============================================
# Search / RAG Models
# ============================================

class SearchRequest(BaseModel):
    """Request for vector search."""
    query: str = Field(..., min_length=1, max_length=1000)
    limit: int = Field(default=5, ge=1, le=20)
    category: Optional[str] = None
    week: Optional[int] = Field(default=None, ge=1, le=52)


class SearchResult(BaseModel):
    """Single search result."""
    material_id: str
    chunk_text: str
    file_name: str
    page_number: Optional[int]
    category: Optional[str]
    topic: Optional[str]
    similarity: float


class SearchResponse(BaseModel):
    """Response for vector search."""
    results: List[SearchResult]
    query: str
    total: int


class AskRequest(BaseModel):
    """Request for RAG Q&A."""
    question: str = Field(..., min_length=1, max_length=2000)
    limit: int = Field(default=5, ge=1, le=10)
    category: Optional[str] = None
    week: Optional[int] = None


class SourceDocument(BaseModel):
    """Source in RAG response."""
    file_name: str
    page_number: Optional[int]
    excerpt: str
    similarity: float
    material_id: str


class AskResponse(BaseModel):
    """Response for RAG Q&A."""
    answer: str
    sources: List[SourceDocument]
    question: str


class IngestResponse(BaseModel):
    """Response for ingestion."""
    success: bool
    material_id: str
    chunks_created: int
    message: str


# ============================================
# Chat / Conversation Models
# ============================================

class ChatMessageCreate(BaseModel):
    """Request to send a chat message."""
    conversation_id: str
    message: str = Field(..., min_length=1, max_length=4000)


class ChatMessageResponse(BaseModel):
    """A single chat message."""
    id: str
    role: str  # 'user' or 'assistant'
    content: str
    sources: List[SourceDocument] = []
    created_at: datetime


class ConversationCreate(BaseModel):
    """Request to create a new conversation."""
    title: Optional[str] = "New Chat"


class ConversationResponse(BaseModel):
    """A conversation with its messages."""
    id: str
    title: str
    message_count: int
    created_at: datetime
    updated_at: datetime


class ConversationWithMessages(ConversationResponse):
    """Conversation with full message history."""
    messages: List[ChatMessageResponse] = []


class ChatRequest(BaseModel):
    """Request for chat (can create conversation inline)."""
    message: str = Field(..., min_length=1, max_length=4000)
    conversation_id: Optional[str] = None  # If None, creates new conversation


class ChatResponse(BaseModel):
    """Response from chat endpoint."""
    conversation_id: str
    message: ChatMessageResponse
    sources: List[SourceDocument] = []
    intent: Optional[str] = None  # search, summarize, explain, followup, general

