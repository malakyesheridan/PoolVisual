// Zustand Asset Store Slice
// Manages asset state with reducer-style actions and history

import { create } from 'zustand';
import { Asset, AssetId, AssetState, AssetSourceItem } from './types';
import { assetSource } from './assetSource';

interface AssetHistorySnapshot {
  assets: Record<AssetId, Asset>;
  order: AssetId[];
  timestamp: number;
}

interface AssetStore extends AssetState {
  // History management
  history: AssetHistorySnapshot[];
  historyIndex: number;
  maxHistorySize: number;
  
  // Actions
  addAsset: (sourceItem: AssetSourceItem, x: number, y: number) => AssetId;
  moveAsset: (id: AssetId, x: number, y: number) => void;
  transformAsset: (id: AssetId, updates: Partial<Asset>) => void;
  duplicateAsset: (id: AssetId) => AssetId;
  deleteAsset: (id: AssetId) => void;
  setAssetZ: (id: AssetId, z: number) => void;
  lockAsset: (id: AssetId, locked: boolean) => void;
  hideAsset: (id: AssetId, hidden: boolean) => void;
  
  // Selection
  selectAsset: (id: AssetId) => void;
  deselectAsset: (id: AssetId) => void;
  clearSelection: () => void;
  
  // History
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  
  // Utility
  getAsset: (id: AssetId) => Asset | undefined;
  getSelectedAsset: () => Asset | undefined;
  getAssetsInOrder: () => Asset[];
  getNextZ: () => number;
}

function generateAssetId(): AssetId {
  return `asset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function createAsset(sourceItem: AssetSourceItem, x: number, y: number): Asset {
  return {
    id: generateAssetId(),
    kind: 'decal',
    sourceId: sourceItem.id,
    name: sourceItem.name,
    category: sourceItem.category,
    natW: sourceItem.w,
    natH: sourceItem.h,
    x,
    y,
    scale: 1.0,
    rotation: 0,
    skewX: 0,
    opacity: 1.0,
    blend: 'normal',
    z: 0,
    locked: false,
    hidden: false
  };
}

export const useAssetStore = create<AssetStore>((set, get) => ({
  // Initial state
  assets: {},
  order: [],
  selected: [],
  history: [],
  historyIndex: -1,
  maxHistorySize: 50,

  // Asset management actions
  addAsset: (sourceItem: AssetSourceItem, x: number, y: number) => {
    const asset = createAsset(sourceItem, x, y);
    const nextZ = get().getNextZ();
    asset.z = nextZ;
    
    set((state) => ({
      assets: { ...state.assets, [asset.id]: asset },
      order: [...state.order, asset.id],
      selected: [asset.id] // Auto-select new asset
    }));
    
    get().pushHistory();
    return asset.id;
  },

  moveAsset: (id: AssetId, x: number, y: number) => {
    set((state) => {
      const asset = state.assets[id];
      if (!asset || asset.locked) return state;
      
      return {
        assets: {
          ...state.assets,
          [id]: { ...asset, x, y }
        }
      };
    });
  },

  transformAsset: (id: AssetId, updates: Partial<Asset>) => {
    set((state) => {
      const asset = state.assets[id];
      if (!asset || asset.locked) return state;
      
      return {
        assets: {
          ...state.assets,
          [id]: { ...asset, ...updates }
        }
      };
    });
  },

  duplicateAsset: (id: AssetId) => {
    const state = get();
    const originalAsset = state.assets[id];
    if (!originalAsset) return '';
    
    const newAsset: Asset = {
      ...originalAsset,
      id: generateAssetId(),
      x: originalAsset.x + 10,
      y: originalAsset.y + 10,
      z: state.getNextZ()
    };
    
    set((state) => ({
      assets: { ...state.assets, [newAsset.id]: newAsset },
      order: [...state.order, newAsset.id],
      selected: [newAsset.id]
    }));
    
    get().pushHistory();
    return newAsset.id;
  },

  deleteAsset: (id: AssetId) => {
    set((state) => {
      const { [id]: deleted, ...remainingAssets } = state.assets;
      const newOrder = state.order.filter(assetId => assetId !== id);
      const newSelected = state.selected.filter(assetId => assetId !== id);
      
      return {
        assets: remainingAssets,
        order: newOrder,
        selected: newSelected
      };
    });
    
    get().pushHistory();
  },

  setAssetZ: (id: AssetId, z: number) => {
    set((state) => {
      const asset = state.assets[id];
      if (!asset) return state;
      
      return {
        assets: {
          ...state.assets,
          [id]: { ...asset, z }
        }
      };
    });
  },

  lockAsset: (id: AssetId, locked: boolean) => {
    set((state) => {
      const asset = state.assets[id];
      if (!asset) return state;
      
      return {
        assets: {
          ...state.assets,
          [id]: { ...asset, locked }
        }
      };
    });
  },

  hideAsset: (id: AssetId, hidden: boolean) => {
    set((state) => {
      const asset = state.assets[id];
      if (!asset) return state;
      
      return {
        assets: {
          ...state.assets,
          [id]: { ...asset, hidden }
        }
      };
    });
  },

  // Selection actions
  selectAsset: (id: AssetId) => {
    set((state) => ({
      selected: [id] // Single-select MVP
    }));
  },

  deselectAsset: (id: AssetId) => {
    set((state) => ({
      selected: state.selected.filter(assetId => assetId !== id)
    }));
  },

  clearSelection: () => {
    set({ selected: [] });
  },

  // History management
  pushHistory: () => {
    const state = get();
    const snapshot: AssetHistorySnapshot = {
      assets: { ...state.assets },
      order: [...state.order],
      timestamp: Date.now()
    };
    
    set((state) => {
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(snapshot);
      
      // Trim history if too long
      if (newHistory.length > state.maxHistorySize) {
        newHistory.shift();
      }
      
      return {
        history: newHistory,
        historyIndex: newHistory.length - 1
      };
    });
  },

  undo: () => {
    const state = get();
    if (!state.canUndo()) return;
    
    const snapshot = state.history[state.historyIndex - 1];
    set({
      assets: { ...snapshot.assets },
      order: [...snapshot.order],
      historyIndex: state.historyIndex - 1
    });
  },

  redo: () => {
    const state = get();
    if (!state.canRedo()) return;
    
    const snapshot = state.history[state.historyIndex + 1];
    set({
      assets: { ...snapshot.assets },
      order: [...snapshot.order],
      historyIndex: state.historyIndex + 1
    });
  },

  canUndo: () => {
    const state = get();
    return state.historyIndex > 0;
  },

  canRedo: () => {
    const state = get();
    return state.historyIndex < state.history.length - 1;
  },

  // Utility functions
  getAsset: (id: AssetId) => {
    return get().assets[id];
  },

  getSelectedAsset: () => {
    const state = get();
    const selectedId = state.selected[0];
    return selectedId ? state.assets[selectedId] : undefined;
  },

  getAssetsInOrder: () => {
    const state = get();
    return state.order.map(id => state.assets[id]).filter(Boolean);
  },

  getNextZ: () => {
    const state = get();
    if (state.order.length === 0) return 0;
    
    const maxZ = Math.max(...state.order.map(id => state.assets[id]?.z || 0));
    return maxZ + 1;
  }
}));

// Export store actions for external use
export const assetActions = {
  addAsset: (sourceItem: AssetSourceItem, x: number, y: number) => 
    useAssetStore.getState().addAsset(sourceItem, x, y),
  moveAsset: (id: AssetId, x: number, y: number) => 
    useAssetStore.getState().moveAsset(id, x, y),
  transformAsset: (id: AssetId, updates: Partial<Asset>) => 
    useAssetStore.getState().transformAsset(id, updates),
  deleteAsset: (id: AssetId) => 
    useAssetStore.getState().deleteAsset(id),
  selectAsset: (id: AssetId) => 
    useAssetStore.getState().selectAsset(id),
  clearSelection: () => 
    useAssetStore.getState().clearSelection()
};
