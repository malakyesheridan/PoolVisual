// Asset Library UI Component
// Displays asset cards with search, filter, and drag functionality

import React, { useState, useEffect, useCallback } from 'react';
import { AssetSourceItem, AssetCategory } from './types';
import { assetSource } from './assetSource';
import { useAssetDragStart } from './dragDrop';

interface AssetLibraryProps {
  onAssetDragStart?: (asset: AssetSourceItem) => void;
}

export function AssetLibrary({ onAssetDragStart }: AssetLibraryProps) {
  const [items, setItems] = useState<AssetSourceItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<AssetSourceItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<AssetCategory | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  
  const handleDragStart = useAssetDragStart();

  // Load assets on mount
  useEffect(() => {
    const loadAssets = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log('Loading asset manifest...');
        await assetSource.loadManifest();
        const loadedItems = assetSource.getItems();
        console.log('Loaded assets:', loadedItems.length, loadedItems);
        setItems(loadedItems);
        setFilteredItems(loadedItems);
      } catch (err) {
        console.error('Failed to load assets:', err);
        setError('Failed to load asset library');
        setItems([]);
        setFilteredItems([]);
      } finally {
        setLoading(false);
      }
    };

    loadAssets();
  }, []);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Filter items based on search and category
  useEffect(() => {
    let filtered = items;

    // Apply search filter
    if (debouncedQuery.trim()) {
      filtered = assetSource.searchItems(debouncedQuery);
    }

    // Apply category filter
    if (selectedCategory) {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }

    setFilteredItems(filtered);
  }, [items, debouncedQuery, selectedCategory]);

  // Get unique categories
  const categories = assetSource.getCategories();
  const sourceInfo = assetSource.getSourceInfo();

  // Handle drag start
  const handleAssetDragStart = async (asset: AssetSourceItem, event: React.DragEvent) => {
    // Import drag-drop system dynamically to avoid circular imports
    const { assetDragDrop } = await import('./dragDrop');
    await assetDragDrop.startDrag(asset, event);
    onAssetDragStart?.(asset);
  };

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      try {
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
          const newAsset: AssetSourceItem = {
            id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: file.name.replace(/\.[^/.]+$/, ""),
            category: 'custom',
            thumb: dataUrl,
            src: dataUrl,
            w: img.naturalWidth,
            h: img.naturalHeight,
            author: 'Custom',
            license: 'uploaded',
            tags: ['custom', 'uploaded']
          };

          // Add to manifest (in memory for now)
          const currentItems = assetSource.getItems();
          assetSource.addItem(newAsset);
          
          // Update UI
          setItems(prev => [...prev, newAsset]);
          setFilteredItems(prev => [...prev, newAsset]);
        };
        img.src = dataUrl;
      } catch (error) {
        console.error('Failed to upload file:', file.name, error);
      }
    }

    // Reset input
    event.target.value = '';
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-500">Loading assets...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-2">⚠️ {error}</div>
          <button
            onClick={() => window.location.reload()}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header with source info */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Asset Library</h3>
          <div className={`text-xs px-2 py-1 rounded ${
            sourceInfo.error 
              ? 'bg-red-100 text-red-700' 
              : 'bg-green-100 text-green-700'
          }`}>
            {sourceInfo.type}
          </div>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search assets..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
          data-testid="asset-search"
        />

        {/* Category filter */}
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setSelectedCategory('')}
            className={`px-2 py-1 text-xs rounded ${
              selectedCategory === ''
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            data-testid="asset-category-all"
          >
            All
          </button>
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-2 py-1 text-xs rounded capitalize ${
                selectedCategory === category
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              data-testid={`asset-category-${category}`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Results count */}
        <div className="text-xs text-gray-500 mt-2">
          Showing {filteredItems.length} of {items.length} assets
        </div>

        {/* Upload button (DEV only) */}
        {import.meta.env.DEV && (
          <div className="mt-3">
            <input
              type="file"
              id="asset-upload"
              accept="image/png,image/jpeg,image/webp"
              multiple
              className="hidden"
              onChange={handleFileUpload}
            />
            <label
              htmlFor="asset-upload"
              className="w-full px-3 py-2 bg-green-500 text-white text-sm rounded hover:bg-green-600 cursor-pointer flex items-center justify-center"
            >
              + Upload Assets (DEV)
            </label>
          </div>
        )}
      </div>

      {/* Asset grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredItems.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            {items.length === 0 ? (
              <div>
                <p>No assets available</p>
                <p className="text-xs mt-1">Assets will appear here when added to the library</p>
              </div>
            ) : (
              <div>
                <p>No assets match your search</p>
                <p className="text-xs mt-1">Try adjusting your search or category filter</p>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredItems.map(item => (
              <AssetCard
                key={item.id}
                item={item}
                onDragStart={handleAssetDragStart}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Individual asset card component
interface AssetCardProps {
  item: AssetSourceItem;
  onDragStart: (asset: AssetSourceItem, event: React.DragEvent) => void;
}

function AssetCard({ item, onDragStart }: AssetCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleDragStart = (event: React.DragEvent) => {
    console.log('Drag start:', item.name);
    onDragStart(item, event);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('Asset card clicked:', item.name, 'Shift:', e.shiftKey);
    
    // Enter place mode
    window.dispatchEvent(new CustomEvent('enterPlaceMode', { 
      detail: { asset: item, sticky: e.shiftKey } 
    }));
  };

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  const handleImageError = () => {
    setImageError(true);
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={handleClick}
      className="bg-white border border-gray-200 rounded-lg p-3 cursor-pointer hover:border-blue-300 hover:shadow-md transition-all group select-none"
      data-testid="asset-card"
      title={`Click to place ${item.name}`}
      style={{ userSelect: 'none' }}
    >
      {/* Thumbnail */}
      <div className="aspect-square bg-gray-100 rounded-md overflow-hidden mb-2 relative">
        {!imageError ? (
          <img
            src={item.thumb}
            alt={item.name}
            className={`w-full h-full object-cover transition-opacity ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={handleImageLoad}
            onError={handleImageError}
            data-testid="asset-thumbnail"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-200">
            <div className="text-gray-400 text-xs">?</div>
          </div>
        )}
        
        {/* Loading placeholder */}
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 bg-gray-200 animate-pulse" />
        )}
      </div>

      {/* Asset info */}
      <div className="space-y-1">
        <h4 className="font-medium text-sm text-gray-900 truncate" title={item.name}>
          {item.name}
        </h4>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span className="capitalize">{item.category}</span>
          <span>{item.w}×{item.h}px</span>
        </div>
      </div>

      {/* Add button fallback */}
      <button
        onClick={() => {
          // Place asset at center of canvas
          const centerX = 400; // Assume canvas center
          const centerY = 300;
          const asset = {
            id: `asset_${Date.now()}`,
            kind: 'decal' as const,
            sourceId: item.id,
            name: item.name,
            category: item.category,
            natW: item.w,
            natH: item.h,
            x: centerX,
            y: centerY,
            scale: 1,
            rotation: 0,
            opacity: 1,
            blend: 'normal' as const,
            z: 0
          };
          
          // Dispatch to store (would need to import useEditorStore)
          console.log('Add asset at center:', asset);
        }}
        className="mt-2 w-full px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
      >
        Add
      </button>

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-blue-500 bg-opacity-0 group-hover:bg-opacity-10 rounded-lg transition-all pointer-events-none" />
    </div>
  );
}
