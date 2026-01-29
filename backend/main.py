"""
FastAPI Main Application
AI-Powered Supplementary Learning Platform - Backend API
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import routers
from routers import materials_router

# Initialize the FastAPI application
app = FastAPI(
    title="Learning Platform API",
    description="Backend API for AI-Powered Supplementary Learning Platform",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        # Add production URLs here
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================
# Health & Root Endpoints
# ============================================

@app.get("/")
async def root():
    """Welcome endpoint"""
    return {
        "message": "Learning Platform API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


# ============================================
# Register Routers
# ============================================

app.include_router(materials_router)


# ============================================
# Development Server
# ============================================

if __name__ == "__main__":
    import uvicorn
    import os
    
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8000"))
    
    uvicorn.run("main:app", host=host, port=port, reload=True)
