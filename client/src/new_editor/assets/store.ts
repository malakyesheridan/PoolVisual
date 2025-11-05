import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { assetSource } from './assetSource';

// Asset definition from static JSON
export type AssetDef = {
  id: string;
  name: string;
  category: string;
  url: string;
  thumbnail?: string;
  defaultScale?: number; // 1.0 = 100%
};

// Asset instance placed on canvas
export type AssetInstance = {
  id: string;
  defId: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
  locked: boolean; // per-instance
};

// Assets store state
interface AssetsState {
  // Asset definitions (loaded from static JSON)
  defsById: Record<string, AssetDef>;
  
  // Asset instances (placed on canvas)
  byId: Record<string, AssetInstance>;
  order: string[]; // z-order for assets only
  
  // UI state
  selectedAssetId: string | null;
  editMode: boolean; // controls interactivity
  
  // Actions
  loadAssetDefs: (defs: AssetDef[]) => void;
  syncWithAssetSource: () => Promise<void>;
  addAsset: (defId: string, initial?: Partial<AssetInstance>) => string;
  updateAsset: (id: string, patch: Partial<AssetInstance>) => void;
  removeAsset: (id: string) => void;
  bringForward: (id: string) => void;
  sendBackward: (id: string) => void;
  setSelectedAsset: (id: string | null) => void;
  setEditMode: (on: boolean) => void;
  persist: () => void;
  restore: () => void;
  clearAll: () => void;
}

// Generate unique ID for asset instances
function generateAssetId(): string {
  return `asset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Helper function to resolve asset IDs across different systems
export function resolveAssetId(sourceId: string): string | null {
  // Check if it's already a valid asset definition ID
  const assetsStore = useAssetsStore.getState();
  if (assetsStore.defsById[sourceId]) {
    return sourceId;
  }
  
  // Check AssetSource for the ID
  const items = assetSource.getItems();
  const foundItem = items.find(item => item.id === sourceId);
  if (foundItem) {
    return sourceId;
  }
  
  console.warn(`[ASSETS:resolve] Asset not found: ${sourceId}`);
  return null;
}

// Get storage key for current session
function getStorageKey(): string {
  // Try to get storeToken from the editor store, fallback to simple key
  try {
    // Import editor store dynamically to avoid circular dependencies
    const editorStore = (window as any).__editorStoreToken;
    if (editorStore) {
      return `poolvisual_assets_${editorStore}`;
    }
  } catch (error) {
    // Fallback to simple key
  }
  return 'poolvisual_assets';
}

export const useAssetsStore = create<AssetsState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    defsById: {},
    byId: {},
    order: [],
    selectedAssetId: null,
    editMode: false,

    // Load asset definitions from static JSON
    loadAssetDefs: (defs: AssetDef[]) => {
      if (import.meta.env.DEV) {
        console.log('[ASSETS:init]', { defs: defs.length });
      }
      set((state) => {
        const newDefsById = { ...state.defsById };
        defs.forEach(def => {
          newDefsById[def.id] = def;
        });
        return { defsById: newDefsById };
      });
    },

    // Sync with AssetSource to ensure consistency
    syncWithAssetSource: async () => {
      try {
        await assetSource.loadManifest();
        const items = assetSource.getItems();
        const assetDefs = items.map(item => ({
          id: item.id,
          name: item.name,
          category: item.category,
          url: item.src,
          thumbnail: item.thumb,
          defaultScale: 1.0
        }));
        
        if (import.meta.env.DEV) {
          console.log('[ASSETS:sync] Syncing with AssetSource:', assetDefs.length, 'items');
        }
        
        get().loadAssetDefs(assetDefs);
      } catch (error) {
        console.error('[ASSETS:sync] Failed to sync with AssetSource:', error);
      }
    },

    // Add new asset instance
    addAsset: (defId: string, initial: Partial<AssetInstance> = {}) => {
      const { defsById } = get();
      const def = defsById[defId];
      if (!def) {
        console.warn('[ASSETS:add] Asset definition not found:', defId);
        return '';
      }

      const id = generateAssetId();
      const asset: AssetInstance = {
        id,
        defId,
        x: initial.x ?? 0,
        y: initial.y ?? 0,
        scale: initial.scale ?? (def.defaultScale ?? 1.0),
        rotation: initial.rotation ?? 0,
        opacity: initial.opacity ?? 1.0,
        locked: initial.locked ?? false,
      };

      if (import.meta.env.DEV) {
        console.log('[ASSETS:add]', { id, defId, x: asset.x, y: asset.y, scale: asset.scale });
      }

      set((state) => ({
        byId: { ...state.byId, [id]: asset },
        order: [...state.order, id], // Add to end (top)
        selectedAssetId: id, // Auto-select new asset
      }));

      // Persist after adding
      get().persist();
      return id;
    },

    // Update asset instance
    updateAsset: (id: string, patch: Partial<AssetInstance>) => {
      if (import.meta.env.DEV) {
        console.log('[ASSETS:update]', { id, patch });
      }
      
      set((state) => {
        const asset = state.byId[id];
        if (!asset) return state;

        return {
          byId: {
            ...state.byId,
            [id]: { ...asset, ...patch }
          }
        };
      });

      // Persist after updating
      get().persist();
    },

    // Remove asset instance
    removeAsset: (id: string) => {
      if (import.meta.env.DEV) {
        console.log('[ASSETS:remove]', { id });
      }
      
      set((state) => {
        const { [id]: removed, ...byId } = state.byId;
        const order = state.order.filter(assetId => assetId !== id);
        const selectedAssetId = state.selectedAssetId === id ? null : state.selectedAssetId;

        return {
          byId,
          order,
          selectedAssetId,
        };
      });

      // Persist after removing
      get().persist();
    },

    // Bring asset forward in z-order
    bringForward: (id: string) => {
      set((state) => {
        const order = [...state.order];
        const index = order.indexOf(id);
        if (index === -1 || index === order.length - 1) return state;

        // Move to end (top)
        order.splice(index, 1);
        order.push(id);

        return { order };
      });
      get().persist();
    },

    // Send asset backward in z-order
    sendBackward: (id: string) => {
      set((state) => {
        const order = [...state.order];
        const index = order.indexOf(id);
        if (index === -1 || index === 0) return state;

        // Move to beginning (bottom)
        order.splice(index, 1);
        order.unshift(id);

        return { order };
      });
      get().persist();
    },

    // Set selected asset
    setSelectedAsset: (id: string | null) => {
      set({ selectedAssetId: id });
    },

    // Toggle edit mode
    setEditMode: (on: boolean) => {
      if (import.meta.env.DEV) {
        console.log('[ASSETS:editMode]', { on });
      }
      set({ editMode: on });
    },

    // Persist to localStorage
    persist: () => {
      const { byId, order } = get();
      const data = { byId, order, timestamp: Date.now() };
      
      try {
        localStorage.setItem(getStorageKey(), JSON.stringify(data));
      } catch (error) {
        console.warn('[ASSETS:persist] Failed to save to localStorage:', error);
      }
    },

    // Restore from localStorage
    restore: () => {
      try {
        const stored = localStorage.getItem(getStorageKey());
        if (!stored) return;

        const data = JSON.parse(stored);
        if (data.byId && data.order) {
          // Validate restored assets - drop any instance whose defId no longer exists
          const { defsById } = get();
          const validById: Record<string, AssetInstance> = {};
          const validOrder: string[] = [];
          
          Object.entries(data.byId).forEach(([id, asset]: [string, any]) => {
            if (defsById[asset.defId]) {
              validById[id] = asset;
              if (data.order.includes(id)) {
                validOrder.push(id);
              }
            } else {
              if (import.meta.env.DEV) {
                console.warn('[ASSETS:restore] Dropping invalid asset:', { id, defId: asset.defId });
              }
            }
          });
          
          set({
            byId: validById,
            order: validOrder,
            selectedAssetId: null, // Don't restore selection
          });
          
          if (import.meta.env.DEV) {
            console.log('[ASSETS:restore]', { 
              count: Object.keys(validById).length,
              dropped: Object.keys(data.byId).length - Object.keys(validById).length
            });
          }
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('[ASSETS:error]', { scope: 'restore', message: error.message });
        }
      }
    },

    // Clear all assets
    clearAll: () => {
      if (import.meta.env.DEV) {
        console.log('[ASSETS:clearAll]');
      }
      set({
        byId: {},
        order: [],
        selectedAssetId: null,
      });
      get().persist();
    },
  }))
);
