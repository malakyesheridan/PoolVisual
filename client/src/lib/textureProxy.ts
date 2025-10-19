/**
 * Utility functions for handling texture URLs with CORS proxy
 */

/**
 * Check if a URL is external (not from the same origin)
 */
function isExternalUrl(url: string): boolean {
  if (!url) return false;
  
  try {
    const urlObj = new URL(url);
    const currentOrigin = window.location.origin;
    return urlObj.origin !== currentOrigin;
  } catch {
    return false;
  }
}

/**
 * Convert external URLs to use the texture proxy
 */
export function getProxiedTextureUrl(url: string): string {
  if (!url) return url;
  
  // If it's an external URL, use the proxy
  if (isExternalUrl(url)) {
    return `/api/texture?url=${encodeURIComponent(url)}`;
  }
  
  // For same-origin URLs, return as-is
  return url;
}

/**
 * Load an image with CORS proxy support
 */
export function loadImageWithProxy(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => resolve(img);
    img.onerror = (error) => {
      console.error('[TextureProxy] Failed to load image:', url, error);
      reject(error);
    };
    
    // Use proxied URL for external images
    img.src = getProxiedTextureUrl(url);
  });
}

/**
 * Get texture URL for PIXI.js with proxy support
 */
export function getPixiTextureUrl(url: string): string {
  return getProxiedTextureUrl(url);
}
