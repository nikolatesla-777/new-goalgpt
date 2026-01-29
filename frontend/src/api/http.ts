/**
 * HTTP Client - Centralized fetch wrapper
 * Handles base URL, headers, timeout, and error normalization
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
const DEFAULT_TIMEOUT = 30000; // 30 seconds

export interface HttpError {
  message: string;
  status?: number;
  statusText?: string;
  data?: any;
}

export class ApiError extends Error {
  status?: number;
  statusText?: string;
  data?: any;

  constructor(message: string, status?: number, statusText?: string, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.statusText = statusText;
    this.data = data;
  }
}

export interface HttpOptions extends RequestInit {
  timeout?: number;
  baseURL?: string;
}

/**
 * Centralized HTTP client with timeout support
 */
async function http<T = any>(
  endpoint: string,
  options: HttpOptions = {}
): Promise<T> {
  const {
    timeout = DEFAULT_TIMEOUT,
    baseURL = API_BASE_URL,
    headers = {},
    ...fetchOptions
  } = options;

  const url = endpoint.startsWith('http')
    ? endpoint
    : `${baseURL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Clone response to read body multiple times if needed
    const responseClone = response.clone();

    if (!response.ok) {
      let errorData: any;
      try {
        errorData = await responseClone.json();
      } catch {
        errorData = await responseClone.text();
      }

      throw new ApiError(
        errorData?.message || errorData?.error || `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        response.statusText,
        errorData
      );
    }

    // Try parsing as JSON first
    try {
      return await response.json();
    } catch {
      // If not JSON, return text
      return (await response.text()) as any;
    }
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof ApiError) {
      throw error;
    }

    if ((error as Error).name === 'AbortError') {
      throw new ApiError('Request timeout', 408, 'Timeout');
    }

    throw new ApiError(
      (error as Error).message || 'Network error',
      undefined,
      undefined,
      error
    );
  }
}

/**
 * HTTP GET request
 */
export async function get<T = any>(
  endpoint: string,
  options?: Omit<HttpOptions, 'method' | 'body'>
): Promise<T> {
  return http<T>(endpoint, { ...options, method: 'GET' });
}

/**
 * HTTP POST request
 */
export async function post<T = any>(
  endpoint: string,
  data?: any,
  options?: Omit<HttpOptions, 'method'>
): Promise<T> {
  return http<T>(endpoint, {
    ...options,
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * HTTP PUT request
 */
export async function put<T = any>(
  endpoint: string,
  data?: any,
  options?: Omit<HttpOptions, 'method'>
): Promise<T> {
  return http<T>(endpoint, {
    ...options,
    method: 'PUT',
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * HTTP PATCH request
 */
export async function patch<T = any>(
  endpoint: string,
  data?: any,
  options?: Omit<HttpOptions, 'method'>
): Promise<T> {
  return http<T>(endpoint, {
    ...options,
    method: 'PATCH',
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * HTTP DELETE request
 */
export async function del<T = any>(
  endpoint: string,
  options?: Omit<HttpOptions, 'method' | 'body'>
): Promise<T> {
  return http<T>(endpoint, { ...options, method: 'DELETE' });
}

export default {
  get,
  post,
  put,
  patch,
  delete: del,
};
