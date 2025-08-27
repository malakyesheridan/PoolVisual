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
  EditorState,
  ToolType,
  ViewMode,
  Photo
} from '@shared/schema';
import { UndoRedoManager } from '@/lib/undoRedo';
import { 
  polygonAreaPx, 
  polylineLengthPx, 
  toSquareMeters, 
  toMetersPx,
  smoothFreehand,
  isPolygonValid,
  generateWaterlineBand
} from '@/lib/geometry';
import { 
  pixelsToMeters, 
  pixelsToSquareMeters, 
  validateCalibration 
} from '@/lib/calibration';
import { apiClient } from '@/lib/api-client';


export interface MaskMetrics {
  area_m2?: number;
  perimeter_m?: number;
  estimatedCost?: number;
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
  
  // Materials
  selectedMaterialId: string | null;
  
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
  
  // Waterline specific
  setBandHeight: (maskId: string, heightM: number) => void;
  
  // View and navigation
  setZoom: (zoom: number) => void;
  setPan: (pan: Vec2) => void;
  setViewMode: (mode: ViewMode) => void;
  resetView: () => void;
  
  // Metrics
  computeMetrics: (maskId: string) => MaskMetrics;
  getAllMetrics: () => Record<string, MaskMetrics>;
  
  // History
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  getUndoAction: () => string | null;
  getRedoAction: () => string | null;
  
  // Persistence
  saveProgress: () => Promise<void>;
  autoSave: () => void;
  
  // Quote generation
  generateQuote: () => Promise<void>;
  
  // Composite rendering
  generateComposite: (mode: 'after' | 'sideBySide') => Promise<void>;
  pollComposite: () => Promise<void>;
  
  // Utility
  clearError: () => void;
  setError: (error: string) => void;
}

type EditorSlice = EditorSliceState & EditorSliceActions;

const defaultEditorState: EditorState = {
  zoom: 1,
  pan: { x: 0, y: 0 },
  activeTool: 'area',
  brushSize: 15,
  mode: 'before',
  isDirty: false
};

export const useEditorStore = create<EditorSlice>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    photo: null,
    photoId: null,
    jobId: null,
    editorState: defaultEditorState,
    masks: [],
    currentDrawing: null,
    selectedMaskId: null,
    selectedMaterialId: null,
    undoRedoManager: new UndoRedoManager(),
    isLoading: false,
    isDirty: false,
    lastSaved: null,
    error: null,
    compositeUrls: {},
    isGeneratingComposite: false,

    // Photo management
    loadPhoto: async (photoId: string, jobId: string) => {
      set({ isLoading: true, error: null });
      
      try {
        const [photo, masks] = await Promise.all([
          apiClient.getPhoto(photoId),
          apiClient.getMasks(photoId)
        ]);
        
        const editorMasks: EditorMask[] = masks.map(mask => ({
          id: mask.id,
          photoId: mask.photoId,
          type: mask.type,
          createdBy: mask.createdBy,
          createdAt: mask.createdAt,
          updatedAt: mask.createdAt,
          ...(mask.type === 'area' && {
            polygon: JSON.parse(mask.pathJson as string),
            area_m2: mask.areaM2 ? Number(mask.areaM2) : undefined,
            materialId: mask.materialId ?? undefined
          }),
          ...(mask.type === 'linear' && {
            polyline: JSON.parse(mask.pathJson as string),
            perimeter_m: mask.perimeterM ? Number(mask.perimeterM) : undefined,
            materialId: mask.materialId ?? undefined
          }),
          ...(mask.type === 'waterline_band' && {
            polyline: JSON.parse(mask.pathJson as string),
            band_height_m: Number(mask.bandHeightM) || 0.3,
            perimeter_m: mask.perimeterM ? Number(mask.perimeterM) : undefined,
            area_m2: mask.areaM2 ? Number(mask.areaM2) : undefined,
            materialId: mask.materialId ?? undefined
          })
        })) as EditorMask[];
        
        const calibration = photo.calibrationPixelsPerMeter ? {
          ...(photo.calibrationMetaJson as CalibrationData),
          pixelsPerMeter: Number(photo.calibrationPixelsPerMeter)
        } : undefined;
        
        set({
          photo: {
            id: photo.id,
            originalUrl: photo.originalUrl,
            width: photo.width,
            height: photo.height,
            jobId: photo.jobId,
            exifJson: photo.exifJson,
            calibrationPixelsPerMeter: photo.calibrationPixelsPerMeter,
            calibrationMetaJson: photo.calibrationMetaJson,
            createdAt: photo.createdAt
          },
          photoId,
          jobId,
          masks: editorMasks,
          editorState: {
            ...defaultEditorState,
            calibration: calibration || undefined
          },
          isLoading: false
        });
        
        // Initialize undo/redo manager with current state
        const undoRedoManager = new UndoRedoManager();
        undoRedoManager.pushState(editorMasks, calibration, undefined, 'Initialize');
        set({ undoRedoManager });
        
      } catch (error) {
        set({ 
          error: error instanceof Error ? error.message : 'Failed to load photo',
          isLoading: false 
        });
      }
    },

    setPhoto: (photo: Photo) => {
      set({ photo });
    },

    loadImageFile: (file: File, imageUrl: string, dimensions: { width: number; height: number }) => {
      // Create a temporary photo object for the uploaded image
      const tempPhoto: Photo = {
        id: 'temp-' + Date.now(),
        jobId: 'temp-job',
        originalUrl: imageUrl,
        width: dimensions.width,
        height: dimensions.height,
        exifJson: null,
        calibrationPixelsPerMeter: null,
        calibrationMetaJson: null,
        createdAt: new Date()
      };
      
      set({ 
        photo: tempPhoto,
        photoId: tempPhoto.id,
        jobId: 'temp-job',
        masks: [],
        selectedMaskId: null,
        currentDrawing: null,
        isDirty: false,
        lastSaved: null,
        error: null,
        editorState: {
          ...get().editorState,
          calibration: undefined
        }
      });
    },

    // Calibration
    setCalibration: (calibration: CalibrationData) => {
      const state = get();
      const newEditorState = { ...state.editorState, calibration };
      
      set({ 
        editorState: newEditorState,
        isDirty: true 
      });
      
      // Push to history
      state.undoRedoManager.pushState(
        state.masks, 
        calibration, 
        state.selectedMaskId ?? undefined,
        'Set calibration'
      );
    },

    clearCalibration: () => {
      const state = get();
      const newEditorState = { ...state.editorState, calibration: undefined };
      
      set({ 
        editorState: newEditorState,
        isDirty: true 
      });
      
      // Push to history
      state.undoRedoManager.pushState(
        state.masks, 
        undefined, 
        state.selectedMaskId ?? undefined,
        'Clear calibration'
      );
    },

    // Drawing tools
    setActiveTool: (tool: ToolType) => {
      const state = get();
      set({ 
        editorState: { ...state.editorState, activeTool: tool },
        currentDrawing: null // Cancel any current drawing
      });
    },

    setBrushSize: (size: number) => {
      const state = get();
      set({ 
        editorState: { ...state.editorState, brushSize: Math.max(1, Math.min(100, size)) }
      });
    },

    startDrawing: (point: Vec2) => {
      set({ currentDrawing: [point] });
    },

    addPoint: (point: Vec2) => {
      const state = get();
      if (!state.currentDrawing) return;
      
      const newDrawing = [...state.currentDrawing, point];
      set({ currentDrawing: newDrawing });
    },

    finishDrawing: (type) => {
      const state = get();
      if (!state.currentDrawing || state.currentDrawing.length < 2) {
        set({ currentDrawing: null });
        return;
      }
      
      const drawingType = type || (state.editorState.activeTool === 'area' || state.editorState.activeTool === 'linear' || state.editorState.activeTool === 'waterline' ? state.editorState.activeTool : 'area');
      if (drawingType !== 'area' && drawingType !== 'linear' && drawingType !== 'waterline_band') {
        set({ currentDrawing: null });
        return;
      }
      
      // Smooth the path
      const smoothedPoints = smoothFreehand(state.currentDrawing, state.editorState.brushSize / 4);
      
      // Create mask
      const maskId = crypto.randomUUID();
      const now = new Date().toISOString();
      
      let newMask: EditorMask;
      
      if (drawingType === 'area') {
        if (smoothedPoints.length < 3) {
          set({ currentDrawing: null });
          return;
        }
        
        const polygon = { points: smoothedPoints };
        if (!isPolygonValid(smoothedPoints)) {
          set({ error: 'Invalid polygon - please draw a valid shape' });
          set({ currentDrawing: null });
          return;
        }
        
        newMask = {
          id: maskId,
          photoId: state.photoId!,
          type: 'area',
          polygon,
          materialId: state.selectedMaterialId ?? undefined,
          createdBy: 'current-user', // This should come from auth
          createdAt: now,
          updatedAt: now
        } as AreaMask;
        
      } else if (drawingType === 'linear') {
        newMask = {
          id: maskId,
          photoId: state.photoId!,
          type: 'linear',
          polyline: { points: smoothedPoints },
          materialId: state.selectedMaterialId ?? undefined,
          createdBy: 'current-user',
          createdAt: now,
          updatedAt: now
        } as LinearMask;
        
      } else { // waterline_band
        newMask = {
          id: maskId,
          photoId: state.photoId!,
          type: 'waterline_band',
          polyline: { points: smoothedPoints },
          band_height_m: 0.3, // Default 30cm
          materialId: state.selectedMaterialId ?? undefined,
          createdBy: 'current-user',
          createdAt: now,
          updatedAt: now
        } as WaterlineMask;
      }
      
      const newMasks = [...state.masks, newMask];
      
      set({ 
        masks: newMasks,
        currentDrawing: null,
        selectedMaskId: maskId,
        isDirty: true
      });
      
      // Push to history
      state.undoRedoManager.pushState(
        newMasks, 
        state.editorState.calibration, 
        maskId,
        `Create ${drawingType} mask`
      );
    },

    cancelDrawing: () => {
      set({ currentDrawing: null });
    },

    // Mask management
    selectMask: (maskId: string | null) => {
      set({ selectedMaskId: maskId });
    },

    setSelectedMaterialId: (materialId: string | null) => {
      set({ selectedMaterialId: materialId, isDirty: true });
    },

    deleteMask: (maskId: string) => {
      const state = get();
      const newMasks = state.masks.filter(mask => mask.id !== maskId);
      
      set({ 
        masks: newMasks,
        selectedMaskId: state.selectedMaskId === maskId ? null : state.selectedMaskId,
        isDirty: true
      });
      
      // Push to history
      state.undoRedoManager.pushState(
        newMasks, 
        state.editorState.calibration, 
        state.selectedMaskId === maskId ? undefined : (state.selectedMaskId ?? undefined),
        'Delete mask'
      );
    },

    updateMask: (maskId: string, updates: Partial<EditorMask>) => {
      const state = get();
      const newMasks = state.masks.map(mask => {
        if (mask.id === maskId) {
          return { ...mask, ...updates, updatedAt: new Date().toISOString() } as EditorMask;
        }
        return mask;
      });
      
      set({ 
        masks: newMasks,
        isDirty: true
      });
      
      // Push to history for significant changes
      if ('polygon' in updates || 'polyline' in updates || 'band_height_m' in updates) {
        state.undoRedoManager.pushState(
          newMasks, 
          state.editorState.calibration, 
          state.selectedMaskId ?? undefined,
          'Update mask'
        );
      }
    },

    attachMaterial: (maskId: string, materialId: string) => {
      const state = get();
      get().updateMask(maskId, { materialId });
      set({ selectedMaterialId: materialId });
    },

    detachMaterial: (maskId: string) => {
      const state = get();
      const newMasks = state.masks.map(mask => {
        if (mask.id === maskId) {
          const { materialId, ...rest } = mask;
          return { ...rest, updatedAt: new Date().toISOString() } as EditorMask;
        }
        return mask;
      });
      
      set({ 
        masks: newMasks,
        isDirty: true
      });
    },

    resetEditor: () => {
      set({
        photo: null,
        photoId: null,
        jobId: null,
        masks: [],
        currentDrawing: null,
        selectedMaskId: null,
        selectedMaterialId: null,
        editorState: defaultEditorState,
        undoRedoManager: new UndoRedoManager(),
        isDirty: false,
        lastSaved: null,
        error: null,
        compositeUrls: {},
        isGeneratingComposite: false
      });
    },

    setBandHeight: (maskId: string, heightM: number) => {
      get().updateMask(maskId, { band_height_m: heightM });
    },

    eraseFromSelected: (points: Vec2[], brushSize: number) => {
      const state = get();
      if (!state.selectedMaskId || points.length === 0) return;
      
      const mask = state.masks.find(m => m.id === state.selectedMaskId);
      if (!mask || mask.type !== 'area') return;
      
      // Simple implementation: remove points that are close to eraser stroke
      // In a production app, you'd implement proper polygon subtraction
      const threshold = brushSize / 2;
      const updatedPolygon = mask.polygon.points.filter(point => {
        return !points.some(erasePoint => {
          const dx = point.x - erasePoint.x;
          const dy = point.y - erasePoint.y;
          return Math.sqrt(dx * dx + dy * dy) < threshold;
        });
      });
      
      if (updatedPolygon.length >= 3) {
        get().updateMask(state.selectedMaskId, { 
          polygon: { points: updatedPolygon } 
        });
      } else {
        // If too few points remain, delete the mask
        get().deleteMask(state.selectedMaskId);
      }
    },

    // View and navigation
    setZoom: (zoom: number) => {
      const state = get();
      set({ 
        editorState: { 
          ...state.editorState, 
          zoom: Math.max(0.1, Math.min(10, zoom)) 
        }
      });
    },

    setPan: (pan: Vec2) => {
      const state = get();
      set({ editorState: { ...state.editorState, pan } });
    },

    setViewMode: (mode: ViewMode) => {
      const state = get();
      set({ editorState: { ...state.editorState, mode } });
    },

    resetView: () => {
      const state = get();
      set({ 
        editorState: { 
          ...state.editorState, 
          zoom: 1, 
          pan: { x: 0, y: 0 } 
        }
      });
    },

    // Metrics computation
    computeMetrics: (maskId: string) => {
      const state = get();
      const mask = state.masks.find(m => m.id === maskId);
      if (!mask || !state.editorState.calibration) return {};
      
      const calibration = state.editorState.calibration;
      
      try {
        if (mask.type === 'area') {
          const areaPixels = polygonAreaPx(mask.polygon.points, mask.polygon.holes);
          const area_m2 = pixelsToSquareMeters(areaPixels, calibration);
          return { area_m2 };
          
        } else if (mask.type === 'linear') {
          const lengthPixels = polylineLengthPx(mask.polyline.points);
          const perimeter_m = pixelsToMeters(lengthPixels, calibration);
          return { perimeter_m };
          
        } else if (mask.type === 'waterline_band') {
          const lengthPixels = polylineLengthPx(mask.polyline.points);
          const perimeter_m = pixelsToMeters(lengthPixels, calibration);
          const bandHeightPixels = mask.band_height_m * calibration.pixelsPerMeter;
          const bandAreaPixels = lengthPixels * bandHeightPixels;
          const area_m2 = pixelsToSquareMeters(bandAreaPixels, calibration);
          return { perimeter_m, area_m2 };
        }
      } catch (error) {
        console.warn('Error computing metrics:', error);
      }
      
      return {};
    },

    getAllMetrics: () => {
      const state = get();
      const metrics: Record<string, MaskMetrics> = {};
      
      for (const mask of state.masks) {
        metrics[mask.id] = get().computeMetrics(mask.id);
      }
      
      return metrics;
    },

    // History
    undo: () => {
      const state = get();
      const previousState = state.undoRedoManager.undo();
      
      if (previousState) {
        set({
          masks: previousState.masks,
          editorState: {
            ...state.editorState,
            calibration: previousState.calibration || undefined
          },
          selectedMaskId: previousState.selectedMaskId,
          isDirty: true
        });
      }
    },

    redo: () => {
      const state = get();
      const nextState = state.undoRedoManager.redo();
      
      if (nextState) {
        set({
          masks: nextState.masks,
          editorState: {
            ...state.editorState,
            calibration: nextState.calibration || undefined
          },
          selectedMaskId: nextState.selectedMaskId,
          isDirty: true
        });
      }
    },

    canUndo: () => get().undoRedoManager.canUndo(),
    canRedo: () => get().undoRedoManager.canRedo(),
    getUndoAction: () => get().undoRedoManager.getUndoAction(),
    getRedoAction: () => get().undoRedoManager.getRedoAction(),

    // Persistence
    saveProgress: async () => {
      const state = get();
      if (!state.photoId || !state.isDirty) return;
      
      set({ isLoading: true, error: null });
      
      try {
        // Save calibration if changed
        if (state.editorState.calibration) {
          // This would need to be implemented in the API client
          console.log('Saving calibration:', state.editorState.calibration);
        }
        
        // Save masks (this would typically be implemented in the backend)
        // For now, we'll mark as saved
        console.log('Saving masks:', state.masks);
        
        set({ 
          isDirty: false, 
          lastSaved: new Date().toISOString(),
          isLoading: false 
        });
        
      } catch (error) {
        set({ 
          error: error instanceof Error ? error.message : 'Failed to save progress',
          isLoading: false 
        });
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

    // Quote generation
    generateQuote: async () => {
      const state = get();
      if (!state.jobId || state.masks.length === 0) return;
      
      set({ isLoading: true, error: null });
      
      try {
        // First save current progress
        await get().saveProgress();
        
        // Generate quote (this would typically be implemented in the backend)
        console.log('Generating quote for job:', state.jobId);
        
        set({ isLoading: false });
        
        // Navigate to quote view or show success
        // This would typically trigger a navigation
        
      } catch (error) {
        set({ 
          error: error instanceof Error ? error.message : 'Failed to generate quote',
          isLoading: false 
        });
      }
    },

    // Composite rendering
    generateComposite: async (mode: 'after' | 'sideBySide') => {
      const state = get();
      if (!state.photoId) return;
      
      set({ isGeneratingComposite: true, error: null });
      
      try {
        // Generate composite (this would typically be implemented in the backend)
        console.log('Generating composite for photo:', state.photoId, 'mode:', mode);
        
        // Start polling for results
        get().pollComposite();
        
      } catch (error) {
        set({ 
          error: error instanceof Error ? error.message : 'Failed to generate composite',
          isGeneratingComposite: false 
        });
      }
    },

    pollComposite: async () => {
      const state = get();
      if (!state.photoId) return;
      
      try {
        // Poll composite status (this would typically be implemented in the backend)
        const results = { after: undefined, sideBySide: undefined };
        
        set({ 
          compositeUrls: {
            ...state.compositeUrls,
            ...results
          },
          isGeneratingComposite: !results.after && !results.sideBySide
        });
        
        // Continue polling if still generating
        if (state.isGeneratingComposite) {
          setTimeout(() => get().pollComposite(), 2000);
        }
        
      } catch (error) {
        set({ 
          error: error instanceof Error ? error.message : 'Failed to check composite status',
          isGeneratingComposite: false 
        });
      }
    },

    // Utility
    clearError: () => set({ error: null }),
    setError: (error: string) => set({ error })
  }))
);

// Set up auto-save subscription
useEditorStore.subscribe(
  (state) => state.isDirty,
  (isDirty) => {
    if (isDirty) {
      useEditorStore.getState().autoSave();
    }
  }
);