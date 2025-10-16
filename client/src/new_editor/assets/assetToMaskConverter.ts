// Asset to Mask Converter
// Converts asset instances to mask-like entities for unified rendering

import { AssetInstance, AssetDef } from './store';
import { Mask, Pt } from '../../maskcore/store';

export interface AssetMask extends Mask {
  // Inherit all mask properties
  // Add asset-specific properties
  assetType: 'asset';
  assetDefId: string;
  assetUrl: string;
  assetThumbnail?: string;
  assetWidth: number;
  assetHeight: number;
  assetRotation: number;
  assetScale: number;
  assetOpacity: number;
  assetLocked: boolean;
}

/**
 * Convert asset instance to mask-like entity
 * Creates a rectangular mask that represents the asset bounds
 */
export function convertAssetToMask(
  asset: AssetInstance, 
  def: AssetDef
): AssetMask {
  // Calculate asset bounds based on position, scale, and rotation
  const width = (def.width || 50) * asset.scale;
  const height = (def.height || 50) * asset.scale;
  
  // Create rectangular points for the asset bounds
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  
  // Calculate rotated corners
  const cos = Math.cos(asset.rotation);
  const sin = Math.sin(asset.rotation);
  
  const corners: Pt[] = [
    { x: -halfWidth, y: -halfHeight },
    { x: halfWidth, y: -halfHeight },
    { x: halfWidth, y: halfHeight },
    { x: -halfWidth, y: halfHeight }
  ];
  
  // Apply rotation and translation
  const pts: Pt[] = corners.map(corner => ({
    x: asset.x + (corner.x * cos - corner.y * sin),
    y: asset.y + (corner.x * sin + corner.y * cos)
  }));
  
  return {
    // Mask properties
    id: `asset_${asset.id}`,
    pts,
    mode: 'polygon',
    materialId: null, // Assets don't have materials initially
    
    // Asset-specific properties
    assetType: 'asset',
    assetDefId: asset.defId,
    assetUrl: def.url,
    assetThumbnail: def.thumbnail,
    assetWidth: def.width || 50,
    assetHeight: def.height || 50,
    assetRotation: asset.rotation,
    assetScale: asset.scale,
    assetOpacity: asset.opacity,
    assetLocked: asset.locked
  };
}

/**
 * Convert asset mask back to asset instance
 */
export function convertMaskToAsset(assetMask: AssetMask): AssetInstance {
  // Calculate center point from mask points
  const centerX = assetMask.pts.reduce((sum, pt) => sum + pt.x, 0) / assetMask.pts.length;
  const centerY = assetMask.pts.reduce((sum, pt) => sum + pt.y, 0) / assetMask.pts.length;
  
  return {
    id: assetMask.id.replace('asset_', ''),
    defId: assetMask.assetDefId,
    x: centerX,
    y: centerY,
    scale: assetMask.assetScale,
    rotation: assetMask.assetRotation,
    opacity: assetMask.assetOpacity,
    locked: assetMask.assetLocked
  };
}

/**
 * Create asset mask for obscure/non-linear shapes
 * This allows assets to have custom polygon shapes beyond simple rectangles
 */
export function createCustomAssetMask(
  asset: AssetInstance,
  def: AssetDef,
  customPoints: Pt[]
): AssetMask {
  return {
    // Mask properties
    id: `asset_${asset.id}`,
    pts: customPoints,
    mode: 'polygon',
    materialId: null,
    
    // Asset-specific properties
    assetType: 'asset',
    assetDefId: asset.defId,
    assetUrl: def.url,
    assetThumbnail: def.thumbnail,
    assetWidth: def.width || 50,
    assetHeight: def.height || 50,
    assetRotation: asset.rotation,
    assetScale: asset.scale,
    assetOpacity: asset.opacity,
    assetLocked: asset.locked
  };
}

/**
 * Check if a mask is an asset mask
 */
export function isAssetMask(mask: Mask): mask is AssetMask {
  return 'assetType' in mask && mask.assetType === 'asset';
}

/**
 * Get asset definition from asset mask
 */
export function getAssetDefFromMask(assetMask: AssetMask, defsById: Record<string, AssetDef>): AssetDef | null {
  return defsById[assetMask.assetDefId] || null;
}
