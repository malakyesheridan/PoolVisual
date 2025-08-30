import { create } from 'zustand';
import type { Material } from './materialsStore';

export type MaskMeta = {
  id: string;
  type: 'area' | 'linear' | 'band';
  material_id?: string | null;
  material_meta?: { 
    scale: number; 
    rotationDeg: number; 
    offsetX: number; 
    offsetY: number;
  } | null;
};

type EditorState = {
  selectedMaskId: string | null;
  showMaterialPicker: boolean;
  
  // Actions
  setSelectedMask: (id: string | null) => void;
  setShowMaterialPicker: (show: boolean) => void;
  
  // Mask and calibration functions (to be wired to existing systems)
  getCalibrationPxPerMeter: () => number;
  getMaskById: (id: string) => MaskMeta | null;
  updateMaskMaterial: (maskId: string, patch: Partial<MaskMeta>) => void;
  pushUndo: (label: string) => void;
  
  // High-level material application
  applyMaterialToMask: (maskId: string, material: Material) => Promise<void>;
  applyMaterialToSelected?: (material: Material) => void;
};

export const useEditorStore = create<EditorState>((set, get) => ({
  selectedMaskId: null,
  showMaterialPicker: false,
  
  setSelectedMask: (id) => set({ selectedMaskId: id }),
  setShowMaterialPicker: (show) => set({ showMaterialPicker: show }),
  
  // Add missing applyMaterialToSelected function with proper repeatPx calculation
  applyMaterialToSelected: (material) => {
    const state = get();
    const maskId = state.selectedMaskId;
    if (!maskId) return;
    
    // Calculate proper repeatPx from calibration and material properties
    const ppm = Math.max(1, state.getCalibrationPxPerMeter()); // pixels per meter from calibration
    const repeatM = 
      (material.physicalRepeatM && material.physicalRepeatM > 0) ? parseFloat(material.physicalRepeatM) :
      (material.sheetWidthMm ? material.sheetWidthMm / 1000 :
      (material.tileWidthMm ? material.tileWidthMm / 1000 : 0.30));

    const repeatPx = repeatM * ppm; // <- this is meta.scale
    const meta = { scale: repeatPx, rotationDeg: 0, offsetX: 0, offsetY: 0 };
    
    console.info('[EditorStore] Applying material with proper scaling:', { 
      maskId, 
      material: material.name, 
      repeatM, 
      ppm, 
      repeatPx 
    });
    
    // Apply material with calculated metadata
    state.updateMaskMaterial(maskId, { material_id: material.id, material_meta: meta });
  },
  
  // TODO: Wire these to your existing editor state/canvas system
  getCalibrationPxPerMeter: () => {
    // Placeholder - replace with actual calibration from canvas
    console.warn('[EditorStore] getCalibrationPxPerMeter needs implementation');
    return 100; // Default 100 pixels per meter
  },
  
  getMaskById: (id) => {
    // Placeholder - replace with actual mask lookup
    console.warn('[EditorStore] getMaskById needs implementation for:', id);
    return null;
  },
  
  updateMaskMaterial: (maskId, patch) => {
    // Placeholder - replace with actual mask update
    console.warn('[EditorStore] updateMaskMaterial needs implementation:', { maskId, patch });
  },
  
  pushUndo: (label) => {
    // Placeholder - replace with actual undo stack
    console.warn('[EditorStore] pushUndo needs implementation:', label);
  },
  
  applyMaterialToMask: async (maskId, material) => {
    console.log('[EditorStore] Applying material to mask:', { maskId, material });
    
    const { getCalibrationPxPerMeter, updateMaskMaterial, pushUndo } = get();
    
    try {
      // Get calibration (pixels per meter)
      const ppm = Math.max(1, getCalibrationPxPerMeter());
      
      // Determine physical repeat in meters
      // Priority: physical_repeat_m > sheet_width_mm > tile_width_mm > 0.3m fallback
      const repeatM = 
        (material.physical_repeat_m && material.physical_repeat_m > 0) ? material.physical_repeat_m :
        (material.sheet_width_mm && material.sheet_width_mm > 0) ? (material.sheet_width_mm / 1000) :
        (material.tile_width_mm && material.tile_width_mm > 0) ? (material.tile_width_mm / 1000) : 
        0.30; // 30cm fallback
      
      // Convert physical repeat to pixels and compute scale
      const repeatPx = repeatM * ppm;
      const defaultScale = repeatPx > 0 ? (256 / repeatPx) : 1; // Assumes 256px texture
      
      const materialMeta = {
        scale: defaultScale,
        rotationDeg: 0,
        offsetX: 0,
        offsetY: 0
      };
      
      // Update the mask with material info
      pushUndo('Apply material');
      updateMaskMaterial(maskId, {
        material_id: material.id,
        material_meta: materialMeta
      });
      
      console.log('[EditorStore] Material applied successfully:', {
        maskId,
        materialId: material.id,
        scale: defaultScale,
        repeatM,
        repeatPx
      });
      
    } catch (error) {
      console.error('[EditorStore] Failed to apply material:', error);
      throw error;
    }
  }
}));