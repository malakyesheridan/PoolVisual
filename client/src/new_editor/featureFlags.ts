// Feature flag for Material Library integration
// Set to true to enable real material library, false for placeholder materials
export const PV_MATERIAL_LIBRARY_ENABLED = import.meta.env.VITE_PV_MATERIAL_LIBRARY_ENABLED === 'true' || import.meta.env.DEV;

// Feature flag for Under-Water Effect v1.5
// Set to true to enable enhanced underwater pipeline, false for v1.0 effect
export const PV_UNDERWATER_V15 = import.meta.env.VITE_PV_UNDERWATER_V15 === 'true' || import.meta.env.DEV;

// Feature flag for Under-Water Effect v1.6 Polish
// Set to true to enable auto-calibrated defaults and enhanced realism, false for v1.5 effect
export const PV_UNDERWATER_V16_POLISH = import.meta.env.VITE_PV_UNDERWATER_V16_POLISH === 'true' || import.meta.env.DEV;

// Feature flag for Under-Water Effect v2.0
// Set to true to enable realistic pool optics with 5-layer pipeline, false for v1.6 effect
export const PV_UNDERWATER_V20 = import.meta.env.VITE_PV_UNDERWATER_V20 === 'true' || import.meta.env.DEV;

// Feature flag for Precision Masks v1
// Set to true to enable precision drawing tools, snapping, and vertex editing
export const PV_PRECISE_MASKS = import.meta.env.VITE_PV_PRECISE_MASKS === 'true' || import.meta.env.DEV;

// Feature flag for Asset Library
// Set to true to enable drag-drop asset library with decals and transform gizmo
export const PV_ASSET_LIBRARY = import.meta.env.VITE_PV_ASSET_LIBRARY === 'true' || import.meta.env.DEV;

// Assets feature flag helper
export function isAssetsEnabled(): boolean {
  // Check environment variable
  if (!PV_ASSET_LIBRARY) return false;
  
  // Check URL parameter
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('assets') === '1') return true;
  
  // Default to environment flag
  return PV_ASSET_LIBRARY;
}

// Kill switch function to disable assets feature
export function disableAssetsFeature(): void {
  console.log('[ASSETS] Feature disabled via kill switch');
  // This function can be called to completely disable the assets feature
  // All asset components should check isAssetsEnabled() before rendering
}


// Feature flag for Pool Templates
// Set to true to enable pool template library with geometry generation
export const PV_POOL_TEMPLATES = import.meta.env.VITE_PV_POOL_TEMPLATES === 'true' || import.meta.env.DEV;

// Feature flag for Surface Assets (future)
// Set to true to enable surface prefabs that create polygon masks
export const PV_SURFACE_ASSETS = import.meta.env.VITE_PV_SURFACE_ASSETS === 'true' || false;

// Material Library configuration
export const MATERIAL_LIBRARY_CONFIG = {
  // Cache settings
  maxCacheEntries: 50,
  cacheEvictionThreshold: 0.8, // Evict when 80% full
  
  // Default values
  defaultPhysicalRepeatM: 0.3, // meters per tile
  defaultTileScale: 1.0,
  minTileScale: 0.25,
  maxTileScale: 4.0,
  
  // Heuristic pixels per meter for materials without calibration
  heuristicPPM: 1000, // Assume 1000 pixels per meter for typical pool images
  
  // Fallback material (removed hardcoded albedoURL to prevent silent replacements)
  fallbackMaterial: {
    id: 'fallback',
    name: 'Neutral Fill',
    category: 'fallback',
    albedoURL: '', // Empty to prevent silent replacements
    physicalRepeatM: 0.3,
    defaultTileScale: 1.0
  }
};
