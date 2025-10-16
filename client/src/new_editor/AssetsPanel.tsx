import { useState, useEffect } from 'react';
import { useEditorStore } from './store';
import { Asset } from './types';

interface AssetDef {
  id: string;
  name: string;
  url: string;
  width: number;
  height: number;
  category: string;
}

// Asset definitions - same as in AssetsLayerKonva
const ASSET_DEFINITIONS: Record<string, AssetDef> = {
  'tree_palm_01': {
    id: 'tree_palm_01',
    name: 'Palm Tree',
    url: '/assets/full/tree_palm_01.svg',
    width: 400,
    height: 600,
    category: 'Trees'
  },
  'tree_oak_01': {
    id: 'tree_oak_01',
    name: 'Oak Tree',
    url: '/assets/full/tree_oak_01.svg',
    width: 500,
    height: 700,
    category: 'Trees'
  },
  'tree_pine_01': {
    id: 'tree_pine_01',
    name: 'Pine Tree',
    url: '/assets/full/tree_pine_01.svg',
    width: 350,
    height: 550,
    category: 'Trees'
  },
  'furniture_chair_01': {
    id: 'furniture_chair_01',
    name: 'Pool Chair',
    url: '/assets/full/furniture_chair_01.svg',
    width: 200,
    height: 300,
    category: 'Furniture'
  },
  'furniture_table_01': {
    id: 'furniture_table_01',
    name: 'Pool Table',
    url: '/assets/full/furniture_table_01.svg',
    width: 300,
    height: 200,
    category: 'Furniture'
  }
};

export function AssetsPanel() {
  const { assets, selectedAssetId, dispatch } = useEditorStore();
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Get unique categories
  const categories = ['All', ...new Set(Object.values(ASSET_DEFINITIONS).map(def => def.category))];

  // Filter assets by category
  const filteredAssets = selectedCategory === 'All' 
    ? Object.values(ASSET_DEFINITIONS)
    : Object.values(ASSET_DEFINITIONS).filter(def => def.category === selectedCategory);

  const handleAssetSelect = (defId: string) => {
    console.log('[AssetsPanel] Asset selected for placement:', defId);
    
    // Set place mode
    dispatch({ type: 'SET_ASSET_PLACE_MODE', payload: { defId } });
    
    // Change cursor to indicate placement mode
    document.body.style.cursor = 'crosshair';
    
    console.log('[AssetsPanel] Asset place mode activated:', defId);
  };

  const handleCanvasClick = (event: React.MouseEvent) => {
    const { assetPlaceMode } = useEditorStore.getState();
    
    if (!assetPlaceMode) return;
    
    // Get canvas position (this would need to be passed from Canvas component)
    // For now, we'll create the asset at a default position
    const newAsset: Asset = {
      id: `asset_${Date.now()}`,
      defId: assetPlaceMode.defId,
      x: 200, // Default position - will be improved in Stage 5
      y: 150,
      scale: 1.0,
      rotation: 0,
      opacity: 1.0,
      createdAt: Date.now(),
      settings: {
        brightness: 0,
        contrast: 0,
        saturation: 0,
        hue: 0,
        blur: 0,
        shadow: {
          enabled: false,
          offsetX: 2,
          offsetY: 2,
          blur: 5,
          opacity: 0.3
        }
      }
    };
    
    // Add the asset
    console.log('[AssetsPanel] Creating new asset:', newAsset);
    dispatch({ type: 'ADD_ASSET', payload: newAsset });
    
    // Clear place mode
    dispatch({ type: 'SET_ASSET_PLACE_MODE', payload: null });
    
    // Reset cursor
    document.body.style.cursor = 'default';
    
    console.log('[AssetsPanel] Asset placed:', newAsset.id);
  };

  // Asset placement is now handled by Konva stage click handler
  // No need for global click listener

  return (
    <div className="h-full flex flex-col">
      {/* Header - Fixed */}
      <div className="flex-shrink-0 p-4 border-b bg-white">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Assets</h3>
          <div className="text-xs text-gray-500">
            {Object.keys(ASSET_DEFINITIONS).length} assets
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex-shrink-0 p-4 border-b bg-gray-50">
        <div className="flex gap-2 flex-wrap">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-3 py-1 text-sm rounded ${
                selectedCategory === category
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable Asset Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-2">
          {filteredAssets.map((assetDef) => (
            <button
              key={assetDef.id}
              onClick={() => handleAssetSelect(assetDef.id)}
              className="p-2 border border-gray-200 rounded text-left hover:border-blue-300 hover:bg-blue-50 transition-colors"
            >
              {/* Asset Preview */}
              <div className="w-full h-16 bg-gray-100 rounded mb-2 flex items-center justify-center text-xs text-gray-500">
                {assetDef.name}
              </div>
              
              <div className="text-sm font-medium">{assetDef.name}</div>
              <div className="text-xs text-gray-500">
                {assetDef.width}×{assetDef.height}px
              </div>
              <div className="text-xs text-gray-400">{assetDef.category}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Placed Assets List */}
      {assets.length > 0 && (
        <div className="flex-shrink-0 border-t bg-gray-50">
          <div className="p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Placed Assets ({assets.length})</h4>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {assets.map((asset) => {
                const def = ASSET_DEFINITIONS[asset.defId];
                return (
                  <div
                    key={asset.id}
                    className={`p-2 text-xs rounded cursor-pointer ${
                      selectedAssetId === asset.id
                        ? 'bg-blue-100 border border-blue-300'
                        : 'bg-white border border-gray-200 hover:bg-gray-50'
                    }`}
                    onClick={() => dispatch({ type: 'SET_SELECTED_ASSET', payload: asset.id })}
                  >
                    <div className="font-medium">{def?.name || asset.defId}</div>
                    <div className="text-gray-500">
                      Scale: {(asset.scale * 100).toFixed(0)}% | 
                      Pos: ({asset.x}, {asset.y})
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Place Mode Indicator */}
      {useEditorStore.getState().assetPlaceMode && (
        <div className="flex-shrink-0 p-4 bg-blue-50 border-t border-blue-200">
          <div className="text-sm text-blue-700">
            <strong>Place Mode:</strong> Click on canvas to place{' '}
            {ASSET_DEFINITIONS[useEditorStore.getState().assetPlaceMode!.defId]?.name}
          </div>
          <button
            onClick={() => {
              dispatch({ type: 'SET_ASSET_PLACE_MODE', payload: null });
              document.body.style.cursor = 'default';
            }}
            className="mt-2 px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
