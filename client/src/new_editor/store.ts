import { create } from 'zustand';
import { EditorState, EditorAction, PhotoSpace, Mask, Point, UnderwaterRealismSettings, MaskPoint, CalibrationState, MeasurementSettings } from './types';
import { getMaskBounds, pointInPolygon } from './utils';
import { insertVertexAtEdge, removeVertex, moveVertex, toggleVertexKind } from './precisionMasks';
import { HistoryManager } from '../editor/undoRedo/historyManager';

// Guard against NaN/Infinity values
function isFiniteNumber(value: number): boolean {
  return typeof value === 'number' && isFinite(value) && !isNaN(value);
}

// Guard PhotoSpace updates
function guardPhotoSpace(photoSpace: Partial<PhotoSpace>): Partial<PhotoSpace> {
  const guarded: Partial<PhotoSpace> = {};
  
  if (photoSpace.scale !== undefined && isFiniteNumber(photoSpace.scale)) {
    guarded.scale = Math.max(0.01, Math.min(10, photoSpace.scale)); // Clamp to reasonable range
  }
  
  if (photoSpace.panX !== undefined && isFiniteNumber(photoSpace.panX)) {
    guarded.panX = photoSpace.panX;
  }
  
  if (photoSpace.panY !== undefined && isFiniteNumber(photoSpace.panY)) {
    guarded.panY = photoSpace.panY;
  }
  
  if (photoSpace.imgW !== undefined && isFiniteNumber(photoSpace.imgW)) {
    guarded.imgW = Math.max(0, photoSpace.imgW);
  }
  
  if (photoSpace.imgH !== undefined && isFiniteNumber(photoSpace.imgH)) {
    guarded.imgH = Math.max(0, photoSpace.imgH);
  }
  
  if (photoSpace.dpr !== undefined && isFiniteNumber(photoSpace.dpr)) {
    guarded.dpr = Math.max(0.5, Math.min(3, photoSpace.dpr));
  }
  
  return guarded;
}

// Auto-calibrate underwater settings from photo luminance
export function autoCalibrateUnderwaterSettings(
  photoData: ImageData, 
  maskPoints: Point[], 
  photoSpace: PhotoSpace
): Partial<UnderwaterRealismSettings> {
  try {
    // Sample a 64-128px grid inside the mask in image space
    const bounds = getMaskBounds(maskPoints);
    const sampleSize = Math.min(128, Math.min(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) / 4);
    const gridSize = Math.max(8, Math.floor(sampleSize / 8)); // 8x8 to 16x16 grid
    
    let totalLuminance = 0;
    let totalHue = 0;
    let sampleCount = 0;
    
    // Sample grid points within mask bounds
    for (let x = bounds.minX; x < bounds.maxX; x += gridSize) {
      for (let y = bounds.minY; y < bounds.maxY; y += gridSize) {
        // Check if point is inside mask
        if (pointInPolygon({ x, y }, maskPoints)) {
          const pixelIndex = (Math.floor(y) * photoData.width + Math.floor(x)) * 4;
          if (pixelIndex >= 0 && pixelIndex < photoData.data.length - 3) {
            const r = photoData.data[pixelIndex];
            const g = photoData.data[pixelIndex + 1];
            const b = photoData.data[pixelIndex + 2];
            
            // Calculate luminance
            const luminance = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
            totalLuminance += luminance;
            
            // Calculate hue (simplified)
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const delta = max - min;
            let hue = 0;
            if (delta > 0) {
              if (max === r) hue = ((g - b) / delta) % 6;
              else if (max === g) hue = (b - r) / delta + 2;
              else hue = (r - g) / delta + 4;
            }
            totalHue += hue;
            sampleCount++;
          }
        }
      }
    }
    
    if (sampleCount === 0) {
      return {}; // Fallback to defaults
    }
    
    const medianLuminance = totalLuminance / sampleCount;
    const medianHue = totalHue / sampleCount;
    
    // Map luminance to settings (brighter pools → lower tint)
    const tint = Math.max(12, Math.min(28, 28 - (medianLuminance - 0.5) * 20));
    const highlights = Math.max(15, Math.min(28, 28 - (medianLuminance - 0.5) * 15));
    const intensity = Math.max(35, Math.min(55, 45 + (medianLuminance - 0.5) * 20));
    const depthBias = Math.max(18, Math.min(30, 24 + (medianLuminance - 0.5) * 12));
    
    return {
      tint: Math.round(tint),
      highlights: Math.round(highlights),
      blend: Math.round(intensity),
      depthBias: Math.round(depthBias),
      autoCalibrated: true
    };
  } catch (error) {
    console.warn('Auto-calibration failed:', error);
    return {}; // Fallback to defaults
  }
}

// Get default underwater realism settings
export function getDefaultUnderwaterRealismSettings(category?: string, autoCalibrated?: boolean): UnderwaterRealismSettings {
  const isPoolInterior = category === 'interior' || category === 'waterline_tile';
  
  if (autoCalibrated) {
    // v1.6 auto-calibrated defaults (will be overridden by actual calibration)
    return {
      enabled: isPoolInterior,
      blend: 45, // Midpoint of 35-55% range
      refraction: 25, // Keep v1.5 default
      edgeSoftness: 6, // Keep v1.5 default
      depthBias: 24, // Midpoint of 18-30% range
      // v1.5 defaults
      tint: 20, // Midpoint of 12-28% range
      edgeFeather: 8, // Default edge feather in screen space
      highlights: 22, // Midpoint of 15-28% range
      ripple: 0, // Default ripple (off by default)
      // v1.6 defaults
      materialOpacity: 85, // Default material opacity
      autoCalibrated: true, // Mark as auto-calibrated
      contactOcclusion: 9, // Midpoint of 6-12% range
      textureBoost: 20, // Default texture contrast boost
      // v2.0 defaults
      underwaterVersion: 'v1' as const, // Default to v1 for backward compatibility
      meniscus: 32, // Default meniscus highlight (25-40% range)
      softness: 0 // Default softness (off by default)
    };
  }
  
  return {
    enabled: isPoolInterior, // Auto-enable for pool interior materials
    blend: 65, // Default blend strength
    refraction: 25, // Default refraction strength
    edgeSoftness: 6, // Default edge softness in pixels
    depthBias: 35, // Default depth bias (30-40% range)
    // v1.5 defaults
    tint: 18, // Default aqua tint (10-20% range)
    edgeFeather: 8, // Default edge feather in screen space
    highlights: 20, // Default highlight preservation
    ripple: 0, // Default ripple (off by default)
    // v1.6 defaults
    materialOpacity: 85, // Default material opacity
    autoCalibrated: false, // Not auto-calibrated
    contactOcclusion: 9, // Default contact occlusion
    textureBoost: 20, // Default texture contrast boost
    // v2.0 defaults
    underwaterVersion: 'v1' as const, // Default to v1 for backward compatibility
    meniscus: 32, // Default meniscus highlight (25-40% range)
    softness: 0 // Default softness (off by default)
  };
}

// Loop tripwire - track state writes per frame
let stateWritesThisFrame = 0;
let lastFrameTime = 0;

function checkLoopTripwire() {
  const now = performance.now();
  if (now - lastFrameTime > 16) { // New frame
    stateWritesThisFrame = 0;
    lastFrameTime = now;
  }
  
  stateWritesThisFrame++;
  if (stateWritesThisFrame > 25) {
    console.error('[EditorStore] Loop tripwire triggered - too many state writes in one frame', {
      writes: stateWritesThisFrame,
      stack: new Error().stack
    });
    return false;
  }
  
  return true;
}

// Initial state
const initialState: EditorState = {
  photoSpace: {
    scale: 1,
    panX: 0,
    panY: 0,
    imgW: 0,
    imgH: 0,
    dpr: window.devicePixelRatio || 1
  },
  imageUrl: undefined,
  variants: [],
  activeVariantId: null,
  state: 'idle',
  activeTool: 'select',
  drawingPoints: [],
  isDrawing: false,
  // Precision tools state
  precisionMode: 'freehand',
  snappingEnabled: {
    grid: false,
    angle: false,
    edge: false,
    orthogonal: false
  },
  gridSpacing: 24, // Default 24px grid
  selectedVertexIndex: undefined,
  masks: [],
  selectedMaskId: undefined,
  // Assets state (like masks)
  assets: [], // Start with empty array - no test assets
  selectedAssetId: undefined,
  assetPlaceMode: null,
  materials: [], // Materials are now loaded dynamically
  selectedMaterialId: undefined,
  // Pool templates state
  poolTemplates: {},
  history: [],
  historyIndex: -1,
  containerSize: { width: 0, height: 0 },
  zoomLabel: '100%',
  // NEW: Calibration system
  calibration: {
    isCalibrated: false,
    referenceLength: 0,
    referencePixels: 0,
    pixelsPerMeter: 0,
    calibrationDate: 0,
    calibrationMethod: 'manual'
  },
  // NEW: Measurement display settings
  measurements: {
    showMeasurements: true,  // Enable measurements by default
    showCosts: true,         // Enable costs by default
    currency: 'USD',
    unit: 'metric'
  },
  // NEW: Calibration mode
  calibrationMode: false,
  // NEW: Point editing settings
  pointEditing: {
    showGrid: false,
    snapToGrid: false,
    gridOpacity: 0.3
  },
  // NEW: Drawing mode for freehand vs area
  drawingMode: 'area' as const, // Default to area mode
  // NEW: Konva stage reference for canvas export
  konvaStageRef: undefined
};

// Create store with reducer pattern
export const useEditorStore = create<EditorState & {
  dispatch: (action: EditorAction) => void;
  getState: () => EditorState;
}>((set, get) => ({
  ...initialState,
  
  dispatch: (action: EditorAction) => {
    if (!checkLoopTripwire()) {
      return; // Prevent infinite loops
    }
    
    const currentState = get();
    
    switch (action.type) {
      case 'SET_PHOTO_SPACE': {
        const guarded = guardPhotoSpace(action.payload);
        if (Object.keys(guarded).length === 0) {
          console.warn('[EditorStore] Invalid PhotoSpace update ignored');
          return;
        }
        
        set(state => {
          const newPhotoSpace = { ...state.photoSpace, ...guarded };
          
          // Persist photo space state to localStorage (keyed by photoId)
          if (state.jobContext?.photoId && typeof window !== 'undefined') {
            // Use dynamic import instead of require to avoid errors in browser
            import('./photoSpacePersistence').then(({ savePhotoSpace }) => {
              savePhotoSpace(state.jobContext!.photoId!, newPhotoSpace);
            }).catch((error) => {
              console.warn('[EditorStore] Failed to persist photo space:', error);
            });
          }
          
          return {
            ...state,
            photoSpace: newPhotoSpace
          };
        });
        break;
      }
      
      case 'SET_IMAGE': {
        const { url, width, height, naturalWidth, naturalHeight } = action.payload;
        if (!isFiniteNumber(width) || !isFiniteNumber(height)) {
          console.warn('[EditorStore] Invalid image dimensions ignored');
          return;
        }
        
        // Log if natural dimensions differ from provided dimensions (for debugging)
        if (naturalWidth && naturalHeight) {
          const widthDiff = Math.abs(naturalWidth - width);
          const heightDiff = Math.abs(naturalHeight - height);
          if (widthDiff > 1 || heightDiff > 1) {
            console.log('[EditorStore] Using database dimensions instead of natural dimensions:', {
              database: `${width}x${height}`,
              natural: `${naturalWidth}x${naturalHeight}`
            });
          }
        }
        
        set(state => {
          // CRITICAL: Preserve existing zoom/pan when setting image
          // Only update dimensions, don't reset scale/panX/panY
          const currentPhotoSpace = state.photoSpace;
          const newPhotoSpace = {
            ...currentPhotoSpace,
            imgW: width,
            imgH: height
            // Preserve scale, panX, panY from current state
          };
          
          // Initialize variants with Original if this is the first image load
          const originalVariantId = 'original';
          const hasOriginalVariant = state.variants.some(v => v.id === originalVariantId);
          const newVariants = hasOriginalVariant 
            ? state.variants 
            : [{ id: originalVariantId, label: 'Original', imageUrl: url }, ...state.variants];
          
          return {
            ...state,
            imageUrl: url,
            photoSpace: newPhotoSpace,
            state: 'ready',
            variants: newVariants,
            activeVariantId: state.activeVariantId || originalVariantId
          };
        });
        break;
      }
      
      case 'SET_JOB_CONTEXT': {
        const { jobId, photoId } = action.payload;
        set(state => ({
          ...state,
          jobContext: { jobId, photoId }
        }));
        break;
      }
      
      case 'SET_STATE': {
        set(state => ({ ...state, state: action.payload }));
        break;
      }
      
      case 'SET_ACTIVE_TOOL': {
        set(state => ({ ...state, activeTool: action.payload }));
        break;
      }
      
      case 'SET_DRAWING_POINTS': {
        // Validate all points are finite
        const validPoints = action.payload.filter(p => 
          isFiniteNumber(p.x) && isFiniteNumber(p.y)
        );
        
        if (validPoints.length !== action.payload.length) {
          console.warn('[EditorStore] Invalid drawing points filtered out');
        }
        
        // PHASE 3: Store model - DEV logging
        if (import.meta.env.DEV) {
          console.log('MASK_ACTION: SET_DRAWING_POINTS', { pointsCount: validPoints.length });
        }
        
        set(state => ({ ...state, drawingPoints: validPoints }));
        break;
      }
      
      case 'SET_IS_DRAWING': {
        set(state => ({ ...state, isDrawing: action.payload }));
        break;
      }
      
      case 'ADD_MASK': {
        const mask = action.payload;
        // Validate mask points are finite
        const validPoints = mask.points.filter(p => 
          isFiniteNumber(p.x) && isFiniteNumber(p.y)
        );
        
        if (validPoints.length !== mask.points.length) {
          console.warn('[EditorStore] Invalid mask points filtered out');
          return;
        }
        
        // PHASE 3: Store model - DEV logging
        if (import.meta.env.DEV) {
          console.log('MASK_ACTION: ADD_MASK', { id: mask.id, pointsCount: validPoints.length, totalMasks: get().masks.length + 1 });
        }
        
        set(state => ({
          ...state,
          masks: [...state.masks, { ...mask, points: validPoints }]
        }));
        break;
      }
      
      case 'UPDATE_MASK': {
        const { id, updates } = action.payload;
        set(state => ({
          ...state,
          masks: state.masks.map(mask => 
            mask.id === id ? { ...mask, ...updates } : mask
          )
        }));
        break;
      }
      
      case 'REMOVE_MASK': {
        set(state => ({
          ...state,
          masks: state.masks.filter(m => m.id !== action.payload),
          selectedMaskId: state.selectedMaskId === action.payload ? undefined : state.selectedMaskId
        }));
        break;
      }
      
      case 'SET_SELECTED_MASK': {
        set(state => ({ ...state, selectedMaskId: action.payload }));
        break;
      }
      
      // Asset actions (like mask actions)
      case 'ADD_ASSET': {
        const asset = action.payload;
        if (import.meta.env.DEV) {
          console.log('ASSET_ACTION: ADD_ASSET', { id: asset.id, defId: asset.defId, totalAssets: get().assets.length + 1 });
        }
        set(state => ({
          ...state,
          assets: [...state.assets, asset]
        }));
        break;
      }
      
      case 'UPDATE_ASSET': {
        const { id, updates } = action.payload;
        set(state => ({
          ...state,
          assets: state.assets.map(asset => 
            asset.id === id ? { ...asset, ...updates } : asset
          )
        }));
        break;
      }
      
      case 'REMOVE_ASSET': {
        const assetId = action.payload;
        set(state => ({
          ...state,
          assets: state.assets.filter(asset => asset.id !== assetId),
          selectedAssetId: state.selectedAssetId === assetId ? undefined : state.selectedAssetId
        }));
        break;
      }
      
      case 'SET_SELECTED_ASSET': {
        set(state => ({ ...state, selectedAssetId: action.payload }));
        break;
      }
      
      case 'SET_ASSET_PLACE_MODE': {
        set(state => ({ ...state, assetPlaceMode: action.payload }));
        break;
      }
      
      case 'SET_SELECTED_MATERIAL': {
        set(state => ({ ...state, selectedMaterialId: action.payload }));
        break;
      }
      
      case 'SET_CONTAINER_SIZE': {
        const { width, height } = action.payload;
        if (!isFiniteNumber(width) || !isFiniteNumber(height)) {
          console.warn('[EditorStore] Invalid container size ignored');
          return;
        }
        
        set(state => ({ ...state, containerSize: { width, height } }));
        break;
      }
      
      case 'SET_ZOOM_LABEL': {
        set(state => ({ ...state, zoomLabel: action.payload }));
        break;
      }
      
      case 'UPDATE_UNDERWATER_REALISM': {
        const { maskId, settings } = action.payload;
        set(state => ({
          ...state,
          masks: state.masks.map(mask => 
            mask.id === maskId 
              ? { ...mask, underwaterRealism: settings }
              : mask
          )
        }));
        break;
      }
      
      case 'SNAPSHOT': {
        const currentState = get();
        const snapshot = {
          ...currentState,
          history: currentState.history,
          historyIndex: currentState.historyIndex
        };
        
        // Persist to HistoryManager if projectId available
        const projectId = currentState.jobContext?.photoId || 'default';
        try {
          const hm = getHistoryManager(projectId);
          hm.push({
            id: crypto.randomUUID(),
            type: 'batch',
            action: 'snapshot',
            timestamp: Date.now(),
          });
          // Persist checkpoint with full snapshot
          // Convert Mask[] to EditorMask[] format (AreaMask)
          const snapshotForHistory: EditorSnapshot = {
            masks: currentState.masks.map(m => ({
              id: m.id,
              photoId: currentState.jobContext?.photoId || '',
              type: 'area' as const,
              createdBy: 'current-user', // TODO: Get from auth
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              polygon: {
                points: m.points,
              },
              materialId: m.materialId,
            })),
            selectedMaskId: currentState.selectedMaskId,
            calibration: currentState.calibration ? {
              pixelsPerMeter: currentState.calibration.pixelsPerMeter,
              a: { x: 0, y: 0 }, // TODO: Store actual calibration points
              b: { x: 0, y: 0 },
              lengthMeters: currentState.calibration.referenceLength,
            } : undefined,
            timestamp: Date.now(),
            action: 'snapshot',
            history: [],
          };
          hm.persistCheckpoint(snapshotForHistory).catch(console.error);
        } catch (error) {
          console.warn('[Store] Failed to persist history:', error);
        }
        
        set(state => ({
          ...state,
          history: [...state.history.slice(0, state.historyIndex + 1), snapshot],
          historyIndex: state.historyIndex + 1
        }));
        break;
      }
      
      case 'UNDO': {
        const currentState = get();
        if (currentState.historyIndex > 0) {
          const previousState = currentState.history[currentState.historyIndex - 1];
          
          // Track in HistoryManager
          const projectId = currentState.jobContext?.photoId || 'default';
          try {
            const hm = getHistoryManager(projectId);
            hm.undo();
          } catch (error) {
            console.warn('[Store] Failed to track undo in HistoryManager:', error);
          }
          
          set(state => ({
            ...previousState,
            history: state.history,
            historyIndex: state.historyIndex - 1
          }));
        }
        break;
      }
      
      case 'REDO': {
        const currentState = get();
        if (currentState.historyIndex < currentState.history.length - 1) {
          const nextState = currentState.history[currentState.historyIndex + 1];
          
          // Track in HistoryManager
          const projectId = currentState.jobContext?.photoId || 'default';
          try {
            const hm = getHistoryManager(projectId);
            hm.redo();
          } catch (error) {
            console.warn('[Store] Failed to track redo in HistoryManager:', error);
          }
          
          set(state => ({
            ...nextState,
            history: state.history,
            historyIndex: state.historyIndex + 1
          }));
        }
        break;
      }
      
      case 'RESET': {
        set(state => ({
          ...initialState,
          jobContext: state.jobContext // Preserve job context during reset
        }));
        break;
      }
      
      // Precision tools actions
      case 'SET_PRECISION_MODE': {
        set(state => ({ ...state, precisionMode: action.payload }));
        break;
      }
      
      case 'TOGGLE_SNAPPING': {
        set(state => ({
          ...state,
          snappingEnabled: {
            ...state.snappingEnabled,
            [action.payload]: !state.snappingEnabled[action.payload]
          }
        }));
        break;
      }
      
      case 'SET_GRID_SPACING': {
        if (isFiniteNumber(action.payload) && action.payload > 0) {
          set(state => ({ ...state, gridSpacing: action.payload }));
        }
        break;
      }
      
      case 'SET_SELECTED_VERTEX': {
        set(state => ({ ...state, selectedVertexIndex: action.payload }));
        break;
      }
      
      case 'INSERT_VERTEX': {
        const { maskId, edgeIndex, point } = action.payload;
        set(state => ({
          ...state,
          masks: state.masks.map(mask => 
            mask.id === maskId 
              ? { ...mask, points: insertVertexAtEdge(mask.points, edgeIndex, point) }
              : mask
          )
        }));
        break;
      }
      
      case 'DELETE_VERTEX': {
        const { maskId, vertexIndex } = action.payload;
        set(state => ({
          ...state,
          masks: state.masks.map(mask => 
            mask.id === maskId 
              ? { ...mask, points: removeVertex(mask.points, vertexIndex) }
              : mask
          )
        }));
        break;
      }
      
      case 'MOVE_VERTEX': {
        const { maskId, vertexIndex, point } = action.payload;
        set(state => ({
          ...state,
          masks: state.masks.map(mask => 
            mask.id === maskId 
              ? { ...mask, points: moveVertex(mask.points, vertexIndex, point) }
              : mask
          )
        }));
        break;
      }
      
      case 'TOGGLE_VERTEX_KIND': {
        const { maskId, vertexIndex } = action.payload;
        set(state => ({
          ...state,
          masks: state.masks.map(mask => 
            mask.id === maskId 
              ? { ...mask, points: toggleVertexKind(mask.points, vertexIndex) }
              : mask
          )
        }));
        break;
      }
      
      case 'APPLY_TEMPLATE': {
        const { template, mode } = action.payload;
        set(state => {
          if (mode === 'replace') {
            return {
              ...state,
              masks: [],
              selectedMaskId: null
            };
          } else {
            return state;
          }
        });
        break;
      }
      
      // Pool template actions
      case 'ADD_POOL_TEMPLATE': {
        const template = action.payload;
        set(state => ({
          ...state,
          poolTemplates: { ...state.poolTemplates, [template.id]: template }
        }));
        break;
      }
      
      case 'UPDATE_POOL_TEMPLATE': {
        const { id, updates } = action.payload;
        set(state => ({
          ...state,
          poolTemplates: {
            ...state.poolTemplates,
            [id]: { ...state.poolTemplates[id], ...updates }
          }
        }));
        break;
      }
      
      case 'REMOVE_POOL_TEMPLATE': {
        const templateId = action.payload;
        set(state => ({
          ...state,
          poolTemplates: Object.fromEntries(
            Object.entries(state.poolTemplates).filter(([id]) => id !== templateId)
          )
        }));
        break;
      }
      
      case 'SET_SELECTED_POOL_TEMPLATE': {
        set(state => ({ ...state, selectedPoolTemplateId: action.payload }));
        break;
      }
      
      // NEW: Calibration actions
      case 'SET_CALIBRATION': {
        set(state => ({ ...state, calibration: action.payload }));
        break;
      }
      
      case 'UPDATE_CALIBRATION': {
        set(state => ({ 
          ...state, 
          calibration: { ...state.calibration, ...action.payload }
        }));
        break;
      }
      
      case 'RESET_CALIBRATION': {
        set(state => ({ 
          ...state, 
          calibration: {
            isCalibrated: false,
            referenceLength: 0,
            referencePixels: 0,
            pixelsPerMeter: 0,
            calibrationDate: 0,
            calibrationMethod: 'manual'
          }
        }));
        break;
      }
      
      case 'SET_MEASUREMENT_SETTINGS': {
        set(state => ({ 
          ...state, 
          measurements: { ...state.measurements, ...action.payload }
        }));
        break;
      }
      
      case 'SET_CALIBRATION_MODE': {
        console.log('[Store] SET_CALIBRATION_MODE:', action.payload);
        set(state => ({ ...state, calibrationMode: action.payload }));
        break;
      }
      
      // NEW: Point editing actions
      case 'SET_POINT_EDITING_SETTINGS': {
        set(state => ({ 
          ...state, 
          pointEditing: { ...state.pointEditing, ...action.payload }
        }));
        break;
      }
      
      case 'TOGGLE_GRID_VISIBILITY': {
        set(state => ({ 
          ...state, 
          pointEditing: { 
            ...state.pointEditing, 
            showGrid: !state.pointEditing.showGrid 
          }
        }));
        break;
      }
      
      case 'TOGGLE_GRID_SNAPPING': {
        set(state => ({ 
          ...state, 
          pointEditing: { 
            ...state.pointEditing, 
            snapToGrid: !state.pointEditing.snapToGrid 
          }
        }));
        break;
      }
      
      // NEW: Drawing mode actions
      case 'SET_DRAWING_MODE': {
        set(state => ({ 
          ...state, 
          drawingMode: action.payload
        }));
        break;
      }
      
      case 'SET_KONVA_STAGE_REF': {
        set(state => ({ 
          ...state, 
          konvaStageRef: action.payload
        }));
        break;
      }
      
      // NEW: Canvas variant actions
      case 'ADD_VARIANT': {
        const variant = action.payload;
        set(state => {
          // Check if variant with same ID already exists
          const exists = state.variants.some(v => v.id === variant.id);
          if (exists) {
            console.warn('[EditorStore] Variant with ID already exists:', variant.id);
            return state;
          }
          return {
            ...state,
            variants: [...state.variants, variant],
            activeVariantId: variant.id
          };
        });
        break;
      }
      
      case 'SET_ACTIVE_VARIANT': {
        const variantId = action.payload;
        set(state => {
          // Validate variant exists
          const variant = state.variants.find(v => v.id === variantId);
          if (!variant && variantId !== null) {
            console.warn('[EditorStore] Variant not found:', variantId);
            return state;
          }
          return {
            ...state,
            activeVariantId: variantId,
            // Update imageUrl to match active variant
            imageUrl: variant ? variant.imageUrl : state.imageUrl
          };
        });
        break;
      }
      
      case 'REMOVE_VARIANT': {
        const variantId = action.payload;
        set(state => {
          // Don't allow removing the original variant
          if (variantId === 'original') {
            console.warn('[EditorStore] Cannot remove original variant');
            return state;
          }
          
          const newVariants = state.variants.filter(v => v.id !== variantId);
          const newActiveVariantId = state.activeVariantId === variantId
            ? (newVariants.length > 0 ? newVariants[0].id : 'original')
            : state.activeVariantId;
          
          return {
            ...state,
            variants: newVariants,
            activeVariantId: newActiveVariantId,
            // Update imageUrl to match new active variant
            imageUrl: newVariants.find(v => v.id === newActiveVariantId)?.imageUrl || state.imageUrl
          };
        });
        break;
      }
    }
  },
  
  getState: () => get()
}));
