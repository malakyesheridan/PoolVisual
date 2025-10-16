// Bridge between materials and masks
import { useMaskStore } from '../../client/src/maskcore/store';
import { getSelectedMaterialId, getMaterialById } from '../materials/selectors';

export function assignMaterialToSelectedMask(materialId: string | null) {
  const maskStore = useMaskStore.getState();
  const selectedMaskId = maskStore.selectedId;
  
  if (selectedMaskId) {
    console.log('[MaterialAssign]', { maskId: selectedMaskId, materialId });
    maskStore.SET_MATERIAL(selectedMaskId, materialId || '');
  } else {
    console.log('[MaterialAssign] No mask selected, material set as active only');
  }
}

export function getActiveMaterial() {
  const materialId = getSelectedMaterialId();
  return getMaterialById(materialId);
}
