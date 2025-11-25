/**
 * Retry Utility
 * Provides retry logic with exponential backoff
 */

export interface RetryOptions {
  maxRetries: number;
  delay: number;
  retryable?: (error: Error) => boolean;
  onRetry?: (attempt: number, error: Error) => void;
}

/**
 * Execute a function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Check if error is retryable
      if (options.retryable && !options.retryable(lastError)) {
        throw lastError;
      }
      
      // Don't retry on last attempt
      if (attempt === options.maxRetries) {
        break;
      }
      
      // Call retry callback
      if (options.onRetry) {
        options.onRetry(attempt + 1, lastError);
      }
      
      // Wait before retry with exponential backoff
      const delay = options.delay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

