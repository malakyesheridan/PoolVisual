// Material Library Adapter - Real Material Sources Integration
import { PV_MATERIAL_LIBRARY_ENABLED, MATERIAL_LIBRARY_CONFIG } from './featureFlags';

// Standardized Material DTO (Data Transfer Object)
export type MaterialDTO = {
  id: string;
  name: string;
  category?: string;
  thumbnailURL: string;   // small preview
  albedoURL: string;      // main tiling image
  physicalRepeatM?: number; // meters per tile (defaults to 0.3)
  defaultTileScale?: number; // UI multiplier (defaults to 1.0)
  updatedAt?: string;     // ISO for cache bust
  // NEW: Cost information for calibration and quoting
  costPerSquareMeter?: number; // Primary cost field in USD
  costPerSquareFoot?: number;  // Alternative unit in USD
  currency?: string;           // Default: 'USD'
  costLastUpdated?: string;    // Cost update timestamp (ISO)
};

// API Material Response (from server)
interface APIMaterial {
  id: string;
  name: string;
  category: 'coping' | 'waterline_tile' | 'interior' | 'paving' | 'fencing';
  textureUrl?: string | null;
  thumbnailUrl?: string | null;
  physicalRepeatM?: string | null; // stored as string in DB
  createdAt: string;
  sku?: string | null;
  supplier?: string | null;
  color?: string | null;
  finish?: string | null;
  // NEW: Cost fields from API
  costPerSquareMeter?: string | null; // stored as string in DB
  costPerSquareFoot?: string | null;  // stored as string in DB
  currency?: string | null;
  costLastUpdated?: string | null;
}

// Material Cache Entry
interface MaterialCacheEntry {
  status: 'pending' | 'ready' | 'error';
  image?: HTMLImageElement;
  pattern?: CanvasPattern;
  error?: string;
  updatedAt?: string;
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
      this.moveToEnd(key);
    }
    return entry;
  }

  set(key: string, entry: MaterialCacheEntry): void {
    if (this.cache.has(key)) {
      this.removeFromOrder(key);
    }

    this.cache.set(key, entry);
    this.accessOrder.push(key);

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
      if (lruKey) {
        this.cache.delete(lruKey);
        this.accessOrder.shift();
      }
    }
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  getStats(): { total: number; ready: number; pending: number; error: number } {
    let ready = 0, pending = 0, error = 0;
    for (const entry of Array.from(this.cache.values())) {
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
  private materials: MaterialDTO[] = [];
  private loadingPromises = new Map<string, Promise<MaterialCacheEntry>>();
  private sourceInfo: { type: 'API' | 'JSON' | 'DEV'; url?: string; error?: string } = { type: 'API' };

  async loadMaterials(): Promise<MaterialDTO[]> {
    if (!PV_MATERIAL_LIBRARY_ENABLED) {
      return this.getPlaceholderMaterials();
    }

    try {
      // Try API first
      const apiMaterials = await this.loadFromAPI();
      this.materials = apiMaterials;
      this.sourceInfo = { type: 'API', url: '/api/v2/materials' };
      return apiMaterials;
    } catch (error) {
      console.warn('Failed to load materials from API:', error);
      
      // Fallback to local JSON
      try {
        const localMaterials = await this.loadFromLocalJSON();
        this.materials = localMaterials;
        this.sourceInfo = { type: 'JSON', url: '/materials/materials.json' };
        return localMaterials;
      } catch (localError) {
        console.warn('Failed to load materials from local JSON:', localError);
        this.materials = [];
        this.sourceInfo = { type: 'JSON', url: '/materials/materials.json', error: localError instanceof Error ? localError.message : 'Unknown error' };
        return [];
      }
    }
  }

  private async loadFromAPI(): Promise<MaterialDTO[]> {
    try {
      // Use the v2 materials endpoint which doesn't require authentication or orgId
      const response = await fetch('/api/v2/materials', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      // The v2 endpoint returns { items: Material[] }
      const apiMaterials: APIMaterial[] = data.items || [];
      
      if (!Array.isArray(apiMaterials)) {
        throw new Error('API returned invalid data format');
      }
      
      return this.mapAPIMaterialsToDTO(apiMaterials);
    } catch (error) {
      console.warn('Failed to load materials from API:', error);
      throw error;
    }
  }


  private async loadFromLocalJSON(): Promise<MaterialDTO[]> {
    const response = await fetch('/materials/materials.json');
    if (!response.ok) {
      throw new Error(`Local JSON request failed: ${response.status}`);
    }
    
    const data = await response.json();
    const materials = data.materials || [];
    
    // PHASE 1: Materials - Check HTTP status for first 8 thumbnails
    if (import.meta.env.DEV) {
      console.log('PHASE 1: Materials loaded from JSON:', materials.length, 'materials');
      console.log('PHASE 1: First 8 material IDs:', materials.slice(0, 8).map((m: any) => m.id));
      
      // Check HTTP status for first 8 thumbnails
      for (let i = 0; i < Math.min(8, materials.length); i++) {
        const material = materials[i];
        try {
          const thumbResponse = await fetch(material.thumbnailURL, { method: 'HEAD' });
          console.log(`PHASE 1: Thumbnail ${i + 1} (${material.id}): HTTP ${thumbResponse.status}`);
        } catch (error) {
          console.log(`PHASE 1: Thumbnail ${i + 1} (${material.id}): HTTP 404 (not found)`);
        }
      }
    }
    
    return materials;
  }

  private mapAPIMaterialsToDTO(apiMaterials: APIMaterial[]): MaterialDTO[] {
    return apiMaterials.map(api => {
      const dto: MaterialDTO = {
        id: api.id,
        name: api.name,
        category: api.category,
        thumbnailURL: api.thumbnailUrl || this.generatePlaceholderThumbnail(api.category),
        albedoURL: api.textureUrl || this.generatePlaceholderTexture(api.category),
        physicalRepeatM: api.physicalRepeatM ? parseFloat(api.physicalRepeatM) : 0.3,
        defaultTileScale: 1.0,
        updatedAt: api.createdAt,
        currency: api.currency || 'USD'
      };
      
      // Add cost fields only if they exist
      if (api.costPerSquareMeter) {
        dto.costPerSquareMeter = parseFloat(api.costPerSquareMeter);
      }
      if (api.costPerSquareFoot) {
        dto.costPerSquareFoot = parseFloat(api.costPerSquareFoot);
      }
      if (api.costLastUpdated) {
        dto.costLastUpdated = api.costLastUpdated;
      }
      
      return dto;
    });
  }

  private generatePlaceholderThumbnail(category: string): string {
    const colors = {
      coping: '#8B4513',
      waterline_tile: '#4682B4',
      interior: '#F5DEB3',
      paving: '#696969',
      fencing: '#228B22'
    };
    const color = colors[category as keyof typeof colors] || '#E5E7EB';
    
    return `data:image/svg+xml;base64,${btoa(`
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="64" height="64" fill="${color}"/>
        <rect x="0" y="0" width="32" height="32" fill="${color}" opacity="0.7"/>
        <rect x="32" y="32" width="32" height="32" fill="${color}" opacity="0.7"/>
      </svg>
    `)}`;
  }

  private generatePlaceholderTexture(category: string): string {
    const colors = {
      coping: '#8B4513',
      waterline_tile: '#4682B4',
      interior: '#F5DEB3',
      paving: '#696969',
      fencing: '#228B22'
    };
    const color = colors[category as keyof typeof colors] || '#E5E7EB';
    
    return `data:image/svg+xml;base64,${btoa(`
      <svg width="256" height="256" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="256" height="256" fill="${color}"/>
        <rect x="0" y="0" width="128" height="128" fill="${color}" opacity="0.8"/>
        <rect x="128" y="128" width="128" height="128" fill="${color}" opacity="0.8"/>
        <rect x="128" y="0" width="128" height="128" fill="${color}" opacity="0.6"/>
        <rect x="0" y="128" width="128" height="128" fill="${color}" opacity="0.6"/>
      </svg>
    `)}`;
  }


  private getPlaceholderMaterials(): MaterialDTO[] {
    // A) MATERIALS - Revert to real library: Use real materials as fallback instead of empty array
    console.log('A) MATERIALS: Loading real materials as fallback');
    return this.getRealMaterialsFallback();
  }

  private getRealMaterialsFallback(): MaterialDTO[] {
    // Return empty array to prevent hardcoded fallback materials
    // Materials should come from the API/registry, not hardcoded examples
    return [];
  }

  async getPattern(materialId: string, tileScale: number, underwaterParams?: { enabled: boolean; blend: number; edgeSoftness: number; depthBias: number; tint: number; edgeFeather: number; highlights: number; ripple: number; materialOpacity: number; contactOcclusion: number; textureBoost: number }): Promise<CanvasPattern | null> {
    const material = this.materials.find(m => m.id === materialId);
    if (!material) {
      return null;
    }

    // Include updatedAt and underwater params in cache key for cache busting
    const underwaterKey = underwaterParams ? `@uw${underwaterParams.enabled ? '1' : '0'}${underwaterParams.blend}${underwaterParams.edgeSoftness}${underwaterParams.depthBias}${underwaterParams.tint}${underwaterParams.edgeFeather}${underwaterParams.highlights}${underwaterParams.ripple}${underwaterParams.materialOpacity}${underwaterParams.contactOcclusion}${underwaterParams.textureBoost}` : '';
    const cacheKey = `${materialId}@${tileScale}@${material.updatedAt || 'no-update'}${underwaterKey}`;
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached?.status === 'ready' && cached.pattern) {
      return cached.pattern;
    }
    
    if (cached?.status === 'pending') {
      const promise = this.loadingPromises.get(cacheKey);
      if (promise) {
        const result = await promise;
        return result.pattern || null;
      }
    }

    // Start loading
    const loadingPromise = this.loadPattern(materialId, tileScale, material);
    this.loadingPromises.set(cacheKey, loadingPromise);
    
    const result = await loadingPromise;
    this.cache.set(cacheKey, result);
    this.loadingPromises.delete(cacheKey);
    
    return result.pattern || null;
  }

  private async loadPattern(materialId: string, tileScale: number, material: MaterialDTO): Promise<MaterialCacheEntry> {
    try {
      const image = await this.loadImage(material.albedoURL);
      const pattern = this.createPattern(image, tileScale, material);
      
      if (!pattern) {
        throw new Error('Failed to create pattern');
      }
      
      return {
        status: 'ready',
        image,
        pattern,
        ...(material.updatedAt && { updatedAt: material.updatedAt })
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
      // Check if URL is external and use proxy preemptively to avoid CORS
      const isExternalUrl = (url: string): boolean => {
        try {
          const urlObj = new URL(url);
          const currentOrigin = window.location.origin;
          return urlObj.origin !== currentOrigin;
        } catch {
          return false;
        }
      };
      
      // Use proxy for external URLs to avoid CORS errors (same approach as texture-loader)
      const urlToLoad = isExternalUrl(url)
        ? `/api/texture?url=${encodeURIComponent(url)}`
        : url;
      
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${url} (via ${urlToLoad})`));
      
      img.src = urlToLoad;
    });
  }

  private createPattern(image: HTMLImageElement, tileScale: number, material: MaterialDTO): CanvasPattern | null {
    // Calculate tile size in pixels using calibrated PPM or heuristic
    const ppm = MATERIAL_LIBRARY_CONFIG.heuristicPPM; // Use heuristic until calibrated
    const physicalRepeatM = material.physicalRepeatM || MATERIAL_LIBRARY_CONFIG.defaultPhysicalRepeatM;
    const tileSizePx = (ppm * physicalRepeatM) / tileScale;
    
    // Create scaled pattern
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return null;

    tempCanvas.width = tileSizePx;
    tempCanvas.height = tileSizePx;
    
    tempCtx.drawImage(image, 0, 0, tileSizePx, tileSizePx);
    
    const pattern = tempCtx.createPattern(tempCanvas, 'repeat');
    if (!pattern) {
      throw new Error('Failed to create pattern');
    }
    return pattern;
  }

  searchMaterials(query: string, category?: string): { materials: MaterialDTO[]; total: number } {
    let filtered = this.materials;

    if (query) {
      const lowerQuery = query.toLowerCase();
      filtered = filtered.filter(material => 
        material.name.toLowerCase().includes(lowerQuery) ||
        material.category?.toLowerCase().includes(lowerQuery)
      );
    }

    if (category && category !== 'All Categories') {
      filtered = filtered.filter(material => material.category === category);
    }

    return {
      materials: filtered,
      total: filtered.length
    };
  }

  getMaterialById(id: string): MaterialDTO | undefined {
    return this.materials.find(m => m.id === id);
  }

  getCacheStats() {
    return this.cache.getStats();
  }

  clearCache() {
    this.cache.clear();
    this.loadingPromises.clear();
  }

  getSourceInfo() {
    return this.sourceInfo;
  }
}

// Singleton instance
export const materialLibraryAdapter = new MaterialLibraryAdapter();
