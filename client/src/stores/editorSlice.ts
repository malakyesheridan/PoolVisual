/**
 * Enhanced Canvas Editor Store with comprehensive state management
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { 
  Vec2, 
  EditorMask, 
  AreaMask, 
  LinearMask, 
  WaterlineMask,
  CalibrationData, 
  ToolType,
  ViewMode,
  Photo
} from '@shared/schema';
import { UndoRedoManager } from '@/lib/undoRedo';
import { 
  polygonAreaPx, 
  polylineLengthPx, 
  smoothFreehand,
  isPolygonValid,
  generateWaterlineBand
} from '@/lib/geometry';
import { 
  pixelsToMeters, 
  pixelsToSquareMeters, 
  validateCalibration,
  computePixelsPerMeter
} from '@/lib/calibration';

export interface MaskMetrics {
  area_m2?: number;
  perimeter_m?: number;
  band_area_m2?: number;
  qty_effective?: number;
  estimatedCost?: number;
}

export interface MaskMaterialSettings {
  materialId: string;
  repeatScale: number;
  rotationDeg: number;
  brightness: number;
  contrast: number;
}

export interface EditorState {
  calibration: CalibrationData | null;
  zoom: number;
  pan: Vec2;
  activeTool: ToolType;
  brushSize: number;
  mode: ViewMode;
}

export interface EditorSliceState {
  // Photo and basic state
  photo: Photo | null;
  photoId: string | null;
  jobId: string | null;
  
  // Editor state
  editorState: EditorState;
  
  // Masks and drawing
  masks: EditorMask[];
  currentDrawing: Vec2[] | null;
  selectedMaskId: string | null;
  
  // Materials and settings
  selectedMaterialId: string | null;
  maskMaterials: Record<string, MaskMaterialSettings>;
  
  // History
  undoRedoManager: UndoRedoManager;
  
  // UI state
  isLoading: boolean;
  isDirty: boolean;
  lastSaved: string | null;
  error: string | null;
  
  // Composite rendering
  compositeUrls: {
    after?: string;
    sideBySide?: string;
  };
  isGeneratingComposite: boolean;
}

export interface EditorSliceActions {
  // Photo management
  loadPhoto: (photoId: string, jobId: string) => Promise<void>;
  setPhoto: (photo: Photo) => void;
  loadImageFile: (file: File, imageUrl: string, dimensions: { width: number; height: number }) => void;
  
  // Calibration
  setCalibration: (calibration: CalibrationData) => void;
  setCalibrationMode: (enabled: boolean) => void;
  clearCalibration: () => void;
  
  // Drawing tools
  setActiveTool: (tool: ToolType) => void;
  setBrushSize: (size: number) => void;
  startDrawing: (point: Vec2) => void;
  addPoint: (point: Vec2) => void;
  finishDrawing: (type?: 'area' | 'linear' | 'waterline_band') => void;
  cancelDrawing: () => void;
  
  // Mask management
  selectMask: (maskId: string | null) => void;
  setSelectedMaterialId: (materialId: string | null) => void;
  deleteMask: (maskId: string) => void;
  updateMask: (maskId: string, updates: Partial<EditorMask>) => void;
  attachMaterial: (maskId: string, materialId: string) => void;
  detachMaterial: (maskId: string) => void;
  eraseFromSelected: (points: Vec2[], brushSize: number) => void;
  updateMaterialSettings: (maskId: string, settings: Partial<MaskMaterialSettings>) => void;
  
  // Waterline specific
  setBandHeight: (maskId: string, heightM: number) => void;
  
  // View and navigation
  setZoom: (zoom: number) => void;
  setPan: (pan: Vec2) => void;
  setViewMode: (mode: ViewMode) => void;
  resetView: () => void;
  
  // Metrics
  computeMetrics: (maskId: string) => MaskMetrics;
  
  // History
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  getUndoAction: () => string | null;
  getRedoAction: () => string | null;
  resetEditor: () => void;
  
  // Composites
  generateComposite: (type: 'after' | 'sideBySide') => Promise<void>;
  clearComposites: () => void;
  
  // Persistence and autosave
  saveProgress: () => Promise<void>;
  loadPhotoState: (photoId: string) => Promise<void>;
  generateQuote: (jobId: string, photoId: string) => Promise<void>;
  autoSave: () => void;
  setError: (error: string | null) => void;
}

export type EditorSlice = EditorSliceState & EditorSliceActions;

const initialState: EditorSliceState = {
  // Photo and basic state
  photo: null,
  photoId: null,
  jobId: null,
  
  // Editor state
  editorState: {
    calibration: null,
    zoom: 1,
    pan: { x: 0, y: 0 },
    activeTool: 'hand' as ToolType,
    brushSize: 20,
    mode: 'before' as ViewMode
  },
  
  // Masks and drawing
  masks: [],
  currentDrawing: null,
  selectedMaskId: null,
  
  // Materials and settings
  selectedMaterialId: null,
  maskMaterials: {},
  
  // History
  undoRedoManager: new UndoRedoManager(),
  
  // UI state
  isLoading: false,
  isDirty: false,
  lastSaved: null,
  error: null,
  
  // Composite rendering
  compositeUrls: {},
  isGeneratingComposite: false,
};

export const useEditorStore = create<EditorSlice>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    // Photo management
    loadPhoto: async (photoId: string, jobId: string) => {
      set({ isLoading: true, photoId, jobId });
      try {
        // TODO: Load actual photo data from API
        set({ isLoading: false });
      } catch (error) {
        console.error('Failed to load photo:', error);
        set({ error: 'Failed to load photo', isLoading: false });
      }
    },

    setPhoto: (photo: Photo) => {
      set({ 
        photo,
        photoId: photo.id,
        editorState: {
          ...get().editorState,
          zoom: 1,
          pan: { x: 0, y: 0 }
        }
      });
    },

    loadImageFile: (file: File, imageUrl: string, dimensions: { width: number; height: number }) => {
      const photoId = `temp-${Date.now()}`;
      const photo: Photo = {
        id: photoId,
        filename: file.name,
        filesize: file.size,
        width: dimensions.width,
        height: dimensions.height,
        mimeType: file.type,
        uploadUrl: imageUrl,
        jobId: get().jobId || 'temp-job',
        kind: 'existing',
        createdAt: new Date().toISOString()
      };
      
      set({ 
        photo,
        photoId,
        masks: [],
        selectedMaskId: null,
        editorState: {
          ...get().editorState,
          calibration: null,
          zoom: 1,
          pan: { x: 0, y: 0 }
        }
      });
    },

    // Calibration
    setCalibration: (calibration: CalibrationData) => {
      const newEditorState = {
        ...get().editorState,
        calibration
      };
      
      set({
        editorState: newEditorState,
        isDirty: true 
      });
    },

    setCalibrationMode: (enabled: boolean) => {
      if (enabled) {
        set({
          editorState: {
            ...get().editorState,
            activeTool: 'calibration'
          }
        });
      }
    },

    clearCalibration: () => {
      const newEditorState = {
        ...get().editorState,
        calibration: null
      };
      
      set({
        editorState: newEditorState,
        isDirty: true 
      });
    },

    // Drawing tools
    setActiveTool: (tool: ToolType) => {
      set({
        editorState: {
          ...get().editorState,
          activeTool: tool
        }
      });
    },

    setBrushSize: (size: number) => {
      set({
        editorState: {
          ...get().editorState,
          brushSize: size
        }
      });
    },

    startDrawing: (point: Vec2) => {
      set({ currentDrawing: [point] });
    },

    addPoint: (point: Vec2) => {
      const current = get().currentDrawing;
      if (current) {
        set({ currentDrawing: [...current, point] });
      }
    },

    finishDrawing: (type: 'area' | 'linear' | 'waterline_band' = 'area') => {
      const { currentDrawing, photoId } = get();
      if (!currentDrawing || currentDrawing.length < 2 || !photoId) return;

      const maskId = crypto.randomUUID();
      const now = new Date().toISOString();
      
      let newMask: EditorMask;
      
      if (type === 'area') {
        newMask = {
          id: maskId,
          photoId,
          type: 'area',
          polygon: {
            points: currentDrawing
          },
          createdBy: 'current-user',
          createdAt: now,
          updatedAt: now
        } as AreaMask;
      } else if (type === 'linear') {
        newMask = {
          id: maskId,
          photoId,
          type: 'linear',
          polyline: {
            points: currentDrawing
          },
          createdBy: 'current-user',
          createdAt: now,
          updatedAt: now
        } as LinearMask;
      } else {
        newMask = {
          id: maskId,
          photoId,
          type: 'waterline_band',
          polyline: {
            points: currentDrawing
          },
          band_height_m: 0.3,
          createdBy: 'current-user',
          createdAt: now,
          updatedAt: now
        } as WaterlineMask;
      }

      const newMasks = [...get().masks, newMask];
      set({
        masks: newMasks,
        currentDrawing: null,
        selectedMaskId: maskId,
        isDirty: true
      });

      console.log('Saving masks:', newMasks);
    },

    cancelDrawing: () => {
      set({ currentDrawing: null });
    },

    // Mask management
    selectMask: (maskId: string | null) => {
      set({ selectedMaskId: maskId });
    },

    setSelectedMaterialId: (materialId: string | null) => {
      set({ selectedMaterialId: materialId });
    },

    deleteMask: (maskId: string) => {
      const newMasks = get().masks.filter(m => m.id !== maskId);
      set({
        masks: newMasks,
        selectedMaskId: get().selectedMaskId === maskId ? null : get().selectedMaskId,
        isDirty: true
      });
    },

    updateMask: (maskId: string, updates: Partial<EditorMask>) => {
      const newMasks = get().masks.map(mask => 
        mask.id === maskId ? { ...mask, ...updates, updatedAt: new Date().toISOString() } : mask
      );
      
      set({
        masks: newMasks,
        isDirty: true
      });
    },

    attachMaterial: (maskId: string, materialId: string) => {
      const defaultSettings: MaskMaterialSettings = {
        materialId,
        repeatScale: 1.0,
        rotationDeg: 0,
        brightness: 0,
        contrast: 1.0
      };
      
      set({
        maskMaterials: {
          ...get().maskMaterials,
          [maskId]: defaultSettings
        },
        isDirty: true
      });
    },

    detachMaterial: (maskId: string) => {
      const { [maskId]: removed, ...rest } = get().maskMaterials;
      set({
        maskMaterials: rest,
        isDirty: true
      });
    },

    updateMaterialSettings: (maskId: string, settings: Partial<MaskMaterialSettings>) => {
      const currentSettings = get().maskMaterials[maskId];
      if (currentSettings) {
        set({
          maskMaterials: {
            ...get().maskMaterials,
            [maskId]: { ...currentSettings, ...settings }
          },
          isDirty: true
        });
      }
    },

    eraseFromSelected: (points: Vec2[], brushSize: number) => {
      // TODO: Implement erasing logic
    },

    // Waterline specific
    setBandHeight: (maskId: string, heightM: number) => {
      const mask = get().masks.find(m => m.id === maskId);
      if (mask && mask.type === 'waterline_band') {
        get().updateMask(maskId, { band_height_m: heightM });
      }
    },

    // View and navigation
    setZoom: (zoom: number) => {
      set({
        editorState: {
          ...get().editorState,
          zoom: Math.max(0.1, Math.min(10, zoom))
        }
      });
    },

    setPan: (pan: Vec2) => {
      set({
        editorState: {
          ...get().editorState,
          pan
        }
      });
    },

    setViewMode: (mode: ViewMode) => {
      set({
        editorState: {
          ...get().editorState,
          mode
        }
      });
    },

    resetView: () => {
      set({
        editorState: {
          ...get().editorState,
          zoom: 1,
          pan: { x: 0, y: 0 }
        }
      });
    },

    // Metrics computation
    computeMetrics: (maskId: string) => {
      const state = get();
      const mask = state.masks.find(m => m.id === maskId);
      const calibration = state.editorState.calibration;
      const materialSettings = state.maskMaterials[maskId];
      
      if (!mask) return {};
      
      const metrics: MaskMetrics = {};
      
      if (calibration && validateCalibration(calibration)) {
        try {
          if (mask.type === 'area' && 'polygon' in mask) {
            const area = polygonAreaPx(mask.polygon.points);
            metrics.area_m2 = pixelsToSquareMeters(area, calibration);
            metrics.qty_effective = metrics.area_m2;
          } else if (mask.type === 'linear' && 'polyline' in mask) {
            const length = polylineLengthPx(mask.polyline.points);
            metrics.perimeter_m = pixelsToMeters(length, calibration);
            metrics.qty_effective = metrics.perimeter_m;
          } else if (mask.type === 'waterline_band' && 'polyline' in mask) {
            const length = polylineLengthPx(mask.polyline.points);
            metrics.perimeter_m = pixelsToMeters(length, calibration);
            const bandHeightM = mask.band_height_m || 0.3;
            metrics.band_area_m2 = metrics.perimeter_m * bandHeightM;
            metrics.qty_effective = metrics.band_area_m2;
          }
          
          // Add wastage and calculate cost if material is assigned
          if (materialSettings?.materialId && metrics.qty_effective) {
            // Apply standard 10% wastage
            const wastage = 0.10;
            metrics.qty_effective = metrics.qty_effective * (1 + wastage);
          }
        } catch (error) {
          console.error('Metrics calculation failed:', error);
        }
      }
      
      return metrics;
    },

    // History
    undo: () => {
      // TODO: Implement undo
    },

    redo: () => {
      // TODO: Implement redo
    },

    canUndo: () => false,
    canRedo: () => false,
    getUndoAction: () => null,
    getRedoAction: () => null,

    resetEditor: () => {
      set({
        ...initialState,
        undoRedoManager: new UndoRedoManager()
      });
    },

    // Composites
    generateComposite: async (type: 'after' | 'sideBySide') => {
      set({ isGeneratingComposite: true });
      try {
        // TODO: Implement composite generation
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        set({
          compositeUrls: {
            ...get().compositeUrls,
            [type]: 'mock-composite-url'
          },
          isGeneratingComposite: false
        });
      } catch (error) {
        console.error('Composite generation failed:', error);
        set({ isGeneratingComposite: false });
      }
    },

    clearComposites: () => {
      set({ compositeUrls: {} });
    },

    // Persistence and autosave
    saveProgress: async () => {
      const state = get();
      if (!state.isDirty) return;
      
      try {
        // TODO: Implement actual API calls for saving masks and calibration
        // await apiClient.saveMasks(state.photoId, state.masks);
        // await apiClient.saveCalibration(state.photoId, state.editorState.calibration);
        
        set({ isDirty: false, lastSaved: new Date().toISOString() });
      } catch (error) {
        console.error('Save failed:', error);
        set({ error: 'Failed to save progress' });
      }
    },
    
    loadPhotoState: async (photoId: string) => {
      set({ isLoading: true });
      try {
        // TODO: Implement actual API calls
        set({ isLoading: false });
      } catch (error) {
        console.error('Load failed:', error);
        set({ error: 'Failed to load photo state', isLoading: false });
      }
    },
    
    generateQuote: async (jobId: string, photoId: string) => {
      try {
        // TODO: Implement quote generation
        console.log('Quote generation not yet implemented');
      } catch (error) {
        console.error('Quote generation failed:', error);
        set({ error: 'Failed to generate quote' });
      }
    },

    autoSave: () => {
      const state = get();
      if (state.isDirty && !state.isLoading) {
        // Debounced auto-save
        clearTimeout((window as any).autoSaveTimeout);
        (window as any).autoSaveTimeout = setTimeout(() => {
          get().saveProgress();
        }, 1200);
      }
    },

    setError: (error: string | null) => {
      set({ error });
    }
  }))
);

// Subscribe to isDirty changes for auto-save
useEditorStore.subscribe(
  (state) => state.isDirty,
  (isDirty) => {
    if (isDirty) {
      useEditorStore.getState().autoSave();
    }
  }
);