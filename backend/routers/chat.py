"""
Chat router for conversational interface.
Provides endpoints for managing conversations and chat messages.
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional

from auth import get_current_user, AuthenticatedUser
from config import get_supabase_admin_client, get_settings
from services import RAGService, ChatService
from models import (
    ChatRequest, ChatResponse, 
    ConversationCreate, ConversationResponse, ConversationWithMessages,
    ChatMessageResponse, SourceDocument
)

router = APIRouter(prefix="/api/chat", tags=["chat"])


def get_chat_service() -> ChatService:
    """Get ChatService instance."""
    settings = get_settings()
    supabase = get_supabase_admin_client()
    rag_service = RAGService(supabase, settings.GEMINI_API_KEY)
    return ChatService(supabase, settings.GEMINI_API_KEY, rag_service)


# ============================================
# Conversation Endpoints
# ============================================

@router.post("/conversations", response_model=ConversationResponse)
async def create_conversation(
    request: ConversationCreate,
    user: AuthenticatedUser = Depends(get_current_user),
    chat_service: ChatService = Depends(get_chat_service)
):
    """Create a new conversation."""
    conversation = await chat_service.create_conversation(
        user_id=user.user_id,
        title=request.title or "New Chat"
    )
    
    if not conversation:
        raise HTTPException(status_code=500, detail="Failed to create conversation")
    
    return ConversationResponse(
        id=conversation["id"],
        title=conversation["title"],
        message_count=conversation["message_count"],
        created_at=conversation["created_at"],
        updated_at=conversation["updated_at"]
    )


@router.get("/conversations", response_model=List[ConversationResponse])
async def list_conversations(
    limit: int = 20,
    user: AuthenticatedUser = Depends(get_current_user),
    chat_service: ChatService = Depends(get_chat_service)
):
    """List user's conversations."""
    conversations = await chat_service.list_conversations(user.user_id, limit)
    
    return [
        ConversationResponse(
            id=conv["id"],
            title=conv["title"],
            message_count=conv["message_count"],
            created_at=conv["created_at"],
            updated_at=conv["updated_at"]
        )
        for conv in conversations
    ]


@router.get("/conversations/{conversation_id}", response_model=ConversationWithMessages)
async def get_conversation(
    conversation_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
    chat_service: ChatService = Depends(get_chat_service)
):
    """Get a conversation with its messages."""
    conversation = await chat_service.get_conversation(conversation_id)
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Verify ownership
    if conversation["user_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    messages = await chat_service.get_messages(conversation_id)
    
    message_responses = []
    for msg in messages:
        sources = []
        if msg.get("sources"):
            for src in msg["sources"]:
                sources.append(SourceDocument(
                    file_name=src.get("file_name", ""),
                    page_number=src.get("page_number"),
                    excerpt=src.get("excerpt", ""),
                    similarity=src.get("similarity", 0),
                    material_id=src.get("material_id", "")
                ))
        
        message_responses.append(ChatMessageResponse(
            id=msg["id"],
            role=msg["role"],
            content=msg["content"],
            sources=sources,
            created_at=msg["created_at"]
        ))
    
    return ConversationWithMessages(
        id=conversation["id"],
        title=conversation["title"],
        message_count=conversation["message_count"],
        created_at=conversation["created_at"],
        updated_at=conversation["updated_at"],
        messages=message_responses
    )


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
    chat_service: ChatService = Depends(get_chat_service)
):
    """Delete a conversation."""
    conversation = await chat_service.get_conversation(conversation_id)
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    if conversation["user_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    success = await chat_service.delete_conversation(conversation_id)
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete conversation")
    
    return {"message": "Conversation deleted", "success": True}


# ============================================
# Chat Endpoint
# ============================================

@router.post("/message", response_model=ChatResponse)
async def send_message(
    request: ChatRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    chat_service: ChatService = Depends(get_chat_service)
):
    """
    Send a message and get a response.
    Creates a new conversation if conversation_id is not provided.
    """
    conversation_id = request.conversation_id
    
    # Create new conversation if needed
    if not conversation_id:
        conversation = await chat_service.create_conversation(
            user_id=user.user_id,
            title="New Chat"
        )
        if not conversation:
            raise HTTPException(status_code=500, detail="Failed to create conversation")
        conversation_id = conversation["id"]
    else:
        # Verify ownership
        existing = await chat_service.get_conversation(conversation_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Conversation not found")
        if existing["user_id"] != user.user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Process the chat
    result = await chat_service.chat(
        conversation_id=conversation_id,
        user_message=request.message,
        user_id=user.user_id
    )
    
    # Build response
    msg = result["message"]
    sources = []
    for src in result.get("sources", []):
        sources.append(SourceDocument(
            file_name=src.get("file_name", ""),
            page_number=src.get("page_number"),
            excerpt=src.get("excerpt", ""),
            similarity=src.get("similarity", 0),
            material_id=src.get("material_id", "")
        ))
    
    return ChatResponse(
        conversation_id=result["conversation_id"],
        message=ChatMessageResponse(
            id=msg["id"],
            role=msg["role"],
            content=msg["content"],
            sources=sources,
            created_at=msg["created_at"]
        ),
        sources=sources,
        intent=result.get("intent", "general")
    )
