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

export default function MaterialsBrowser() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Category>('theory');
  const [filterWeek, setFilterWeek] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  
  const supabase = createSPAClient();

  const fetchMaterials = async () => {
    setLoading(true);
    
    try {
      let query = supabase
        .from('course_materials')
        .select('*')
        .eq('category', activeTab)
        .order('week_number', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });
      
      if (filterWeek) {
        query = query.eq('week_number', parseInt(filterWeek));
      }
      
      if (searchQuery) {
        query = query.or(`title.ilike.%${searchQuery}%,topic.ilike.%${searchQuery}%`);
      }
      
      const { data, error } = await query;
      
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
  }, [activeTab, filterWeek, searchQuery]);

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
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Group materials by week
  const groupedMaterials = materials.reduce((acc, material) => {
    const week = material.week_number || 0;
    if (!acc[week]) acc[week] = [];
    acc[week].push(material);
    return acc;
  }, {} as Record<number, Material[]>);

  const getFileIcon = (fileType: string) => {
    switch (fileType.toLowerCase()) {
      case 'pdf':
        return (
          <svg className="w-8 h-8 text-red-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
          </svg>
        );
      case 'pptx':
      case 'ppt':
        return (
          <svg className="w-8 h-8 text-orange-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6,2A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2H6M13,3.5L18.5,9H13V3.5M8,11H16V13H8V11M8,15H16V17H8V15Z" />
          </svg>
        );
      case 'py':
      case 'js':
      case 'ts':
      case 'cpp':
      case 'java':
        return (
          <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        );
      case 'md':
      case 'txt':
        return (
          <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      default:
        return (
          <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        );
    }
  };

  const getContentTypeBadge = (contentType: string | null) => {
    const badges: Record<string, string> = {
      lecture_slide: 'bg-purple-100 text-purple-700',
      lab_code: 'bg-green-100 text-green-700',
      note: 'bg-yellow-100 text-yellow-700',
      reference: 'bg-blue-100 text-blue-700',
      other: 'bg-gray-100 text-gray-700',
    };
    return badges[contentType || 'other'] || badges.other;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Course Materials</h2>
        <p className="text-gray-600">Browse and download lecture slides, lab files, and resources</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('theory')}
          className={`px-6 py-3 text-sm font-medium transition-colors ${
            activeTab === 'theory'
              ? 'text-purple-600 border-b-2 border-purple-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          📚 Theory
        </button>
        <button
          onClick={() => setActiveTab('lab')}
          className={`px-6 py-3 text-sm font-medium transition-colors ${
            activeTab === 'lab'
              ? 'text-purple-600 border-b-2 border-purple-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          💻 Lab
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <input
          type="text"
          placeholder="Search materials..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent w-64"
        />
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
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-purple-500 border-t-transparent mb-4"></div>
          <p>Loading materials...</p>
        </div>
      ) : materials.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Materials Yet</h3>
          <p className="text-gray-500">
            No {activeTab} materials have been uploaded yet.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedMaterials)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([week, weekMaterials]) => (
              <div key={week} className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <span className="w-8 h-8 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center text-sm font-bold">
                    {week === '0' ? '—' : week}
                  </span>
                  {week === '0' ? 'General Resources' : `Week ${week}`}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {weekMaterials.map((material) => (
                    <div
                      key={material.id}
                      className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0">
                          {getFileIcon(material.file_type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 truncate">
                            {material.title}
                          </h4>
                          {material.topic && (
                            <p className="text-sm text-gray-500 truncate">
                              {material.topic}
                            </p>
                          )}
                          {material.description && (
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                              {material.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getContentTypeBadge(material.content_type)}`}>
                              {material.content_type?.replace('_', ' ') || 'file'}
                            </span>
                            <span className="text-xs text-gray-400">
                              {material.file_type.toUpperCase()} • {formatFileSize(material.file_size_bytes)}
                            </span>
                          </div>
                          {material.tags.length > 0 && (
                            <div className="flex gap-1 mt-2 flex-wrap">
                              {material.tags.slice(0, 3).map((tag, i) => (
                                <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDownload(material)}
                        className="w-full mt-4 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all text-sm font-medium flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
