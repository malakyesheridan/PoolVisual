import React, { useEffect, useRef } from 'react';
import { Group, Image, Transformer } from 'react-konva';
import Konva from 'konva';
import { useAssetsStore } from './store';
import { loadAssetImage } from './imageLoader';
import type { AssetInstance } from './store';

interface Props {
  // World transform props - reuse existing system
  camera: { scale: number; panX: number; panY: number };
  imgFit: { originX: number; originY: number; imgScale: number };
}

interface AssetImageProps {
  asset: AssetInstance;
  def: { url: string; defaultScale?: number };
  editMode: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onTransform: (attrs: Partial<AssetInstance>) => void;
}

// Individual asset image component
function AssetImage({ asset, def, editMode, isSelected, onSelect, onTransform }: AssetImageProps) {
  const imageRef = useRef<Konva.Image>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const [image, setImage] = React.useState<HTMLImageElement | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  // Load image
  useEffect(() => {
    let stopped = false;
    
    (async () => {
      try {
        setLoading(true);
        setError(false);
        
        const img = await loadAssetImage(def.url);
        if (stopped) return;
        
        if (import.meta.env.DEV) {
          console.log('[ASSETS:img:load]', { 
            url: def.url, 
            ok: true, 
            naturalSize: { width: img.naturalWidth, height: img.naturalHeight } 
          });
        }
        
        setImage(img);
        setLoading(false);
      } catch (err) {
        if (stopped) return;
        if (import.meta.env.DEV) {
          console.error('[ASSETS:img:load]', { url: def.url, ok: false, error: err });
        }
        setError(true);
        setLoading(false);
      }
    })();
    
    return () => { stopped = true; };
  }, [def.url]);

  // Update transformer when selection changes
  useEffect(() => {
    if (isSelected && editMode && transformerRef.current && imageRef.current) {
      transformerRef.current.nodes([imageRef.current]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected, editMode]);

  // Handle transform end
  const handleTransformEnd = () => {
    if (!imageRef.current) return;
    
    const node = imageRef.current;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    const rotation = node.rotation();
    
    // Reset scale to avoid cumulative scaling
    node.scaleX(1);
    node.scaleY(1);
    
    const newAttrs = {
      scale: asset.scale * Math.max(scaleX, scaleY),
      rotation: rotation,
      x: node.x(),
      y: node.y(),
    };
    
    if (import.meta.env.DEV) {
      console.log('[ASSETS:transform]', { 
        id: asset.id, 
        x: newAttrs.x, 
        y: newAttrs.y, 
        rotation: newAttrs.rotation, 
        scale: newAttrs.scale 
      });
    }
    
    onTransform(newAttrs);
  };

  // Handle drag end
  const handleDragEnd = () => {
    if (!imageRef.current) return;
    
    const node = imageRef.current;
    onTransform({
      x: node.x(),
      y: node.y(),
    });
  };

  if (loading) {
    // Loading placeholder
    return (
      <Group x={asset.x} y={asset.y}>
        <Image
          width={50}
          height={50}
          fill="#f0f0f0"
          stroke="#ccc"
          strokeWidth={1}
          dash={[5, 5]}
        />
      </Group>
    );
  }

  if (error || !image) {
    // Error placeholder
    return (
      <Group x={asset.x} y={asset.y}>
        <Image
          width={50}
          height={50}
          fill="#ffebee"
          stroke="#f44336"
          strokeWidth={2}
        />
      </Group>
    );
  }

  // Calculate center offset for proper rotation
  // Use default dimensions if not specified in def
  const defaultWidth = 50;
  const defaultHeight = 50;
  const assetWidth = defaultWidth * asset.scale;
  const assetHeight = defaultHeight * asset.scale;
  const centerOffsetX = assetWidth / 2;
  const centerOffsetY = assetHeight / 2;

  return (
    <Group>
      <Image
        ref={imageRef}
        image={image}
        x={asset.x - centerOffsetX}
        y={asset.y - centerOffsetY}
        width={defaultWidth}
        height={defaultHeight}
        scaleX={asset.scale}
        scaleY={asset.scale}
        rotation={asset.rotation}
        opacity={asset.opacity}
        draggable={editMode && !asset.locked}
        listening={true} // Always listening for centralized selection
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
        perfectDrawEnabled={false}
        shadowColor="rgba(0,0,0,0.2)"
        shadowBlur={5}
        shadowOffset={{ x: 2, y: 2 }}
        // Add asset marker for centralized selection
        name="asset-shape"
        assetId={asset.id}
      />
      
      {/* Transformer for editing */}
      {isSelected && editMode && !asset.locked && (
        <Transformer
          ref={transformerRef}
          boundBoxFunc={(oldBox, newBox) => {
            // Limit resize
            if (newBox.width < 20 || newBox.height < 20) {
              return oldBox;
            }
            return newBox;
          }}
        />
      )}
    </Group>
  );
}

// Main assets layer component
export function AssetsLayer({ camera, imgFit }: Props) {
  const { 
    byId, 
    order, 
    selectedAssetId, 
    editMode, 
    defsById,
    setSelectedAsset,
    updateAsset 
  } = useAssetsStore();

  // Listen for asset selection events from centralized handler
  useEffect(() => {
    const handleAssetSelect = (event: CustomEvent) => {
      const { assetId } = event.detail;
      console.log('[AssetsLayer:select]', { 
        assetId,
        transformerAttached: editMode && !byId[assetId]?.locked
      });
      setSelectedAsset(assetId);
    };

    const handleAssetDeselect = () => {
      console.log('[AssetsLayer:deselect]', { transformerAttached: false });
      setSelectedAsset(null);
    };

    window.addEventListener('assetSelect', handleAssetSelect as EventListener);
    window.addEventListener('assetDeselect', handleAssetDeselect);

    return () => {
      window.removeEventListener('assetSelect', handleAssetSelect as EventListener);
      window.removeEventListener('assetDeselect', handleAssetDeselect);
    };
  }, [setSelectedAsset, editMode, byId]);

  // Log render info
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('[ASSETS:render]', { 
        count: order.length, 
        editMode, 
        listening: editMode 
      });
    }
  }, [order.length, editMode]);

  // Handle asset selection
  const handleAssetSelect = (assetId: string) => {
    setSelectedAsset(assetId);
  };

  // Handle asset transform
  const handleAssetTransform = (assetId: string, attrs: Partial<AssetInstance>) => {
    updateAsset(assetId, attrs);
  };

  return (
    <Group name="assets-layer">
      {/* Render assets in z-order */}
      {order.map(assetId => {
        const asset = byId[assetId];
        if (!asset) return null;
        
        const def = defsById[asset.defId];
        if (!def) return null;
        
        return (
          <AssetImage
            key={assetId}
            asset={asset}
            def={def}
            editMode={editMode}
            isSelected={selectedAssetId === assetId}
            onSelect={() => handleAssetSelect(assetId)}
            onTransform={(attrs) => handleAssetTransform(assetId, attrs)}
          />
        );
      })}
    </Group>
  );
}
