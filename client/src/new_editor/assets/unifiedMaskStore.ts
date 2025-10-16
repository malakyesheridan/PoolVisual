// Unified Mask Store Integration
// Integrates assets into the mask system for unified rendering and behavior

import { useMaskStore } from '../../maskcore/store';
import { useAssetsStore } from './store';
import { convertAssetToMask, convertMaskToAsset, isAssetMask, AssetMask } from './assetToMaskConverter';
import { Mask } from '../../maskcore/store';

/**
 * Get all masks including converted assets
 */
export function getAllMasks(): Record<string, Mask> {
  try {
    const maskStore = useMaskStore.getState();
    const assetStore = useAssetsStore.getState();
    
    const allMasks: Record<string, Mask> = { ...maskStore.masks };
    
    // Convert assets to masks
    if (assetStore && assetStore.byId && assetStore.defsById) {
      Object.values(assetStore.byId).forEach(asset => {
        const def = assetStore.defsById[asset.defId];
        if (def) {
          const assetMask = convertAssetToMask(asset, def);
          allMasks[assetMask.id] = assetMask;
        }
      });
    }
    
    return allMasks;
  } catch (error) {
    console.warn('[getAllMasks] Error getting masks:', error);
    return {};
  }
}

/**
 * Get selected mask (could be regular mask or asset)
 */
export function getSelectedMask(): Mask | null {
  const maskStore = useMaskStore.getState();
  const assetStore = useAssetsStore.getState();
  
  const selectedId = maskStore.selectedId;
  if (!selectedId) return null;
  
  // Check if it's a regular mask
  if (maskStore.masks[selectedId]) {
    return maskStore.masks[selectedId];
  }
  
  // Check if it's an asset mask
  if (selectedId.startsWith('asset_')) {
    const assetId = selectedId.replace('asset_', '');
    const asset = assetStore.byId[assetId];
    if (asset) {
      const def = assetStore.defsById[asset.defId];
      if (def) {
        return convertAssetToMask(asset, def);
      }
    }
  }
  
  return null;
}

/**
 * Handle selection of mask or asset
 */
export function selectMaskOrAsset(id: string): void {
  const maskStore = useMaskStore.getState();
  const assetStore = useAssetsStore.getState();
  
  if (id.startsWith('asset_')) {
    // It's an asset - deselect masks and select asset
    maskStore.SELECT(null);
    const assetId = id.replace('asset_', '');
    assetStore.setSelectedAsset(assetId);
  } else {
    // It's a regular mask - deselect assets and select mask
    assetStore.setSelectedAsset(null);
    maskStore.SELECT(id);
  }
}

/**
 * Deselect all masks and assets
 */
export function deselectAll(): void {
  const maskStore = useMaskStore.getState();
  const assetStore = useAssetsStore.getState();
  
  maskStore.SELECT(null);
  assetStore.setSelectedAsset(null);
  
  // Also exit point editing mode when deselecting
  if (maskStore.pointEditingMode) {
    maskStore.EXIT_POINT_EDITING();
  }
}

/**
 * Update asset from mask changes
 */
export function updateAssetFromMask(assetMask: AssetMask): void {
  const assetStore = useAssetsStore.getState();
  const assetId = assetMask.id.replace('asset_', '');
  
  const updatedAsset = convertMaskToAsset(assetMask);
  assetStore.updateAsset(assetId, updatedAsset);
}

/**
 * Check if selection is an asset
 */
export function isSelectedAsset(): boolean {
  const maskStore = useMaskStore.getState();
  const assetStore = useAssetsStore.getState();
  
  return !!assetStore.selectedAssetId || 
         (!!maskStore.selectedId && maskStore.selectedId.startsWith('asset_'));
}

/**
 * Get selected asset ID (if any)
 */
export function getSelectedAssetId(): string | null {
  const assetStore = useAssetsStore.getState();
  const maskStore = useMaskStore.getState();
  
  if (assetStore.selectedAssetId) {
    return assetStore.selectedAssetId;
  }
  
  if (maskStore.selectedId && maskStore.selectedId.startsWith('asset_')) {
    return maskStore.selectedId.replace('asset_', '');
  }
  
  return null;
}
