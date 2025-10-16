import { Material } from './types';

// Minimal materials store for this module
interface MaterialsState {
  byId: Record<string, Material>;
  selectedId: string | null;
}

interface MaterialsActions {
  setSelected: (id: string | null) => void;
  loadMaterials: () => Promise<void>;
}

type MaterialsStore = MaterialsState & MaterialsActions;

// Simple in-memory store
let materialsStore: MaterialsStore = {
  byId: {},
  selectedId: null,
  setSelected: (id: string | null) => {
    console.log('[MaterialSelect]', { materialId: id });
    materialsStore.selectedId = id;
  },
  loadMaterials: async () => {
    try {
      // Try to load from existing materials.json
      const response = await fetch('/materials/materials.json');
      if (response.ok) {
        const data = await response.json();
        const materials: Record<string, Material> = {};
        
        // Convert API format to our Material format
        const materialsArray = data.materials || data;
        if (Array.isArray(materialsArray)) {
          materialsArray.forEach((item: any) => {
            if (item.id && item.name && item.albedoURL) {
              materials[item.id] = {
                id: item.id,
                name: item.name,
                textureUrl: item.albedoURL, // Use albedoURL as textureUrl
                scale: item.defaultTileScale || 1.0,
                opacity: 0.9
              };
            }
          });
        }
        
        materialsStore.byId = materials;
        console.log('[MaterialsLoaded]', { count: Object.keys(materials).length, materials: Object.keys(materials) });
      }
    } catch (error) {
      console.warn('[MaterialsLoadError]', error);
    }
  }
};

// Load materials on module init
materialsStore.loadMaterials();

export const getSelectedMaterialId = () => materialsStore.selectedId;
export const getMaterialById = (id: string | null | undefined) => {
  if (!id) return null;
  const material = materialsStore.byId?.[id] ?? null;
  if (!material) {
    console.log('[MaterialTextureMissing]', { materialId: id });
    return null;
  }
  return material;
};

// Expose store globally for CanvasOverlay access
if (typeof window !== 'undefined') {
  (window as any).__materialsStore = materialsStore;
}
