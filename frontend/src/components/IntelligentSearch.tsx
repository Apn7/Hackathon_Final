'use client';

import { useState } from 'react';
import { Search, MessageCircle, FileText, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { createSPAClient } from '@/lib/supabase/client';

interface SourceDocument {
  file_name: string;
  page_number: number | null;
  excerpt: string;
  similarity: number;
  material_id: string;
  file_url?: string;
}

interface AskResponse {
  answer: string;
  sources: SourceDocument[];
  question: string;
}

export default function IntelligentSearch() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AskResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSources, setShowSources] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || loading) return;

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      // Get auth token from Supabase session
      const supabase = createSPAClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Please log in to use the search feature');
      }

      const res = await fetch('http://localhost:8000/api/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          question: question.trim(),
          limit: 5,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Search failed');
      }

      const data: AskResponse = await res.json();
      setResponse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <a
          href="/app"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Dashboard
        </a>
      </div>

      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 mb-4">
          <MessageCircle className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Ask AI Tutor
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Ask questions about your course materials and get AI-powered answers with sources
        </p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSubmit} className="mb-8">
        <div className="relative">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question about the course materials..."
            className="w-full p-4 pr-16 text-lg border-2 border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-800 resize-none transition-all"
            rows={3}
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="absolute right-3 bottom-3 p-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:from-purple-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Search className="w-5 h-5" />
            )}
          </button>
        </div>
      </form>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <p className="text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="w-10 h-10 animate-spin text-purple-500 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Searching course materials...</p>
          </div>
        </div>
      )}

      {/* Response */}
      {response && !loading && (
        <div className="space-y-6">
          {/* Answer Card */}
          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0">
                <MessageCircle className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">AI Answer</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Based on your course materials</p>
              </div>
            </div>
            <div className="prose prose-purple dark:prose-invert max-w-none">
              <div className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
                {response.answer}
              </div>
            </div>
          </div>

          {/* Sources */}
          {response.sources.length > 0 && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowSources(!showSources)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-gray-500" />
                  <span className="font-medium text-gray-900 dark:text-white">
                    Sources ({response.sources.length})
                  </span>
                </div>
                {showSources ? (
                  <ChevronUp className="w-5 h-5 text-gray-500" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-500" />
                )}
              </button>

              {showSources && (
                <div className="border-t border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
                  {response.sources.map((source, idx) => (
                    <div key={idx} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-medium rounded">
                            Source {idx + 1}
                          </span>
                          <span className="font-medium text-gray-900 dark:text-white text-sm">
                            {source.file_url ? (
                              <a
                                href={source.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline text-purple-600 dark:text-purple-400"
                              >
                                {source.file_name}
                              </a>
                            ) : (
                              source.file_name
                            )}
                          </span>
                          {source.page_number && (
                            <span className="text-gray-500 dark:text-gray-400 text-sm">
                              Page {source.page_number}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-400">
                          {Math.round(source.similarity * 100)}% match
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3">
                        {source.excerpt}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!response && !loading && !error && (
        <div className="text-center py-12 px-6">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <Search className="w-10 h-10 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Ask anything about your courses
          </h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            Try questions like &quot;Explain matrix transformations&quot; or &quot;How do I implement a linked list?&quot;
          </p>
        </div>
      )}
    </div>
  );
}
