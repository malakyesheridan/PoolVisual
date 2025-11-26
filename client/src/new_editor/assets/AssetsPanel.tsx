import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { 
  Plus, 
  Search, 
  Edit3, 
  Lock, 
  Unlock, 
  Eye, 
  EyeOff, 
  Trash2, 
  ArrowUp, 
  ArrowDown,
  Settings,
  Upload
} from 'lucide-react';
import { useAssetsStore } from './store';
import { ASSET_DEFINITIONS, ASSET_CATEGORIES, getAssetDefsByCategory } from './definitions';
import { preloadAssetImages } from './imageLoader';
// Import editor store for coordinate conversion
import { useEditorStore } from '../store';

export function AssetsPanel() {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const {
    byId,
    order,
    selectedAssetId,
    editMode,
    defsById,
    addAsset,
    removeAsset,
    bringForward,
    sendBackward,
    setSelectedAsset,
    setEditMode,
    loadAssetDefs,
    syncWithAssetSource,
    restore,
  } = useAssetsStore();

  // Get photoSpace from editor store
  const { photoSpace } = useEditorStore();

  // Handle file upload for custom assets
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      try {
        // Validate file type
        if (!file.type.startsWith('image/')) {
          console.warn('[AssetsPanel] Skipping non-image file:', file.name);
          continue;
        }

        // Read file as data URL
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        // Get image dimensions
        const img = new Image();
        img.onload = () => {
          // Create custom asset definition
          const customDef = {
            id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: file.name.replace(/\.[^/.]+$/, ""),
            category: 'custom',
            url: dataUrl,
            thumbnail: dataUrl,
            defaultScale: 1.0
          };

          // Add to asset definitions
          loadAssetDefs([customDef]);

          console.log('[AssetsPanel] Added custom asset:', customDef.name);
        };
        img.src = dataUrl;
      } catch (error) {
        console.error('[AssetsPanel] Error uploading file:', file.name, error);
      }
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle upload button click
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // Initialize asset definitions and restore from localStorage
  useEffect(() => {
    // Use the unified sync method to load assets
    const loadAssets = async () => {
      try {
        console.log('[AssetsPanel] Loading assets via unified system...');
        await syncWithAssetSource();
        preloadAssetImages(Object.values(defsById));
      } catch (error) {
        console.error('[AssetsPanel] Error loading assets:', error);
        // Fallback to static definitions
        loadAssetDefs(ASSET_DEFINITIONS);
        preloadAssetImages(ASSET_DEFINITIONS);
      }
    };
    
    loadAssets();
    restore();
  }, [syncWithAssetSource, loadAssetDefs, restore, defsById]);

  // Filter asset definitions
  const filteredDefs = Object.values(defsById)
    .filter(def => selectedCategory === 'all' || def.category === selectedCategory)
    .filter(def => def.name.toLowerCase().includes(search.toLowerCase()));

  // Debug logging
  console.log('[AssetsPanel] Debug:', {
    defsByIdCount: Object.keys(defsById).length,
    defsById: Object.keys(defsById),
    filteredDefsCount: filteredDefs.length,
    selectedCategory,
    search
  });

  // Get placed assets in order
  const placedAssets = order.map(id => byId[id]).filter(Boolean);

  // Unified asset addition function
  const handleAddAssetUnified = async (defId: string, imageX: number, imageY: number) => {
    // Import asset service dynamically to avoid circular imports
    const { assetService } = await import('./assetService');
    
    // Find the asset definition
    const def = defsById[defId];
    if (!def) {
      console.warn('[AssetsPanel] Asset definition not found:', defId);
      return;
    }
    
    // Convert AssetDef to AssetSourceItem format
    const sourceItem = {
      id: def.id,
      name: def.name,
      category: def.category as any,
      thumb: def.thumbnail || def.url,
      src: def.url,
      w: 50, // Default width
      h: 50, // Default height
      author: 'System',
      license: 'internal',
      tags: []
    };
    
    // Use unified asset service
    const assetId = assetService.addAssetAt({
      sourceItem,
      imageX,
      imageY,
      centerOffset: true,
      photoSpace
    });
    
    if (import.meta.env.DEV) {
      console.log('[AssetsPanel:add] Created asset:', assetId);
    }
  };

  // Handle adding asset
  const handleAddAsset = async (defId: string) => {
    // Import asset service dynamically to avoid circular imports
    const { assetService } = await import('./assetService');
    
    // Get viewport center in image-space coordinates using unified method
    const imageCoords = assetService.getViewportCenterInImageSpace(photoSpace);
    if (!imageCoords) {
      console.warn('[AssetsPanel] Could not get viewport center in image space');
      return;
    }
    
    if (import.meta.env.DEV) {
      console.log('[AssetsPanel:add]', { 
        defId, 
        imagePos: imageCoords
      });
    }
    
    // Use unified asset service
    handleAddAssetUnified(defId, imageCoords.x, imageCoords.y);
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!editMode) return;
      
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedAssetId) {
          removeAsset(selectedAssetId);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editMode, selectedAssetId, removeAsset]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b bg-white">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Assets</h3>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleUploadClick}
              className="flex items-center gap-1"
              title="Upload custom assets"
            >
              <Upload className="w-3 h-3" />
              Upload
            </Button>
            <Button
              variant={editMode ? "default" : "outline"}
              size="sm"
              onClick={() => setEditMode(!editMode)}
              className="flex items-center gap-1"
            >
              <Edit3 className="w-3 h-3" />
              {editMode ? 'Editing' : 'Edit'}
            </Button>
          </div>
        </div>
        
        {/* Search and Filter */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search assets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASSET_CATEGORIES.map(category => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Asset Library Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-2 mb-4">
          {filteredDefs.map((def) => (
            <div
              key={def.id}
              className="border rounded-lg p-2 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => handleAddAsset(def.id)}
            >
              <div className="aspect-square bg-gray-100 rounded mb-2 flex items-center justify-center">
                {def.thumbnail ? (
                  <img
                    src={def.thumbnail}
                    alt={def.name}
                    className="w-full h-full object-cover rounded"
                    crossOrigin="anonymous"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="text-gray-400 text-xs text-center">
                    {def.name}
                  </div>
                )}
              </div>
              <div className="text-xs font-medium">{def.name}</div>
              <div className="text-xs text-gray-500 capitalize">{def.category}</div>
            </div>
          ))}
        </div>

        {/* Placed Assets List */}
        {placedAssets.length > 0 && (
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-2">Placed Assets ({placedAssets.length})</h4>
            <div className="space-y-1">
              {placedAssets.map((asset) => {
                const def = defsById[asset.defId];
                if (!def) return null;
                
                return (
                  <div
                    key={asset.id}
                    className={`flex items-center gap-2 p-2 rounded border ${
                      selectedAssetId === asset.id ? 'border-primary bg-primary/5' : 'border-gray-200'
                    }`}
                    onClick={() => setSelectedAsset(asset.id)}
                  >
                    <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center">
                      {def.thumbnail ? (
                        <img
                          src={def.thumbnail}
                          alt={def.name}
                          className="w-full h-full object-cover rounded"
                          crossOrigin="anonymous"
                        />
                      ) : (
                        <div className="text-xs text-gray-400">{def.name[0]}</div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{def.name}</div>
                      <div className="text-xs text-gray-500">
                        {Math.round(asset.scale * 100)}% • {Math.round(asset.rotation)}°
                      </div>
                    </div>
                    
                    {editMode && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            bringForward(asset.id);
                          }}
                          className="h-6 w-6 p-0"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            sendBackward(asset.id);
                          }}
                          className="h-6 w-6 p-0"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeAsset(asset.id);
                          }}
                          className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      
      {/* Hidden file input for asset uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileUpload}
        className="hidden"
      />
    </div>
  );
}
