// client/src/components/canvas/modelBindings.ts
// Bindings to connect existing editor model to new texture rendering system

import { useEditorStore as useOldEditorStore } from '@/stores/editorSlice';
import { useMaterialsStore } from '@/state/materialsStore';
import type { MaskRecord } from '../../state/editorStore';

// Convert existing masks to new format
export function getAllMasks(): MaskRecord[] {
  const masks = useOldEditorStore.getState().masks;
  return masks.map(mask => ({
    id: mask.id,
    kind: mask.type as 'area'|'linear'|'band',
    polygon: mask.path?.points || [],
    material_id: mask.materialId || null,
    material_meta: mask.materialMeta || null,
  }));
}

export function getMaskById(id: string): MaskRecord | null {
  const masks = getAllMasks();
  return masks.find(m => m.id === id) || null;
}

export function patchMask(id: string, patch: Partial<MaskRecord>) {
  const store = useOldEditorStore.getState();
  
  // Convert back to old format and update
  if (patch.material_id !== undefined || patch.material_meta !== undefined) {
    // Find the mask and update it directly
    const maskIndex = store.masks.findIndex(m => m.id === id);
    if (maskIndex >= 0) {
      const updatedMask = {
        ...store.masks[maskIndex],
        materialId: patch.material_id || store.masks[maskIndex].materialId,
        materialMeta: patch.material_meta || store.masks[maskIndex].materialMeta,
      };
      // Use the existing update mechanism
      store.updateMask(updatedMask);
    }
  }
}

export function pushUndo(label: string) {
  // Wire to existing undo system if available
  console.info('[Undo]', label);
}

export function getPxPerMeter(): number {
  const store = useOldEditorStore.getState();
  return store.calibration?.ppm || 120; // fallback to reasonable default
}