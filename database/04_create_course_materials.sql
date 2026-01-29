-- =====================================================
-- Part 1: Content Management System - Course Materials
-- Run this in Supabase SQL Editor after profiles setup
-- =====================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. Create course_materials table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.course_materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- File Information
  title VARCHAR(255) NOT NULL,
  description TEXT,
  file_path TEXT NOT NULL,              -- Supabase Storage path
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(50) NOT NULL,       -- 'pdf', 'pptx', 'py', 'md', etc.
  file_size_bytes INTEGER,
  
  -- Categorization
  category VARCHAR(20) NOT NULL CHECK (category IN ('theory', 'lab')),
  topic VARCHAR(255),
  week_number INTEGER CHECK (week_number >= 1 AND week_number <= 52),
  tags TEXT[] DEFAULT '{}',             -- Array of tags
  content_type VARCHAR(50) CHECK (content_type IN ('lecture_slide', 'lab_code', 'note', 'reference', 'other')),
  
  -- Future AI Integration (Part 2)
  extracted_text TEXT,                  -- Pre-extracted text for indexing
  is_indexed BOOLEAN DEFAULT false,     -- Flag for AI indexing status
  
  -- Audit
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 2. Create indexes for performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_materials_category ON public.course_materials(category);
CREATE INDEX IF NOT EXISTS idx_materials_week ON public.course_materials(week_number);
CREATE INDEX IF NOT EXISTS idx_materials_tags ON public.course_materials USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_materials_topic ON public.course_materials(topic);
CREATE INDEX IF NOT EXISTS idx_materials_content_type ON public.course_materials(content_type);
CREATE INDEX IF NOT EXISTS idx_materials_uploaded_by ON public.course_materials(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_materials_created_at ON public.course_materials(created_at DESC);

-- =====================================================
-- 3. Enable Row Level Security
-- =====================================================
ALTER TABLE public.course_materials ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 4. RLS Policies
-- =====================================================

-- All authenticated users can view materials
CREATE POLICY "Anyone can view materials"
  ON public.course_materials FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can insert materials
CREATE POLICY "Admins can upload materials"
  ON public.course_materials FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Only admins can update materials
CREATE POLICY "Admins can update materials"
  ON public.course_materials FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Only admins can delete materials
CREATE POLICY "Admins can delete materials"
  ON public.course_materials FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- =====================================================
-- 5. Auto-update timestamp trigger
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_course_materials_updated ON public.course_materials;
CREATE TRIGGER on_course_materials_updated
  BEFORE UPDATE ON public.course_materials
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================
-- 6. Grant permissions
-- =====================================================
GRANT SELECT ON public.course_materials TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.course_materials TO authenticated;

-- =====================================================
-- 7. Optional: Material access logs for analytics
-- =====================================================
CREATE TABLE IF NOT EXISTS public.material_access_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  material_id UUID REFERENCES public.course_materials(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  access_type VARCHAR(20) CHECK (access_type IN ('view', 'download')),
  accessed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for analytics queries
CREATE INDEX IF NOT EXISTS idx_access_logs_material ON public.material_access_logs(material_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_user ON public.material_access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_time ON public.material_access_logs(accessed_at DESC);

-- Enable RLS
ALTER TABLE public.material_access_logs ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (log their own access)
CREATE POLICY "Users can log their access"
  ON public.material_access_logs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Admins can view all access logs
CREATE POLICY "Admins can view access logs"
  ON public.material_access_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

GRANT SELECT, INSERT ON public.material_access_logs TO authenticated;
