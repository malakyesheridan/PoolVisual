// Underwater Realism Cache - LRU cache for composited results
// Caches the final composited image data to avoid recomputation

import { UnderwaterRealismSettings } from './types';

export interface UnderwaterRealismCacheEntry {
  imageData: ImageData;
  settings: UnderwaterRealismSettings;
  materialId: string;
  tileScale: number;
  maskHash: string; // Hash of mask points for cache key
  timestamp: number;
}

export class UnderwaterRealismCache {
  private cache = new Map<string, UnderwaterRealismCacheEntry>();
  private accessOrder: string[] = [];
  private maxEntries = 20; // Keep cache size reasonable

  constructor(maxEntries: number = 20) {
    this.maxEntries = maxEntries;
  }

  // Generate cache key from material and settings
  private generateKey(
    materialId: string,
    tileScale: number,
    settings: UnderwaterRealismSettings,
    maskHash: string
  ): string {
    return `${materialId}@${tileScale}@${settings.enabled}@${settings.blend}@${settings.refraction}@${settings.edgeSoftness}@${maskHash}`;
  }

  // Generate hash from mask points
  generateMaskHash(points: { x: number; y: number }[]): string {
    // Simple hash function for mask points
    const str = points.map(p => `${p.x},${p.y}`).join('|');
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  // Get cached result
  get(
    materialId: string,
    tileScale: number,
    settings: UnderwaterRealismSettings,
    maskHash: string
  ): ImageData | null {
    const key = this.generateKey(materialId, tileScale, settings, maskHash);
    const entry = this.cache.get(key);

    if (entry) {
      // Update access order
      this.updateAccessOrder(key);
      return entry.imageData;
    }

    return null;
  }

  // Set cached result
  set(
    materialId: string,
    tileScale: number,
    settings: UnderwaterRealismSettings,
    maskHash: string,
    imageData: ImageData
  ): void {
    const key = this.generateKey(materialId, tileScale, settings, maskHash);

    // Evict if cache is full
    if (this.cache.size >= this.maxEntries) {
      this.evictLRU();
    }

    // Store entry
    this.cache.set(key, {
      imageData,
      settings,
      materialId,
      tileScale,
      maskHash,
      timestamp: Date.now()
    });

    // Update access order
    this.updateAccessOrder(key);
  }

  // Update access order for LRU
  private updateAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  // Evict least recently used entry
  private evictLRU(): void {
    if (this.accessOrder.length > 0) {
      const lruKey = this.accessOrder[0];
      if (lruKey) {
        this.cache.delete(lruKey);
        this.accessOrder.shift();
      }
    }
  }

  // Clear cache
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  // Get cache stats
  getStats(): { total: number; memoryUsage: number } {
    let memoryUsage = 0;
    for (const entry of this.cache.values()) {
      // Rough estimate: width * height * 4 bytes per pixel
      memoryUsage += entry.imageData.width * entry.imageData.height * 4;
    }

    return {
      total: this.cache.size,
      memoryUsage
    };
  }

  // Invalidate cache for specific material
  invalidateMaterial(materialId: string): void {
    const keysToDelete: string[] = [];
    for (const [key, entry] of this.cache.entries()) {
      if (entry.materialId === materialId) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => {
      this.cache.delete(key);
      const index = this.accessOrder.indexOf(key);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
    });
  }

  // Invalidate cache for specific mask
  invalidateMask(maskHash: string): void {
    const keysToDelete: string[] = [];
    for (const [key, entry] of this.cache.entries()) {
      if (entry.maskHash === maskHash) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => {
      this.cache.delete(key);
      const index = this.accessOrder.indexOf(key);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
    });
  }
}

// Global cache instance
export const underwaterRealismCache = new UnderwaterRealismCache();
