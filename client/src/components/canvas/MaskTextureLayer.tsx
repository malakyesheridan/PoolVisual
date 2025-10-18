import React, { useEffect, useState } from 'react';
import { Layer } from 'react-konva';
import { MaskTexture } from './MaskTexture';
import { useMaskStore } from '../../maskcore/store';
import { ensureLoaded, getById } from '../../materials/registry';

interface Props {
  stageScale: number;
  imgFit?: { originX: number; originY: number; imgScale: number };
}

export function MaskTextureLayer({ stageScale, imgFit }: Props) {
  const masks = useMaskStore(state => state.masks);
  const selectedId = useMaskStore(state => state.selectedId);
  const pointEditingMode = useMaskStore(state => state.pointEditingMode);
  const editingMaskId = useMaskStore(state => state.editingMaskId);
  const [materialsLoaded, setMaterialsLoaded] = useState(false);

  // Load materials once
  useEffect(() => {
    ensureLoaded().then(() => {
      setMaterialsLoaded(true);
    }).catch(err => {
      console.warn('[MaskTextureLayer] failed to load materials', err);
      setMaterialsLoaded(true); // Still render, just without materials
    });
  }, []);

  const maskEntries = Object.entries(masks);
  const masksWithMaterials = maskEntries.filter(([_, mask]) => 
    mask.materialId && 
    getById(mask.materialId) && 
    mask.isVisible !== false // Only render visible masks
  );

  console.log('[MaskTextureLayer] render', { 
    maskCount: maskEntries.length, 
    withMaterials: masksWithMaterials.length 
  });

  return (
    <>
      {materialsLoaded && masksWithMaterials
        .map(([maskId, mask]) => {
          const material = getById(mask.materialId);
          if (!material) {
            console.warn('[Editor:MaterialMissing]', { maskId, materialId: mask.materialId });
            return null;
          }

          // Check if this mask is in point editing mode
          const isInPointEditing = pointEditingMode && editingMaskId === maskId;
          
          let adjustedPts;
          if (isInPointEditing) {
            // In point editing mode, mask is already flattened - use points as-is
            adjustedPts = mask.pts;
            console.log('[MaskTextureLayer] Using flattened points for texture in point editing mode', { maskId });
          } else {
            // Normal mode - apply position offset and rotation to mask points for texture rendering
            const positionOffset = mask.position || { x: 0, y: 0 };
            const rotation = mask.rotation || 0;
            
            // Calculate mask center for rotation
            const maskCenter = {
              x: mask.pts.reduce((sum, pt) => sum + pt.x, 0) / mask.pts.length,
              y: mask.pts.reduce((sum, pt) => sum + pt.y, 0) / mask.pts.length
            };
            
            // Helper function to rotate a point around center
            const rotatePoint = (pt: { x: number; y: number }, center: { x: number; y: number }, angle: number) => {
              if (angle === 0) return pt;
              
              const cos = Math.cos(angle * Math.PI / 180);
              const sin = Math.sin(angle * Math.PI / 180);
              const dx = pt.x - center.x;
              const dy = pt.y - center.y;
              
              return {
                x: center.x + dx * cos - dy * sin,
                y: center.y + dx * sin + dy * cos
              };
            };
            
            adjustedPts = mask.pts.map(pt => {
              // Apply rotation first
              const rotatedPt = rotatePoint(pt, maskCenter, rotation);
              // Then apply position offset
              return {
                x: rotatedPt.x + positionOffset.x,
                y: rotatedPt.y + positionOffset.y
              };
            });
          }

          return (
            <MaskTexture
              key={`${maskId}-${mask.pts.length}-${mask.lastModified || 0}-${isInPointEditing ? 'editing' : 'normal'}`}
              maskId={maskId}
              pts={adjustedPts}
              stageScale={stageScale}
              material={material}
              imgFit={imgFit}
              settings={{
                opacity: mask.materialSettings?.opacity ?? 70,
                tint: mask.materialSettings?.tint ?? 55,
                edgeFeather: mask.materialSettings?.edgeFeather ?? 0,
                intensity: mask.materialSettings?.intensity ?? 50,
                textureScale: mask.materialSettings?.textureScale ?? 100,
                // Pass through all underwater settings for potential Canvas2D integration
                blend: mask.materialSettings?.blend ?? 65,
                refraction: mask.materialSettings?.refraction ?? 25,
                edgeSoftness: mask.materialSettings?.edgeSoftness ?? 6,
                depthBias: mask.materialSettings?.depthBias ?? 35,
                highlights: mask.materialSettings?.highlights ?? 20,
                ripple: mask.materialSettings?.ripple ?? 0,
                materialOpacity: mask.materialSettings?.materialOpacity ?? 85,
                contactOcclusion: mask.materialSettings?.contactOcclusion ?? 9,
                textureBoost: mask.materialSettings?.textureBoost ?? 20,
                underwaterVersion: mask.materialSettings?.underwaterVersion ?? 'v1',
                meniscus: mask.materialSettings?.meniscus ?? 32,
                softness: mask.materialSettings?.softness ?? 0,
              }}
            />
          );
        })
        .filter(Boolean)}
    </>
  );
}