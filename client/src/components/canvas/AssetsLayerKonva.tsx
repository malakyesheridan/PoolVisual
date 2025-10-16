import React, { useRef, useEffect, useState } from 'react';
import { Image, Group, Rect, Text } from 'react-konva';
import Konva from 'konva';
import { Asset } from '../../new_editor/types';

interface Props {
  assets: Asset[];
  selectedId: string | null;
  onSelect: (assetId: string) => void;
}

interface AssetDef {
  id: string;
  name: string;
  url: string;
  width: number;
  height: number;
}

// Simple asset definitions for now
const ASSET_DEFINITIONS: Record<string, AssetDef> = {
  'tree_palm_01': {
    id: 'tree_palm_01',
    name: 'Palm Tree',
    url: '/assets/full/tree_palm_01.svg',
    width: 400,
    height: 600
  },
  'tree_oak_01': {
    id: 'tree_oak_01',
    name: 'Oak Tree',
    url: '/assets/full/tree_oak_01.svg',
    width: 500,
    height: 700
  },
  'tree_pine_01': {
    id: 'tree_pine_01',
    name: 'Pine Tree',
    url: '/assets/full/tree_pine_01.svg',
    width: 350,
    height: 550
  },
  'furniture_chair_01': {
    id: 'furniture_chair_01',
    name: 'Pool Chair',
    url: '/assets/full/furniture_chair_01.svg',
    width: 200,
    height: 300
  },
  'furniture_table_01': {
    id: 'furniture_table_01',
    name: 'Pool Table',
    url: '/assets/full/furniture_table_01.svg',
    width: 300,
    height: 200
  }
};

// Image cache to avoid reloading images
const imageCache = new Map<string, HTMLImageElement>();

function loadImage(url: string): Promise<HTMLImageElement> {
  if (imageCache.has(url)) {
    console.log('[AssetsLayerKonva] Using cached image:', url);
    return Promise.resolve(imageCache.get(url)!);
  }

  console.log('[AssetsLayerKonva] Loading new image:', url);
  
  // For SVG files, use a different approach
  if (url.endsWith('.svg')) {
    return loadSVGAsImage(url);
  }
  
  return new Promise((resolve, reject) => {
    const img = document.createElement('img');
    
    // Add timeout to detect stuck loads
    const timeout = setTimeout(() => {
      console.error('[AssetsLayerKonva] Image load timeout:', url);
      reject(new Error('Image load timeout'));
    }, 10000); // 10 second timeout
    
    img.onload = () => {
      clearTimeout(timeout);
      console.log('[AssetsLayerKonva] Image loaded successfully:', url, 'Size:', img.width, 'x', img.height);
      console.log('[AssetsLayerKonva] Image natural size:', img.naturalWidth, 'x', img.naturalHeight);
      console.log('[AssetsLayerKonva] Image complete:', img.complete);
      imageCache.set(url, img);
      resolve(img);
    };
    
    img.onerror = (error) => {
      clearTimeout(timeout);
      console.error('[AssetsLayerKonva] Failed to load image:', url, error);
      console.error('[AssetsLayerKonva] Image error details:', {
        url,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        complete: img.complete,
        readyState: img.readyState
      });
      reject(error);
    };
    
    // Try loading the image
    img.src = url;
    
    // If image is already loaded (cached by browser)
    if (img.complete && img.naturalWidth > 0) {
      clearTimeout(timeout);
      console.log('[AssetsLayerKonva] Image already loaded (browser cached):', url);
      imageCache.set(url, img);
      resolve(img);
    }
  });
}

function loadSVGAsImage(url: string): Promise<HTMLImageElement> {
  console.log('[AssetsLayerKonva] Loading SVG as image:', url);
  
  return new Promise((resolve, reject) => {
    const img = document.createElement('img');
    
    const timeout = setTimeout(() => {
      console.error('[AssetsLayerKonva] SVG load timeout:', url);
      reject(new Error('SVG load timeout'));
    }, 5000); // Reduced timeout for faster feedback
    
    img.onload = () => {
      clearTimeout(timeout);
      console.log('[AssetsLayerKonva] SVG loaded successfully:', url, 'Size:', img.width, 'x', img.height);
      console.log('[AssetsLayerKonva] SVG natural size:', img.naturalWidth, 'x', img.naturalHeight);
      
      // Ensure proper dimensions
      if (img.naturalWidth === 0 || img.naturalHeight === 0) {
        console.warn('[AssetsLayerKonva] SVG has zero dimensions, setting defaults');
        img.width = 400;
        img.height = 600;
      }
      
      imageCache.set(url, img);
      resolve(img);
    };
    
    img.onerror = (error) => {
      clearTimeout(timeout);
      console.error('[AssetsLayerKonva] Failed to load SVG:', url, error);
      reject(error);
    };
    
    // Simple direct loading - no crossOrigin needed for same-origin requests
    img.src = url;
  });
}

export function AssetsLayerKonva({ assets, selectedId, onSelect }: Props) {
  const [loadedImages, setLoadedImages] = useState<Map<string, HTMLImageElement>>(new Map());

  // Load images for all assets
  useEffect(() => {
    const loadImages = async () => {
      console.log('[AssetsLayerKonva] Loading images for assets:', assets.length);
      const newLoadedImages = new Map<string, HTMLImageElement>();
      
      for (const asset of assets) {
        const def = ASSET_DEFINITIONS[asset.defId];
        if (!def) {
          console.warn(`[AssetsLayerKonva] Asset definition not found for:`, asset.defId);
          continue;
        }

        console.log(`[AssetsLayerKonva] Loading image for asset ${asset.id}:`, def.url);
        try {
          const img = await loadImage(def.url);
          newLoadedImages.set(asset.id, img);
          console.log(`[AssetsLayerKonva] Successfully loaded image for asset ${asset.id}`);
        } catch (error) {
          console.warn(`[AssetsLayerKonva] Failed to load image for asset ${asset.id}:`, error);
          // Don't create fallback images - we want to see the real issue
        }
      }
      
      console.log('[AssetsLayerKonva] Loaded images:', newLoadedImages.size);
      setLoadedImages(newLoadedImages);
    };

    loadImages();
  }, [assets]);

  return (
    <>
      {assets.map((asset) => {
        const def = ASSET_DEFINITIONS[asset.defId];
        if (!def) {
          console.warn(`[AssetsLayerKonva] Rendering: Asset definition not found for:`, asset.defId);
          return null;
        }

        const img = loadedImages.get(asset.id);
        if (!img) {
          console.log(`[AssetsLayerKonva] Rendering: Image not loaded yet for asset ${asset.id}, skipping render`);
          return null; // Don't render anything until image loads
        }

        console.log(`[AssetsLayerKonva] Rendering asset ${asset.id} at (${asset.x}, ${asset.y})`);
        const isSelected = selectedId === asset.id;

        // Calculate scaled dimensions
        const scaledWidth = def.width * asset.scale;
        const scaledHeight = def.height * asset.scale;

        return (
          <Group
            key={asset.id}
            name="asset-shape"
            listening={true}
            isAsset={true} // custom attr
            assetId={asset.id} // for centralized handler
            x={asset.x}
            y={asset.y}
            scaleX={asset.scale}
            scaleY={asset.scale}
            rotation={asset.rotation}
            opacity={asset.opacity}
            onClick={() => onSelect(asset.id)}
          >
            {/* Asset Image */}
            <Image
              image={img}
              width={def.width}
              height={def.height}
              offsetX={def.width / 2} // Center the image
              offsetY={def.height / 2}
              listening={true}
            />
            
            {/* Selection Outline */}
            {isSelected && (
              <Group>
                {/* Simple selection border */}
                <Group>
                  <Image
                    image={img}
                    width={def.width}
                    height={def.height}
                    offsetX={def.width / 2}
                    offsetY={def.height / 2}
                    stroke="#2563eb"
                    strokeWidth={2}
                    fillEnabled={false}
                    listening={false}
                  />
                </Group>
              </Group>
            )}
          </Group>
        );
      })}
    </>
  );
}
