-- =====================================================
-- Storage Bucket Setup for Course Materials
-- Run this in Supabase SQL Editor
-- =====================================================

-- NOTE: Storage bucket creation is done via Supabase Dashboard or API
-- This script sets up the storage policies only

-- =====================================================
-- Storage Policies for 'course-materials' bucket
-- =====================================================

-- IMPORTANT: First create the bucket manually in Supabase Dashboard:
-- 1. Go to Storage > Create new bucket
-- 2. Name: course-materials
-- 3. Public: OFF (we'll use authenticated access)
-- 4. File size limit: 52428800 (50MB)
-- 5. Allowed MIME types: (leave empty for all)

-- =====================================================
-- 1. Admin can upload files
-- =====================================================
CREATE POLICY "Admins can upload course materials"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'course-materials' AND
  (
    SELECT role FROM public.profiles 
    WHERE id = auth.uid()
  ) = 'admin'
);

-- =====================================================
-- 2. Admin can update files
-- =====================================================
CREATE POLICY "Admins can update course materials"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'course-materials' AND
  (
    SELECT role FROM public.profiles 
    WHERE id = auth.uid()
  ) = 'admin'
);

-- =====================================================
-- 3. Admin can delete files
-- =====================================================
CREATE POLICY "Admins can delete course materials"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'course-materials' AND
  (
    SELECT role FROM public.profiles 
    WHERE id = auth.uid()
  ) = 'admin'
);

-- =====================================================
-- 4. All authenticated users can view/download
-- =====================================================
CREATE POLICY "Authenticated users can view course materials"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'course-materials');

-- =====================================================
-- Storage path convention:
-- course-materials/
-- ├── theory/
-- │   ├── week-01/
-- │   │   ├── lecture-intro.pdf
-- │   │   └── notes.md
-- │   └── week-02/
-- └── lab/
--     ├── week-01/
--     │   ├── lab1-code.py
--     │   └── instructions.pdf
--     └── week-02/
-- =====================================================
