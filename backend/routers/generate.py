from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Dict, Any, Optional
import json
import urllib.request
import urllib.parse
from config import get_supabase_admin_client, get_settings
from services.rag_service import RAGService
from langchain_google_genai import ChatGoogleGenerativeAI

router = APIRouter(prefix="/api/generate", tags=["Generation"])

class GenerateRequest(BaseModel):
    topic: str
    audience: str = "undergraduate"

class GenerateResponse(BaseModel):
    notes: str
    slides: str
    lab_code: Dict[str, str]

@router.post("", response_model=GenerateResponse)
async def generate_content(request: GenerateRequest):
    settings = get_settings()
    supabase = get_supabase_admin_client()
    
    # Init RAG
    rag_service = RAGService(supabase, settings.GEMINI_API_KEY)
    
    # 1. RAG Search
    chunks = await rag_service.search(request.topic, limit=5, threshold=0.4)
    rag_context = "\n\n".join([c.chunk_text for c in chunks])
    if not rag_context:
        rag_context = "No specific internal documents found."

    # 2. Wikipedia Search (Optional)
    wiki_context = ""
    try:
        # Simple search
        search_url = f"https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={urllib.parse.quote(request.topic)}&format=json"
        with urllib.request.urlopen(search_url) as response:
            data = json.loads(response.read().decode())
            if data['query']['search']:
                page_id = data['query']['search'][0]['pageid']
                # Get content
                content_url = f"https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&explaintext&pageids={page_id}&format=json"
                with urllib.request.urlopen(content_url) as c_response:
                    c_data = json.loads(c_response.read().decode())
                    wiki_context = c_data['query']['pages'][str(page_id)]['extract']
    except Exception:
        wiki_context = "Wikipedia unavailable."

    # 3. LLM Call
    llm = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        google_api_key=settings.GEMINI_API_KEY,
        temperature=0.3,
    )
    
    prompt = """You are an academic content generation engine.

TASK:
Generate high-quality academic teaching material for the topic: {topic}

TARGET AUDIENCE:
{audience}

RETRIEVED CONTEXT FROM KNOWLEDGE BASE:
{rag_context}

OPTIONAL EXTERNAL CONTEXT:
{wiki_context}

STRICT OUTPUT RULES:
- Output ONLY valid JSON
- No explanations
- No extra text
- No markdown outside JSON
- Follow the schema exactly

REQUIRED JSON SCHEMA:
{{
  "notes": "Comprehensive, well-structured markdown lecture notes suitable for university teaching",
  "slides": "Concise slide content in markdown. Use `---` to separate slides.",
  "lab_code": {{
    "language": "relevant programming language",
    "code": "Executable, commented, educational example code"
  }}
}}"""

    formatted_prompt = prompt.format(
        topic=request.topic,
        audience=request.audience,
        rag_context=rag_context,
        wiki_context=wiki_context[:2000] 
    )
    
    try:
        response = llm.invoke(formatted_prompt)
        content = response.content
        
        # Clean up code blocks
        if content.startswith("```json"):
            content = content[7:]
        elif content.startswith("```"):
            content = content[3:]
            
        if content.endswith("```"):
            content = content[:-3]
            
        content = content.strip()
        
        data = json.loads(content)
        return data
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="LLM failed to generate valid JSON")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
