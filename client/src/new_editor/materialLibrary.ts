// Material Library types and adapter
import { PV_MATERIAL_LIBRARY_ENABLED, MATERIAL_LIBRARY_CONFIG } from './featureFlags';

export interface MaterialLibraryEntry {
  id: string;
  name: string;
  category?: string;
  tags?: string[];
  albedoURL: string;
  physicalRepeatM?: number; // meters per tile
  defaultTileScale?: number; // 0.25..4.0
  // Optional PBR for future
  normalURL?: string;
  roughnessURL?: string;
  aoURL?: string;
}

export interface MaterialCacheEntry {
  status: 'pending' | 'ready' | 'error';
  image?: HTMLImageElement;
  pattern?: CanvasPattern;
  error?: string;
}

export interface MaterialSearchResult {
  materials: MaterialLibraryEntry[];
  total: number;
}

// LRU Cache for material patterns
class MaterialPatternCache {
  private cache = new Map<string, MaterialCacheEntry>();
  private accessOrder: string[] = [];
  private maxEntries: number;

  constructor(maxEntries: number = MATERIAL_LIBRARY_CONFIG.maxCacheEntries) {
    this.maxEntries = maxEntries;
  }

  get(key: string): MaterialCacheEntry | undefined {
    const entry = this.cache.get(key);
    if (entry) {
      // Move to end (most recently used)
      this.moveToEnd(key);
    }
    return entry;
  }

  set(key: string, entry: MaterialCacheEntry): void {
    // Remove if exists
    if (this.cache.has(key)) {
      this.removeFromOrder(key);
    }

    // Add new entry
    this.cache.set(key, entry);
    this.accessOrder.push(key);

    // Evict if over limit
    if (this.cache.size > this.maxEntries) {
      this.evictLRU();
    }
  }

  private moveToEnd(key: string): void {
    this.removeFromOrder(key);
    this.accessOrder.push(key);
  }

  private removeFromOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  private evictLRU(): void {
    if (this.accessOrder.length > 0) {
      const lruKey = this.accessOrder[0];
      this.cache.delete(lruKey);
      this.accessOrder.shift();
    }
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  getStats(): { total: number; ready: number; pending: number; error: number } {
    let ready = 0, pending = 0, error = 0;
    for (const entry of this.cache.values()) {
      switch (entry.status) {
        case 'ready': ready++; break;
        case 'pending': pending++; break;
        case 'error': error++; break;
      }
    }
    return { total: this.cache.size, ready, pending, error };
  }
}

// Material Library Adapter
class MaterialLibraryAdapter {
  private cache = new MaterialPatternCache();
  private materials: MaterialLibraryEntry[] = [];
  private loadingPromises = new Map<string, Promise<MaterialCacheEntry>>();

  async loadMaterials(): Promise<MaterialLibraryEntry[]> {
    if (!PV_MATERIAL_LIBRARY_ENABLED) {
      // Return placeholder materials when feature flag is disabled
      return this.getPlaceholderMaterials();
    }

    try {
      // Try API first
      const apiMaterials = await this.loadFromAPI();
      if (apiMaterials.length > 0) {
        this.materials = apiMaterials;
        return apiMaterials;
      }
    } catch (error) {
      console.warn('Failed to load materials from API:', error);
    }

    try {
      // Try static JSON
      const jsonMaterials = await this.loadFromJSON();
      if (jsonMaterials.length > 0) {
        this.materials = jsonMaterials;
        return jsonMaterials;
      }
    } catch (error) {
      console.warn('Failed to load materials from JSON:', error);
    }

    // Fallback to dev materials
    this.materials = this.getDevMaterials();
    return this.materials;
  }

  private async loadFromAPI(): Promise<MaterialLibraryEntry[]> {
    const response = await fetch('/api/materials');
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    return await response.json();
  }

  private async loadFromJSON(): Promise<MaterialLibraryEntry[]> {
    const response = await fetch('/materials/index.json');
    if (!response.ok) {
      throw new Error(`JSON request failed: ${response.status}`);
    }
    return await response.json();
  }

  private getDevMaterials(): MaterialLibraryEntry[] {
    return [
      {
        id: 'ceramic-tile',
        name: 'Ceramic Tile',
        category: 'tile',
        tags: ['ceramic', 'tile', 'bathroom'],
        albedoURL: '/materials/dev/ceramic-tile.jpg',
        physicalRepeatM: 0.3,
        defaultTileScale: 0.5
      },
      {
        id: 'natural-stone',
        name: 'Natural Stone',
        category: 'stone',
        tags: ['stone', 'natural', 'outdoor'],
        albedoURL: '/materials/dev/natural-stone.jpg',
        physicalRepeatM: 0.4,
        defaultTileScale: 0.3
      },
      {
        id: 'wood-deck',
        name: 'Wood Decking',
        category: 'wood',
        tags: ['wood', 'deck', 'outdoor'],
        albedoURL: '/materials/dev/wood-deck.jpg',
        physicalRepeatM: 0.2,
        defaultTileScale: 0.4
      }
    ];
  }

  private getPlaceholderMaterials(): MaterialLibraryEntry[] {
    // Return the existing placeholder materials when feature flag is disabled
    return [
      {
        id: 'tile-1',
        name: 'Ceramic Tile',
        category: 'placeholder',
        albedoURL: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjRjNGNEY2Ii8+CjxyZWN0IHg9IjAiIHk9IjAiIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgZmlsbD0iI0U1RTdFQSIvPgo8cmVjdCB4PSIzMiIgeT0iMzIiIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgZmlsbD0iI0U1RTdFQSIvPgo8cmVjdCB4PSIzMiIgeT0iMCIgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiBmaWxsPSIjRjNGNEY2Ii8+CjxyZWN0IHg9IjAiIHk9IjMyIiB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIGZpbGw9IiNGM0Y0RjYiLz4KPHN2Zz4=',
        physicalRepeatM: 0.3,
        defaultTileScale: 0.5
      },
      {
        id: 'stone-1',
        name: 'Natural Stone',
        category: 'placeholder',
        albedoURL: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjNjc3NDc0Ii8+CjxjaXJjbGUgY3g9IjE2IiBjeT0iMTYiIHI9IjQiIGZpbGw9IiM1NzU3NTciLz4KPGNpcmNsZSBjeD0iNDgiIGN5PSIyMCIgcj0iMyIgZmlsbD0iIzU3NTc1NyIvPgo8Y2lyY2xlIGN4PSIzMiIgY3k9IjQwIiByPSI1IiBmaWxsPSIjNTc1NzU3Ii8+CjxjaXJjbGUgY3g9IjEyIiBjeT0iNDgiIHI9IjIiIGZpbGw9IiM1NzU3NTciLz4KPGNpcmNsZSBjeD0iNTIiIGN5PSI1MiIgcj0iNCIgZmlsbD0iIzU3NTc1NyIvPgo8L3N2Zz4=',
        physicalRepeatM: 0.4,
        defaultTileScale: 0.3
      },
      {
        id: 'wood-1',
        name: 'Wood Decking',
        category: 'placeholder',
        albedoURL: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjOEQ2QjM5Ii8+CjxyZWN0IHg9IjAiIHk9IjAiIHdpZHRoPSI2NCIgaGVpZ2h0PSI4IiBmaWxsPSIjN0M1QjI5Ii8+CjxyZWN0IHg9IjAiIHk9IjE2IiB3aWR0aD0iNjQiIGhlaWdodD0iOCIgZmlsbD0iIzdDNUIyOSIvPgo8cmVjdCB4PSIwIiB5PSIzMiIgd2lkdGg9IjY0IiBoZWlnaHQ9IjgiIGZpbGw9IiM3QzVCMjkiLz4KPHJlY3QgeD0iMCIgeT0iNDgiIHdpZHRoPSI2NCIgaGVpZ2h0PSI4IiBmaWxsPSIjN0M1QjI5Ii8+CjxsaW5lIHgxPSIwIiB5MT0iMCIgeDI9IjY0IiB5Mj0iMCIgc3Ryb2tlPSIjNjQ0NjM0IiBzdHJva2Utd2lkdGg9IjEiLz4KPGxpbmUgeDE9IjAiIHkxPSIxNiIgeDI9IjY0IiB5Mj0iMTYiIHN0cm9rZT0iIzY0NDYzNCIgc3Ryb2tlLXdpZHRoPSIxIi8+CjxsaW5lIHgxPSIwIiB5MT0iMzIiIHgyPSI2NCIgeTI9IjMyIiBzdHJva2U9IiM2NDQ2MzQiIHN0cm9rZS13aWR0aD0iMSIvPgo8bGluZSB4MT0iMCIgeTE9IjQ4IiB4Mj0iNjQiIHkyPSI0OCIgc3Ryb2tlPSIjNjQ0NjM0IiBzdHJva2Utd2lkdGg9IjEiLz4KPC9zdmc+',
        physicalRepeatM: 0.2,
        defaultTileScale: 0.4
      }
    ];
  }

  async getPattern(materialId: string, tileScale: number): Promise<CanvasPattern | null> {
    const cacheKey = `${materialId}@${tileScale}`;
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached?.status === 'ready' && cached.pattern) {
      return cached.pattern;
    }
    
    if (cached?.status === 'pending') {
      // Return existing loading promise
      const promise = this.loadingPromises.get(cacheKey);
      if (promise) {
        const result = await promise;
        return result.pattern || null;
      }
    }

    // Start loading
    const loadingPromise = this.loadPattern(materialId, tileScale);
    this.loadingPromises.set(cacheKey, loadingPromise);
    
    const result = await loadingPromise;
    this.cache.set(cacheKey, result);
    this.loadingPromises.delete(cacheKey);
    
    return result.pattern || null;
  }

  private async loadPattern(materialId: string, tileScale: number): Promise<MaterialCacheEntry> {
    const material = this.materials.find(m => m.id === materialId);
    if (!material) {
      return {
        status: 'error',
        error: `Material ${materialId} not found`
      };
    }

    try {
      const image = await this.loadImage(material.albedoURL);
      const pattern = this.createPattern(image, tileScale, material);
      
      return {
        status: 'ready',
        image,
        pattern
      };
    } catch (error) {
      console.warn(`Failed to load material ${materialId}:`, error);
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      
      img.src = url;
    });
  }

  private createPattern(image: HTMLImageElement, tileScale: number, material: MaterialLibraryEntry): CanvasPattern | null {
    // Calculate tile size in pixels
    const physicalRepeatM = material.physicalRepeatM || MATERIAL_LIBRARY_CONFIG.defaultPhysicalRepeatM;
    const ppm = MATERIAL_LIBRARY_CONFIG.heuristicPPM; // Use heuristic for now
    const tileSizePx = (ppm * physicalRepeatM) / tileScale;
    
    // Create scaled pattern
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return null;

    tempCanvas.width = tileSizePx;
    tempCanvas.height = tileSizePx;
    
    tempCtx.drawImage(image, 0, 0, tileSizePx, tileSizePx);
    
    return tempCtx.createPattern(tempCanvas, 'repeat');
  }

  searchMaterials(query: string, category?: string): MaterialSearchResult {
    let filtered = this.materials;

    if (query) {
      const lowerQuery = query.toLowerCase();
      filtered = filtered.filter(material => 
        material.name.toLowerCase().includes(lowerQuery) ||
        material.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
      );
    }

    if (category) {
      filtered = filtered.filter(material => material.category === category);
    }

    return {
      materials: filtered,
      total: filtered.length
    };
  }

  getMaterialById(id: string): MaterialLibraryEntry | undefined {
    return this.materials.find(m => m.id === id);
  }

  getCacheStats() {
    return this.cache.getStats();
  }

  clearCache() {
    this.cache.clear();
    this.loadingPromises.clear();
  }
}

// Singleton instance
export const materialLibrary = new MaterialLibraryAdapter();
