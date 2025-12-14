/**
 * API client wrapper for Pulse frontend
 * Provides consistent fetch operations with auth token injection and error handling
 */

const API_BASE_URL = '/api';

interface ApiOptions extends RequestInit {
  skipAuth?: boolean;
}

/**
 * Core API fetch wrapper that handles:
 * - Prefixing with /api
 * - Injecting auth token from localStorage
 * - JSON serialization/deserialization
 * - Consistent error handling
 */
async function apiFetch<T = any>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<T> {
  const { skipAuth = false, headers = {}, ...fetchOptions } = options;
  
  // Build the full URL
  const url = endpoint.startsWith('http') 
    ? endpoint 
    : `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  
  // Prepare headers
  const requestHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    ...headers,
  };
  
  // Add auth token if not skipped
  if (!skipAuth) {
    const token = localStorage.getItem('authToken');
    if (token) {
      requestHeaders['Authorization'] = `Bearer ${token}`;
    }
  }
  
  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers: requestHeaders,
    });
    
    // Handle non-JSON responses (e.g., file downloads)
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      
      // Handle API errors
      if (!response.ok) {
        throw new ApiError(
          data.message || data.error || `HTTP ${response.status}`,
          response.status,
          data
        );
      }
      
      return data;
    } else {
      // For non-JSON responses, just check status and return response
      if (!response.ok) {
        throw new ApiError(`HTTP ${response.status}`, response.status);
      }
      return response as any;
    }
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    // Handle network errors, JSON parsing errors, etc.
    throw new ApiError(
      error instanceof Error ? error.message : 'Network error',
      0,
      error
    );
  }
}

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Convenience methods for common HTTP verbs
 */
export const api = {
  get: <T = any>(endpoint: string, options?: Omit<ApiOptions, 'method' | 'body'>) =>
    apiFetch<T>(endpoint, { ...options, method: 'GET' }),
    
  post: <T = any>(endpoint: string, data?: any, options?: Omit<ApiOptions, 'method' | 'body'>) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),
    
  put: <T = any>(endpoint: string, data?: any, options?: Omit<ApiOptions, 'method' | 'body'>) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    }),
    
  patch: <T = any>(endpoint: string, data?: any, options?: Omit<ApiOptions, 'method' | 'body'>) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    }),
    
  delete: <T = any>(endpoint: string, options?: Omit<ApiOptions, 'method' | 'body'>) =>
    apiFetch<T>(endpoint, { ...options, method: 'DELETE' }),
    
  upload: <T = any>(endpoint: string, file: File, options?: Omit<ApiOptions, 'method' | 'body'>) => {
    const formData = new FormData();
    formData.append('file', file);
    
    return apiFetch<T>(endpoint, {
      ...options,
      method: 'POST',
      body: formData,
      headers: {
        // Don't set Content-Type for FormData - browser sets it with boundary
        ...options?.headers,
      },
    });
  },
};

/**
 * Legacy compatibility - export functions that match existing pulseApi pattern
 * These can be gradually replaced with the new api methods
 */
export const pulseGet = api.get;
export const pulsePost = api.post;
export const pulsePut = api.put;
export const pulseDelete = api.delete;
export const pulseUpload = api.upload;

export default api;
