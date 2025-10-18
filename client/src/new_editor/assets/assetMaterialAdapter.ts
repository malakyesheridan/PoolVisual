// Asset-to-Material Adapter
// Converts assets to materials so they can use the existing texture rendering system

import { Material } from '../../materials/registry';

export interface AssetMaterial extends Material {
  // Asset-specific properties
  assetId: string;
  assetName: string;
  assetCategory: string;
  assetDimensions: {
    width: number;
    height: number;
  };
}

// Asset definitions with realistic texture URLs
export const ASSET_MATERIAL_DEFINITIONS: Record<string, Partial<AssetMaterial>> = {
  'tree_palm_01': {
    id: 'asset_tree_palm_01',
    name: 'Palm Tree',
    category: 'coping', // Using existing category for now
    unit: 'each',
    assetId: 'tree_palm_01',
    assetName: 'Palm Tree',
    assetCategory: 'Trees',
    assetDimensions: { width: 400, height: 600 },
    texture_url: '/assets/images/tree_palm_01.jpg', // Realistic image
    thumbnail_url: '/assets/images/tree_palm_01_thumb.jpg',
    physical_repeat_m: 0.4, // Palm tree width in meters
    price: 150.00,
    cost: 120.00,
    sku: 'TREE-PALM-01',
    supplier: 'Landscape Supply Co.',
    color: 'Green',
    finish: 'Natural'
  },
  'tree_oak_01': {
    id: 'asset_tree_oak_01',
    name: 'Oak Tree',
    category: 'coping',
    unit: 'each',
    assetId: 'tree_oak_01',
    assetName: 'Oak Tree',
    assetCategory: 'Trees',
    assetDimensions: { width: 500, height: 700 },
    texture_url: '/assets/images/tree_oak_01.jpg',
    thumbnail_url: '/assets/images/tree_oak_01_thumb.jpg',
    physical_repeat_m: 0.5,
    price: 200.00,
    cost: 160.00,
    sku: 'TREE-OAK-01',
    supplier: 'Landscape Supply Co.',
    color: 'Green/Brown',
    finish: 'Natural'
  },
  'tree_pine_01': {
    id: 'asset_tree_pine_01',
    name: 'Pine Tree',
    category: 'coping',
    unit: 'each',
    assetId: 'tree_pine_01',
    assetName: 'Pine Tree',
    assetCategory: 'Trees',
    assetDimensions: { width: 350, height: 550 },
    texture_url: '/assets/images/tree_pine_01.jpg',
    thumbnail_url: '/assets/images/tree_pine_01_thumb.jpg',
    physical_repeat_m: 0.35,
    price: 180.00,
    cost: 140.00,
    sku: 'TREE-PINE-01',
    supplier: 'Landscape Supply Co.',
    color: 'Green',
    finish: 'Natural'
  },
  'furniture_chair_01': {
    id: 'asset_furniture_chair_01',
    name: 'Pool Chair',
    category: 'coping',
    unit: 'each',
    assetId: 'furniture_chair_01',
    assetName: 'Pool Chair',
    assetCategory: 'Furniture',
    assetDimensions: { width: 200, height: 300 },
    texture_url: '/assets/images/furniture_chair_01.jpg',
    thumbnail_url: '/assets/images/furniture_chair_01_thumb.jpg',
    physical_repeat_m: 0.2,
    price: 250.00,
    cost: 200.00,
    sku: 'FURN-CHAIR-01',
    supplier: 'Pool Furniture Co.',
    color: 'White',
    finish: 'Weather Resistant'
  },
  'furniture_table_01': {
    id: 'asset_furniture_table_01',
    name: 'Pool Table',
    category: 'coping',
    unit: 'each',
    assetId: 'furniture_table_01',
    assetName: 'Pool Table',
    assetCategory: 'Furniture',
    assetDimensions: { width: 300, height: 200 },
    texture_url: '/assets/images/furniture_table_01.jpg',
    thumbnail_url: '/assets/images/furniture_table_01_thumb.jpg',
    physical_repeat_m: 0.3,
    price: 400.00,
    cost: 320.00,
    sku: 'FURN-TABLE-01',
    supplier: 'Pool Furniture Co.',
    color: 'White',
    finish: 'Weather Resistant'
  }
};

// Convert asset definition to material
export function assetToMaterial(assetId: string): AssetMaterial | null {
  const assetDef = ASSET_MATERIAL_DEFINITIONS[assetId];
  if (!assetDef) return null;

  // Create a complete Material object
  const material: AssetMaterial = {
    id: assetDef.id!,
    name: assetDef.name!,
    category: assetDef.category!,
    unit: assetDef.unit!,
    price: assetDef.price || null,
    cost: assetDef.cost || null,
    texture_url: assetDef.texture_url || null,
    thumbnail_url: assetDef.thumbnail_url || null,
    physical_repeat_m: assetDef.physical_repeat_m || null,
    sheet_width_mm: assetDef.sheet_width_mm || null,
    sheet_height_mm: assetDef.sheet_height_mm || null,
    tile_width_mm: assetDef.tile_width_mm || null,
    tile_height_mm: assetDef.tile_height_mm || null,
    created_at: new Date().toISOString(),
    sku: assetDef.sku || null,
    supplier: assetDef.supplier || null,
    color: assetDef.color || null,
    finish: assetDef.finish || null,
    
    // Computed properties
    albedoURL: assetDef.texture_url || undefined,
    thumbnailURL: assetDef.thumbnail_url || undefined,
    physicalRepeatM: assetDef.physical_repeat_m || undefined,
    defaultTileScale: 1.0,
    
    // Asset-specific properties
    assetId: assetDef.assetId!,
    assetName: assetDef.assetName!,
    assetCategory: assetDef.assetCategory!,
    assetDimensions: assetDef.assetDimensions!
  };

  return material;
}

// Get all asset materials
export function getAllAssetMaterials(): AssetMaterial[] {
  return Object.keys(ASSET_MATERIAL_DEFINITIONS)
    .map(assetId => assetToMaterial(assetId))
    .filter((material): material is AssetMaterial => material !== null);
}

// Get asset materials by category
export function getAssetMaterialsByCategory(category: string): AssetMaterial[] {
  return getAllAssetMaterials().filter(material => 
    material.assetCategory.toLowerCase() === category.toLowerCase()
  );
}
