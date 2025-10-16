// Pool Templates Types and Models
// Defines data structures for pool template library and geometry generation

import { MaskPoint } from '../types';

export type PoolTemplateId = string;

export type PoolTemplateType = 'rect' | 'lap' | 'kidney' | 'freeform';

export interface BandParams {
  waterlinePx: number;
  copingPx: number;
}

export interface PoolTemplate {
  id: PoolTemplateId;
  type: PoolTemplateType;
  // primary geometry in image space
  frame: { x: number; y: number; w: number; h: number }; // suggested bounds; for rect/lap
  cornerR?: number;               // rect/lap rounded corners in px
  spline?: MaskPoint[];           // kidney/freeform centerline or outer shape
  bands: BandParams;              // widths in px (image space)
  maskIds: {
    interior: string;             // main tile/water mask id
    waterline?: string;           // band 1 (optional)
    coping?: string;              // band 2 (optional)
  };
  name?: string;
}

export interface PoolTemplateLibraryItem {
  id: string;
  name: string;
  type: PoolTemplateType;
  thumbnail: string;    // URL to thumbnail image
  description: string;
  defaultBands: BandParams;
  defaultFrame: { w: number; h: number }; // default dimensions
}

export interface PoolGeometry {
  interior: MaskPoint[];
  waterline?: MaskPoint[];
  coping?: MaskPoint[];
}

export interface PoolTemplateParams {
  waterlineEnabled: boolean;
  copingEnabled: boolean;
  waterlineWidth: number;  // pixels
  copingWidth: number;     // pixels
  cornerRadius: number;    // pixels (for rect/lap)
}

export interface UnderwaterPreset {
  name: string;
  settings: {
    intensity: number;      // 0-100%
    depthBias: number;     // 0-100%
    tint: number;          // 0-100%
    edgeFeather: number;   // pixels
    highlights: number;    // 0-100%
    underwaterVersion: 'v1' | 'v2';
  };
}
