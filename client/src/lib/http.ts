/**
 * Robust HTTP client with retries, timeouts, and comprehensive error handling
 */

import { AppError, parseError, networkError, timeoutError } from './errors.js';
import { logger } from './logger.js';
import type { ApiResponse } from '@shared/schemas';

// HTTP client configuration
interface HttpConfig {
  baseUrl?: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  retryMultiplier?: number;
  maxRetryDelay?: number;
  headers?: Record<string, string>;
}

// Request options
interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  cache?: RequestCache;
}

// Default configuration
const DEFAULT_CONFIG: Required<Omit<HttpConfig, 'baseUrl'>> = {
  timeout: 15000, // 15 seconds
  retries: 2,
  retryDelay: 750, // 750ms
  retryMultiplier: 2,
  maxRetryDelay: 5000, // 5 seconds
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
};

// Retry configuration for different status codes
const RETRY_STATUS_CODES = new Set([
  408, // Request Timeout
  429, // Too Many Requests
  500, // Internal Server Error
  502, // Bad Gateway
  503, // Service Unavailable
  504  // Gateway Timeout
]);

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 */
function calculateDelay(attempt: number, baseDelay: number, multiplier: number, maxDelay: number): number {
  const delay = baseDelay * Math.pow(multiplier, attempt);
  return Math.min(delay, maxDelay);
}

/**
 * Check if error should trigger a retry
 */
function shouldRetry(error: unknown, attempt: number, maxRetries: number): boolean {
  if (attempt >= maxRetries) {
    return false;
  }

  // Don't retry if request was aborted
  if (error instanceof Error && error.name === 'AbortError') {
    return false;
  }

  // Retry on network errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }

  // Retry on specific HTTP status codes
  if (error instanceof AppError) {
    const statusCode = error.getStatusCode();
    return RETRY_STATUS_CODES.has(statusCode);
  }

  return false;
}

/**
 * Enhanced HTTP client class
 */
class HttpClient {
  private config: Required<Omit<HttpConfig, 'baseUrl'>> & { baseUrl?: string };

  constructor(config: HttpConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Create AbortController with timeout
   */
  private createTimeoutController(timeout: number, existingSignal?: AbortSignal): AbortController {
    const controller = new AbortController();
    
    // Respect existing signal
    if (existingSignal?.aborted) {
      controller.abort();
      return controller;
    }

    // Set up timeout
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeout);

    // Handle existing signal abortion
    if (existingSignal) {
      existingSignal.addEventListener('abort', () => {
        clearTimeout(timeoutId);
        controller.abort();
      });
    }

    // Clean up timeout when request completes
    controller.signal.addEventListener('abort', () => {
      clearTimeout(timeoutId);
    });

    return controller;
  }

  /**
   * Prepare request URL
   */
  private prepareUrl(url: string): string {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    
    if (this.config.baseUrl) {
      return `${this.config.baseUrl.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
    }
    
    return url;
  }

  /**
   * Prepare request headers
   */
  private prepareHeaders(options: RequestOptions): Record<string, string> {
    return {
      ...this.config.headers,
      ...options.headers
    };
  }

  /**
   * Prepare request body
   */
  private prepareBody(body: unknown, headers: Record<string, string>): string | FormData | undefined {
    if (!body) {
      return undefined;
    }

    // Handle FormData (for file uploads)
    if (body instanceof FormData) {
      // Remove Content-Type header to let browser set it with boundary
      delete headers['Content-Type'];
      return body;
    }

    // Handle other objects as JSON
    if (typeof body === 'object') {
      return JSON.stringify(body);
    }

    // Handle strings
    return String(body);
  }

  /**
   * Parse response
   */
  private async parseResponse<T>(response: Response): Promise<ApiResponse<T>> {
    const contentType = response.headers.get('content-type') || '';
    
    try {
      if (contentType.includes('application/json')) {
        return await response.json() as ApiResponse<T>;
      }
      
      // Handle non-JSON responses
      const text = await response.text();
      if (response.ok) {
        return { ok: true, data: text as T };
      } else {
        throw new AppError('EXTERNAL_SERVICE_ERROR', `HTTP ${response.status}: ${text}`);
      }
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError('EXTERNAL_SERVICE_ERROR', 'Failed to parse response', { cause: error });
    }
  }

  /**
   * Execute HTTP request with retries
   */
  private async executeRequest<T>(
    url: string, 
    options: RequestOptions,
    attempt: number = 0
  ): Promise<ApiResponse<T>> {
    const timeout = options.timeout ?? this.config.timeout;
    const maxRetries = options.retries ?? this.config.retries;
    
    // Create timeout controller
    const controller = this.createTimeoutController(timeout, options.signal);
    
    try {
      // Prepare request
      const requestUrl = this.prepareUrl(url);
      const headers = this.prepareHeaders(options);
      const body = this.prepareBody(options.body, headers);
      
      // Log request attempt
      logger.debug({
        msg: `HTTP request attempt ${attempt + 1}`,
        meta: {
          method: options.method || 'GET',
          url: requestUrl,
          attempt: attempt + 1,
          maxRetries: maxRetries + 1
        }
      });

      // Execute fetch
      const response = await fetch(requestUrl, {
        method: options.method || 'GET',
        headers,
        body,
        signal: controller.signal,
        cache: options.cache
      });

      // Parse response
      const result = await this.parseResponse<T>(response);
      
      // Handle API errors
      if (!result.ok) {
        const error = new AppError(
          result.code || 'EXTERNAL_SERVICE_ERROR',
          result.message || 'Request failed',
          {
            meta: {
              status: response.status,
              details: result.details,
              requestId: result.requestId
            }
          }
        );
        
        // Check if we should retry
        if (shouldRetry(error, attempt, maxRetries)) {
          const delay = calculateDelay(
            attempt,
            options.retryDelay ?? this.config.retryDelay,
            this.config.retryMultiplier,
            this.config.maxRetryDelay
          );
          
          logger.warn({
            msg: `Request failed, retrying in ${delay}ms`,
            code: error.code,
            meta: {
              attempt: attempt + 1,
              delay,
              url: requestUrl
            }
          });
          
          await sleep(delay);
          return this.executeRequest(url, options, attempt + 1);
        }
        
        throw error;
      }

      // Success
      logger.debug({
        msg: 'HTTP request successful',
        meta: {
          method: options.method || 'GET',
          url: requestUrl,
          status: response.status,
          attempt: attempt + 1
        }
      });

      return result;
      
    } catch (error) {
      // Handle timeout
      if (controller.signal.aborted) {
        const timeoutError = new AppError('TIMEOUT_ERROR', `Request timed out after ${timeout}ms`);
        
        if (shouldRetry(timeoutError, attempt, maxRetries)) {
          const delay = calculateDelay(
            attempt,
            options.retryDelay ?? this.config.retryDelay,
            this.config.retryMultiplier,
            this.config.maxRetryDelay
          );
          
          await sleep(delay);
          return this.executeRequest(url, options, attempt + 1);
        }
        
        throw timeoutError;
      }

      // Handle network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        const netError = networkError('Network request failed', error);
        
        if (shouldRetry(netError, attempt, maxRetries)) {
          const delay = calculateDelay(
            attempt,
            options.retryDelay ?? this.config.retryDelay,
            this.config.retryMultiplier,
            this.config.maxRetryDelay
          );
          
          await sleep(delay);
          return this.executeRequest(url, options, attempt + 1);
        }
        
        throw netError;
      }

      // Re-throw AppErrors
      if (error instanceof AppError) {
        throw error;
      }

      // Parse other errors
      throw parseError(error);
    }
  }

  /**
   * Main request method
   */
  async request<T = unknown>(url: string, options: RequestOptions = {}): Promise<T> {
    try {
      const result = await this.executeRequest<T>(url, options);
      return result.data;
    } catch (error) {
      logger.logError(error, {
        msg: 'HTTP request failed',
        meta: {
          method: options.method || 'GET',
          url: this.prepareUrl(url)
        }
      });
      throw error;
    }
  }

  // Convenience methods
  async get<T = unknown>(url: string, options: Omit<RequestOptions, 'method'> = {}): Promise<T> {
    return this.request<T>(url, { ...options, method: 'GET' });
  }

  async post<T = unknown>(url: string, body?: unknown, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<T> {
    return this.request<T>(url, { ...options, method: 'POST', body });
  }

  async put<T = unknown>(url: string, body?: unknown, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<T> {
    return this.request<T>(url, { ...options, method: 'PUT', body });
  }

  async patch<T = unknown>(url: string, body?: unknown, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<T> {
    return this.request<T>(url, { ...options, method: 'PATCH', body });
  }

  async delete<T = unknown>(url: string, options: Omit<RequestOptions, 'method'> = {}): Promise<T> {
    return this.request<T>(url, { ...options, method: 'DELETE' });
  }
}

// Create default client instance
export const apiClient = new HttpClient({
  baseUrl: '/api'
});

// Export factory function for custom clients
export function createHttpClient(config: HttpConfig = {}): HttpClient {
  return new HttpClient(config);
}

// Export class for advanced usage
export { HttpClient };

// Legacy alias for backward compatibility
export const apiFetch = apiClient.request.bind(apiClient);