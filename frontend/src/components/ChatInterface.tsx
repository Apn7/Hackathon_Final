'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Send, Bot, User, FileText, ChevronDown, ChevronUp, 
  Loader2, Plus, MessageSquare, Trash2, Search, BookOpen, HelpCircle, FileEdit, Code
} from 'lucide-react';
import { createSPAClient } from '@/lib/supabase/client';
import ReactMarkdown from 'react-markdown';

// Types
interface SourceDocument {
  file_name: string;
  page_number: number | null;
  excerpt: string;
  similarity: number;
  material_id: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources: SourceDocument[];
  created_at: string;
}

interface Conversation {
  id: string;
  title: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

const API_BASE = 'http://localhost:8000';

// Intent icons mapping
const IntentIcon: Record<string, React.ReactNode> = {
  search: <Search className="w-3 h-3" />,
  summarize: <BookOpen className="w-3 h-3" />,
  explain: <HelpCircle className="w-3 h-3" />,
};

// Parse citations from text like (Source: file.pdf, Page 5)
function parseCitations(text: string): { text: string; citations: string[] } {
  const citationRegex = /\(Source:\s*([^,]+),?\s*(?:Page\s*(\d+))?\)/gi;
  const citations: string[] = [];
  
  let match;
  while ((match = citationRegex.exec(text)) !== null) {
    const fileName = match[1].trim();
    const page = match[2] ? `, Page ${match[2]}` : '';
    citations.push(`${fileName}${page}`);
  }
  
  return { text, citations: [...new Set(citations)] };
}

export default function ChatInterface() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [expandedSources, setExpandedSources] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentIntent, setCurrentIntent] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get auth token
  const getToken = async () => {
    const supabase = createSPAClient();
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  };

  // Load conversations
  useEffect(() => {
    loadConversations();
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversations = async () => {
    try {
      const token = await getToken();
      if (!token) return;

      const res = await fetch(`${API_BASE}/api/chat/conversations`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setLoadingConversations(false);
    }
  };

  const loadConversation = async (conversationId: string) => {
    try {
      const token = await getToken();
      if (!token) return;

      const res = await fetch(`${API_BASE}/api/chat/conversations/${conversationId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        setCurrentConversation(conversationId);
      }
    } catch (err) {
      console.error('Failed to load conversation:', err);
    }
  };

  const startNewConversation = () => {
    setCurrentConversation(null);
    setMessages([]);
    setCurrentIntent(null);
  };

  const deleteConversation = async (conversationId: string) => {
    try {
      const token = await getToken();
      if (!token) return;

      const res = await fetch(`${API_BASE}/api/chat/conversations/${conversationId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (res.ok) {
        setConversations(prev => prev.filter(c => c.id !== conversationId));
        if (currentConversation === conversationId) {
          startNewConversation();
        }
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setLoading(true);

    // Optimistically add user message
    const tempUserMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: userMessage,
      sources: [],
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      const token = await getToken();
      if (!token) throw new Error('Please log in');

      const res = await fetch(`${API_BASE}/api/chat/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: userMessage,
          conversation_id: currentConversation,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Chat failed');
      }

      const data = await res.json();
      
      // Track the detected intent
      setCurrentIntent(data.intent);
      
      // Update conversation ID if new
      if (!currentConversation) {
        setCurrentConversation(data.conversation_id);
        loadConversations();
      }

      // Update messages with actual response
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== tempUserMsg.id);
        return [
          ...filtered,
          { ...tempUserMsg, id: `user-${Date.now()}` },
          {
            id: data.message.id,
            role: 'assistant',
            content: data.message.content,
            sources: data.sources || [],
            created_at: data.message.created_at,
          },
        ];
      });
    } catch (err) {
      setMessages(prev => prev.filter(m => m.id !== tempUserMsg.id));
      console.error('Chat error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Quick action buttons for different intents
  const quickActions = [
    { label: 'Generate Notes', icon: <FileEdit className="w-4 h-4" />, prompt: 'Generate study notes on ', color: 'bg-green-50 border-green-200 hover:border-green-500 hover:text-green-600' },
    { label: 'Generate Code', icon: <Code className="w-4 h-4" />, prompt: 'Generate code example for ', color: 'bg-blue-50 border-blue-200 hover:border-blue-500 hover:text-blue-600' },
    { label: 'Search', icon: <Search className="w-4 h-4" />, prompt: 'Find information about ', color: '' },
    { label: 'Summarize', icon: <BookOpen className="w-4 h-4" />, prompt: 'Summarize ', color: '' },
    { label: 'Explain', icon: <HelpCircle className="w-4 h-4" />, prompt: 'Explain ', color: '' },
  ];

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-72' : 'w-0'} transition-all duration-300 overflow-hidden border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col`}>
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={startNewConversation}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl hover:from-purple-600 hover:to-indigo-700 transition-all font-medium"
          >
            <Plus className="w-5 h-5" />
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {loadingConversations ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
              No conversations yet
            </div>
          ) : (
            <div className="space-y-1">
              {conversations.map(conv => (
                <div
                  key={conv.id}
                  className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                    currentConversation === conv.id
                      ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                  onClick={() => loadConversation(conv.id)}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <MessageSquare className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate text-sm">{conv.title}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation(conv.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-all"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Toggle Sidebar Button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-1 bg-gray-200 dark:bg-gray-700 rounded-r-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        style={{ left: sidebarOpen ? '288px' : '0' }}
      >
        {sidebarOpen ? <ChevronDown className="w-4 h-4 rotate-90" /> : <ChevronDown className="w-4 h-4 -rotate-90" />}
      </button>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-lg">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                  <Bot className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  AI Course Tutor
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Ask questions about your course materials. I provide answers <strong>grounded in your uploaded content</strong> with source citations.
                </p>
                
                {/* Quick Actions */}
                <div className="flex flex-wrap gap-2 justify-center mb-4">
                  {quickActions.map(action => (
                    <button
                      key={action.label}
                      onClick={() => setInput(action.prompt)}
                      className={`flex items-center gap-2 px-4 py-2 border text-gray-700 dark:text-gray-300 rounded-full text-sm transition-colors ${
                        action.color || 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-purple-500 hover:text-purple-600 dark:hover:text-purple-400'
                      }`}
                    >
                      {action.icon}
                      {action.label}
                    </button>
                  ))}
                </div>
                
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  All responses include citations like: (Source: filename.pdf, Page 5)
                </p>
              </div>
            </div>
          ) : (
            messages.map(msg => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}
                
                <div className={`max-w-[80%] ${msg.role === 'user' ? 'order-1' : ''}`}>
                  <div
                    className={`rounded-2xl px-4 py-3 ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white'
                        : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white'
                    }`}
                  >
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown
                          components={{
                            // Style inline citations
                            p: ({ children }) => {
                              if (typeof children === 'string') {
                                // Highlight citations in the text
                                const parts = children.split(/(\(Source:[^)]+\))/g);
                                return (
                                  <p>
                                    {parts.map((part, i) => 
                                      part.match(/\(Source:[^)]+\)/) ? (
                                        <span key={i} className="text-purple-600 dark:text-purple-400 font-medium text-xs bg-purple-50 dark:bg-purple-900/30 px-1 py-0.5 rounded">
                                          {part}
                                        </span>
                                      ) : part
                                    )}
                                  </p>
                                );
                              }
                              return <p>{children}</p>;
                            }
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>

                  {/* Sources Card */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-2">
                      <button
                        onClick={() => setExpandedSources(expandedSources === msg.id ? null : msg.id)}
                        className="flex items-center gap-1 text-sm text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                      >
                        <FileText className="w-4 h-4" />
                        <span className="font-medium">{msg.sources.length} source{msg.sources.length > 1 ? 's' : ''} referenced</span>
                        {expandedSources === msg.id ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>

                      {expandedSources === msg.id && (
                        <div className="mt-2 space-y-2 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 border border-gray-200 dark:border-gray-700">
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                            Referenced Materials
                          </p>
                          {msg.sources.map((src, idx) => (
                            <div
                              key={idx}
                              className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700 transition-colors"
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <span className="w-6 h-6 flex items-center justify-center bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-bold rounded-full">
                                  {idx + 1}
                                </span>
                                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                  {src.file_name}
                                </span>
                                {src.page_number && (
                                  <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded">
                                    Page {src.page_number}
                                  </span>
                                )}
                                <span className="ml-auto text-xs text-gray-400">
                                  {Math.round((src.similarity || 0) * 100)}% match
                                </span>
                              </div>
                              <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-3 leading-relaxed">
                                {src.excerpt}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  </div>
                )}
              </div>
            ))
          )}

          {/* Loading indicator */}
          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2 text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Searching course materials and generating response...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800">
          <div className="max-w-4xl mx-auto relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about course materials... (e.g., 'Summarize chapter 3' or 'Explain machine learning')"
              className="w-full p-4 pr-14 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-800 resize-none transition-all"
              rows={2}
              disabled={loading}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="absolute right-3 bottom-3 p-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl hover:from-purple-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
          <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-2">
            ✨ All responses are grounded in your uploaded course materials with citations
          </p>
        </div>
      </div>
    </div>
  );
}
