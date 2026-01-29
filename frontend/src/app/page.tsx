import React from 'react';
import Link from 'next/link';
import { BookOpen, Brain, Search, MessageSquare, Users, Zap } from 'lucide-react';

export default function Home() {
  const features = [
    {
      icon: BookOpen,
      title: 'Organized Content',
      description: 'Access all your course materials - slides, PDFs, lab code, and references in one place',
      color: 'text-blue-600'
    },
    {
      icon: Search,
      title: 'Intelligent Search',
      description: 'Find exactly what you need with AI-powered search across all course materials',
      color: 'text-purple-600'
    },
    {
      icon: Brain,
      title: 'AI-Powered Learning',
      description: 'Get instant answers and explanations from our AI tutor trained on your course content',
      color: 'text-green-600'
    },
    {
      icon: MessageSquare,
      title: 'Interactive Chat',
      description: 'Ask questions and get contextual responses based on lecture notes and materials',
      color: 'text-orange-600'
    },
    {
      icon: Users,
      title: 'For Students & Instructors',
      description: 'Students learn better, instructors manage content efficiently',
      color: 'text-indigo-600'
    },
    {
      icon: Zap,
      title: 'Fast & Efficient',
      description: 'Quick access to resources, instant responses, and seamless learning experience',
      color: 'text-red-600'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/90 backdrop-blur-md z-50 border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                LearnHub
              </span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/auth/login"
                className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/auth/register"
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-lg hover:shadow-lg transition-all font-medium"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                AI-Powered Learning
              </span>
              <br />
              <span className="text-gray-900">For University Courses</span>
            </h1>
            <p className="mt-6 text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Access organized course materials, search through lectures, and chat with an AI tutor 
              that understands your curriculum. Learning made smarter.
            </p>
            <div className="mt-10 flex gap-4 justify-center flex-wrap">
              <Link
                href="/auth/register"
                className="inline-flex items-center px-8 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold hover:shadow-2xl hover:scale-105 transition-all text-lg"
              >
                Start Learning Free
                <Brain className="ml-2 w-5 h-5" />
              </Link>
              <Link
                href="/auth/admin/login"
                className="inline-flex items-center px-8 py-4 rounded-xl bg-white text-gray-700 font-semibold border-2 border-gray-300 hover:border-purple-600 hover:text-purple-600 transition-all text-lg"
              >
                Instructor Portal
                <Users className="ml-2 w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Everything You Need to Excel
            </h2>
            <p className="text-xl text-gray-600">
              Built for modern university learning
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-gradient-to-br from-white to-gray-50 p-8 rounded-2xl shadow-md hover:shadow-xl transition-all border border-gray-100 hover:scale-105"
              >
                <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br from-white to-gray-100 mb-4`}>
                  <feature.icon className={`h-8 w-8 ${feature.color}`} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              How It Works
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="text-xl font-semibold mb-2">Instructors Upload</h3>
              <p className="text-gray-600">
                Professors upload course materials - slides, PDFs, lab code, and references
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="text-xl font-semibold mb-2">AI Processes</h3>
              <p className="text-gray-600">
                Our AI analyzes and indexes all content for intelligent retrieval
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-green-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="text-xl font-semibold mb-2">Students Learn</h3>
              <p className="text-gray-600">
                Search, chat, and get instant answers from course-specific AI tutor
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-4">
            Ready to Transform Your Learning?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join students and instructors already using AI-powered learning
          </p>
          <Link
            href="/auth/register"
            className="inline-flex items-center px-8 py-4 rounded-xl bg-white text-blue-600 font-bold hover:shadow-2xl transition-all text-lg hover:scale-105"
          >
            Get Started Free
            <Zap className="ml-2 w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold">LearnHub</span>
              </div>
              <p className="text-gray-400">
                AI-powered supplementary learning platform for university courses
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">For Students</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/auth/register" className="hover:text-white transition-colors">Sign Up</Link></li>
                <li><Link href="/auth/login" className="hover:text-white transition-colors">Login</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">For Instructors</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/auth/admin/login" className="hover:text-white transition-colors">Admin Portal</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-800 text-center text-gray-400">
            <p>© {new Date().getFullYear()} LearnHub. Built for better learning.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}