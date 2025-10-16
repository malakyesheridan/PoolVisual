import React, { useEffect } from 'react';
import { Group } from 'react-konva';

interface Props {
  camera: { scale: number; panX: number; panY: number };
  imgFit: { originX: number; originY: number; imgScale: number };
  children: React.ReactNode;
}

export function WorldGroup({ camera, imgFit, children }: Props) {
  // Diagnostic logging once on mount
  useEffect(() => {
    console.log('[WorldTransform]', { 
      panX: camera.panX, 
      panY: camera.panY, 
      scale: camera.scale, 
      imgFit 
    });
  }, []); // Only log once on mount

  return (
    <Group
      name="world-group"
      // CRITICAL: Match Canvas.tsx transformation exactly
      // Canvas.tsx: ctx.translate(panX, panY); ctx.scale(scale, scale);
      // This means: translate by (panX, panY), then scale by (scale, scale)
      // In Konva, transformations are applied in reverse order, so:
      // 1. Set scale first (applied last)
      // 2. Set translate second (applied first)
      // This gives us: translate(panX, panY) then scale(scale, scale)
      x={camera.panX}
      y={camera.panY}
      scaleX={camera.scale}
      scaleY={camera.scale}
    >
      {children}
    </Group>
  );
}
