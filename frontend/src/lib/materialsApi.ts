/**
 * Materials API Service
 * Handles all communication with FastAPI backend for materials CRUD operations.
 */

import { createSPAClient } from './supabase/client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

export interface Material {
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
  file_url?: string | null;
  uploaded_by?: string;
  created_at: string;
  updated_at?: string;
}

export interface MaterialListResponse {
  materials: Material[];
  total: number;
  page: number;
  page_size: number;
}

export interface UploadResponse {
  id: string;
  file_path: string;
  message: string;
}

export interface MaterialUpdateData {
  title?: string;
  description?: string;
  topic?: string;
  week_number?: number;
  tags?: string[];
  content_type?: string;
}

/**
 * Get auth token from Supabase session
 */
async function getAuthToken(): Promise<string> {
  const supabase = createSPAClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }
  
  return session.access_token;
}

/**
 * Make authenticated request to FastAPI backend
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAuthToken();
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
    },
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  
  return response.json();
}

/**
 * Materials API methods
 */
export const MaterialsAPI = {
  /**
   * List materials with optional filters
   */
  async list(params?: {
    category?: 'theory' | 'lab';
    topic?: string;
    week_number?: number;
    content_type?: string;
    tags?: string;
    search?: string;
    page?: number;
    page_size?: number;
  }): Promise<MaterialListResponse> {
    const searchParams = new URLSearchParams();
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.append(key, String(value));
        }
      });
    }
    
    const queryString = searchParams.toString();
    const endpoint = `/api/materials${queryString ? `?${queryString}` : ''}`;
    
    return apiRequest<MaterialListResponse>(endpoint);
  },

  /**
   * Get a single material by ID
   */
  async get(id: string): Promise<Material> {
    return apiRequest<Material>(`/api/materials/${id}`);
  },

  /**
   * Upload a new material (admin only)
   */
  async upload(data: {
    file: File;
    title: string;
    category: 'theory' | 'lab';
    description?: string;
    topic?: string;
    week_number?: number;
    tags?: string;
    content_type?: string;
  }): Promise<UploadResponse> {
    const token = await getAuthToken();
    
    const formData = new FormData();
    formData.append('file', data.file);
    formData.append('title', data.title);
    formData.append('category', data.category);
    
    if (data.description) formData.append('description', data.description);
    if (data.topic) formData.append('topic', data.topic);
    if (data.week_number) formData.append('week_number', String(data.week_number));
    if (data.tags) formData.append('tags', data.tags);
    if (data.content_type) formData.append('content_type', data.content_type);
    
    const response = await fetch(`${API_BASE_URL}/api/materials/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Upload failed' }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }
    
    return response.json();
  },

  /**
   * Update material metadata (admin only)
   */
  async update(id: string, data: MaterialUpdateData): Promise<Material> {
    return apiRequest<Material>(`/api/materials/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete a material (admin only)
   */
  async delete(id: string): Promise<{ message: string }> {
    return apiRequest<{ message: string }>(`/api/materials/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * Get download URL for a material
   * Uses the file_url from the material response
   */
  async getDownloadUrl(material: Material): Promise<string | null> {
    // If we already have a signed URL, use it
    if (material.file_url) {
      return material.file_url;
    }
    
    // Otherwise, fetch the material to get a fresh signed URL
    try {
      const freshMaterial = await this.get(material.id);
      return freshMaterial.file_url || null;
    } catch {
      return null;
    }
  },
};

export default MaterialsAPI;
