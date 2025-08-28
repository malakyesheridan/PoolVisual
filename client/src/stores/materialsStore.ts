import { create } from 'zustand';

export type Material = {
  id: string;
  name: string;
  category: 'coping' | 'waterline_tile' | 'interior' | 'paving' | 'fencing';
  unit: 'm2' | 'lm' | 'each';
  price?: number | null;
  cost?: number | null;
  textureUrl?: string | null;
  thumbnailUrl?: string | null;
  physicalRepeatM?: number | null;
  supplier?: string | null;
  sku?: string | null;
  wastagePct?: number | null;
  marginPct?: number | null;
  finish?: string | null;
  tileWidthMm?: number | null;
  tileHeightMm?: number | null;
  sheetWidthMm?: number | null;
  sheetHeightMm?: number | null;
  groutWidthMm?: number | null;
  thicknessMm?: number | null;
  notes?: string | null;
  sourceUrl?: string | null;
  isActive: boolean;
  createdAt: string;
  orgId?: string | null;
};

type MaterialsState = {
  items: Record<string, Material>;
  upsert: (material: Material) => void;
  remove: (id: string) => void;
  byCategory: (category: Material['category']) => Material[];
  getAll: () => Material[];
  clear: () => void;
};

export const useMaterialsStore = create<MaterialsState>((set, get) => ({
  items: {},
  
  upsert: (material) => set((state) => ({
    items: { ...state.items, [material.id]: material }
  })),
  
  remove: (id) => set((state) => {
    const newItems = { ...state.items };
    delete newItems[id];
    return { items: newItems };
  }),
  
  byCategory: (category) => 
    Object.values(get().items).filter(item => item.category === category),
  
  getAll: () => Object.values(get().items),
  
  clear: () => set({ items: {} })
}));