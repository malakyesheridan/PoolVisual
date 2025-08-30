import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type Material = {
  id: string;
  name: string;
  category: 'coping'|'waterline_tile'|'interior'|'paving'|'fencing';
  unit: 'm2'|'lm'|'each';
  price?: number|null;
  cost?: number|null;
  texture_url?: string|null;
  physical_repeat_m?: number|null;
  sheet_width_mm?: number|null;
  sheet_height_mm?: number|null;
  tile_width_mm?: number|null;
  tile_height_mm?: number|null;
  created_at?: string;
};

type S = {
  items: Record<string, Material>;
  lastLoadedAt?: number|null;
  hydrateMerge: (arr: Material[]) => void;      // MERGES; never clears on empty
  upsert: (m: Material) => void;
  all: () => Material[];
  byCategory: (c: Material['category']|'all') => Material[];
  reset: () => void; // for debugging
};

export const useMaterialsStore = create<S>()(
  persist(
    (set, get) => ({
      items: {},
      lastLoadedAt: null,
      hydrateMerge: (arr) => {
        if (!Array.isArray(arr) || arr.length === 0) {
          // do NOT clobber existing cache with an empty fetch
          return;
        }
        const merged = { ...get().items };
        for (const m of arr) merged[m.id] = m;
        set({ items: merged, lastLoadedAt: Date.now() });
      },
      upsert: (m) => set(s => ({ items: { ...s.items, [m.id]: m } })),
      all: () => Object.values(get().items),
      byCategory: (c) => (c === 'all' ? Object.values(get().items) : Object.values(get().items).filter(i => i.category === c)),
      reset: () => set({ items: {}, lastLoadedAt: null })
    }),
    {
      name: 'materials_v1',
      storage: createJSONStorage(() => localStorage)
    }
  )
);