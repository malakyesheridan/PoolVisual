/**
 * Clean masking component - minimal and predictable
 * DISABLED - NEW MASKING SYSTEM IS ACTIVE
 */

import React from 'react';

interface MaskingProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  imageRef: React.RefObject<HTMLImageElement>;
  camera: any;
  imgFit: any;
  width: number;
  height: number;
  activeTool: 'area' | null;
  onToolChange: (tool: 'area' | null) => void;
  showDevHud: boolean;
}

export function Masking({
  canvasRef,
  imageRef,
  camera,
  imgFit,
  width,
  height,
  activeTool,
  onToolChange,
  showDevHud
}: MaskingProps) {
  // DISABLE OLD MASKING SYSTEM
  console.warn('[DEPRECATED MASKING] attempted to mount; new masking is active');
  return null;
}

// Export store actions for external use
export { useMaskStore } from '../maskcore/store';