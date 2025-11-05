/**
 * Pool Section Offset Utility
 * Creates offset masks for pool sections (waterline, coping, paving)
 * Uses existing offset functions from the codebase
 */

import { MaskPoint } from '../maskcore/store';
import { offsetPolygonInward } from './utils';
import { offsetPolygonOutward } from './pools/geometry';

interface OffsetConfig {
  mm: number;
  direction: 'inward' | 'outward';
}

const SECTIONS: Record<'waterline' | 'coping' | 'paving', OffsetConfig> = {
  waterline: { mm: 150, direction: 'inward' },
  coping: { mm: 200, direction: 'outward' },
  paving: { mm: 600, direction: 'outward' }
};

/**
 * Create offset points for a pool section
 * @param basePoints Original mask points
 * @param sectionType Type of section to create
 * @param pixelsPerMeter Optional calibration data for accurate sizing
 * @returns Offset points, or empty array if invalid
 */
export function createPoolSectionOffset(
  basePoints: MaskPoint[],
  sectionType: 'waterline' | 'coping' | 'paving',
  pixelsPerMeter?: number
): MaskPoint[] {
  if (basePoints.length < 3) {
    console.warn('[createPoolSectionOffset] Base points insufficient, need at least 3');
    return [];
  }
  
  const config = SECTIONS[sectionType];
  if (!config) {
    console.warn('[createPoolSectionOffset] Unknown section type:', sectionType);
    return [];
  }
  
  // Convert mm to pixels
  let offsetPx: number;
  if (pixelsPerMeter && pixelsPerMeter > 0) {
    // Convert mm to meters, then to pixels
    offsetPx = (config.mm / 1000) * pixelsPerMeter;
  } else {
    // Fallback: assume 100 pixels per meter (approximately 2.5m = 250px display)
    // So 150mm = 0.15m = 15px at 100px/m
    offsetPx = config.mm / 10;
    console.warn('[createPoolSectionOffset] No calibration data, using fallback pixel ratio');
  }
  
  // Apply offset based on direction
  const offsetPoints = config.direction === 'inward'
    ? offsetPolygonInward(basePoints, offsetPx)
    : offsetPolygonOutward(basePoints, offsetPx);
  
  if (offsetPoints.length < 3) {
    console.warn('[createPoolSectionOffset] Resulting offset too small, section cannot be created');
    return [];
  }
  
  return offsetPoints;
}

