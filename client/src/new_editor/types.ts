// Core types for the new canvas editor

export interface PhotoSpace {
  scale: number;
  panX: number;
  panY: number;
  imgW: number;
  imgH: number;
  dpr: number;
  fitScale?: number; // Baseline scale for "100% zoom" (the fit-to-canvas scale)
}

export interface Point {
  x: number;
  y: number;
}

export interface MaskPoint {
  x: number; // image px
  y: number; // image px
  kind: 'corner' | 'smooth'; // smooth = bezier corner (optional for v1 ui)
  h1?: { x: number; y: number }; // optional bezier handle in image px
  h2?: { x: number; y: number };
}

export interface UnderwaterRealismSettings {
  enabled: boolean;
  blend: number; // 0-100% - overall tint/attenuation strength
  refraction: number; // 0-100% - how much pattern warps with ripples
  edgeSoftness: number; // 0-12px - feather/inner shadow falloff
  depthBias: number; // 0-100% - depth falloff gradient strength
  // v1.5 parameters
  tint: number; // 0-100% - aqua tint strength
  edgeFeather: number; // 0-20px - inner feather in screen space
  highlights: number; // 0-100% - highlight preservation strength
  ripple: number; // 0-100% - micro-refraction strength (optional)
  // v1.6 parameters
  materialOpacity: number; // 0-100% - material opacity before blend stack
  autoCalibrated: boolean; // true if defaults were auto-calibrated from photo
  contactOcclusion: number; // 0-100% - edge contact darkening strength
  textureBoost: number; // 0-100% - texture contrast enhancement
  // v2.0 parameters
  underwaterVersion: 'v1' | 'v2'; // which underwater pipeline to use
  meniscus: number; // 0-100% - meniscus edge highlight opacity/width
  softness: number; // 0-100% - global post-blur for gentle integration
  sampledWaterHue?: { h: number; s: number; v: number }; // cached sampled water color
  causticMask?: string; // cached caustic mask data URL
}

export interface Mask {
  id: string;
  points: Point[];
  materialId?: string;
  name?: string;
  // Enhanced calibration fields for mask-specific measurements
  customCalibration?: {
    estimatedLength?: number; // User's estimated length in meters
    estimatedWidth?: number;  // User's estimated width in meters
    // NEW: Per-edge calibration for perspective correction
    edgeMeasurements?: {
      edgeIndex: number;        // Which edge (0, 1, 2, ...)
      pixelLength: number;      // Measured pixel length
      realWorldLength: number;   // User-entered real-world length (meters)
      pixelsPerMeter: number;   // Calculated: pixelLength / realWorldLength
    }[];
    calibrationMethod: 'reference' | 'estimated' | 'auto' | 'manual_edges';
    confidence: 'high' | 'medium' | 'low';
    lastUpdated: number; // timestamp
  };
  // NEW: Mask type for freehand vs area
  type?: 'area' | 'linear';     // 'area' = closed polygon, 'linear' = open polyline (default: 'area')
}

export interface Material {
  id: string;
  name: string;
  textureUrl: string;
  scale: number;
}

export interface Asset {
  id: string;
  defId: string; // Reference to asset definition
  x: number; // Position in image space (same as masks)
  y: number;
  scale: number; // Scale factor (0.1 - 5.0)
  rotation: number; // Rotation in degrees
  opacity: number; // Opacity (0.0 - 1.0)
  createdAt: number;
  // Asset-specific settings (like mask materials)
  settings?: {
    brightness?: number; // -100 to 100
    contrast?: number; // -100 to 100
    saturation?: number; // -100 to 100
    hue?: number; // -180 to 180
    blur?: number; // 0 to 20
    shadow?: {
      enabled: boolean;
      offsetX: number;
      offsetY: number;
      blur: number;
      opacity: number;
    };
  };
}

// Legacy Material interface - kept for backward compatibility
// New materials use MaterialLibraryEntry from materialLibrary.ts

// NEW: Calibration system interfaces
export interface CalibrationState {
  isCalibrated: boolean;
  referenceLength: number;     // Known length in meters
  referencePixels: number;    // Measured length in pixels
  pixelsPerMeter: number;     // Calculated conversion factor
  calibrationDate: number;    // When calibration was done (timestamp)
  calibrationMethod: 'manual' | 'reference_object' | 'known_dimensions';
}

export interface MeasurementSettings {
  showMeasurements: boolean;
  showCosts: boolean;
  currency: string;
  unit: 'metric' | 'imperial';
}

export interface CanvasVariant {
  id: string;
  label: string; // e.g. "Original", "AI Enhanced 1"
  imageUrl: string;
  loadingState?: 'idle' | 'loading' | 'loaded' | 'error';
  errorMessage?: string;
  retryCount?: number;
  loadedAt?: number;
}

export interface EditorState {
  // Photo state
  photoSpace: PhotoSpace;
  imageUrl?: string;
  state: 'idle' | 'loading' | 'ready' | 'error';
  
  // Canvas variants (for enhanced images)
  variants: CanvasVariant[];
  activeVariantId: string | null;
  loadingVariantId: string | null; // Track which variant is currently loading
  
  // Enhancement lock
  isEnhancing: boolean; // Global lock to prevent concurrent enhancements
  pendingEnhancement: {
    variantId: string;
    imageUrl: string;
    activeVariantIdAtStart: string | null;
  } | null; // Track pending enhancement for cancellation
  
  // Job context
  jobContext?: {
    jobId: string;
    photoId: string;
  };
  
  // Tool state
  activeTool: 'select' | 'area' | 'polygon' | 'pen' | 'pan';
  drawingPoints: Point[]; // Current drawing points (screen space)
  isDrawing: boolean;
  
  // Precision drawing state
  precisionMode: 'freehand' | 'polygon' | 'pen';
  snappingEnabled: {
    grid: boolean;
    angle: boolean;
    edge: boolean;
    orthogonal: boolean;
  };
  gridSpacing: number; // pixels
  selectedVertexIndex?: number; // for editing
  
  // Masks
  masks: Mask[];
  selectedMaskId?: string;
  
  // Assets (like masks)
  assets: Asset[];
  selectedAssetId?: string;
  assetPlaceMode?: { defId: string } | null; // When placing an asset
  
  // Materials
  materials: Material[]; // Legacy - materials now loaded dynamically
  selectedMaterialId?: string;
  
  // Pool Templates (new)
  poolTemplates: Record<string, any>; // PoolTemplateId -> PoolTemplate
  selectedPoolTemplateId?: string;
  
  // History
  history: EditorState[];
  historyIndex: number;
  
  // UI state
  containerSize: { width: number; height: number };
  zoomLabel: string;
  
  // NEW: Calibration system
  calibration: CalibrationState;
  
  // NEW: Measurement display settings
  measurements: MeasurementSettings;
  
  // NEW: Calibration mode
  calibrationMode: boolean;
  
  // NEW: Point editing settings
  pointEditing: {
    showGrid: boolean;
    snapToGrid: boolean;
    gridOpacity: number;
  };
  
  // NEW: Drawing mode for freehand vs area
  drawingMode: 'area' | 'freehand'; // 'area' = closed polygon, 'freehand' = open polyline
  
  // NEW: Konva stage reference for canvas export
  konvaStageRef?: any; // Konva.Stage | null
}

export type EditorAction = 
  | { type: 'SET_PHOTO_SPACE'; payload: Partial<PhotoSpace> }
  | { type: 'SET_IMAGE'; payload: { url: string; width: number; height: number; naturalWidth?: number; naturalHeight?: number; photoId?: string } }
  | { type: 'SET_STATE'; payload: EditorState['state'] }
  | { type: 'SET_JOB_CONTEXT'; payload: { jobId: string; photoId: string } }
  | { type: 'SET_ACTIVE_TOOL'; payload: EditorState['activeTool'] }
  | { type: 'SET_DRAWING_POINTS'; payload: Point[] }
  | { type: 'SET_IS_DRAWING'; payload: boolean }
  | { type: 'ADD_MASK'; payload: Mask }
  | { type: 'UPDATE_MASK'; payload: { id: string; updates: Partial<Mask> } }
  | { type: 'REMOVE_MASK'; payload: string }
  | { type: 'SET_SELECTED_MASK'; payload?: string }
  // Asset actions (like mask actions)
  | { type: 'ADD_ASSET'; payload: Asset }
  | { type: 'UPDATE_ASSET'; payload: { id: string; updates: Partial<Asset> } }
  | { type: 'REMOVE_ASSET'; payload: string }
  | { type: 'SET_SELECTED_ASSET'; payload?: string }
  | { type: 'SET_ASSET_PLACE_MODE'; payload: { defId: string } | null }
  | { type: 'SET_SELECTED_MATERIAL'; payload?: string }
  | { type: 'SET_CONTAINER_SIZE'; payload: { width: number; height: number } }
  | { type: 'SET_ZOOM_LABEL'; payload: string }
  | { type: 'UPDATE_UNDERWATER_REALISM'; payload: { maskId: string; settings: UnderwaterRealismSettings } }
  | { type: 'SNAPSHOT' }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'RESET' }
  // Precision tools actions
  | { type: 'SET_PRECISION_MODE'; payload: EditorState['precisionMode'] }
  | { type: 'TOGGLE_SNAPPING'; payload: keyof EditorState['snappingEnabled'] }
  | { type: 'SET_GRID_SPACING'; payload: number }
  | { type: 'SET_SELECTED_VERTEX'; payload?: number }
  | { type: 'INSERT_VERTEX'; payload: { maskId: string; edgeIndex: number; point: MaskPoint } }
  | { type: 'DELETE_VERTEX'; payload: { maskId: string; vertexIndex: number } }
  | { type: 'MOVE_VERTEX'; payload: { maskId: string; vertexIndex: number; point: MaskPoint } }
  | { type: 'TOGGLE_VERTEX_KIND'; payload: { maskId: string; vertexIndex: number } }
  // Pool template actions
  | { type: 'ADD_POOL_TEMPLATE'; payload: any }
  | { type: 'UPDATE_POOL_TEMPLATE'; payload: { id: string; updates: any } }
  | { type: 'REMOVE_POOL_TEMPLATE'; payload: string }
  | { type: 'SET_SELECTED_POOL_TEMPLATE'; payload?: string }
  // NEW: Calibration actions
  | { type: 'SET_CALIBRATION'; payload: CalibrationState }
  | { type: 'UPDATE_CALIBRATION'; payload: Partial<CalibrationState> }
  | { type: 'RESET_CALIBRATION' }
  | { type: 'SET_MEASUREMENT_SETTINGS'; payload: Partial<MeasurementSettings> }
  | { type: 'SET_CALIBRATION_MODE'; payload: boolean }
  // Canvas variant actions
  | { type: 'ADD_VARIANT'; payload: CanvasVariant }
  | { type: 'SET_ACTIVE_VARIANT'; payload: string | null }
  | { type: 'SET_VARIANTS'; payload: { variants: CanvasVariant[]; activeVariantId: string | null } }
  | { type: 'UPDATE_VARIANT_LOADING_STATE'; payload: { variantId: string; loadingState: 'idle' | 'loading' | 'loaded' | 'error'; errorMessage?: string; loadedAt?: number } }
  | { type: 'INCREMENT_VARIANT_RETRY'; payload: { variantId: string } }
  | { type: 'SET_LOADING_VARIANT'; payload: string | null }
  | { type: 'SET_ENHANCING'; payload: boolean }
  | { type: 'SET_PENDING_ENHANCEMENT'; payload: { variantId: string; imageUrl: string; activeVariantIdAtStart: string | null } | null }
  | { type: 'CANCEL_PENDING_ENHANCEMENT' }
  // NEW: Point editing actions
  | { type: 'SET_POINT_EDITING_SETTINGS'; payload: Partial<EditorState['pointEditing']> }
  | { type: 'TOGGLE_GRID_VISIBILITY' }
  // NEW: Drawing mode actions
  | { type: 'SET_DRAWING_MODE'; payload: 'area' | 'freehand' }
  | { type: 'TOGGLE_GRID_SNAPPING' }
  // NEW: Konva stage reference for canvas export
  | { type: 'SET_KONVA_STAGE_REF'; payload: any | null } // Konva.Stage | null
  // NEW: Canvas variant actions
  | { type: 'ADD_VARIANT'; payload: CanvasVariant }
  | { type: 'SET_ACTIVE_VARIANT'; payload: string | null }
  | { type: 'SET_VARIANTS'; payload: { variants: CanvasVariant[]; activeVariantId: string | null } }
  | { type: 'REMOVE_VARIANT'; payload: string }
