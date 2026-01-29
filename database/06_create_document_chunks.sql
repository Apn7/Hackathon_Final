-- =====================================================
-- Part 2: Intelligent Search Engine - Vector Storage
-- Run this in Supabase SQL Editor
-- =====================================================

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create document_chunks table for RAG
CREATE TABLE IF NOT EXISTS public.document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES public.course_materials(id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  embedding vector(768),
  file_name TEXT NOT NULL,
  page_number INTEGER,
  category TEXT,
  topic TEXT,
  week_number INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- HNSW index for fast vector search
CREATE INDEX IF NOT EXISTS idx_chunks_embedding 
ON public.document_chunks USING hnsw (embedding vector_cosine_ops);

-- Other indexes
CREATE INDEX IF NOT EXISTS idx_chunks_material_id ON public.document_chunks(material_id);
CREATE INDEX IF NOT EXISTS idx_chunks_category ON public.document_chunks(category);

-- Vector similarity search function
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 5,
  filter_category text DEFAULT NULL,
  filter_week int DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  material_id uuid,
  chunk_text text,
  chunk_index int,
  file_name text,
  page_number int,
  category text,
  topic text,
  week_number int,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.material_id,
    dc.chunk_text,
    dc.chunk_index,
    dc.file_name,
    dc.page_number,
    dc.category,
    dc.topic,
    dc.week_number,
    1 - (dc.embedding <=> query_embedding) as similarity
  FROM public.document_chunks dc
  WHERE 
    dc.embedding IS NOT NULL
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
    AND (filter_category IS NULL OR dc.category = filter_category)
    AND (filter_week IS NULL OR dc.week_number = filter_week)
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Enable RLS
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view document chunks"
  ON public.document_chunks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage chunks"
  ON public.document_chunks FOR ALL
  TO service_role
  USING (true);

-- Grant permissions
GRANT SELECT ON public.document_chunks TO authenticated;
GRANT ALL ON public.document_chunks TO service_role;
