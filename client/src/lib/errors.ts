/**
 * Centralized error handling system
 * Provides structured error types and factory functions
 */

// Standard error codes
export const ERROR_CODES = {
  // Client errors (4xx)
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  
  // Server errors (5xx)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  
  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  ABORT_ERROR: 'ABORT_ERROR',
  
  // Application specific
  UPLOAD_ERROR: 'UPLOAD_ERROR',
  PROCESSING_ERROR: 'PROCESSING_ERROR'
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

// HTTP status code mapping
export const ERROR_STATUS_MAP: Record<string, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  DATABASE_ERROR: 500,
  EXTERNAL_SERVICE_ERROR: 502,
  NETWORK_ERROR: 503,
  TIMEOUT_ERROR: 408,
  ABORT_ERROR: 499,
  UPLOAD_ERROR: 400,
  PROCESSING_ERROR: 500
};

// User-friendly error messages
export const ERROR_MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: 'The information provided is invalid. Please check your input and try again.',
  UNAUTHORIZED: 'You need to sign in to access this resource.',
  FORBIDDEN: 'You don\'t have permission to perform this action.',
  NOT_FOUND: 'The requested resource could not be found.',
  CONFLICT: 'This action conflicts with existing data. Please refresh and try again.',
  RATE_LIMITED: 'Too many requests. Please wait a moment before trying again.',
  INTERNAL_ERROR: 'Something went wrong on our end. Please try again later.',
  DATABASE_ERROR: 'We\'re experiencing database issues. Please try again later.',
  EXTERNAL_SERVICE_ERROR: 'An external service is temporarily unavailable.',
  NETWORK_ERROR: 'Network connection failed. Please check your internet connection.',
  TIMEOUT_ERROR: 'The request took too long to complete. Please try again.',
  ABORT_ERROR: 'The request was cancelled.',
  UPLOAD_ERROR: 'File upload failed. Please check the file and try again.',
  PROCESSING_ERROR: 'Processing failed. Please try again later.'
};

/**
 * Enhanced error class with structured metadata
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly cause?: unknown;
  public readonly meta?: Record<string, unknown>;
  public readonly timestamp: string;
  public readonly requestId?: string;

  constructor(
    code: string,
    message?: string,
    options: {
      cause?: unknown;
      meta?: Record<string, unknown>;
      requestId?: string;
    } = {}
  ) {
    const errorMessage = message || ERROR_MESSAGES[code] || 'An unexpected error occurred';
    super(errorMessage);
    
    this.name = 'AppError';
    this.code = code;
    this.cause = options.cause;
    this.meta = options.meta;
    this.timestamp = new Date().toISOString();
    this.requestId = options.requestId;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  /**
   * Convert to HTTP status code
   */
  getStatusCode(): number {
    return ERROR_STATUS_MAP[this.code] || 500;
  }

  /**
   * Convert to API response format
   */
  toApiResponse(): {
    ok: false;
    code: string;
    message: string;
    requestId?: string;
    details?: unknown;
  } {
    return {
      ok: false,
      code: this.code,
      message: this.message,
      requestId: this.requestId,
      details: this.meta
    };
  }

  /**
   * Convert to JSON for logging
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      stack: this.stack,
      cause: this.cause,
      meta: this.meta,
      timestamp: this.timestamp,
      requestId: this.requestId
    };
  }
}

/**
 * Type guard to check if error is AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Error factory functions for common cases
 */
export function badRequest(message?: string, meta?: Record<string, unknown>): AppError {
  return new AppError('VALIDATION_ERROR', message, { meta });
}

export function unauthorized(message?: string, meta?: Record<string, unknown>): AppError {
  return new AppError('UNAUTHORIZED', message, { meta });
}

export function forbidden(message?: string, meta?: Record<string, unknown>): AppError {
  return new AppError('FORBIDDEN', message, { meta });
}

export function notFound(resource?: string, meta?: Record<string, unknown>): AppError {
  const message = resource ? `${resource} not found` : undefined;
  return new AppError('NOT_FOUND', message, { meta });
}

export function conflict(message?: string, meta?: Record<string, unknown>): AppError {
  return new AppError('CONFLICT', message, { meta });
}

export function internal(message?: string, cause?: unknown, meta?: Record<string, unknown>): AppError {
  return new AppError('INTERNAL_ERROR', message, { cause, meta });
}

export function networkError(message?: string, cause?: unknown): AppError {
  return new AppError('NETWORK_ERROR', message, { cause });
}

export function timeoutError(message?: string): AppError {
  return new AppError('TIMEOUT_ERROR', message);
}

export function uploadError(message?: string, meta?: Record<string, unknown>): AppError {
  return new AppError('UPLOAD_ERROR', message, { meta });
}

/**
 * Parse error from various sources
 */
export function parseError(error: unknown, requestId?: string): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    // Handle specific error types
    if (error.name === 'AbortError') {
      return new AppError('ABORT_ERROR', 'Request was cancelled', { cause: error, requestId });
    }
    
    if (error.name === 'TimeoutError') {
      return new AppError('TIMEOUT_ERROR', 'Request timed out', { cause: error, requestId });
    }

    // Handle network errors
    if (error.message.includes('fetch') || error.message.includes('network')) {
      return new AppError('NETWORK_ERROR', error.message, { cause: error, requestId });
    }

    // Generic error
    return new AppError('INTERNAL_ERROR', error.message, { cause: error, requestId });
  }

  // Unknown error type
  return new AppError('INTERNAL_ERROR', 'An unexpected error occurred', { cause: error, requestId });
}