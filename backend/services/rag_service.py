"""
RAG Service using LangChain and Gemini.
"""

import os
import tempfile
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI
from langchain_core.documents import Document
from supabase import Client


@dataclass
class ChunkResult:
    """Search result."""
    id: str
    material_id: str
    chunk_text: str
    chunk_index: int
    file_name: str
    page_number: Optional[int]
    category: Optional[str]
    topic: Optional[str]
    week_number: Optional[int]
    similarity: float


@dataclass
class RAGResponse:
    """RAG answer response."""
    answer: str
    sources: List[Dict[str, Any]]


class RAGService:
    """RAG Service for intelligent search."""
    
    def __init__(self, supabase_client: Client, gemini_api_key: str):
        self.supabase = supabase_client
        self.gemini_api_key = gemini_api_key
        
        self.embeddings = GoogleGenerativeAIEmbeddings(
            model="models/text-embedding-004",
            google_api_key=gemini_api_key,
            task_type="retrieval_document"
        )
        
        self.llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            google_api_key=gemini_api_key,
            temperature=0.3,
        )
        
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            length_function=len,
            separators=["\n\n", "\n", ". ", " ", ""]
        )
    
    async def extract_pdf(self, file_content: bytes) -> List[Document]:
        """Extract text from PDF."""
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(file_content)
            tmp_path = tmp.name
        
        try:
            loader = PyPDFLoader(tmp_path)
            return loader.load()
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
    
    def chunk_documents(self, documents: List[Document]) -> List[Document]:
        """Split documents into chunks."""
        return self.text_splitter.split_documents(documents)
    
    def generate_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for texts."""
        return self.embeddings.embed_documents(texts)
    
    def generate_query_embedding(self, query: str) -> List[float]:
        """Generate embedding for query."""
        query_emb = GoogleGenerativeAIEmbeddings(
            model="models/text-embedding-004",
            google_api_key=self.gemini_api_key,
            task_type="retrieval_query"
        )
        return query_emb.embed_query(query)
    
    async def index_material(
        self, 
        material_id: str, 
        file_content: bytes,
        file_name: str,
        category: Optional[str] = None,
        topic: Optional[str] = None,
        week_number: Optional[int] = None
    ) -> Dict[str, Any]:
        """Index a PDF into vector database."""
        try:
            # Delete existing chunks
            self.supabase.table("document_chunks").delete().eq(
                "material_id", material_id
            ).execute()
            
            # Extract text
            documents = await self.extract_pdf(file_content)
            if not documents:
                return {"success": False, "error": "No text extracted", "chunks_created": 0}
            
            # Chunk
            chunks = self.chunk_documents(documents)
            if not chunks:
                return {"success": False, "error": "No chunks created", "chunks_created": 0}
            
            # Generate embeddings
            texts = [c.page_content for c in chunks]
            embeddings = self.generate_embeddings(texts)
            
            # Store in database
            records = []
            for idx, (chunk, emb) in enumerate(zip(chunks, embeddings)):
                page = chunk.metadata.get("page")
                if page is not None:
                    page = int(page) + 1
                
                records.append({
                    "material_id": material_id,
                    "chunk_text": chunk.page_content,
                    "chunk_index": idx,
                    "embedding": emb,
                    "file_name": file_name,
                    "page_number": page,
                    "category": category,
                    "topic": topic,
                    "week_number": week_number
                })
            
            self.supabase.table("document_chunks").insert(records).execute()
            
            # Mark as indexed
            self.supabase.table("course_materials").update({
                "is_indexed": True
            }).eq("id", material_id).execute()
            
            return {"success": True, "chunks_created": len(records), "message": f"Indexed {len(records)} chunks"}
            
        except Exception as e:
            return {"success": False, "error": str(e), "chunks_created": 0}
    
    async def search(
        self, 
        query: str, 
        limit: int = 5,
        threshold: float = 0.5,
        category: Optional[str] = None,
        week: Optional[int] = None
    ) -> List[ChunkResult]:
        """Vector similarity search."""
        embedding = self.generate_query_embedding(query)
        
        response = self.supabase.rpc(
            "match_documents",
            {
                "query_embedding": embedding,
                "match_threshold": threshold,
                "match_count": limit,
                "filter_category": category,
                "filter_week": week
            }
        ).execute()
        
        results = []
        for row in response.data:
            results.append(ChunkResult(
                id=row["id"],
                material_id=row["material_id"],
                chunk_text=row["chunk_text"],
                chunk_index=row["chunk_index"],
                file_name=row["file_name"],
                page_number=row["page_number"],
                category=row["category"],
                topic=row["topic"],
                week_number=row["week_number"],
                similarity=row["similarity"]
            ))
        
        return results
    
    async def ask(
        self, 
        question: str, 
        limit: int = 5,
        category: Optional[str] = None,
        week: Optional[int] = None
    ) -> RAGResponse:
        """Full RAG pipeline."""
        chunks = await self.search(question, limit, 0.4, category, week)
        
        if not chunks:
            return RAGResponse(
                answer="I couldn't find relevant information in the course materials.",
                sources=[]
            )
        
        # Build context
        context_parts = []
        for i, c in enumerate(chunks):
            src = f"[Source {i+1}: {c.file_name}"
            if c.page_number:
                src += f", Page {c.page_number}"
            src += "]"
            context_parts.append(f"{src}\n{c.chunk_text}")
        
        context = "\n\n---\n\n".join(context_parts)
        
        # Generate answer
        prompt = f"""Answer using ONLY the provided context. Cite sources with [Source X].

CONTEXT:
{context}

QUESTION: {question}

ANSWER:"""

        response = self.llm.invoke(prompt)
        
        sources = [{
            "file_name": c.file_name,
            "page_number": c.page_number,
            "excerpt": c.chunk_text[:300] + "..." if len(c.chunk_text) > 300 else c.chunk_text,
            "similarity": round(c.similarity, 3),
            "material_id": c.material_id
        } for c in chunks]
        
        return RAGResponse(answer=response.content, sources=sources)
