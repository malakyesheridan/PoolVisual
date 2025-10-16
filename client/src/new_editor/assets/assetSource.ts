// Asset Source Adapter - Pluggable asset loading system
// Supports Local JSON, CDN, and API sources with fallback chain

import { AssetManifest, AssetSourceItem, AssetSourceInfo } from './types';

export class AssetSource {
  private sourceInfo: AssetSourceInfo = { type: 'LOCAL' };
  private manifest: AssetManifest | null = null;
  private items: AssetSourceItem[] = [];

  constructor() {
    // Don't load manifest in constructor - let AssetLibrary handle it
    this.setFallbackManifest();
  }

  async loadManifest(): Promise<void> {
    // Try API first (if enabled)
    if (import.meta.env.VITE_PV_ASSET_API === 'true') {
      try {
        await this.loadFromAPI();
        return;
      } catch (error) {
        console.warn('API asset source failed, falling back to CDN:', error);
      }
    }

    // Try CDN (if configured)
    if (import.meta.env.VITE_PV_ASSET_CDN_URL) {
      try {
        await this.loadFromCDN();
        return;
      } catch (error) {
        console.warn('CDN asset source failed, falling back to local:', error);
      }
    }

    // Fallback to local JSON
    try {
      await this.loadFromLocal();
    } catch (error) {
      console.error('All asset sources failed:', error);
      this.sourceInfo = { type: 'LOCAL', error: 'Failed to load asset manifest' };
      this.setFallbackManifest();
    }
  }

  private async loadFromAPI(): Promise<void> {
    const response = await fetch('/api/assets');
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }
    
    const manifest = await response.json() as AssetManifest;
    this.validateManifest(manifest);
    
    this.manifest = manifest;
    this.items = manifest.items;
    this.sourceInfo = { type: 'API', url: '/api/assets' };
  }

  private async loadFromCDN(): Promise<void> {
    const cdnUrl = import.meta.env.VITE_PV_ASSET_CDN_URL;
    const response = await fetch(`${cdnUrl}/asset-index.json`);
    if (!response.ok) {
      throw new Error(`CDN returned ${response.status}`);
    }
    
    const manifest = await response.json() as AssetManifest;
    this.validateManifest(manifest);
    
    this.manifest = manifest;
    this.items = manifest.items;
    this.sourceInfo = { type: 'CDN', url: cdnUrl };
  }

  private async loadFromLocal(): Promise<void> {
    console.log('Loading from local manifest...');
    const response = await fetch('/assets/asset-index.json');
    if (!response.ok) {
      throw new Error(`Local manifest returned ${response.status}`);
    }
    
    const manifest = await response.json() as AssetManifest;
    console.log('Loaded manifest:', manifest);
    this.validateManifest(manifest);
    
    this.manifest = manifest;
    this.items = manifest.items;
    this.sourceInfo = { type: 'LOCAL', url: '/assets/asset-index.json' };
    console.log('Asset source loaded:', this.items.length, 'items');
  }

  private validateManifest(manifest: any): void {
    if (!manifest.version || !manifest.items || !Array.isArray(manifest.items)) {
      throw new Error('Invalid manifest format');
    }

    for (const item of manifest.items) {
      if (!item.id || !item.name || !item.category || !item.src || !item.thumb) {
        throw new Error(`Invalid asset item: ${item.id || 'unknown'}`);
      }
    }
  }

  private setFallbackManifest(): void {
    // Provide a minimal fallback manifest for development
    this.manifest = {
      version: 1,
      updatedAt: new Date().toISOString(),
      categories: ['tree', 'lawn', 'decking', 'paver', 'furniture', 'lighting', 'misc'],
      items: [
        {
          id: 'tree_palm_01',
          name: 'Palm Tree',
          category: 'tree',
          thumb: '/assets/thumbs/tree_palm_01.png',
          src: '/assets/full/tree_palm_01.png',
          w: 400,
          h: 600,
          author: 'PV',
          license: 'owned',
          tags: ['tree', 'palm', 'tropical']
        },
        {
          id: 'furniture_chair_01',
          name: 'Pool Chair',
          category: 'furniture',
          thumb: '/assets/thumbs/furniture_chair_01.png',
          src: '/assets/full/furniture_chair_01.png',
          w: 200,
          h: 300,
          author: 'PV',
          license: 'owned',
          tags: ['furniture', 'chair', 'pool']
        }
      ]
    };
    this.items = this.manifest.items;
  }

  // Public API
  getItems(): AssetSourceItem[] {
    return [...this.items];
  }

  getItemById(id: string): AssetSourceItem | undefined {
    return this.items.find(item => item.id === id);
  }

  getItemsByCategory(category: string): AssetSourceItem[] {
    return this.items.filter(item => item.category === category);
  }

  searchItems(query: string): AssetSourceItem[] {
    if (!query.trim()) return this.items;
    
    const lowerQuery = query.toLowerCase();
    return this.items.filter(item => 
      item.name.toLowerCase().includes(lowerQuery) ||
      item.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  getCategories(): string[] {
    return this.manifest?.categories || [];
  }

  getSourceInfo(): AssetSourceInfo {
    return { ...this.sourceInfo };
  }

  addItem(item: AssetSourceItem): void {
    this.items.push(item);
  }

  getManifest(): AssetManifest | null {
    return this.manifest;
  }

  // Cache management
  getCacheKey(item: AssetSourceItem): string {
    return `${item.src}?${item.cacheKey || ''}`;
  }

  getThumbCacheKey(item: AssetSourceItem): string {
    return `${item.thumb}?${item.cacheKey || ''}`;
  }
}

// Singleton instance
export const assetSource = new AssetSource();
