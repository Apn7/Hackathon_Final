"""
Search API router for RAG-based intelligent search.
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import Optional

from config import get_supabase_admin_client, get_settings
from auth import AuthenticatedUser, get_current_user, require_admin
from models import (
    SearchRequest, SearchResponse, SearchResult,
    AskRequest, AskResponse, SourceDocument,
    IngestResponse, MessageResponse
)
from services.rag_service import RAGService

router = APIRouter(prefix="/api", tags=["Search"])
settings = get_settings()


def get_rag_service() -> RAGService:
    """Get RAG service instance."""
    if not settings.GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")
    return RAGService(get_supabase_admin_client(), settings.GEMINI_API_KEY)


@router.post("/ingest/{material_id}", response_model=IngestResponse)
async def ingest_material(
    material_id: str,
    force: bool = False,
    admin: AuthenticatedUser = Depends(require_admin),
    rag: RAGService = Depends(get_rag_service)
):
    """Index a PDF material for search. Admin only."""
    supabase = get_supabase_admin_client()
    
    try:
        # Get material
        resp = supabase.table("course_materials").select("*").eq("id", material_id).single().execute()
        if not resp.data:
            raise HTTPException(status_code=404, detail="Material not found")
        
        material = resp.data
        
        # Check if indexed
        if material.get("is_indexed") and not force:
            return IngestResponse(
                success=True, material_id=material_id, chunks_created=0,
                message="Already indexed. Use force=true to re-index."
            )
        
        # Check PDF
        if material.get("file_type", "").lower() != "pdf":
            raise HTTPException(status_code=400, detail="Only PDF files supported")
        
        # Download file
        file_data = supabase.storage.from_(settings.STORAGE_BUCKET).download(material["file_path"])
        if not file_data:
            raise HTTPException(status_code=500, detail="Failed to download file")
        
        # Index
        result = await rag.index_material(
            material_id=material_id,
            file_content=file_data,
            file_name=material.get("file_name", "unknown.pdf"),
            category=material.get("category"),
            topic=material.get("topic"),
            week_number=material.get("week_number")
        )
        
        if not result["success"]:
            raise HTTPException(status_code=500, detail=result.get("error"))
        
        return IngestResponse(
            success=True, material_id=material_id,
            chunks_created=result["chunks_created"], message=result["message"]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/search", response_model=SearchResponse)
async def search_materials(
    request: SearchRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    rag: RAGService = Depends(get_rag_service)
):
    """Semantic search across indexed materials."""
    try:
        results = await rag.search(
            query=request.query,
            limit=request.limit,
            category=request.category,
            week=request.week
        )
        
        return SearchResponse(
            results=[
                SearchResult(
                    material_id=r.material_id,
                    chunk_text=r.chunk_text,
                    file_name=r.file_name,
                    page_number=r.page_number,
                    category=r.category,
                    topic=r.topic,
                    similarity=round(r.similarity, 4)
                )
                for r in results
            ],
            query=request.query,
            total=len(results)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ask", response_model=AskResponse)
async def ask_question(
    request: AskRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    rag: RAGService = Depends(get_rag_service)
):
    """Ask a question and get AI-generated answer with sources."""
    try:
        response = await rag.ask(
            question=request.question,
            limit=request.limit,
            category=request.category,
            week=request.week
        )
        
        return AskResponse(
            answer=response.answer,
            sources=[
                SourceDocument(
                    file_name=s["file_name"],
                    page_number=s["page_number"],
                    excerpt=s["excerpt"],
                    similarity=s["similarity"],
                    material_id=s["material_id"]
                )
                for s in response.sources
            ],
            question=request.question
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ingest-all", response_model=MessageResponse)
async def ingest_all(
    admin: AuthenticatedUser = Depends(require_admin),
    rag: RAGService = Depends(get_rag_service)
):
    """Index all unindexed PDF materials. Admin only."""
    supabase = get_supabase_admin_client()
    
    try:
        resp = supabase.table("course_materials").select("*").eq(
            "file_type", "pdf"
        ).eq("is_indexed", False).execute()
        
        materials = resp.data or []
        if not materials:
            return MessageResponse(message="No unindexed PDFs found.")
        
        success, errors = 0, 0
        for m in materials:
            try:
                file_data = supabase.storage.from_(settings.STORAGE_BUCKET).download(m["file_path"])
                result = await rag.index_material(
                    m["id"], file_data, m.get("file_name", "unknown.pdf"),
                    m.get("category"), m.get("topic"), m.get("week_number")
                )
                if result["success"]:
                    success += 1
                else:
                    errors += 1
            except:
                errors += 1
        
        return MessageResponse(message=f"Indexed {success} materials. Errors: {errors}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/index-status")
async def index_status(user: AuthenticatedUser = Depends(get_current_user)):
    """Get indexing statistics."""
    supabase = get_supabase_admin_client()
    
    try:
        total = supabase.table("course_materials").select("id", count="exact").execute()
        indexed = supabase.table("course_materials").select("id", count="exact").eq("is_indexed", True).execute()
        chunks = supabase.table("document_chunks").select("id", count="exact").execute()
        
        return {
            "total_materials": total.count or 0,
            "indexed_materials": indexed.count or 0,
            "total_chunks": chunks.count or 0
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
