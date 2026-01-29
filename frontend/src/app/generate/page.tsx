'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ArrowLeft, BookOpen, Presentation, Code, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function GeneratePage() {
  const [topic, setTopic] = useState('');
  const [audience, setAudience] = useState('undergraduate');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    notes: string;
    slides: string;
    lab_code: { language: string; code: string };
  } | null>(null);
  const [activeTab, setActiveTab] = useState<'notes' | 'slides' | 'code'>('notes');
  const [slideIndex, setSlideIndex] = useState(0);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic) return;
    
    setLoading(true);
    setResult(null);
    setSlideIndex(0);
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
      const res = await fetch(`${apiUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, audience }),
      });
      
      if (!res.ok) throw new Error('Generation failed');
      
      const data = await res.json();
      setResult(data);
    } catch (error) {
      console.error(error);
      alert('Failed to generate content. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const slides = result?.slides ? result.slides.split('---').map(s => s.trim()).filter(s => s) : [];

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 hover:bg-gray-200 rounded-full transition-colors">
              <ArrowLeft className="w-6 h-6 text-gray-700" />
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">Academic Content Generator</h1>
          </div>
        </header>

        {/* Input Section */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <form onSubmit={handleGenerate} className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <label className="block text-sm font-medium text-gray-700 mb-1">Topic</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Neural Networks, Quantum Mechanics, Byzantine Generals Problem"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>
            
            <div className="w-full md:w-64">
              <label className="block text-sm font-medium text-gray-700 mb-1">Audience</label>
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                <option value="undergraduate">Undergraduate Students</option>
                <option value="graduate">Graduate Students</option>
                <option value="highschool">High School</option>
                <option value="researcher">Researcher</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              {loading ? 'Generating...' : 'Generate Content'}
            </button>
          </form>
        </div>

        {/* Results Section */}
        {result && (
          <div className="bg-white rounded-xl shadow-xl overflow-hidden min-h-[600px] flex flex-col">
            {/* Tabs */}
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveTab('notes')}
                className={`flex-1 py-4 px-6 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${
                  activeTab === 'notes' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <BookOpen className="w-4 h-4" /> Lecture Notes
              </button>
              <button
                onClick={() => setActiveTab('slides')}
                className={`flex-1 py-4 px-6 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${
                  activeTab === 'slides' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Presentation className="w-4 h-4" /> Slides ({slides.length})
              </button>
              <button
                onClick={() => setActiveTab('code')}
                className={`flex-1 py-4 px-6 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${
                  activeTab === 'code' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Code className="w-4 h-4" /> Lab Code
              </button>
            </div>

            {/* Content Area */}
            <div className="p-8 flex-1 overflow-auto bg-gray-50/50">
              
              {/* Lecture Notes */}
              {activeTab === 'notes' && (
                <div className="prose prose-blue max-w-none bg-white p-8 rounded-lg shadow-sm border border-gray-100">
                  <ReactMarkdown>{result.notes}</ReactMarkdown>
                </div>
              )}

              {/* Slides */}
              {activeTab === 'slides' && slides.length > 0 && (
                <div className="h-full flex flex-col items-center justify-center">
                  <div className="w-full max-w-4xl aspect-video bg-white rounded-xl shadow-lg border border-gray-200 p-12 flex flex-col justify-center mb-6 relative overflow-hidden">
                    <div className="prose prose-lg max-w-none">
                      <ReactMarkdown>{slides[slideIndex]}</ReactMarkdown>
                    </div>
                    <div className="absolute bottom-4 right-4 text-gray-400 text-sm">
                      Slide {slideIndex + 1} / {slides.length}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setSlideIndex(Math.max(0, slideIndex - 1))}
                      disabled={slideIndex === 0}
                      className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 font-medium transition-colors"
                    >
                      Previous
                    </button>
                    <span className="text-gray-600 font-medium">{slideIndex + 1} of {slides.length}</span>
                    <button
                      onClick={() => setSlideIndex(Math.min(slides.length - 1, slideIndex + 1))}
                      disabled={slideIndex === slides.length - 1}
                      className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 font-medium transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}

              {/* Lab Code */}
              {activeTab === 'code' && (
                <div className="max-w-4xl mx-auto">
                    <div className="bg-gray-900 rounded-t-lg px-4 py-2 text-gray-400 text-xs flex justify-between items-center">
                        <span className="uppercase font-bold tracking-wider">{result.lab_code.language}</span>
                        <span>lab_exercise.{result.lab_code.language === 'python' ? 'py' : 'txt'}</span>
                    </div>
                    
                    {/* Syntax Highlighter attempt, fallback to pre/code if fails */}
                    <div className="rounded-b-lg overflow-hidden border border-gray-800 shadow-2xl">
                         {/* Does not have types for syntax highlighter, using simple pre for robustness if module missing */}
                         <pre className="p-4 bg-[#1e1e1e] text-gray-100 overflow-x-auto text-sm font-mono leading-relaxed">
                            <code>{result.lab_code.code}</code>
                         </pre>
                    </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
