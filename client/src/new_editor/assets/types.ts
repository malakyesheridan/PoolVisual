// Asset Library Data Model
// Based on Asset Library v1 (Production-ready) specification

export type AssetId = string;

export type Blend = 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten';

export type AssetCategory = 'tree' | 'lawn' | 'decking' | 'paver' | 'furniture' | 'lighting' | 'misc';

export interface AssetDecal {
  id: AssetId;
  kind: 'decal';
  sourceId: string;     // id from AssetSource
  name?: string;
  category: AssetCategory;
  natW: number;         // natural pixels of FULL asset
  natH: number;
  x: number;            // image px (center of asset box)
  y: number;
  scale: number;        // uniform, 1 = natural
  rotation: number;      // degrees, pivot=center
  skewX?: number;       // optional perspective cheat
  opacity: number;       // 0..1
  blend: Blend;          // default 'normal'
  z: number;            // draw order
  locked?: boolean;
  hidden?: boolean;
}

export type Asset = AssetDecal;

export interface AssetState {
  assets: Record<AssetId, Asset>;
  order: AssetId[];                 // z-order (top = last)
  selected: AssetId[];              // single-select MVP okay
}

// Asset Source Types
export interface AssetManifest {
  version: number;
  updatedAt: string;
  categories: AssetCategory[];
  items: AssetSourceItem[];
}

export interface AssetSourceItem {
  id: string;
  name: string;
  category: AssetCategory;
  thumb: string;
  src: string;
  w: number;                        // NATURAL pixels
  h: number;
  author: string;
  license: string;
  cacheKey?: string;                // for cache busting
  tags?: string[];                  // for search
}

export interface AssetSourceInfo {
  type: 'LOCAL' | 'CDN' | 'API';
  url?: string;
  error?: string;
}

// Image Cache Types
export interface ImageCacheEntry {
  img: HTMLImageElement;
  w: number;
  h: number;
  status: 'loading' | 'ready' | 'error';
}

// Transform and Interaction Types
export interface SnapTarget {
  type: 'grid' | 'asset-center' | 'asset-edge';
  x: number;
  y: number;
  threshold: number;
}

export interface TransformHandle {
  type: 'resize-corner' | 'resize-side' | 'rotate' | 'move';
  x: number;
  y: number;
  width: number;
  height: number;
}

// Export Types
export interface AssetExportOptions {
  includeHidden: boolean;
  includeLocked: boolean;
  maxTimeoutMs: number;
  fallbackToThumb: boolean;
}
