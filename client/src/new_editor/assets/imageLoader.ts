// Asset image loader with caching - mirrors texture loader pattern
const imgCache = new Map<string, HTMLImageElement>();
const inflight = new Map<string, Promise<HTMLImageElement>>();

// Load asset image with caching and CORS support
export async function loadAssetImage(src: string): Promise<HTMLImageElement> {
  // Check cache first
  const cached = imgCache.get(src);
  if (cached && cached.complete && cached.naturalWidth > 0) {
    return cached;
  }

  // Check if already loading
  const existing = inflight.get(src);
  if (existing) {
    return existing;
  }

  // Start loading
  const promise = loadViaFetchObjectURL(src);
  inflight.set(src, promise);

  try {
    const img = await promise;
    imgCache.set(src, img);
    return img;
  } finally {
    inflight.delete(src);
  }
}

// Load image via fetch + ObjectURL (better CORS support)
async function loadViaFetchObjectURL(src: string): Promise<HTMLImageElement> {
  try {
    const response = await fetch(src, { 
      mode: 'cors',
      credentials: 'omit'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const blob = await response.blob();
    const objectURL = URL.createObjectURL(blob);
    
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        URL.revokeObjectURL(objectURL); // Clean up
        resolve(img);
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(objectURL); // Clean up
        reject(new Error(`Failed to load image: ${src}`));
      };
      
      img.src = objectURL;
    });
  } catch (error) {
    // Fallback to direct loading
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
      img.src = src;
    });
  }
}

// Preload asset images for better performance
export async function preloadAssetImages(defs: Array<{ url: string; thumbnail?: string }>): Promise<void> {
  const urls = defs.flatMap(def => [def.url, def.thumbnail].filter(Boolean));
  
  const promises = urls.map(async (url) => {
    try {
      await loadAssetImage(url);
    } catch (error) {
      console.warn('[ASSETS:preload] Failed to preload:', url, error);
    }
  });
  
  await Promise.allSettled(promises);
}

// Clear cache (useful for memory management)
export function clearAssetImageCache(): void {
  imgCache.clear();
  inflight.clear();
}
