// Import event bus for cache invalidation
import { materialsEventBus } from '../lib/materialsEventBus';

// Unified Material interface that works for both Materials Library page and Canvas Editor
export interface Material {
  id: string;
  name: string;
  category: 'coping' | 'waterline_tile' | 'interior' | 'paving' | 'fencing';
  unit: 'm2' | 'lm' | 'each';
  price?: number | null;
  cost?: number | null;
  texture_url?: string | null;        // Main texture for Canvas Editor (maps to albedoURL)
  thumbnail_url?: string | null;      // Thumbnail for Materials Library (maps to thumbnailURL)
  physical_repeat_m?: number | null;  // Physical repeat in meters
  sheet_width_mm?: number | null;
  sheet_height_mm?: number | null;
  tile_width_mm?: number | null;
  tile_height_mm?: number | null;
  created_at?: string;
  sku?: string | null;
  supplier?: string | null;
  color?: string | null;
  finish?: string | null;
  
  // Computed properties for Canvas Editor compatibility
  albedoURL?: string;     // Computed from texture_url
  thumbnailURL?: string;  // Computed from thumbnail_url
  physicalRepeatM?: number; // Computed from physical_repeat_m
  defaultTileScale?: number; // Default to 1.0
}

let loaded = false;
let byId: Record<string, Material> = {};
let sourceInfo: { type: 'API' | 'JSON' | 'ERROR'; url?: string; error?: string } = { type: 'JSON' };

// Listen for materials changes to invalidate cache
materialsEventBus.subscribe((event) => {
  console.log('[MaterialsSync] registry refresh', event);
  loaded = false; // Force reload on next ensureLoaded() call
  
  // If materials were deleted, clear them from masks
  if (event.reason === 'delete') {
    // Import mask store to clear deleted materials
    import('../maskcore/store').then(({ useMaskStore }) => {
      const { masks, SET_MATERIAL } = useMaskStore.getState();
      event.ids.forEach(deletedId => {
        Object.entries(masks).forEach(([maskId, mask]) => {
          if (mask.materialId === deletedId) {
            SET_MATERIAL(maskId, null);
            console.log('[MaterialsSync] cleared deleted material from mask', { maskId, deletedMaterialId: deletedId });
          }
        });
      });
    });
  }
  
  // Force cache bust for all material images
  if (event.reason === 'create' || event.reason === 'update') {
    const versionToken = Date.now();
    console.log('[MaterialsSync] cache bust', { reason: event.reason, versionToken });
  }
});

export async function ensureLoaded() {
  if (loaded) return;
  
  try {
    // Try API first (same as Materials Library page)
    const apiMaterials = await loadFromAPI();
    if (apiMaterials.length > 0) {
      byId = apiMaterials.reduce((acc, m) => {
        acc[m.id] = computeMaterialProperties(m);
        return acc;
      }, {} as Record<string, Material>);
      sourceInfo = { type: 'API', url: '/api/v2/materials' };
      loaded = true;
      console.log('[MaterialsLoaded]', { 
        count: Object.keys(byId).length, 
        sample: Object.keys(byId).slice(0,3).map(id => byId[id].id),
        source: 'API'
      });
      return;
    }
  } catch (apiError) {
    console.warn('[MaterialsLoadError] API failed:', apiError);
  }

  try {
    // Fallback to JSON (same as current Canvas Editor)
    const jsonMaterials = await loadFromJSON();
    byId = jsonMaterials.reduce((acc, m) => {
      acc[m.id] = computeMaterialProperties(m);
      return acc;
    }, {} as Record<string, Material>);
    sourceInfo = { type: 'JSON', url: '/materials/materials.json' };
    loaded = true;
    console.log('[MaterialsLoaded]', { 
      count: Object.keys(byId).length, 
      sample: Object.keys(byId).slice(0,3).map(id => byId[id].id),
      source: 'JSON'
    });
  } catch (jsonError) {
    console.warn('[MaterialsLoadError] JSON failed:', jsonError);
    sourceInfo = { type: 'ERROR', error: jsonError instanceof Error ? jsonError.message : 'Unknown error' };
  }
}

async function loadFromAPI(): Promise<any[]> {
  // Try v2 endpoint first (same as Materials Library page)
  try {
    const response = await fetch('/api/v2/materials', { credentials: 'include' });
    if (!response.ok) throw new Error(`API v2 failed: ${response.status}`);
    const data = await response.json();
    return data.items || [];
  } catch {
    // Fallback to v1 endpoint
    try {
      const response = await fetch('/api/materials', { credentials: 'include' });
      if (!response.ok) throw new Error(`API v1 failed: ${response.status}`);
      const data = await response.json();
      return Array.isArray(data) ? data : data.items || [];
    } catch {
      throw new Error('Both API endpoints failed');
    }
  }
}

async function loadFromJSON(): Promise<any[]> {
  const response = await fetch('/materials/materials.json', { cache: 'no-store' });
  if (!response.ok) throw new Error(`JSON request failed: ${response.status}`);
  const data = await response.json();
  return Array.isArray(data) ? data : data.materials || [];
}

function computeMaterialProperties(m: any): Material {
  return {
    ...m,
    // Ensure required fields
    id: m.id,
    name: m.name || m.id,
    category: m.category || 'interior',
    unit: m.unit || 'm2',
    
    // Compute Canvas Editor compatibility fields
    // Map from API field names (textureUrl/thumbnailUrl) to UI field names (albedoURL/thumbnailURL)
    albedoURL: m.textureUrl || m.texture_url || m.albedoURL || '',
    thumbnailURL: m.thumbnailUrl || m.thumbnail_url || m.thumbnailURL || '',
    physicalRepeatM: m.physicalRepeatM || m.physical_repeat_m || 0.3,
    defaultTileScale: m.defaultTileScale || 1.0,
  };
}

export function getAll() { return byId; }
export function getById(id: string | null | undefined): Material | null { 
  return id && byId[id] ? byId[id] : null; 
}
export function getTextureUrl(id: string | null | undefined): string | null { 
  return getById(id)?.albedoURL ?? null; 
}
export function getSourceInfo() { return sourceInfo; }
export function clearCache() { 
  loaded = false; 
  byId = {}; 
  sourceInfo = { type: 'JSON' };
}
