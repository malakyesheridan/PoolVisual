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
import {
  createCalSample,
  computeGlobalCalibration,
  validateCalibration as validateCalibrationV2,
  getConfidenceLevel,
  pixelsToMeters as pixelsToMetersV2,
  pixelsToSquareMeters as pixelsToSquareMetersV2,
  isValidReferenceDistance
} from '@/lib/calibration-v2';
import type { CalState, CalSample, Calibration, CalibrationTemp } from '@shared/schema';

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
  calibrationV2: Calibration | null;
  calState: CalState;
  calTempPoints: { a?: Vec2; b?: Vec2 };
  calTempMeters: number;
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
  
  // Per-mask overrides
  maskOverrides: Record<string, { override_ppm?: number }>;
  
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
  
  // Calibration V1 (legacy)
  setCalibration: (calibration: CalibrationData) => void;
  setCalibrationMode: (enabled: boolean) => void;
  clearCalibration: () => void;
  
  // Calibration V2 (robust)
  startCalibration: () => void;
  placeCalPoint: (p: Vec2) => void;
  updateCalPreview: (p: Vec2) => void;
  setCalMeters: (m: number) => void;
  commitCalSample: () => Promise<void>;
  deleteCalSample: (id: string) => void;
  setActiveCalibrationSample: (id: string) => void;
  cancelCalibration: () => void;
  recomputeFromSamples: () => void;
  persistCalibration: (photoId: string) => Promise<void>;
  applyPerMaskLength: (maskId: string, meters: number) => void;
  
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
    calibrationV2: null,
    calState: 'idle' as CalState,
    calTemp: {} as CalibrationTemp,
    zoom: 1,
    pan: { x: 0, y: 0 },
    activeTool: 'hand' as ToolType,
    brushSize: 20,
    mode: 'before' as ViewMode
  },
  
  // Per-mask overrides
  maskOverrides: {},
  
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
        jobId: get().jobId || 'temp-job',
        originalUrl: imageUrl,
        width: dimensions.width,
        height: dimensions.height,
        exifJson: null,
        calibrationPixelsPerMeter: null,
        calibrationMetaJson: null,
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

    // Calibration V2 - Robust State Machine
    startCalibration: () => {
      set({
        editorState: {
          ...get().editorState,
          calState: 'placingA',
          calTemp: {},
          activeTool: 'calibration'
        }
      });
    },

    placeCalPoint: (p: Vec2) => {
      const state = get().editorState;
      
      if (state.calState === 'placingA') {
        set({
          editorState: {
            ...state,
            calState: 'placingB',
            calTemp: { a: p }
          }
        });
      } else if (state.calState === 'placingB') {
        set({
          editorState: {
            ...state,
            calState: 'lengthEntry',
            calTemp: { ...state.calTemp, b: p }
          }
        });
      }
    },

    updateCalPreview: (p: Vec2) => {
      const state = get().editorState;
      if (state.calState === 'placingB') {
        set({
          editorState: {
            ...state,
            calTemp: { ...state.calTemp, preview: p }
          }
        });
      }
    },

    setCalMeters: (m: number) => {
      if (m < 0.01) return;
      
      set({
        editorState: {
          ...get().editorState,
          calTemp: { ...get().editorState.calTemp, meters: m }
        }
      });
    },

    commitCalSample: async () => {
      const state = get().editorState;
      const { a, b, meters } = state.calTemp;
      
      if (!a || !b || !meters || meters < 0.01) return;
      
      try {
        // Calculate pixels per meter
        const distPx = Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
        if (distPx < 10) {
          get().setError('Reference too short; choose a longer edge.');
          return;
        }
        
        const ppm = distPx / meters;
        const newSample: CalSample = {
          id: `cal-${Date.now()}`,
          a, b, meters, ppm,
          createdAt: new Date().toISOString()
        };
        
        const currentCal = state.calibrationV2;
        const samples = currentCal?.samples || [];
        
        if (samples.length >= 3) {
          samples.shift();
        }
        
        const updatedSamples = [...samples, newSample];
        const avgPpm = updatedSamples.reduce((sum, s) => sum + s.ppm, 0) / updatedSamples.length;
        
        // Calculate standard deviation percentage
        const variance = updatedSamples.reduce((sum, s) => sum + Math.pow(s.ppm - avgPpm, 2), 0) / updatedSamples.length;
        const stdevPct = updatedSamples.length > 1 ? (Math.sqrt(variance) / avgPpm) * 100 : 0;
        
        const newCalibration: Calibration = {
          ppm: avgPpm,
          samples: updatedSamples,
          stdevPct
        };
        
        set({
          editorState: {
            ...state,
            calibrationV2: newCalibration,
            calState: 'ready',
            calTemp: {},
            activeTool: 'hand'
          },
          isDirty: true
        });
        
        // Show success message
        get().setError(null);
        
        // Persist to backend if photoId exists
        if (get().photoId) {
          await get().persistCalibration(get().photoId!);
        }
        
        get().recomputeFromSamples();
        
      } catch (error) {
        console.error('Failed to create calibration sample:', error);
        get().setError('Failed to save calibration');
      }
    },

    deleteCalSample: (id: string) => {
      const state = get().editorState;
      const currentCal = state.calibrationV2;
      
      if (!currentCal) return;
      
      const updatedSamples = currentCal.samples.filter(s => s.id !== id);
      
      if (updatedSamples.length === 0) {
        set({
          editorState: {
            ...state,
            calibrationV2: null,
            calState: 'idle'
          },
          isDirty: true
        });
      } else {
        const newCalibration = computeGlobalCalibration(updatedSamples);
        set({
          editorState: {
            ...state,
            calibrationV2: newCalibration
          },
          isDirty: true
        });
        
        get().recomputeFromSamples();
      }
    },

    setActiveCalibrationSample: (id: string) => {
      const state = get().editorState;
      const sample = state.calibrationV2?.samples.find(s => s.id === id);
      
      if (!sample) return;
      
      set({
        editorState: {
          ...state,
          calState: 'lengthEntry',
          calTempPoints: { a: sample.a, b: sample.b },
          calTempMeters: sample.meters
        }
      });
    },

    cancelCalibration: () => {
      set({
        editorState: {
          ...get().editorState,
          calState: 'idle',
          calTemp: {},
          activeTool: 'hand'
        }
      });
    },

    recomputeFromSamples: () => {
      const { editorState, masks } = get();
      const cal = editorState.calibrationV2;
      
      if (!cal) return;
      
      const updatedMasks = masks.map(mask => {
        const metrics = get().computeMetrics(mask.id);
        
        if (mask.type === 'area') {
          return { ...mask, area_m2: metrics.area_m2 };
        } else if (mask.type === 'linear') {
          return { ...mask, perimeter_m: metrics.perimeter_m };
        } else if (mask.type === 'waterline_band') {
          return { 
            ...mask, 
            perimeter_m: metrics.perimeter_m,
            area_m2: metrics.band_area_m2
          };
        }
        
        return mask;
      });
      
      set({ masks: updatedMasks, isDirty: true });
    },

    persistCalibration: async (photoId: string) => {
      const cal = get().editorState.calibrationV2;
      
      if (!cal) return;
      
      try {
        const response = await fetch(`/api/photos/${photoId}/calibration`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cal)
        });
        
        if (!response.ok) {
          throw new Error('Failed to persist calibration');
        }
        
      } catch (error) {
        console.error('Failed to persist calibration:', error);
        get().setError('Failed to save calibration');
      }
    },

    applyPerMaskLength: (maskId: string, meters: number) => {
      const mask = get().masks.find(m => m.id === maskId);
      
      if (!mask || mask.type !== 'linear') return;
      
      try {
        const polylineLength = polylineLengthPx(mask.polyline);
        const override_ppm = polylineLength / meters;
        
        set({
          maskOverrides: {
            ...get().maskOverrides,
            [maskId]: { override_ppm }
          },
          isDirty: true
        });
        
        const updatedMasks = get().masks.map(m => {
          if (m.id === maskId) {
            const metrics = get().computeMetrics(maskId);
            return { ...m, perimeter_m: metrics.perimeter_m };
          }
          return m;
        });
        
        set({ masks: updatedMasks });
        
      } catch (error) {
        console.error('Failed to apply per-mask length:', error);
      }
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

    finishDrawing: (type?: 'area' | 'linear' | 'waterline_band') => {
      const { currentDrawing, photoId, editorState } = get();
      if (!currentDrawing || currentDrawing.length < 2 || !photoId) return;

      // Auto-detect type based on active tool if not specified
      const maskType = type || editorState.activeTool === 'linear' ? 'linear' : 
                           editorState.activeTool === 'waterline' ? 'waterline_band' : 'area';

      const maskId = crypto.randomUUID();
      const now = new Date().toISOString();
      
      let newMask: EditorMask;
      
      if (maskType === 'area') {
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
      } else if (maskType === 'linear') {
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
      const calibrationV2 = state.editorState.calibrationV2;
      const maskOverride = state.maskOverrides[maskId];
      const materialSettings = state.maskMaterials[maskId];
      
      if (!mask) return {};
      
      const metrics: MaskMetrics = {};
      
      // Determine which PPM to use
      let ppm: number | undefined;
      
      if (maskOverride?.override_ppm) {
        // Use per-mask override
        ppm = maskOverride.override_ppm;
      } else if (calibrationV2) {
        // Use V2 calibration
        ppm = calibrationV2.ppm;
      } else if (calibration && validateCalibration(calibration)) {
        // Fallback to legacy calibration
        ppm = calibration.pixelsPerMeter;
      }
      
      if (!ppm) {
        return {};
      }
      
      try {
        if (mask.type === 'area' && 'polygon' in mask) {
          const area = polygonAreaPx(mask.polygon.points);
          metrics.area_m2 = pixelsToSquareMetersV2(area, ppm);
          metrics.qty_effective = metrics.area_m2;
        } else if (mask.type === 'linear' && 'polyline' in mask) {
          const length = polylineLengthPx(mask.polyline.points);
          metrics.perimeter_m = pixelsToMetersV2(length, ppm);
          metrics.qty_effective = metrics.perimeter_m;
        } else if (mask.type === 'waterline_band' && 'polyline' in mask) {
          const length = polylineLengthPx(mask.polyline.points);
          metrics.perimeter_m = pixelsToMetersV2(length, ppm);
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