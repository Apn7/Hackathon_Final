'use client';

import { useState, useEffect } from 'react';
import { createSPAClient } from '@/lib/supabase/client';

interface Material {
  id: string;
  title: string;
  description: string | null;
  file_path: string;
  file_name: string;
  file_type: string;
  file_size_bytes: number | null;
  category: 'theory' | 'lab';
  topic: string | null;
  week_number: number | null;
  tags: string[];
  content_type: string | null;
  created_at: string;
}

type Category = 'theory' | 'lab';
type ContentType = 'lecture_slide' | 'lab_code' | 'note' | 'reference' | 'other';
type ViewLevel = 'categories' | 'courses' | 'files';

export default function AdminCourseBrowser() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Navigation state
  const [currentCategory, setCurrentCategory] = useState<Category | null>(null);
  const [currentCourse, setCurrentCourse] = useState<string | null>(null);
  
  // Upload form state
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [uploadData, setUploadData] = useState({
    title: '',
    description: '',
    topic: '',
    week_number: '',
    tags: '',
    content_type: 'lecture_slide' as ContentType,
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const supabase = createSPAClient();

  // Fetch materials
  const fetchMaterials = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('course_materials')
        .select('*')
        .order('week_number', { ascending: true })
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setMaterials(data || []);
    } catch (err) {
      console.error('Failed to fetch materials:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, []);

  // Get unique courses for a category
  const getCourses = (category: Category): string[] => {
    const courses = materials
      .filter(m => m.category === category && m.topic)
      .map(m => m.topic as string);
    return [...new Set(courses)].sort();
  };

  // Get files for a course
  const getFiles = (category: Category, course: string): Material[] => {
    return materials
      .filter(m => m.category === category && m.topic === course)
      .sort((a, b) => (a.week_number || 0) - (b.week_number || 0));
  };

  // Get view level
  const getViewLevel = (): ViewLevel => {
    if (currentCourse !== null) return 'files';
    if (currentCategory !== null) return 'courses';
    return 'categories';
  };

  // Upload material
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !currentCategory) {
      setError('Please select a file');
      return;
    }
    
    setUploading(true);
    setError(null);
    
    try {
      const fileExt = selectedFile.name.split('.').pop()?.toLowerCase() || '';
      const uniqueId = crypto.randomUUID().slice(0, 8);
      const weekPath = uploadData.week_number 
        ? `week-${uploadData.week_number.padStart(2, '0')}`
        : 'general';
      const filePath = `${currentCategory}/${weekPath}/${uniqueId}_${selectedFile.name}`;
      
      const { error: uploadError } = await supabase.storage
        .from('course-materials')
        .upload(filePath, selectedFile);
      
      if (uploadError) throw uploadError;
      
      const tagList = uploadData.tags.split(',').map(t => t.trim()).filter(t => t);
      
      const { error: insertError } = await supabase
        .from('course_materials')
        .insert({
          title: uploadData.title,
          description: uploadData.description || null,
          file_path: filePath,
          file_name: selectedFile.name,
          file_type: fileExt,
          file_size_bytes: selectedFile.size,
          category: currentCategory,
          topic: uploadData.topic || currentCourse,
          week_number: uploadData.week_number ? parseInt(uploadData.week_number) : null,
          tags: tagList,
          content_type: uploadData.content_type,
        });
      
      if (insertError) {
        await supabase.storage.from('course-materials').remove([filePath]);
        throw insertError;
      }
      
      setSuccess('Material uploaded successfully!');
      resetForm();
      fetchMaterials();
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // Update material
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMaterial) return;
    
    setUploading(true);
    setError(null);
    
    try {
      const tagList = uploadData.tags.split(',').map(t => t.trim()).filter(t => t);
      
      const { error: updateError } = await supabase
        .from('course_materials')
        .update({
          title: uploadData.title,
          description: uploadData.description || null,
          topic: uploadData.topic,
          week_number: uploadData.week_number ? parseInt(uploadData.week_number) : null,
          tags: tagList,
          content_type: uploadData.content_type,
        })
        .eq('id', editingMaterial.id);
      
      if (updateError) throw updateError;
      
      setSuccess('Material updated successfully!');
      resetForm();
      fetchMaterials();
    } catch (err: any) {
      setError(err.message || 'Update failed');
    } finally {
      setUploading(false);
    }
  };

  // Delete material
  const handleDelete = async (material: Material) => {
    if (!confirm(`Delete "${material.title}"? This cannot be undone.`)) return;
    
    try {
      await supabase.storage.from('course-materials').remove([material.file_path]);
      
      const { error } = await supabase
        .from('course_materials')
        .delete()
        .eq('id', material.id);
      
      if (error) throw error;
      
      setSuccess('Material deleted');
      fetchMaterials();
    } catch (err: any) {
      setError(err.message || 'Delete failed');
    }
  };

  // Download file
  const handleDownload = async (material: Material) => {
    const { data } = await supabase.storage
      .from('course-materials')
      .createSignedUrl(material.file_path, 3600);
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank');
    }
  };

  // Edit material
  const startEdit = (material: Material) => {
    setEditingMaterial(material);
    setUploadData({
      title: material.title,
      description: material.description || '',
      topic: material.topic || '',
      week_number: material.week_number?.toString() || '',
      tags: material.tags.join(', '),
      content_type: (material.content_type || 'other') as ContentType,
    });
    setShowUploadForm(true);
  };

  // Reset form
  const resetForm = () => {
    setShowUploadForm(false);
    setEditingMaterial(null);
    setSelectedFile(null);
    setUploadData({
      title: '',
      description: '',
      topic: currentCourse || '',
      week_number: '',
      tags: '',
      content_type: 'lecture_slide',
    });
  };

  // Navigation
  const goBack = () => {
    if (currentCourse !== null) {
      setCurrentCourse(null);
      resetForm();
    } else if (currentCategory !== null) {
      setCurrentCategory(null);
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (fileType: string) => {
    switch (fileType.toLowerCase()) {
      case 'pdf': return '📄';
      case 'pptx': case 'ppt': return '📊';
      case 'py': case 'js': case 'ts': case 'cpp': case 'java': return '💻';
      case 'md': case 'txt': return '📝';
      default: return '📁';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-purple-500 border-t-transparent"></div>
      </div>
    );
  }

  const viewLevel = getViewLevel();

  return (
    <div className="space-y-6">
      {/* Messages */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex justify-between items-center">
          {error}
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 text-xl">×</button>
        </div>
      )}
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 flex justify-between items-center">
          {success}
          <button onClick={() => setSuccess(null)} className="text-green-500 hover:text-green-700 text-xl">×</button>
        </div>
      )}

      {/* Breadcrumb */}
      {viewLevel !== 'categories' && (
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={() => { setCurrentCategory(null); setCurrentCourse(null); resetForm(); }}
            className="text-purple-600 hover:underline"
          >
            Home
          </button>
          {currentCategory && (
            <>
              <span className="text-gray-400">/</span>
              <button
                onClick={() => { setCurrentCourse(null); resetForm(); }}
                className={currentCourse ? "text-purple-600 hover:underline" : "text-gray-700 font-medium"}
              >
                {currentCategory === 'theory' ? '📚 Theory' : '💻 Lab'}
              </button>
            </>
          )}
          {currentCourse && (
            <>
              <span className="text-gray-400">/</span>
              <span className="text-gray-700 font-medium">{currentCourse}</span>
            </>
          )}
        </div>
      )}

      {/* Back Button & Actions */}
      {viewLevel !== 'categories' && (
        <div className="flex items-center justify-between">
          <button
            onClick={goBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          
          {viewLevel === 'files' && !showUploadForm && (
            <button
              onClick={() => { setUploadData({ ...uploadData, topic: currentCourse || '' }); setShowUploadForm(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Upload File
            </button>
          )}
        </div>
      )}

      {/* Categories View */}
      {viewLevel === 'categories' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button
            onClick={() => setCurrentCategory('theory')}
            className="bg-white rounded-xl shadow-md p-8 border border-gray-100 hover:shadow-lg hover:border-purple-200 transition-all text-left group"
          >
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-purple-100 rounded-xl flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                📚
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Theory</h3>
                <p className="text-gray-600">Manage lecture materials</p>
                <p className="text-sm text-purple-600 mt-1">
                  {getCourses('theory').length} courses • {materials.filter(m => m.category === 'theory').length} files
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setCurrentCategory('lab')}
            className="bg-white rounded-xl shadow-md p-8 border border-gray-100 hover:shadow-lg hover:border-green-200 transition-all text-left group"
          >
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-green-100 rounded-xl flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                💻
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Lab</h3>
                <p className="text-gray-600">Manage lab exercises</p>
                <p className="text-sm text-green-600 mt-1">
                  {getCourses('lab').length} courses • {materials.filter(m => m.category === 'lab').length} files
                </p>
              </div>
            </div>
          </button>
        </div>
      )}

      {/* Courses View */}
      {viewLevel === 'courses' && currentCategory && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              {currentCategory === 'theory' ? '📚 Theory Courses' : '💻 Lab Courses'}
            </h2>
            <button
              onClick={() => setShowUploadForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 font-medium text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Course
            </button>
          </div>
          
          {/* New Course Upload Form */}
          {showUploadForm && !currentCourse && (
            <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
              <h3 className="text-lg font-semibold mb-4">Upload to New/Existing Course</h3>
              <form onSubmit={handleUpload} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Course Title (Topic) *</label>
                    <input
                      type="text"
                      required
                      value={uploadData.topic}
                      onChange={(e) => setUploadData({ ...uploadData, topic: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="e.g., Introduction to AI"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">File Title *</label>
                    <input
                      type="text"
                      required
                      value={uploadData.title}
                      onChange={(e) => setUploadData({ ...uploadData, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="e.g., Lecture 1 - Overview"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Week Number</label>
                    <input
                      type="number"
                      min="1"
                      max="52"
                      value={uploadData.week_number}
                      onChange={(e) => setUploadData({ ...uploadData, week_number: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="e.g., 1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Content Type</label>
                    <select
                      value={uploadData.content_type}
                      onChange={(e) => setUploadData({ ...uploadData, content_type: e.target.value as ContentType })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="lecture_slide">Lecture Slide</option>
                      <option value="lab_code">Lab Code</option>
                      <option value="note">Note</option>
                      <option value="reference">Reference</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma-separated)</label>
                    <input
                      type="text"
                      value={uploadData.tags}
                      onChange={(e) => setUploadData({ ...uploadData, tags: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="e.g., python, ml, basics"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-700">
                      {currentCategory === 'theory' ? '📚 Theory' : '💻 Lab'}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={uploadData.description}
                    onChange={(e) => setUploadData({ ...uploadData, description: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Brief description of the content..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">File *</label>
                  <input
                    type="file"
                    required
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    accept=".pdf,.pptx,.ppt,.docx,.doc,.py,.js,.ts,.cpp,.c,.java,.html,.css,.md,.txt,.json,.yaml,.yml,.zip"
                  />
                  <p className="text-xs text-gray-500 mt-1">Supported: PDF, PPTX, code files, MD, TXT, ZIP (max 50MB)</p>
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={uploading}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium"
                  >
                    {uploading ? 'Uploading...' : 'Upload'}
                  </button>
                  <button type="button" onClick={resetForm} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
          
          {getCourses(currentCategory).length === 0 && !showUploadForm ? (
            <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-500">
              No courses yet. Click "New Course" to add materials.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {getCourses(currentCategory).map((course) => (
                <button
                  key={course}
                  onClick={() => setCurrentCourse(course)}
                  className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md hover:border-purple-200 transition-all text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{course}</h3>
                      <p className="text-sm text-gray-500">
                        {getFiles(currentCategory, course).length} files
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Files View */}
      {viewLevel === 'files' && currentCategory && currentCourse && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900">{currentCourse}</h2>
          
          {/* Upload Form */}
          {showUploadForm && (
            <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
              <h3 className="text-lg font-semibold mb-4">
                {editingMaterial ? 'Edit Material' : 'Upload New File'}
              </h3>
              <form onSubmit={editingMaterial ? handleUpdate : handleUpload} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                    <input
                      type="text"
                      required
                      value={uploadData.title}
                      onChange={(e) => setUploadData({ ...uploadData, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Week Number</label>
                    <input
                      type="number"
                      min="1"
                      max="52"
                      value={uploadData.week_number}
                      onChange={(e) => setUploadData({ ...uploadData, week_number: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Content Type</label>
                    <select
                      value={uploadData.content_type}
                      onChange={(e) => setUploadData({ ...uploadData, content_type: e.target.value as ContentType })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="lecture_slide">Lecture Slide</option>
                      <option value="lab_code">Lab Code</option>
                      <option value="note">Note</option>
                      <option value="reference">Reference</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma-separated)</label>
                    <input
                      type="text"
                      value={uploadData.tags}
                      onChange={(e) => setUploadData({ ...uploadData, tags: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="python, ml, basics"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={uploadData.description}
                    onChange={(e) => setUploadData({ ...uploadData, description: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                {!editingMaterial && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">File *</label>
                    <input
                      type="file"
                      required
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      accept=".pdf,.pptx,.ppt,.docx,.doc,.py,.js,.ts,.cpp,.c,.java,.html,.css,.md,.txt,.json,.yaml,.yml,.zip"
                    />
                    <p className="text-xs text-gray-500 mt-1">Supported: PDF, PPTX, code files, MD, TXT, ZIP (max 50MB)</p>
                  </div>
                )}
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={uploading}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium"
                  >
                    {uploading ? 'Saving...' : editingMaterial ? 'Save Changes' : 'Upload'}
                  </button>
                  <button type="button" onClick={resetForm} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
          
          {/* Files List */}
          {getFiles(currentCategory, currentCourse).length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-500">
              No files yet. Click "Upload File" to add materials.
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">File</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Week</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Content Type</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Tags</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {getFiles(currentCategory, currentCourse).map((file) => (
                    <tr key={file.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{getFileIcon(file.file_type)}</span>
                          <div>
                            <div className="font-medium text-gray-900">{file.title}</div>
                            <div className="text-sm text-gray-500">{file.file_name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {file.week_number ? `Week ${file.week_number}` : '-'}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                          {file.content_type?.replace('_', ' ') || file.file_type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {file.tags.length > 0 ? file.tags.slice(0, 3).map((tag, i) => (
                            <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">{tag}</span>
                          )) : <span className="text-gray-400 text-sm">-</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => handleDownload(file)}
                          className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                        >
                          Download
                        </button>
                        <button
                          onClick={() => startEdit(file)}
                          className="text-purple-600 hover:text-purple-800 font-medium text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(file)}
                          className="text-red-600 hover:text-red-800 font-medium text-sm"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
