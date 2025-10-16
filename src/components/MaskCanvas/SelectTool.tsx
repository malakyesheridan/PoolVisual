import React from 'react';
import { MaskingEngine } from '../../masking/engine';
import { screenToImage } from '../../utils/mapping';

interface SelectToolProps {
  engine: MaskingEngine;
  camera: { scale: number; panX: number; panY: number };
  imgFit: { originX: number; originY: number; imgScale: number };
  viewportEl: HTMLElement;
  masks: Record<string, any>;
  onMaskSelect: (id: string | null) => void;
}

export function SelectTool({ engine, camera, imgFit, viewportEl, masks, onMaskSelect }: SelectToolProps) {
  const dpr = window.devicePixelRatio || 1;

  const handleClick = (e: React.MouseEvent) => {
    const pt = screenToImage(e.clientX, e.clientY, viewportEl, camera, dpr, imgFit);
    
    // Check each mask for hit-testing
    for (const [maskId, mask] of Object.entries(masks)) {
      if (mask.pts && MaskingEngine.hitTest(mask.pts, pt)) {
        onMaskSelect(maskId);
        return;
      }
    }
    
    // No mask hit, deselect
    onMaskSelect(null);
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'auto',
        cursor: 'pointer'
      }}
      onClick={handleClick}
    />
  );
}
