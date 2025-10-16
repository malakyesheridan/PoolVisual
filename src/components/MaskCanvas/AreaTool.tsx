import React from 'react';
import { MaskingEngine } from '../../masking/engine';

interface AreaToolProps {
  engine: MaskingEngine;
  camera: { scale: number; panX: number; panY: number };
  imgFit: { originX: number; originY: number; imgScale: number };
  viewportEl: HTMLElement;
  onDraftChange?: (draft: any) => void;
}

export function AreaTool({ engine, camera, imgFit, viewportEl, onDraftChange }: AreaToolProps) {
  const dpr = window.devicePixelRatio || 1;

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    engine.begin('area');
    engine.appendScreenPoint(e.clientX, e.clientY, viewportEl, camera, dpr, imgFit);
    onDraftChange?.(engine.getDraft());
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (engine.getDraft()) {
      engine.appendScreenPoint(e.clientX, e.clientY, viewportEl, camera, dpr, imgFit);
      onDraftChange?.(engine.getDraft());
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'auto',
        cursor: 'crosshair'
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    />
  );
}
