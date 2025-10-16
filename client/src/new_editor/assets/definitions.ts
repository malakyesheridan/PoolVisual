import type { AssetDef } from './store';

// Static asset definitions - bundled with the app
export const ASSET_DEFINITIONS: AssetDef[] = [
  // Trees
  {
    id: 'tree_palm_01',
    name: 'Palm Tree',
    category: 'trees',
    url: '/assets/trees/palm_01.svg',
    thumbnail: '/assets/trees/palm_01_thumb.svg',
    defaultScale: 0.8,
  },
  {
    id: 'tree_oak_01',
    name: 'Oak Tree',
    category: 'trees',
    url: '/assets/trees/oak_01.svg',
    thumbnail: '/assets/trees/oak_01.svg',
    defaultScale: 1.0,
  },

  // Plants
  {
    id: 'plant_fern_01',
    name: 'Fern',
    category: 'plants',
    url: '/assets/plants/fern_01.svg',
    thumbnail: '/assets/plants/fern_01.svg',
    defaultScale: 0.6,
  },

  // Furniture
  {
    id: 'furniture_chair_01',
    name: 'Pool Chair',
    category: 'furniture',
    url: '/assets/furniture/chair_01.svg',
    thumbnail: '/assets/furniture/chair_01.svg',
    defaultScale: 0.4,
  },
];

// Group definitions by category
export const ASSET_CATEGORIES = [
  { id: 'all', name: 'All Assets' },
  { id: 'tree', name: 'Trees' },
  { id: 'lawn', name: 'Lawn & Grass' },
  { id: 'decking', name: 'Decking' },
  { id: 'paver', name: 'Pavers & Stones' },
  { id: 'furniture', name: 'Furniture' },
  { id: 'lighting', name: 'Lighting' },
  { id: 'misc', name: 'Miscellaneous' },
  { id: 'custom', name: 'Custom' },
];

// Get definitions by category
export function getAssetDefsByCategory(category: string): AssetDef[] {
  if (category === 'all') return ASSET_DEFINITIONS;
  return ASSET_DEFINITIONS.filter(def => def.category === category);
}

// Get definition by ID
export function getAssetDefById(id: string): AssetDef | undefined {
  return ASSET_DEFINITIONS.find(def => def.id === id);
}
