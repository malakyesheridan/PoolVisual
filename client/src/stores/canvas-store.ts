import { create } from 'zustand';

interface Point {
  x: number;
  y: number;
}

interface Mask {
  id: string;
  type: 'area' | 'linear' | 'waterline_band';
  points: Point[];
  materialId?: string;
  areaM2?: number;
  perimeterM?: number;
  bandHeightM?: number;
}

interface Calibration {
  pixelsPerMeter: number;
  referenceLength: number;
  startPoint: Point;
  endPoint: Point;
}

interface CanvasState {
  // Canvas state
  scale: number;
  offset: Point;
  
  // Tools
  activeTool: 'pan' | 'area' | 'linear' | 'waterline' | 'eraser';
  brushSize: number;
  
  // Photo and calibration
  photo: {
    url: string;
    width: number;
    height: number;
  } | null;
  calibration: Calibration | null;
  
  // Masks
  masks: Mask[];
  activeMask: string | null;
  
  // Materials
  selectedMaterial: string | null;
  
  // View mode
  viewMode: 'before' | 'after' | 'sideBySide';
  
  // Actions
  setScale: (scale: number) => void;
  setOffset: (offset: Point) => void;
  setActiveTool: (tool: 'pan' | 'area' | 'linear' | 'waterline' | 'eraser') => void;
  setBrushSize: (size: number) => void;
  setPhoto: (photo: { url: string; width: number; height: number }) => void;
  setCalibration: (calibration: Calibration) => void;
  addMask: (mask: Omit<Mask, 'id'>) => void;
  updateMask: (id: string, updates: Partial<Mask>) => void;
  deleteMask: (id: string) => void;
  setActiveMask: (id: string | null) => void;
  setSelectedMaterial: (materialId: string | null) => void;
  setViewMode: (mode: 'before' | 'after' | 'sideBySide') => void;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  // Initial state
  scale: 1,
  offset: { x: 0, y: 0 },
  activeTool: 'area',
  brushSize: 15,
  photo: null,
  calibration: null,
  masks: [],
  activeMask: null,
  selectedMaterial: null,
  viewMode: 'before',
  
  // Actions
  setScale: (scale) => set({ scale }),
  setOffset: (offset) => set({ offset }),
  setActiveTool: (activeTool) => set({ activeTool }),
  setBrushSize: (brushSize) => set({ brushSize }),
  setPhoto: (photo) => set({ photo }),
  setCalibration: (calibration) => set({ calibration }),
  
  addMask: (maskData) => {
    const id = crypto.randomUUID();
    const mask = { ...maskData, id };
    set({ masks: [...get().masks, mask] });
  },
  
  updateMask: (id, updates) => {
    set({
      masks: get().masks.map(mask => 
        mask.id === id ? { ...mask, ...updates } : mask
      )
    });
  },
  
  deleteMask: (id) => {
    set({
      masks: get().masks.filter(mask => mask.id !== id),
      activeMask: get().activeMask === id ? null : get().activeMask
    });
  },
  
  setActiveMask: (activeMask) => set({ activeMask }),
  setSelectedMaterial: (selectedMaterial) => set({ selectedMaterial }),
  setViewMode: (viewMode) => set({ viewMode }),
}));
