import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { apiRequest } from '@/lib/queryClient';

export interface Material {
  id: string;
  orgId?: string;
  supplier?: string;
  sourceUrl?: string;
  name: string;
  sku?: string;
  category: 'coping' | 'waterline_tile' | 'interior' | 'paving' | 'fencing';
  unit: 'm2' | 'lm' | 'each';
  color?: string;
  finish?: string;
  tileWidthMm?: number;
  tileHeightMm?: number;
  sheetWidthMm?: number;
  sheetHeightMm?: number;
  thicknessMm?: number;
  groutWidthMm?: number;
  cost?: number;
  price?: number;
  wastagePct?: number;
  marginPct?: number;
  textureUrl?: string;
  thumbnailUrl?: string;
  physicalRepeatM?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
}

interface MaterialsState {
  materials: Material[];
  loading: boolean;
  error: string | null;
  lastFetch: number | null;
  
  // Actions
  load: (params?: { category?: string; q?: string; page?: number; pageSize?: number }) => Promise<void>;
  upsert: (material: Material) => void;
  remove: (materialId: string) => void;
  clear: () => void;
  
  // Selectors
  byCategory: (category: string) => Material[];
  getById: (id: string) => Material | undefined;
}

export const useMaterialsStore = create<MaterialsState>()(
  subscribeWithSelector((set, get) => ({
    materials: [],
    loading: false,
    error: null,
    lastFetch: null,

    load: async (params = {}) => {
      const { category, q, page = 1, pageSize = 100 } = params;
      
      set({ loading: true, error: null });
      
      try {
        const queryParams = new URLSearchParams();
        if (category) queryParams.set('category', category);
        if (q) queryParams.set('q', q);
        queryParams.set('page', page.toString());
        queryParams.set('pageSize', pageSize.toString());
        
        const response = await apiRequest('GET', `/api/materials?${queryParams}`);
        const data = await response.json();
        
        set({ 
          materials: data.materials || [],
          loading: false,
          error: null,
          lastFetch: Date.now()
        });
        
      } catch (error: any) {
        console.error('Failed to load materials:', error);
        set({ 
          loading: false, 
          error: error?.message || 'Failed to load materials'
        });
      }
    },

    upsert: (material: Material) => {
      set(state => {
        const existingIndex = state.materials.findIndex(m => m.id === material.id);
        
        if (existingIndex >= 0) {
          // Update existing
          const newMaterials = [...state.materials];
          newMaterials[existingIndex] = material;
          return { materials: newMaterials };
        } else {
          // Add new (prepend to beginning)
          return { materials: [material, ...state.materials] };
        }
      });
    },

    remove: (materialId: string) => {
      set(state => ({
        materials: state.materials.filter(m => m.id !== materialId)
      }));
    },

    clear: () => {
      set({ materials: [], error: null, lastFetch: null });
    },

    // Selectors
    byCategory: (category: string) => {
      return get().materials.filter(m => m.category === category && m.isActive);
    },

    getById: (id: string) => {
      return get().materials.find(m => m.id === id);
    }
  }))
);