"""
Materials API router for course content management.
Handles file uploads, CRUD operations, and filtering.
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from typing import Optional, List
import uuid
import re

from config import get_supabase_admin_client, get_settings
from auth import AuthenticatedUser, get_current_user, require_admin
from models import (
    MaterialCreate, MaterialUpdate, MaterialResponse, 
    MaterialListResponse, UploadResponse, MessageResponse,
    CategoryEnum, ContentTypeEnum
)

router = APIRouter(prefix="/api/materials", tags=["Materials"])
settings = get_settings()


def sanitize_filename(filename: str) -> str:
    """Sanitize filename to be safe for storage."""
    # Remove any path components
    filename = filename.split("/")[-1].split("\\")[-1]
    # Replace spaces and special chars with underscores
    filename = re.sub(r'[^\w\-.]', '_', filename)
    return filename


def get_file_extension(filename: str) -> str:
    """Extract file extension from filename."""
    if '.' in filename:
        return filename.rsplit('.', 1)[1].lower()
    return ''


def generate_storage_path(category: str, week_number: Optional[int], filename: str) -> str:
    """Generate a unique storage path for the file."""
    unique_id = str(uuid.uuid4())[:8]
    safe_filename = sanitize_filename(filename)
    
    if week_number:
        return f"{category}/week-{week_number:02d}/{unique_id}_{safe_filename}"
    else:
        return f"{category}/general/{unique_id}_{safe_filename}"


# ============================================
# Upload Endpoint
# ============================================

@router.post("/upload", response_model=UploadResponse)
async def upload_material(
    file: UploadFile = File(...),
    title: str = Form(...),
    description: Optional[str] = Form(None),
    category: CategoryEnum = Form(...),
    topic: Optional[str] = Form(None),
    week_number: Optional[int] = Form(None),
    tags: Optional[str] = Form(None),  # Comma-separated
    content_type: Optional[ContentTypeEnum] = Form(None),
    admin: AuthenticatedUser = Depends(require_admin)
):
    """
    Upload a new course material.
    Admin only.
    """
    # Validate file extension
    file_ext = get_file_extension(file.filename or "unknown")
    if file_ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{file_ext}' not allowed. Allowed: {settings.ALLOWED_EXTENSIONS}"
        )
    
    # Read file content
    file_content = await file.read()
    file_size = len(file_content)
    
    # Check file size
    max_size = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    if file_size > max_size:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size is {settings.MAX_FILE_SIZE_MB}MB"
        )
    
    # Generate storage path
    storage_path = generate_storage_path(
        category.value,
        week_number,
        file.filename or "unnamed"
    )
    
    supabase = get_supabase_admin_client()
    
    try:
        # Upload to Supabase Storage
        storage_response = supabase.storage.from_(settings.STORAGE_BUCKET).upload(
            path=storage_path,
            file=file_content,
            file_options={"content-type": file.content_type or "application/octet-stream"}
        )
        
        # Parse tags
        tag_list = []
        if tags:
            tag_list = [t.strip() for t in tags.split(",") if t.strip()]
        
        # Insert metadata into database
        material_data = {
            "title": title,
            "description": description,
            "file_path": storage_path,
            "file_name": sanitize_filename(file.filename or "unnamed"),
            "file_type": file_ext,
            "file_size_bytes": file_size,
            "category": category.value,
            "topic": topic,
            "week_number": week_number,
            "tags": tag_list,
            "content_type": content_type.value if content_type else None,
            "uploaded_by": admin.user_id
        }
        
        db_response = supabase.table("course_materials").insert(material_data).execute()
        
        if not db_response.data:
            # Rollback: delete uploaded file
            supabase.storage.from_(settings.STORAGE_BUCKET).remove([storage_path])
            raise HTTPException(status_code=500, detail="Failed to save material metadata")
        
        material_id = db_response.data[0]["id"]
        
        # Auto-index PDFs for RAG search
        index_message = ""
        if file_ext.lower() == "pdf":
            try:
                from services.rag_service import RAGService
                if settings.GEMINI_API_KEY:
                    rag_service = RAGService(supabase, settings.GEMINI_API_KEY)
                    result = await rag_service.index_material(
                        material_id=material_id,
                        file_content=file_content,
                        file_name=sanitize_filename(file.filename or "unnamed"),
                        category=category.value,
                        topic=topic,
                        week_number=week_number
                    )
                    if result["success"]:
                        index_message = f" Indexed {result['chunks_created']} chunks for AI search."
                    else:
                        index_message = f" Indexing failed: {result.get('error', 'Unknown error')}"
            except Exception as e:
                index_message = f" Auto-indexing skipped: {str(e)}"
        
        return UploadResponse(
            id=material_id,
            file_path=storage_path,
            message=f"Material uploaded successfully.{index_message}"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


# ============================================
# List Endpoint
# ============================================

@router.get("", response_model=MaterialListResponse)
async def list_materials(
    category: Optional[CategoryEnum] = Query(None),
    week_number: Optional[int] = Query(None, ge=1, le=52),
    topic: Optional[str] = Query(None),
    content_type: Optional[ContentTypeEnum] = Query(None),
    tags: Optional[str] = Query(None, description="Comma-separated tags"),
    search: Optional[str] = Query(None, description="Search in title and description"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: AuthenticatedUser = Depends(get_current_user)
):
    """
    List course materials with optional filters.
    Available to all authenticated users.
    """
    supabase = get_supabase_admin_client()
    
    # Build query
    query = supabase.table("course_materials").select("*", count="exact")
    
    # Apply filters
    if category:
        query = query.eq("category", category.value)
    
    if week_number:
        query = query.eq("week_number", week_number)
    
    if topic:
        query = query.ilike("topic", f"%{topic}%")
    
    if content_type:
        query = query.eq("content_type", content_type.value)
    
    if tags:
        tag_list = [t.strip() for t in tags.split(",") if t.strip()]
        for tag in tag_list:
            query = query.contains("tags", [tag])
    
    if search:
        query = query.or_(f"title.ilike.%{search}%,description.ilike.%{search}%")
    
    # Order and paginate
    offset = (page - 1) * page_size
    query = query.order("created_at", desc=True).range(offset, offset + page_size - 1)
    
    try:
        response = query.execute()
        
        # Generate presigned URLs for downloads
        materials = []
        for item in response.data:
            file_url = None
            try:
                url_response = supabase.storage.from_(settings.STORAGE_BUCKET).create_signed_url(
                    item["file_path"], 
                    expires_in=3600  # 1 hour
                )
                file_url = url_response.get("signedURL")
            except:
                pass
            
            materials.append(MaterialResponse(
                id=item["id"],
                title=item["title"],
                description=item.get("description"),
                file_path=item["file_path"],
                file_name=item["file_name"],
                file_type=item["file_type"],
                file_size_bytes=item.get("file_size_bytes"),
                category=item["category"],
                topic=item.get("topic"),
                week_number=item.get("week_number"),
                tags=item.get("tags", []),
                content_type=item.get("content_type"),
                file_url=file_url,
                uploaded_by=item.get("uploaded_by"),
                created_at=item["created_at"],
                updated_at=item["updated_at"]
            ))
        
        return MaterialListResponse(
            materials=materials,
            total=response.count or len(materials),
            page=page,
            page_size=page_size
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)}")


# ============================================
# Get Single Material
# ============================================

@router.get("/{material_id}", response_model=MaterialResponse)
async def get_material(
    material_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Get a single material by ID.
    Available to all authenticated users.
    """
    supabase = get_supabase_admin_client()
    
    try:
        response = supabase.table("course_materials").select("*").eq("id", material_id).single().execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Material not found")
        
        item = response.data
        
        # Generate presigned URL
        file_url = None
        try:
            url_response = supabase.storage.from_(settings.STORAGE_BUCKET).create_signed_url(
                item["file_path"],
                expires_in=3600
            )
            file_url = url_response.get("signedURL")
        except:
            pass
        
        # Log access (optional)
        try:
            supabase.table("material_access_logs").insert({
                "material_id": material_id,
                "user_id": user.user_id,
                "access_type": "view"
            }).execute()
        except:
            pass  # Non-critical, don't fail the request
        
        return MaterialResponse(
            id=item["id"],
            title=item["title"],
            description=item.get("description"),
            file_path=item["file_path"],
            file_name=item["file_name"],
            file_type=item["file_type"],
            file_size_bytes=item.get("file_size_bytes"),
            category=item["category"],
            topic=item.get("topic"),
            week_number=item.get("week_number"),
            tags=item.get("tags", []),
            content_type=item.get("content_type"),
            file_url=file_url,
            uploaded_by=item.get("uploaded_by"),
            created_at=item["created_at"],
            updated_at=item["updated_at"]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get material: {str(e)}")


# ============================================
# Update Material
# ============================================

@router.put("/{material_id}", response_model=MaterialResponse)
async def update_material(
    material_id: str,
    update_data: MaterialUpdate,
    admin: AuthenticatedUser = Depends(require_admin)
):
    """
    Update material metadata.
    Admin only.
    """
    supabase = get_supabase_admin_client()
    
    # Build update dict with only provided fields
    update_dict = {}
    if update_data.title is not None:
        update_dict["title"] = update_data.title
    if update_data.description is not None:
        update_dict["description"] = update_data.description
    if update_data.topic is not None:
        update_dict["topic"] = update_data.topic
    if update_data.week_number is not None:
        update_dict["week_number"] = update_data.week_number
    if update_data.tags is not None:
        update_dict["tags"] = update_data.tags
    if update_data.content_type is not None:
        update_dict["content_type"] = update_data.content_type.value
    
    if not update_dict:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    try:
        response = supabase.table("course_materials").update(update_dict).eq("id", material_id).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Material not found")
        
        # Return updated material
        return await get_material(material_id, admin)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Update failed: {str(e)}")


# ============================================
# Delete Material
# ============================================

@router.delete("/{material_id}", response_model=MessageResponse)
async def delete_material(
    material_id: str,
    admin: AuthenticatedUser = Depends(require_admin)
):
    """
    Delete a material (file and metadata).
    Admin only.
    """
    supabase = get_supabase_admin_client()
    
    try:
        # Get material first to find file path
        material = supabase.table("course_materials").select("file_path").eq("id", material_id).single().execute()
        
        if not material.data:
            raise HTTPException(status_code=404, detail="Material not found")
        
        file_path = material.data["file_path"]
        
        # Delete from storage
        try:
            supabase.storage.from_(settings.STORAGE_BUCKET).remove([file_path])
        except Exception as e:
            print(f"Warning: Failed to delete file from storage: {e}")
            # Continue anyway - file might already be gone
        
        # Delete from database
        supabase.table("course_materials").delete().eq("id", material_id).execute()
        
        return MessageResponse(message="Material deleted successfully")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")


# ============================================
# Utility Endpoints
# ============================================

@router.get("/category/{category}", response_model=MaterialListResponse)
async def list_by_category(
    category: CategoryEnum,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: AuthenticatedUser = Depends(get_current_user)
):
    """
    List materials by category (theory or lab).
    Shortcut for list_materials with category filter.
    """
    return await list_materials(
        category=category,
        page=page,
        page_size=page_size,
        user=user
    )


@router.get("/week/{week_number}", response_model=MaterialListResponse)
async def list_by_week(
    week_number: int,
    category: Optional[CategoryEnum] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: AuthenticatedUser = Depends(get_current_user)
):
    """
    List materials by week number.
    """
    return await list_materials(
        category=category,
        week_number=week_number,
        page=page,
        page_size=page_size,
        user=user
    )
