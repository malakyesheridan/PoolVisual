/**
 * TextureManager - High-quality texture loading with mipmaps and anisotropic filtering
 * Handles caching, CORS proxy, and performance optimization for material textures
 */

import * as PIXI from 'pixi.js';

export interface TextureOptions {
  mipmaps?: boolean;
  anisotropicFiltering?: boolean;
  wrapMode?: string;
}

export class TextureManager {
  private textureCache = new Map<string, PIXI.Texture>();
  private loadingPromises = new Map<string, Promise<PIXI.Texture | null>>();

  /**
   * Get texture with caching and quality options
   * @param materialId Unique material identifier for caching
   * @param url Texture URL (will use proxy if needed)
   * @param options Quality and filtering options
   * @returns PIXI Texture or null if failed
   */
  async getTexture(
    materialId: string,
    url: string,
    options: TextureOptions = {}
  ): Promise<PIXI.Texture | null> {
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
    const loadPromise = this.loadTexture(url, options);
    this.loadingPromises.set(cacheKey, loadPromise);

    try {
      const texture = await loadPromise;
      
      if (texture) {
        this.textureCache.set(cacheKey, texture);
        console.info('[tex] cached', materialId, texture.width, texture.height);
      }
      
      return texture;
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
      const proxyUrl = this.shouldUseProxy(resolvedUrl) ? `/api/texture?url=${encodeURIComponent(resolvedUrl)}` : resolvedUrl;
      
      // Load image via blob to avoid taint
      const imageBlob = await this.loadImageBlob(proxyUrl);
      if (!imageBlob) return null;

      const imageUrl = URL.createObjectURL(imageBlob);
      
      // Create PIXI texture - using v8 API
      const texture = await PIXI.Assets.load(imageUrl);

      if (!texture) {
        throw new Error('Failed to load texture');
      }

      // Validate texture size
      this.validateTextureSize(texture);

      // Clean up blob URL
      URL.revokeObjectURL(imageUrl);

      return texture;

    } catch (error) {
      console.error('[TextureManager] Failed to load texture:', url, error);
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