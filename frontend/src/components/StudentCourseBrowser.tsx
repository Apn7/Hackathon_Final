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
type ViewLevel = 'categories' | 'courses' | 'weeks' | 'files';

export default function StudentCourseBrowser() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Navigation state
  const [currentCategory, setCurrentCategory] = useState<Category | null>(null);
  const [currentCourse, setCurrentCourse] = useState<string | null>(null);
  const [currentWeek, setCurrentWeek] = useState<number | null>(null);
  
  const supabase = createSPAClient();

  // Fetch all materials
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

  // Get unique courses (topics) for a category
  const getCourses = (category: Category): string[] => {
    const courses = materials
      .filter(m => m.category === category && m.topic)
      .map(m => m.topic as string);
    return [...new Set(courses)].sort();
  };

  // Get unique weeks for a course
  const getWeeks = (category: Category, course: string): number[] => {
    const weeks = materials
      .filter(m => m.category === category && m.topic === course && m.week_number)
      .map(m => m.week_number as number);
    return [...new Set(weeks)].sort((a, b) => a - b);
  };

  // Get files for a specific week
  const getFiles = (category: Category, course: string, week: number): Material[] => {
    return materials.filter(
      m => m.category === category && m.topic === course && m.week_number === week
    );
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

  // Get view level
  const getViewLevel = (): ViewLevel => {
    if (currentWeek !== null) return 'files';
    if (currentCourse !== null) return 'weeks';
    if (currentCategory !== null) return 'courses';
    return 'categories';
  };

  // Breadcrumb navigation
  const goBack = () => {
    if (currentWeek !== null) {
      setCurrentWeek(null);
    } else if (currentCourse !== null) {
      setCurrentCourse(null);
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
      case 'pdf':
        return '📄';
      case 'pptx':
      case 'ppt':
        return '📊';
      case 'py':
      case 'js':
      case 'ts':
      case 'cpp':
      case 'java':
        return '💻';
      case 'md':
      case 'txt':
        return '📝';
      default:
        return '📁';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  const viewLevel = getViewLevel();

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      {viewLevel !== 'categories' && (
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={() => { setCurrentCategory(null); setCurrentCourse(null); setCurrentWeek(null); }}
            className="text-blue-600 hover:underline"
          >
            Home
          </button>
          {currentCategory && (
            <>
              <span className="text-gray-400">/</span>
              <button
                onClick={() => { setCurrentCourse(null); setCurrentWeek(null); }}
                className={currentCourse ? "text-blue-600 hover:underline" : "text-gray-700 font-medium"}
              >
                {currentCategory === 'theory' ? '📚 Theory' : '💻 Lab'}
              </button>
            </>
          )}
          {currentCourse && (
            <>
              <span className="text-gray-400">/</span>
              <button
                onClick={() => setCurrentWeek(null)}
                className={currentWeek ? "text-blue-600 hover:underline" : "text-gray-700 font-medium"}
              >
                {currentCourse}
              </button>
            </>
          )}
          {currentWeek !== null && (
            <>
              <span className="text-gray-400">/</span>
              <span className="text-gray-700 font-medium">Week {currentWeek}</span>
            </>
          )}
        </div>
      )}

      {/* Back Button */}
      {viewLevel !== 'categories' && (
        <button
          onClick={goBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
      )}

      {/* Categories View */}
      {viewLevel === 'categories' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button
            onClick={() => setCurrentCategory('theory')}
            className="bg-white rounded-xl shadow-md p-8 border border-gray-100 hover:shadow-lg hover:border-blue-200 transition-all text-left group"
          >
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                📚
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Theory</h3>
                <p className="text-gray-600">Lecture slides, notes, and references</p>
                <p className="text-sm text-blue-600 mt-1">
                  {getCourses('theory').length} courses available
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
                <p className="text-gray-600">Code files, exercises, and projects</p>
                <p className="text-sm text-green-600 mt-1">
                  {getCourses('lab').length} courses available
                </p>
              </div>
            </div>
          </button>
        </div>
      )}

      {/* Courses View */}
      {viewLevel === 'courses' && currentCategory && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900">
            {currentCategory === 'theory' ? '📚 Theory Courses' : '💻 Lab Courses'}
          </h2>
          
          {getCourses(currentCategory).length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-500">
              No courses available yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {getCourses(currentCategory).map((course) => (
                <button
                  key={course}
                  onClick={() => setCurrentCourse(course)}
                  className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md hover:border-blue-200 transition-all text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{course}</h3>
                      <p className="text-sm text-gray-500">
                        {getWeeks(currentCategory, course).length} weeks
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Weeks View */}
      {viewLevel === 'weeks' && currentCategory && currentCourse && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900">{currentCourse}</h2>
          
          {getWeeks(currentCategory, currentCourse).length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-500">
              No weeks available yet.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {getWeeks(currentCategory, currentCourse).map((week) => (
                <button
                  key={week}
                  onClick={() => setCurrentWeek(week)}
                  className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md hover:border-blue-200 transition-all text-center"
                >
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-lg font-bold text-blue-600">{week}</span>
                  </div>
                  <h3 className="font-medium text-gray-900">Week {week}</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {getFiles(currentCategory, currentCourse, week).length} files
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Files View */}
      {viewLevel === 'files' && currentCategory && currentCourse && currentWeek !== null && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900">
            Week {currentWeek} Materials
          </h2>
          
          {getFiles(currentCategory, currentCourse, currentWeek).length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-500">
              No files available yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {getFiles(currentCategory, currentCourse, currentWeek).map((file) => (
                <div
                  key={file.id}
                  className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 hover:shadow-md transition-all"
                >
                  <div className="flex items-start gap-4">
                    <div className="text-3xl">{getFileIcon(file.file_type)}</div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">{file.title}</h3>
                      <p className="text-sm text-gray-500 truncate">{file.file_name}</p>
                      {file.description && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{file.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                        <span className="uppercase">{file.file_type}</span>
                        <span>{formatFileSize(file.file_size_bytes)}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDownload(file)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex-shrink-0"
                    >
                      Download
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
