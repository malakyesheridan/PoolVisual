// Pool Geometry Generators
// Creates polygon geometry for different pool template types

import { MaskPoint, Point } from '../types';
import { offsetPolygonInward } from '../utils';

export interface PoolGeometry {
  interior: MaskPoint[];
  waterline?: MaskPoint[];
  coping?: MaskPoint[];
}

/**
 * Generate rounded rectangle polygon with adequate subdivision
 */
export function generateRoundedRect(
  x: number, y: number, width: number, height: number, 
  cornerRadius: number, subdivisions: number = 6
): MaskPoint[] {
  const points: MaskPoint[] = [];
  
  // Calculate corner positions
  const corners = [
    { x: x + cornerRadius, y: y },                    // top-left
    { x: x + width - cornerRadius, y: y },             // top-right
    { x: x + width, y: y + cornerRadius },            // right-top
    { x: x + width, y: y + height - cornerRadius },    // right-bottom
    { x: x + width - cornerRadius, y: y + height },    // bottom-right
    { x: x + cornerRadius, y: y + height },            // bottom-left
    { x: x, y: y + height - cornerRadius },            // left-bottom
    { x: x, y: y + cornerRadius }                     // left-top
  ];
  
  // Generate corner arcs
  for (let i = 0; i < 8; i++) {
    const corner = corners[i];
    const nextCorner = corners[(i + 1) % 8];
    
    if (i % 2 === 0) {
      // Straight edge
      points.push({
        x: corner.x,
        y: corner.y,
        kind: 'corner'
      });
    } else {
      // Rounded corner
      const centerX = i < 2 ? x + width - cornerRadius : 
                     i < 4 ? x + width - cornerRadius :
                     i < 6 ? x + cornerRadius : x + cornerRadius;
      const centerY = i < 2 ? y + cornerRadius :
                     i < 4 ? y + height - cornerRadius :
                     i < 6 ? y + height - cornerRadius : y + cornerRadius;
      
      const startAngle = Math.atan2(corner.y - centerY, corner.x - centerX);
      const endAngle = Math.atan2(nextCorner.y - centerY, nextCorner.x - centerX);
      
      for (let j = 0; j <= subdivisions; j++) {
        const t = j / subdivisions;
        const angle = startAngle + (endAngle - startAngle) * t;
        points.push({
          x: centerX + Math.cos(angle) * cornerRadius,
          y: centerY + Math.sin(angle) * cornerRadius,
          kind: 'corner'
        });
      }
    }
  }
  
  return points;
}

/**
 * Generate kidney-shaped pool geometry
 */
export function generateKidneyShape(
  x: number, y: number, width: number, height: number
): MaskPoint[] {
  const points: MaskPoint[] = [];
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  
  // Create kidney shape using parametric equations
  const numPoints = 32;
  for (let i = 0; i < numPoints; i++) {
    const t = (i / numPoints) * 2 * Math.PI;
    
    // Kidney shape parametric equations
    const r1 = width * 0.4;
    const r2 = height * 0.3;
    const x_offset = Math.cos(t) * 0.1;
    
    const px = centerX + Math.cos(t) * r1 + x_offset;
    const py = centerY + Math.sin(t) * r2;
    
    points.push({
      x: px,
      y: py,
      kind: 'corner'
    });
  }
  
  return points;
}

/**
 * Generate freeform pool geometry
 */
export function generateFreeformShape(
  x: number, y: number, width: number, height: number,
  variant: 'organic' | 'modern' = 'organic'
): MaskPoint[] {
  const points: MaskPoint[] = [];
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  
  if (variant === 'organic') {
    // Organic freeform with natural curves
    const numPoints = 24;
    for (let i = 0; i < numPoints; i++) {
      const t = (i / numPoints) * 2 * Math.PI;
      
      // Organic shape with multiple sine waves
      const r1 = width * 0.35 + Math.sin(t * 3) * width * 0.1;
      const r2 = height * 0.3 + Math.cos(t * 2) * height * 0.08;
      
      const px = centerX + Math.cos(t) * r1;
      const py = centerY + Math.sin(t) * r2;
      
      points.push({
        x: px,
        y: py,
        kind: 'corner'
      });
    }
  } else {
    // Modern freeform with geometric elements
    const numPoints = 20;
    for (let i = 0; i < numPoints; i++) {
      const t = (i / numPoints) * 2 * Math.PI;
      
      // Modern shape with sharp angles and curves
      const r1 = width * 0.4 + Math.sin(t * 4) * width * 0.05;
      const r2 = height * 0.35 + Math.cos(t * 3) * height * 0.06;
      
      const px = centerX + Math.cos(t) * r1;
      const py = centerY + Math.sin(t) * r2;
      
      points.push({
        x: px,
        y: py,
        kind: 'corner'
      });
    }
  }
  
  return points;
}

/**
 * Generate complete pool geometry with bands
 */
export function generatePoolGeometry(
  templateType: 'rect' | 'lap' | 'kidney' | 'freeform',
  frame: { x: number; y: number; w: number; h: number },
  bands: { waterlinePx: number; copingPx: number },
  cornerRadius?: number,
  variant?: 'organic' | 'modern'
): PoolGeometry {
  let interior: MaskPoint[];
  
  // Generate interior shape
  switch (templateType) {
    case 'rect':
    case 'lap':
      interior = generateRoundedRect(frame.x, frame.y, frame.w, frame.h, cornerRadius || 20);
      break;
    case 'kidney':
      interior = generateKidneyShape(frame.x, frame.y, frame.w, frame.h);
      break;
    case 'freeform':
      interior = generateFreeformShape(frame.x, frame.y, frame.w, frame.h, variant || 'organic');
      break;
    default:
      interior = generateRoundedRect(frame.x, frame.y, frame.w, frame.h, 20);
  }
  
  const geometry: PoolGeometry = { interior };
  
  // Generate bands if enabled
  if (bands.waterlinePx > 0) {
    try {
      geometry.waterline = offsetPolygonInward(interior, bands.waterlinePx);
    } catch (error) {
      console.warn('Failed to generate waterline band:', error);
      // Try with reduced width
      const reducedWidth = Math.max(4, bands.waterlinePx * 0.5);
      try {
        geometry.waterline = offsetPolygonInward(interior, reducedWidth);
      } catch (retryError) {
        console.warn('Failed to generate waterline band with reduced width');
      }
    }
  }
  
  if (bands.copingPx > 0) {
    try {
      geometry.coping = offsetPolygonInward(interior, bands.copingPx);
    } catch (error) {
      console.warn('Failed to generate coping band:', error);
      // Try with reduced width
      const reducedWidth = Math.max(4, bands.copingPx * 0.5);
      try {
        geometry.coping = offsetPolygonInward(interior, reducedWidth);
      } catch (retryError) {
        console.warn('Failed to generate coping band with reduced width');
      }
    }
  }
  
  return geometry;
}

/**
 * Offset polygon outward (for coping bands)
 */
export function offsetPolygonOutward(points: MaskPoint[], distance: number): MaskPoint[] {
  if (points.length < 3) return [];
  
  const offsetPoints: MaskPoint[] = [];
  
  for (let i = 0; i < points.length; i++) {
    const prev = points[(i - 1 + points.length) % points.length];
    const curr = points[i];
    const next = points[(i + 1) % points.length];
    
    // Calculate outward normal
    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;
    
    // Average the edge directions
    const nx = (dx1 + dx2) / 2;
    const ny = (dy1 + dy2) / 2;
    
    // Calculate perpendicular (outward)
    const perpX = -ny;
    const perpY = nx;
    
    const len = Math.sqrt(perpX * perpX + perpY * perpY);
    if (len === 0) {
      offsetPoints.push(curr);
      continue;
    }
    
    // Apply outward offset
    offsetPoints.push({
      x: curr.x + (perpX / len) * distance,
      y: curr.y + (perpY / len) * distance,
      kind: curr.kind || 'corner'
    });
  }
  
  return offsetPoints;
}
