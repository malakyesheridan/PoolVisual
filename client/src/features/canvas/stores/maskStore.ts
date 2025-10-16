import { create } from "zustand";
import { useEditorStore } from "@/stores/editorSlice";

type Mask = {
  id: string;
  points: Array<{x: number; y: number}>;
  materialId?: string;
  type: 'area' | 'linear' | 'waterline_band';
  materialMeta?: { scale: number; rotationDeg: number; offsetX: number; offsetY: number } | null;
};

type MaskStore = {
  selectedMaskId: string | null;
  masksById: Record<string, Mask>;
  setSelectedMask: (id: string | null) => void;
  addMask: (mask: Mask) => void;
  updateMask: (id: string, updates: Partial<Mask>) => void;
  removeMask: (id: string) => void;
  clear: () => void;
  // Sync with editor store
  syncWithEditorStore: () => void;
};

export const useMaskStore = create<MaskStore>((set, get) => ({
  selectedMaskId: null,
  masksById: {},
  setSelectedMask: (id) => {
    set({ selectedMaskId: id });
    // Sync with editor store
    const editorStore = useEditorStore.getState();
    editorStore.selectMask(id);
  },
  addMask: (mask) => set((s) => ({ 
    masksById: { ...s.masksById, [mask.id]: mask } 
  })),
  updateMask: (id, updates) => set((s) => ({
    masksById: { 
      ...s.masksById, 
      [id]: { ...s.masksById[id], ...updates } 
    }
  })),
  removeMask: (id) => set((s) => {
    const { [id]: removed, ...rest } = s.masksById;
    return { 
      masksById: rest,
      selectedMaskId: s.selectedMaskId === id ? null : s.selectedMaskId
    };
  }),
  clear: () => set({ selectedMaskId: null, masksById: {} }),
  syncWithEditorStore: () => {
    const editorStore = useEditorStore.getState();
    const editorMasks = editorStore.masks;
    
    // Convert editor masks to our format
    const masksById: Record<string, Mask> = {};
    editorMasks.forEach(mask => {
      masksById[mask.id] = {
        id: mask.id,
        points: mask.points,
        materialId: mask.materialId,
        type: mask.type,
        materialMeta: mask.materialMeta
      };
    });
    
    set({ 
      masksById,
      selectedMaskId: editorStore.selectedMaskId
    });
  }
}));
