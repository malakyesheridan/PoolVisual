/**
 * Loader That Never Fails - Contract Requirement
 * SAFETY: Always returns HTMLImageElement - real texture or 256x256 checkerboard fallback
 * NEVER throws; NEVER leaves caller with no image
 */
const API = import.meta.env.VITE_API_BASE_URL || '';

function makeChecker(size = 256): HTMLCanvasElement {
  // SAFETY: Zero-dependency checkerboard fallback
  const c = document.createElement('canvas'); 
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const n = 8, s = size / n;
  
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      ctx.fillStyle = ((x + y) & 1) ? '#dcdcdc' : '#f3f3f3';
      ctx.fillRect(x * s, y * s, s, s);
    }
  }
  return c;
}

export async function loadImageSafe(url?: string): Promise<HTMLImageElement> {
  try {
    if (!url) throw new Error('empty url');
    
    // Handle relative URLs by making them absolute
    let finalUrl = url;
    if (url.startsWith('/')) {
      finalUrl = `${window.location.origin}${url}`;
    }
    
    // For external URLs, use proxy. For local URLs, direct fetch.
    const needsProxy = finalUrl.startsWith('http') && !finalUrl.includes(window.location.hostname);
    const fetchUrl = needsProxy ? `/api/texture?url=${encodeURIComponent(finalUrl)}` : finalUrl;
    
    const resp = await fetch(fetchUrl);
    if (!resp.ok) throw new Error('fetch failed ' + resp.status);
    const blob = await resp.blob();
    const objURL = URL.createObjectURL(blob);
    
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = rej;
      img.src = objURL;
    });
    
    return img;
  } catch (error) {
    // SAFETY: Never fail - log warning and return checkerboard
    console.warn('[PVQ][WARN] texture-fallback', url, error instanceof Error ? error.message : error);
    
    const img = new Image();
    img.src = makeChecker().toDataURL('image/png');
    await new Promise(r => img.onload = () => r(null));
    return img;
  }
}

// Legacy interface compatibility
export interface TextureOptions {
  mipmaps?: boolean;
  anisotropicFiltering?: boolean;
  wrapMode?: string;
}

export class TextureManager {
  private textureCache = new Map<string, HTMLImageElement>();
  private loadingPromises = new Map<string, Promise<HTMLImageElement>>();

  /**
   * Get texture with caching - V2 returns HTMLImageElement for reliability
   */
  async getTexture(
    materialId: string,
    url: string,
    options: TextureOptions = {}
  ): Promise<HTMLImageElement> {
    const cacheKey = `${materialId}_${url}`;
    
    // Return cached texture if available
    if (this.textureCache.has(cacheKey)) {
      return this.textureCache.get(cacheKey)!;
    }

    // Return ongoing loading promise if exists
    if (this.loadingPromises.has(cacheKey)) {
      return this.loadingPromises.get(cacheKey)!;
    }

    // Start loading
    const loadPromise = loadImageSafe(url);
    this.loadingPromises.set(cacheKey, loadPromise);

    try {
      const img = await loadPromise;
      this.textureCache.set(cacheKey, img);
      console.info('[tex] cached', materialId, img.width, img.height);
      return img;
    } finally {
      this.loadingPromises.delete(cacheKey);
    }
  }

  private async loadTexture(
    url: string,
    options: TextureOptions
  ): Promise<PIXI.Texture | null> {
    try {
      // Fix relative URLs and use proxy for external URLs
      const resolvedUrl = this.resolveUrl(url);
      const finalUrl = this.shouldUseProxy(resolvedUrl) ? `/api/texture?url=${encodeURIComponent(resolvedUrl)}` : resolvedUrl;
      
      console.info('[TextureManager] Loading texture from:', finalUrl);
      
      // Load texture directly with PixiJS v8 - no blob conversion needed
      const texture = await PIXI.Assets.load(finalUrl);

      if (!texture) {
        throw new Error('Failed to load texture');
      }

      // Validate texture size
      this.validateTextureSize(texture);

      console.info('[TextureManager] Successfully loaded texture:', finalUrl, texture.width, texture.height);
      return texture;

    } catch (error) {
      console.error('[TextureManager] Failed to load texture:', url, {
        error: error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      return null;
    }
  }

  private async loadImageBlob(url: string): Promise<Blob | null> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const blob = await response.blob();
      
      // Validate it's an image
      if (!blob.type.startsWith('image/')) {
        throw new Error(`Invalid content type: ${blob.type}`);
      }

      return blob;
    } catch (error) {
      console.error('[TextureManager] Failed to load image blob:', url, error);
      return null;
    }
  }

  private resolveUrl(url: string): string {
    // Convert relative URLs to absolute URLs
    if (url.startsWith('/')) {
      return `${window.location.origin}${url}`;
    }
    return url;
  }

  private shouldUseProxy(url: string): boolean {
    // Use proxy for external URLs
    return url.startsWith('http') && !url.includes(window.location.hostname);
  }

  private supportsAnisotropicFiltering(): boolean {
    // Check WebGL support for anisotropic filtering
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') as WebGLRenderingContext;
      if (!gl) return false;

      const ext = gl.getExtension('EXT_texture_filter_anisotropic') ||
                  gl.getExtension('MOZ_EXT_texture_filter_anisotropic') ||
                  gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
      
      return !!ext;
    } catch {
      return false;
    }
  }

  private validateTextureSize(texture: PIXI.Texture): void {
    const { width, height } = texture;
    
    if (width < 512 || height < 512) {
      console.warn('[TextureManager] Small texture detected, may blur:', { width, height });
    }

    if (width > 4096 || height > 4096) {
      console.warn('[TextureManager] Large texture detected, may impact performance:', { width, height });
    }

    // Check if power of 2 for optimal performance
    const isPowerOf2 = (n: number) => (n & (n - 1)) === 0;
    if (!isPowerOf2(width) || !isPowerOf2(height)) {
      console.warn('[TextureManager] Non-power-of-2 texture, mipmaps may be disabled:', { width, height });
    }
  }

  /**
   * Preload textures for better performance
   * @param materialIds Array of material IDs to preload
   * @param materials Material data with texture URLs
   */
  async preloadTextures(materialIds: string[], materials: any[]): Promise<void> {
    const loadPromises = materialIds.map(async (id) => {
      const material = materials.find(m => m.id === id);
      if (!material) return;

      const textureUrl = material.textureUrl || material.texture_url || '';
      if (!textureUrl) return;

      try {
        await this.getTexture(id, textureUrl, { mipmaps: true, anisotropicFiltering: true });
      } catch (error) {
        console.warn('[TextureManager] Preload failed for:', id, error);
      }
    });

    await Promise.allSettled(loadPromises);
    console.info('[TextureManager] Preloaded textures:', materialIds.length);
  }

  /**
   * Clear texture cache to free memory
   * @param materialId Optional specific material to clear, or all if not specified
   */
  clearCache(materialId?: string): void {
    if (materialId) {
      // Clear specific material textures
      const keysToDelete: string[] = [];
      this.textureCache.forEach((texture, key) => {
        if (key.startsWith(`${materialId}_`)) {
          texture.destroy(true);
          keysToDelete.push(key);
        }
      });
      
      keysToDelete.forEach(key => this.textureCache.delete(key));
    } else {
      // Clear all textures
      this.textureCache.forEach(texture => texture.destroy(true));
      this.textureCache.clear();
    }
  }

  /**
   * Get cache statistics for debugging
   */
  getCacheStats(): { count: number; memoryEstimate: number } {
    let memoryEstimate = 0;
    
    this.textureCache.forEach(texture => {
      const { width, height } = texture;
      // Estimate 4 bytes per pixel (RGBA) + mipmaps (~33% extra)
      memoryEstimate += width * height * 4 * 1.33;
    });

    return {
      count: this.textureCache.size,
      memoryEstimate: Math.round(memoryEstimate / (1024 * 1024)) // MB
    };
  }

  destroy(): void {
    this.clearCache();
    this.loadingPromises.clear();
  }
}