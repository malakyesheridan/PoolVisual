import { useState, useEffect } from 'react';
import { useEditorStore } from './store';
import { Asset } from './types';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from '../components/ui/tooltip';
import { useUnifiedAssetStore, useAssetSelectors } from '../stores/unifiedAssetStore';

export function AssetsPanel() {
  const { assets, selectedAssetId, dispatch } = useEditorStore();
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Use unified asset store
  const { loadAssets, recordUsage, setSearchQuery: setStoreSearchQuery, setCategoryFilter } = useUnifiedAssetStore();
  const { filteredAssets, categories } = useAssetSelectors();

  // Load assets on mount
  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  // Sync search and category filters
  useEffect(() => {
    setStoreSearchQuery(searchQuery);
  }, [searchQuery, setStoreSearchQuery]);

  useEffect(() => {
    setCategoryFilter(selectedCategory);
  }, [selectedCategory, setCategoryFilter]);

  const handleAssetSelect = (assetId: string) => {
    console.log('[AssetsPanel] Asset selected for placement:', assetId);
    
    // Record usage in unified store
    recordUsage(assetId);
    
    // Set place mode with asset ID
    dispatch({ type: 'SET_ASSET_PLACE_MODE', payload: { defId: assetId } });
    
    // Change cursor to indicate placement mode
    document.body.style.cursor = 'crosshair';
    
    console.log('[AssetsPanel] Asset place mode activated:', assetId);
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
    <TooltipProvider>
      <div className="h-full flex flex-col">
      {/* Header - Fixed */}
      <div className="flex-shrink-0 p-4 border-b bg-white">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Assets</h3>
          <div className="text-xs text-gray-500">
            {filteredAssets.length} assets
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
                  ? 'bg-primary text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Search Input */}
      <div className="flex-shrink-0 p-4 border-b bg-gray-50">
        <input
          type="text"
          placeholder="Search assets..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        />
      </div>

      {/* Contextual Message */}
      <div className="flex-shrink-0 p-4 border-b bg-green-50">
        <div className="text-sm text-green-700">
          <strong>Click an asset</strong> to place it on the canvas
        </div>
      </div>

      {/* Scrollable Asset Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-2">
          {filteredAssets.map((asset) => (
            <Tooltip key={asset.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleAssetSelect(asset.id)}
                  className="p-2 border border-gray-200 rounded text-left hover:border-blue-300 hover:bg-primary/5 transition-colors"
                >
                  {/* Asset Preview */}
                  <div className="w-full h-16 bg-gray-100 rounded mb-2 flex items-center justify-center overflow-hidden">
                    <img 
                      src={asset.thumbnailUrl} 
                      alt={asset.name}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        // Fallback to text if image fails to load
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const fallback = target.nextElementSibling as HTMLElement;
                        if (fallback) {
                          fallback.style.display = 'flex';
                        }
                      }}
                    />
                    <div className="hidden text-xs text-gray-500 items-center justify-center">{asset.name}</div>
                  </div>
                  
                  <div className="text-sm font-medium">{asset.name}</div>
                  <div className="text-xs text-gray-500">
                    {asset.dimensions.width}×{asset.dimensions.height}px
                  </div>
                  <div className="text-xs text-gray-400">{asset.category}</div>
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-center">
                  <div className="font-medium">{asset.name}</div>
                  <div className="text-xs text-gray-300">{asset.category}</div>
                  <div className="text-xs text-gray-400">{asset.dimensions.width}×{asset.dimensions.height}px</div>
                  {asset.price && (
                    <div className="text-xs text-green-600">${asset.price}</div>
                  )}
                  {asset.description && (
                    <div className="text-xs text-gray-400 mt-1">{asset.description}</div>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
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
                const unifiedAsset = useUnifiedAssetStore.getState().assets[asset.defId];
                return (
                  <div
                    key={asset.id}
                    className={`p-2 text-xs rounded cursor-pointer ${
                      selectedAssetId === asset.id
                        ? 'bg-primary/10 border border-blue-300'
                        : 'bg-white border border-gray-200 hover:bg-gray-50'
                    }`}
                    onClick={() => dispatch({ type: 'SET_SELECTED_ASSET', payload: asset.id })}
                  >
                    <div className="font-medium">{unifiedAsset?.name || asset.defId}</div>
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
        <div className="flex-shrink-0 p-4 bg-primary/5 border-t border-primary/20">
          <div className="text-sm text-primary">
            <strong>Place Mode:</strong> Click on canvas to place{' '}
            {useUnifiedAssetStore.getState().assets[useEditorStore.getState().assetPlaceMode!.defId]?.name || useEditorStore.getState().assetPlaceMode!.defId}
          </div>
          <button
            onClick={() => {
              dispatch({ type: 'SET_ASSET_PLACE_MODE', payload: null });
              document.body.style.cursor = 'default';
            }}
            className="mt-2 px-3 py-1 text-xs bg-primary text-white rounded hover:bg-primary"
          >
            Cancel
          </button>
        </div>
      )}
      </div>
    </TooltipProvider>
  );
}
