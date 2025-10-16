import React from 'react';
import { MaskingEngine } from '../../masking/engine';

interface PolygonToolProps {
  engine: MaskingEngine;
  camera: { scale: number; panX: number; panY: number };
  imgFit: { originX: number; originY: number; imgScale: number };
  viewportEl: HTMLElement;
  onDraftChange?: (draft: any) => void;
}

export function PolygonTool({ engine, camera, imgFit, viewportEl, onDraftChange }: PolygonToolProps) {
  const dpr = window.devicePixelRatio || 1;

  const handleClick = (e: React.MouseEvent) => {
    if (!engine.getDraft()) {
      engine.begin('polygon');
    }
    
    engine.appendScreenPoint(e.clientX, e.clientY, viewportEl, camera, dpr, imgFit);
    onDraftChange?.(engine.getDraft());
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'auto',
        cursor: 'crosshair'
      }}
      onClick={handleClick}
    />
  );
}
