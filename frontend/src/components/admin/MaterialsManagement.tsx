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
  updated_at: string;
}

type Category = 'theory' | 'lab';
type ContentType = 'lecture_slide' | 'lab_code' | 'note' | 'reference' | 'other';

export default function MaterialsManagement() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Filter state
  const [filterCategory, setFilterCategory] = useState<Category | ''>('');
  const [filterWeek, setFilterWeek] = useState<string>('');
  
  // Upload form state
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadData, setUploadData] = useState({
    title: '',
    description: '',
    category: 'theory' as Category,
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
    setError(null);
    
    try {
      let query = supabase
        .from('course_materials')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (filterCategory) {
        query = query.eq('category', filterCategory);
      }
      if (filterWeek) {
        query = query.eq('week_number', parseInt(filterWeek));
      }
      
      const { data, error: fetchError } = await query;
      
      if (fetchError) throw fetchError;
      setMaterials(data || []);
    } catch (err) {
      setError('Failed to fetch materials');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, [filterCategory, filterWeek]);

  // Upload material
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please select a file');
      return;
    }
    
    setUploading(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Generate unique file path
      const fileExt = selectedFile.name.split('.').pop()?.toLowerCase() || '';
      const uniqueId = crypto.randomUUID().slice(0, 8);
      const weekPath = uploadData.week_number 
        ? `week-${uploadData.week_number.padStart(2, '0')}`
        : 'general';
      const filePath = `${uploadData.category}/${weekPath}/${uniqueId}_${selectedFile.name}`;
      
      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('course-materials')
        .upload(filePath, selectedFile);
      
      if (uploadError) throw uploadError;
      
      // Parse tags
      const tagList = uploadData.tags
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);
      
      // Insert metadata
      const { error: insertError } = await supabase
        .from('course_materials')
        .insert({
          title: uploadData.title,
          description: uploadData.description || null,
          file_path: filePath,
          file_name: selectedFile.name,
          file_type: fileExt,
          file_size_bytes: selectedFile.size,
          category: uploadData.category,
          topic: uploadData.topic || null,
          week_number: uploadData.week_number ? parseInt(uploadData.week_number) : null,
          tags: tagList,
          content_type: uploadData.content_type,
        });
      
      if (insertError) {
        // Rollback: delete uploaded file
        await supabase.storage.from('course-materials').remove([filePath]);
        throw insertError;
      }
      
      setSuccess('Material uploaded successfully!');
      setShowUploadForm(false);
      setSelectedFile(null);
      setUploadData({
        title: '',
        description: '',
        category: 'theory',
        topic: '',
        week_number: '',
        tags: '',
        content_type: 'lecture_slide',
      });
      fetchMaterials();
    } catch (err: any) {
      setError(err.message || 'Upload failed');
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  // Delete material
  const handleDelete = async (material: Material) => {
    if (!confirm(`Delete "${material.title}"? This cannot be undone.`)) return;
    
    try {
      // Delete from storage
      await supabase.storage.from('course-materials').remove([material.file_path]);
      
      // Delete from database
      const { error: deleteError } = await supabase
        .from('course_materials')
        .delete()
        .eq('id', material.id);
      
      if (deleteError) throw deleteError;
      
      setSuccess('Material deleted successfully');
      fetchMaterials();
    } catch (err: any) {
      setError(err.message || 'Delete failed');
    }
  };

  // Get download URL
  const getDownloadUrl = async (filePath: string) => {
    const { data } = await supabase.storage
      .from('course-materials')
      .createSignedUrl(filePath, 3600);
    return data?.signedUrl;
  };

  const handleDownload = async (material: Material) => {
    const url = await getDownloadUrl(material.file_path);
    if (url) {
      window.open(url, '_blank');
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Course Materials</h2>
          <p className="text-gray-600">Manage lecture slides, lab files, and resources</p>
        </div>
        <button
          onClick={() => setShowUploadForm(!showUploadForm)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all font-medium"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Upload Material
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-500 hover:text-red-700">×</button>
        </div>
      )}
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          {success}
          <button onClick={() => setSuccess(null)} className="ml-2 text-green-500 hover:text-green-700">×</button>
        </div>
      )}

      {/* Upload Form */}
      {showUploadForm && (
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
          <h3 className="text-lg font-semibold mb-4">Upload New Material</h3>
          <form onSubmit={handleUpload} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={uploadData.title}
                  onChange={(e) => setUploadData({ ...uploadData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="e.g., Lecture 1 - Introduction"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <select
                  required
                  value={uploadData.category}
                  onChange={(e) => setUploadData({ ...uploadData, category: e.target.value as Category })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="theory">Theory</option>
                  <option value="lab">Lab</option>
                </select>
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
                  placeholder="1-52"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Topic</label>
                <input
                  type="text"
                  value={uploadData.topic}
                  onChange={(e) => setUploadData({ ...uploadData, topic: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="e.g., Machine Learning Basics"
                />
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                accept=".pdf,.pptx,.ppt,.docx,.doc,.py,.js,.ts,.cpp,.c,.java,.html,.css,.md,.txt,.json,.yaml,.yml,.zip"
              />
              <p className="text-xs text-gray-500 mt-1">Supported: PDF, PPTX, code files, MD, TXT, ZIP (max 50MB)</p>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={uploading}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
              <button
                type="button"
                onClick={() => setShowUploadForm(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value as Category | '')}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        >
          <option value="">All Categories</option>
          <option value="theory">Theory</option>
          <option value="lab">Lab</option>
        </select>
        <select
          value={filterWeek}
          onChange={(e) => setFilterWeek(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        >
          <option value="">All Weeks</option>
          {[...Array(16)].map((_, i) => (
            <option key={i + 1} value={i + 1}>Week {i + 1}</option>
          ))}
        </select>
        <button
          onClick={fetchMaterials}
          className="px-3 py-2 text-purple-600 hover:text-purple-700 font-medium"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Materials Table */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading materials...</div>
        ) : materials.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No materials found. Upload your first material to get started.
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Title</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Week</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Size</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Uploaded</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {materials.map((material) => (
                <tr key={material.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{material.title}</div>
                    <div className="text-sm text-gray-500">{material.file_name}</div>
                    {material.tags.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {material.tags.slice(0, 3).map((tag, i) => (
                          <span key={i} className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      material.category === 'theory' 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {material.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {material.week_number ? `Week ${material.week_number}` : '-'}
                  </td>
                  <td className="px-6 py-4 text-gray-600 uppercase text-sm">
                    {material.file_type}
                  </td>
                  <td className="px-6 py-4 text-gray-600 text-sm">
                    {formatFileSize(material.file_size_bytes)}
                  </td>
                  <td className="px-6 py-4 text-gray-600 text-sm">
                    {formatDate(material.created_at)}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button
                      onClick={() => handleDownload(material)}
                      className="text-purple-600 hover:text-purple-800 font-medium text-sm"
                    >
                      Download
                    </button>
                    <button
                      onClick={() => handleDelete(material)}
                      className="text-red-600 hover:text-red-800 font-medium text-sm"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
