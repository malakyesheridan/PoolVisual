// Unified Asset Store
// Manages assets that can be used in both Library and Canvas
// Syncs between Library management and Canvas usage

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { AssetMaterial } from '../new_editor/assets/assetMaterialAdapter';

export interface UnifiedAsset {
  id: string;
  name: string;
  category: 'Trees' | 'Furniture' | 'Lighting' | 'Water Features' | 'Plants' | 'Custom';
  type: 'texture' | 'model' | 'pattern' | 'image';
  description?: string;
  
  // Visual properties
  thumbnailUrl: string;
  textureUrl: string;
  dimensions: {
    width: number;
    height: number;
  };
  
  // Business properties
  price?: number;
  cost?: number;
  sku?: string;
  supplier?: string;
  color?: string;
  finish?: string;
  
  // Physical properties
  physicalRepeatM?: number;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  tags: string[];
  
  // Usage tracking
  usageCount: number;
  lastUsed?: string;
}

interface UnifiedAssetState {
  // Assets data
  assets: Record<string, UnifiedAsset>;
  assetOrder: string[]; // For sorting/filtering
  
  // UI state
  selectedAssetId: string | null;
  searchQuery: string;
  categoryFilter: string;
  
  // Loading state
  loading: boolean;
  error: string | null;
  
  // Actions
  loadAssets: () => Promise<void>;
  addAsset: (asset: Omit<UnifiedAsset, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>) => string;
  updateAsset: (id: string, updates: Partial<UnifiedAsset>) => void;
  deleteAsset: (id: string) => void;
  duplicateAsset: (id: string) => string;
  
  // Selection
  selectAsset: (id: string | null) => void;
  
  // Filtering
  setSearchQuery: (query: string) => void;
  setCategoryFilter: (category: string) => void;
  
  // Usage tracking
  recordUsage: (id: string) => void;
  
  // Conversion to material format (for Canvas compatibility)
  getAssetAsMaterial: (id: string) => AssetMaterial | null;
  getAllAssetsAsMaterials: () => AssetMaterial[];
}

// Generate unique ID
function generateAssetId(): string {
  return `asset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Convert UnifiedAsset to AssetMaterial format
function assetToMaterial(asset: UnifiedAsset): AssetMaterial {
  return {
    id: `material_${asset.id}`,
    name: asset.name,
    category: 'coping', // Default category for materials
    unit: 'each',
    price: asset.price || null,
    cost: asset.cost || null,
    texture_url: asset.textureUrl,
    thumbnail_url: asset.thumbnailUrl,
    physical_repeat_m: asset.physicalRepeatM || null,
    sheet_width_mm: null,
    sheet_height_mm: null,
    tile_width_mm: null,
    tile_height_mm: null,
    created_at: asset.createdAt,
    sku: asset.sku || null,
    supplier: asset.supplier || null,
    color: asset.color || null,
    finish: asset.finish || null,
    
    // Computed properties
    albedoURL: asset.textureUrl,
    thumbnailURL: asset.thumbnailUrl,
    physicalRepeatM: asset.physicalRepeatM || undefined,
    defaultTileScale: 1.0,
    
    // Asset-specific properties
    assetId: asset.id,
    assetName: asset.name,
    assetCategory: asset.category,
    assetDimensions: asset.dimensions
  };
}

export const useUnifiedAssetStore = create<UnifiedAssetState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    assets: {},
    assetOrder: [],
    selectedAssetId: null,
    searchQuery: '',
    categoryFilter: 'All',
    loading: false,
    error: null,

    // Load assets from various sources
    loadAssets: async () => {
      set({ loading: true, error: null });
      
      try {
        // Load from localStorage first
        const storedAssets = localStorage.getItem('poolvisual_assets');
        let assets: Record<string, UnifiedAsset> = {};
        
        if (storedAssets) {
          assets = JSON.parse(storedAssets);
        } else {
          // Initialize with default assets
          assets = getDefaultAssets();
        }
        
        const assetOrder = Object.keys(assets).sort((a, b) => 
          assets[b].updatedAt.localeCompare(assets[a].updatedAt)
        );
        
        set({ 
          assets, 
          assetOrder, 
          loading: false 
        });
        
        console.log('[UnifiedAssetStore] Loaded assets:', Object.keys(assets).length);
        
      } catch (error) {
        console.error('[UnifiedAssetStore] Failed to load assets:', error);
        set({ 
          error: error instanceof Error ? error.message : 'Failed to load assets',
          loading: false 
        });
      }
    },

    // Add new asset
    addAsset: (assetData) => {
      const id = generateAssetId();
      const now = new Date().toISOString();
      
      const newAsset: UnifiedAsset = {
        ...assetData,
        id,
        createdAt: now,
        updatedAt: now,
        usageCount: 0,
        tags: assetData.tags || []
      };
      
      set((state) => {
        const newAssets = { ...state.assets, [id]: newAsset };
        const newOrder = [id, ...state.assetOrder];
        
        // Persist to localStorage
        localStorage.setItem('poolvisual_assets', JSON.stringify(newAssets));
        
        return {
          assets: newAssets,
          assetOrder: newOrder
        };
      });
      
      console.log('[UnifiedAssetStore] Added asset:', id, newAsset.name);
      return id;
    },

    // Update existing asset
    updateAsset: (id, updates) => {
      set((state) => {
        const asset = state.assets[id];
        if (!asset) return state;
        
        const updatedAsset = {
          ...asset,
          ...updates,
          id, // Ensure ID doesn't change
          updatedAt: new Date().toISOString()
        };
        
        const newAssets = { ...state.assets, [id]: updatedAsset };
        
        // Persist to localStorage
        localStorage.setItem('poolvisual_assets', JSON.stringify(newAssets));
        
        return { assets: newAssets };
      });
      
      console.log('[UnifiedAssetStore] Updated asset:', id);
    },

    // Delete asset
    deleteAsset: (id) => {
      set((state) => {
        const { [id]: deleted, ...remainingAssets } = state.assets;
        const newOrder = state.assetOrder.filter(assetId => assetId !== id);
        
        // Persist to localStorage
        localStorage.setItem('poolvisual_assets', JSON.stringify(remainingAssets));
        
        return {
          assets: remainingAssets,
          assetOrder: newOrder,
          selectedAssetId: state.selectedAssetId === id ? null : state.selectedAssetId
        };
      });
      
      console.log('[UnifiedAssetStore] Deleted asset:', id);
    },

    // Duplicate asset
    duplicateAsset: (id) => {
      const state = get();
      const originalAsset = state.assets[id];
      if (!originalAsset) return '';
      
      const duplicatedData = {
        ...originalAsset,
        name: `${originalAsset.name} (Copy)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        usageCount: 0
      };
      
      return get().addAsset(duplicatedData);
    },

    // Selection
    selectAsset: (id) => {
      set({ selectedAssetId: id });
    },

    // Filtering
    setSearchQuery: (query) => {
      set({ searchQuery: query });
    },

    setCategoryFilter: (category) => {
      set({ categoryFilter: category });
    },

    // Usage tracking
    recordUsage: (id) => {
      set((state) => {
        const asset = state.assets[id];
        if (!asset) return state;
        
        const updatedAsset = {
          ...asset,
          usageCount: asset.usageCount + 1,
          lastUsed: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        const newAssets = { ...state.assets, [id]: updatedAsset };
        
        // Persist to localStorage
        localStorage.setItem('poolvisual_assets', JSON.stringify(newAssets));
        
        return { assets: newAssets };
      });
    },

    // Conversion to material format
    getAssetAsMaterial: (id) => {
      const state = get();
      const asset = state.assets[id];
      return asset ? assetToMaterial(asset) : null;
    },

    getAllAssetsAsMaterials: () => {
      const state = get();
      return Object.values(state.assets).map(assetToMaterial);
    }
  }))
);

// Default assets to initialize the store
function getDefaultAssets(): Record<string, UnifiedAsset> {
  const now = new Date().toISOString();
  
  return {
    'tree_palm_01': {
      id: 'tree_palm_01',
      name: 'Palm Tree',
      category: 'Trees',
      type: 'image',
      description: 'Realistic palm tree for pool landscaping',
      thumbnailUrl: '/assets/images/tree_palm_01_thumb.jpg',
      textureUrl: '/assets/images/tree_palm_01.jpg',
      dimensions: { width: 400, height: 600 },
      price: 150.00,
      cost: 120.00,
      sku: 'TREE-PALM-01',
      supplier: 'Landscape Supply Co.',
      color: 'Green',
      finish: 'Natural',
      physicalRepeatM: 0.4,
      createdAt: now,
      updatedAt: now,
      tags: ['tree', 'palm', 'landscaping', 'pool'],
      usageCount: 0
    },
    'tree_oak_01': {
      id: 'tree_oak_01',
      name: 'Oak Tree',
      category: 'Trees',
      type: 'image',
      description: 'Mature oak tree for pool area',
      thumbnailUrl: '/assets/images/tree_oak_01_thumb.jpg',
      textureUrl: '/assets/images/tree_oak_01.jpg',
      dimensions: { width: 500, height: 700 },
      price: 200.00,
      cost: 160.00,
      sku: 'TREE-OAK-01',
      supplier: 'Landscape Supply Co.',
      color: 'Green/Brown',
      finish: 'Natural',
      physicalRepeatM: 0.5,
      createdAt: now,
      updatedAt: now,
      tags: ['tree', 'oak', 'landscaping', 'pool'],
      usageCount: 0
    },
    'furniture_chair_01': {
      id: 'furniture_chair_01',
      name: 'Pool Chair',
      category: 'Furniture',
      type: 'image',
      description: 'White pool chair with weather-resistant finish',
      thumbnailUrl: '/assets/images/furniture_chair_01_thumb.jpg',
      textureUrl: '/assets/images/furniture_chair_01.jpg',
      dimensions: { width: 200, height: 300 },
      price: 250.00,
      cost: 200.00,
      sku: 'FURN-CHAIR-01',
      supplier: 'Pool Furniture Co.',
      color: 'White',
      finish: 'Weather Resistant',
      physicalRepeatM: 0.2,
      createdAt: now,
      updatedAt: now,
      tags: ['furniture', 'chair', 'pool', 'outdoor'],
      usageCount: 0
    },
    'furniture_table_01': {
      id: 'furniture_table_01',
      name: 'Pool Table',
      category: 'Furniture',
      type: 'image',
      description: 'White pool table with umbrella hole',
      thumbnailUrl: '/assets/images/furniture_table_01_thumb.jpg',
      textureUrl: '/assets/images/furniture_table_01.jpg',
      dimensions: { width: 300, height: 200 },
      price: 400.00,
      cost: 320.00,
      sku: 'FURN-TABLE-01',
      supplier: 'Pool Furniture Co.',
      color: 'White',
      finish: 'Weather Resistant',
      physicalRepeatM: 0.3,
      createdAt: now,
      updatedAt: now,
      tags: ['furniture', 'table', 'pool', 'outdoor'],
      usageCount: 0
    }
  };
}

// Computed selectors
export const useAssetSelectors = () => {
  const store = useUnifiedAssetStore();
  
  const filteredAssets = Object.values(store.assets).filter(asset => {
    const matchesSearch = store.searchQuery === '' || 
      asset.name.toLowerCase().includes(store.searchQuery.toLowerCase()) ||
      asset.description?.toLowerCase().includes(store.searchQuery.toLowerCase()) ||
      asset.tags.some(tag => tag.toLowerCase().includes(store.searchQuery.toLowerCase()));
    
    const matchesCategory = store.categoryFilter === 'All' || asset.category === store.categoryFilter;
    
    return matchesSearch && matchesCategory;
  });
  
  const categories = ['All', ...new Set(Object.values(store.assets).map(asset => asset.category))];
  
  return {
    filteredAssets,
    categories,
    selectedAsset: store.selectedAssetId ? store.assets[store.selectedAssetId] : null
  };
};
