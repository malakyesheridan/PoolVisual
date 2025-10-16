import { Material } from './types';

// Cache for Canvas2D patterns to avoid recreating them every frame
class MaterialCache {
  private patterns = new Map<string, CanvasPattern>();
  private images = new Map<string, HTMLImageElement>();
  private loadingPromises = new Map<string, Promise<HTMLImageElement>>();

  // Get a cached pattern for a material with specific scale
  getPattern(material: Material, scale: number = 1): Promise<CanvasPattern | null> {
    const cacheKey = `${material.id}-${scale}`;
    
    // Return cached pattern if available
    if (this.patterns.has(cacheKey)) {
      return Promise.resolve(this.patterns.get(cacheKey)!);
    }

    // Return existing loading promise if already loading
    if (this.loadingPromises.has(cacheKey)) {
      return this.loadingPromises.get(cacheKey)!.then(img => {
        if (img) {
          const pattern = this.createPattern(img, scale);
          this.patterns.set(cacheKey, pattern);
          return pattern;
        }
        return null;
      });
    }

    // Start loading the image
    const loadingPromise = this.loadImage(material.textureUrl);
    this.loadingPromises.set(cacheKey, loadingPromise);

    return loadingPromise.then(img => {
      if (img) {
        const pattern = this.createPattern(img, scale);
        this.patterns.set(cacheKey, pattern);
        return pattern;
      }
      return null;
    });
  }

  // Load an image with proper error handling
  private loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      // Check if already cached
      if (this.images.has(url)) {
        resolve(this.images.get(url)!);
        return;
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        this.images.set(url, img);
        resolve(img);
      };
      
      img.onerror = () => {
        console.warn(`Failed to load material texture: ${url}`);
        reject(new Error(`Failed to load texture: ${url}`));
      };
      
      img.src = url;
    });
  }

  // Create a Canvas2D pattern with scale transformation
  private createPattern(img: HTMLImageElement, scale: number): CanvasPattern | null {
    // Create a temporary canvas to apply scale transformation
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    
    if (!tempCtx) return null;

    // Calculate scaled dimensions
    const scaledWidth = img.width * scale;
    const scaledHeight = img.height * scale;
    
    tempCanvas.width = scaledWidth;
    tempCanvas.height = scaledHeight;
    
    // Draw scaled image
    tempCtx.drawImage(img, 0, 0, scaledWidth, scaledHeight);
    
    // Create pattern from scaled canvas
    const pattern = tempCtx.createPattern(tempCanvas, 'repeat');
    return pattern;
  }

  // Clear cache (useful for memory management)
  clear(): void {
    this.patterns.clear();
    this.images.clear();
    this.loadingPromises.clear();
  }

  // Get cache stats for debugging
  getStats(): { patterns: number; images: number; loading: number } {
    return {
      patterns: this.patterns.size,
      images: this.images.size,
      loading: this.loadingPromises.size
    };
  }
}

// Singleton instance
export const materialCache = new MaterialCache();

// Helper function to get material by ID
export function getMaterialById(id: string): Material | null {
  // This will be updated to use the material library
  const DEMO_MATERIALS = [
    {
      id: 'tile-1',
      name: 'Ceramic Tile',
      textureUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjRjNGNEY2Ii8+CjxyZWN0IHg9IjAiIHk9IjAiIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgZmlsbD0iI0U1RTdFQSIvPgo8cmVjdCB4PSIzMiIgeT0iMzIiIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgZmlsbD0iI0U1RTdFQSIvPgo8cmVjdCB4PSIzMiIgeT0iMCIgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiBmaWxsPSIjRjNGNEY2Ii8+CjxyZWN0IHg9IjAiIHk9IjMyIiB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIGZpbGw9IiNGM0Y0RjYiLz4KPHN2Zz4=',
      scale: 0.5
    },
    {
      id: 'stone-1', 
      name: 'Natural Stone',
      textureUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjNjc3NDc0Ii8+CjxjaXJjbGUgY3g9IjE2IiBjeT0iMTYiIHI9IjQiIGZpbGw9IiM1NzU3NTciLz4KPGNpcmNsZSBjeD0iNDgiIGN5PSIyMCIgcj0iMyIgZmlsbD0iIzU3NTc1NyIvPgo8Y2lyY2xlIGN4PSIzMiIgY3k9IjQwIiByPSI1IiBmaWxsPSIjNTc1NzU3Ii8+CjxjaXJjbGUgY3g9IjEyIiBjeT0iNDgiIHI9IjIiIGZpbGw9IiM1NzU3NTciLz4KPGNpcmNsZSBjeD0iNTIiIGN5PSI1MiIgcj0iNCIgZmlsbD0iIzU3NTc1NyIvPgo8L3N2Zz4=',
      scale: 0.3
    },
    {
      id: 'wood-1',
      name: 'Wood Decking',
      textureUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjOEQ2QjM5Ii8+CjxyZWN0IHg9IjAiIHk9IjAiIHdpZHRoPSI2NCIgaGVpZ2h0PSI4IiBmaWxsPSIjN0M1QjI5Ii8+CjxyZWN0IHg9IjAiIHk9IjE2IiB3aWR0aD0iNjQiIGhlaWdodD0iOCIgZmlsbD0iIzdDNUIyOSIvPgo8cmVjdCB4PSIwIiB5PSIzMiIgd2lkdGg9IjY0IiBoZWlnaHQ9IjgiIGZpbGw9IiM3QzVCMjkiLz4KPHJlY3QgeD0iMCIgeT0iNDgiIHdpZHRoPSI2NCIgaGVpZ2h0PSI4IiBmaWxsPSIjN0M1QjI5Ii8+CjxsaW5lIHgxPSIwIiB5MT0iMCIgeDI9IjY0IiB5Mj0iMCIgc3Ryb2tlPSIjNjQ0NjM0IiBzdHJva2Utd2lkdGg9IjEiLz4KPGxpbmUgeDE9IjAiIHkxPSIxNiIgeDI9IjY0IiB5Mj0iMTYiIHN0cm9rZT0iIzY0NDYzNCIgc3Ryb2tlLXdpZHRoPSIxIi8+CjxsaW5lIHgxPSIwIiB5MT0iMzIiIHgyPSI2NCIgeTI9IjMyIiBzdHJva2U9IiM2NDQ2MzQiIHN0cm9rZS13aWR0aD0iMSIvPgo8bGluZSB4MT0iMCIgeTE9IjQ4IiB4Mj0iNjQiIHkyPSI0OCIgc3Ryb2tlPSIjNjQ0NjM0IiBzdHJva2Utd2lkdGg9IjEiLz4KPC9zdmc+',
      scale: 0.4
    }
  ];

  return DEMO_MATERIALS.find(m => m.id === id) || null;
}
