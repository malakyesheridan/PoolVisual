/**
 * Image Preloader with Retry Logic
 * Handles reliable image loading with CORS support, retries, and error handling
 */

export interface PreloadOptions {
  maxRetries?: number;
  retryDelay?: number; // Base delay in ms
  timeout?: number; // Timeout per attempt in ms
  crossOrigin?: 'anonymous' | 'use-credentials';
}

export interface PreloadResult {
  success: boolean;
  image?: HTMLImageElement;
  error?: Error;
  attempts: number;
}

/**
 * Preload an image with retry logic and error handling
 */
export async function preloadImage(
  url: string,
  options: PreloadOptions = {}
): Promise<PreloadResult> {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    timeout = 30000,
    crossOrigin = 'anonymous'
  } = options;

  let lastError: Error | undefined;
  let attempts = 0;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    attempts = attempt + 1;
    
    try {
      const image = await loadImageWithTimeout(url, timeout, crossOrigin);
      return {
        success: true,
        image,
        attempts
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Don't retry on last attempt
      if (attempt < maxRetries - 1) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = retryDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  return {
    success: false,
    error: lastError || new Error('Failed to load image after all retries'),
    attempts
  };
}

/**
 * Load image with timeout
 */
function loadImageWithTimeout(
  url: string,
  timeout: number,
  crossOrigin: string
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = crossOrigin;
    
    let timeoutId: NodeJS.Timeout;
    let resolved = false;

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      img.onload = null;
      img.onerror = null;
    };

    const onSuccess = () => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve(img);
    };

    const onError = (error: Event | string) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      const errorMessage = typeof error === 'string' 
        ? error 
        : 'Failed to load image';
      reject(new Error(errorMessage));
    };

    img.onload = onSuccess;
    img.onerror = (e) => {
      // Try to get more specific error info
      const errorMsg = img.src ? `Failed to load image from ${url}` : 'Failed to load image';
      onError(errorMsg);
    };

    // Set timeout
    timeoutId = setTimeout(() => {
      onError('Image load timeout');
    }, timeout);

    // Start loading
    img.src = url;
  });
}

/**
 * Check if an image URL is accessible (quick check)
 */
export async function checkImageAccessible(
  url: string,
  timeout: number = 5000
): Promise<boolean> {
  try {
    await loadImageWithTimeout(url, timeout, 'anonymous');
    return true;
  } catch {
    return false;
  }
}

