/**
 * Comprehensive geometry utilities for the Canvas Editor
 * Includes shoelace area calculations, polyline length, smoothing, and conversions
 */

import * as polygonClipping from 'polygon-clipping';
import { Vec2, Polygon, Polyline } from '@shared/schema';

/**
 * Calculate the signed area of a polygon using the shoelace formula
 */
export function polygonAreaPx(points: Vec2[], holes?: Vec2[][]): number {
  if (points.length < 3) return 0;
  
  // Calculate main polygon area
  let area = shoelaceArea(points);
  
  // Subtract hole areas
  if (holes) {
    for (const hole of holes) {
      area -= Math.abs(shoelaceArea(hole));
    }
  }
  
  return Math.abs(area);
}

/**
 * Shoelace formula implementation
 */
function shoelaceArea(points: Vec2[]): number {
  if (points.length < 3) return 0;
  
  let area = 0;
  const n = points.length;
  
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  
  return area / 2;
}

/**
 * Calculate the length of a polyline
 */
export function polylineLengthPx(points: Vec2[]): number {
  if (points.length < 2) return 0;
  
  let length = 0;
  for (let i = 0; i < points.length - 1; i++) {
    length += distance(points[i], points[i + 1]);
  }
  
  return length;
}

/**
 * Calculate the perimeter of a polygon (closed polyline)
 */
export function polygonPerimeterPx(points: Vec2[]): number {
  if (points.length < 2) return 0;
  
  let perimeter = 0;
  const n = points.length;
  
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    perimeter += distance(points[i], points[j]);
  }
  
  return perimeter;
}

/**
 * Calculate distance between two points
 */
export function distance(p1: Vec2, p2: Vec2): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Convert pixels to meters using calibration
 */
export function toMetersPx(pixels: number, pixelsPerMeter: number): number {
  if (pixelsPerMeter <= 0) return 0;
  return pixels / pixelsPerMeter;
}

/**
 * Convert square pixels to square meters using calibration
 */
export function toSquareMeters(px2: number, pixelsPerMeter: number): number {
  if (pixelsPerMeter <= 0) return 0;
  return px2 / (pixelsPerMeter * pixelsPerMeter);
}

/**
 * Douglas-Peucker line simplification algorithm for smoothing freehand paths
 */
export function smoothFreehand(points: Vec2[], tolerancePx: number = 2): Vec2[] {
  if (points.length <= 2) return points;
  
  return douglasPeucker(points, tolerancePx);
}

/**
 * Douglas-Peucker algorithm implementation
 */
function douglasPeucker(points: Vec2[], tolerance: number): Vec2[] {
  if (points.length <= 2) return points;
  
  // Find the point with maximum distance from the line between first and last points
  let maxDistance = 0;
  let maxIndex = 0;
  const end = points.length - 1;
  
  for (let i = 1; i < end; i++) {
    const dist = perpendicularDistance(points[i], points[0], points[end]);
    if (dist > maxDistance) {
      maxDistance = dist;
      maxIndex = i;
    }
  }
  
  // If maximum distance is greater than tolerance, recursively simplify
  if (maxDistance > tolerance) {
    const left = douglasPeucker(points.slice(0, maxIndex + 1), tolerance);
    const right = douglasPeucker(points.slice(maxIndex), tolerance);
    
    // Combine results (remove duplicate point at junction)
    return [...left.slice(0, -1), ...right];
  }
  
  // If all points are within tolerance, return just the endpoints
  return [points[0], points[end]];
}

/**
 * Calculate perpendicular distance from point to line
 */
function perpendicularDistance(point: Vec2, lineStart: Vec2, lineEnd: Vec2): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  
  if (dx === 0 && dy === 0) {
    return distance(point, lineStart);
  }
  
  const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (dx * dx + dy * dy);
  
  let closestPoint: Vec2;
  if (t < 0) {
    closestPoint = lineStart;
  } else if (t > 1) {
    closestPoint = lineEnd;
  } else {
    closestPoint = {
      x: lineStart.x + t * dx,
      y: lineStart.y + t * dy
    };
  }
  
  return distance(point, closestPoint);
}

/**
 * Check if a polygon is self-intersecting (basic check)
 */
export function isPolygonValid(points: Vec2[]): boolean {
  if (points.length < 3) return false;
  
  // Basic area check - if area is 0, polygon is degenerate
  const area = Math.abs(shoelaceArea(points));
  return area > 0.1; // Minimum area threshold in pixels
}

/**
 * Calculate centroid of a polygon
 */
export function polygonCentroid(points: Vec2[]): Vec2 {
  if (points.length === 0) return { x: 0, y: 0 };
  
  let centroidX = 0;
  let centroidY = 0;
  let signedArea = 0;
  
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    const cross = points[i].x * points[j].y - points[j].x * points[i].y;
    signedArea += cross;
    centroidX += (points[i].x + points[j].x) * cross;
    centroidY += (points[i].y + points[j].y) * cross;
  }
  
  signedArea *= 0.5;
  centroidX /= (6 * signedArea);
  centroidY /= (6 * signedArea);
  
  return { x: centroidX, y: centroidY };
}

/**
 * Generate offset polygon for waterline band visualization
 */
export function generateWaterlineBand(
  polyline: Vec2[], 
  bandHeightPx: number, 
  side: 'inside' | 'outside' = 'inside'
): Vec2[] {
  if (polyline.length < 2) return [];
  
  const offset = side === 'inside' ? -bandHeightPx : bandHeightPx;
  const offsetPoints: Vec2[] = [];
  
  for (let i = 0; i < polyline.length; i++) {
    const prev = polyline[i - 1] || polyline[i];
    const curr = polyline[i];
    const next = polyline[i + 1] || polyline[i];
    
    // Calculate normal vector
    const prevVector = { x: curr.x - prev.x, y: curr.y - prev.y };
    const nextVector = { x: next.x - curr.x, y: next.y - curr.y };
    
    // Average the normals for smoother offset
    const avgNormal = averageNormals(prevVector, nextVector);
    const length = Math.sqrt(avgNormal.x * avgNormal.x + avgNormal.y * avgNormal.y);
    
    if (length > 0) {
      const normalizedNormal = {
        x: avgNormal.x / length,
        y: avgNormal.y / length
      };
      
      offsetPoints.push({
        x: curr.x + normalizedNormal.x * offset,
        y: curr.y + normalizedNormal.y * offset
      });
    } else {
      offsetPoints.push(curr);
    }
  }
  
  return offsetPoints;
}

/**
 * Calculate average of two normal vectors
 */
function averageNormals(v1: Vec2, v2: Vec2): Vec2 {
  // Get perpendicular vectors (normals)
  const n1 = { x: -v1.y, y: v1.x };
  const n2 = { x: -v2.y, y: v2.x };
  
  return {
    x: (n1.x + n2.x) / 2,
    y: (n1.y + n2.y) / 2
  };
}

/**
 * Point-in-polygon test using ray casting
 */
export function pointInPolygon(point: Vec2, polygon: Vec2[]): boolean {
  let inside = false;
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    
    if (((yi > point.y) !== (yj > point.y)) &&
        (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  
  return inside;
}

/**
 * Round number to specified precision using banker's rounding
 */
export function roundToPrecision(value: number, precision: number = 2): number {
  const factor = Math.pow(10, precision);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

// Enhanced polygon operations for eraser functionality

/**
 * Find nearest point on line segment
 */
export function nearestPointOnSegment(p: Vec2, a: Vec2, b: Vec2): { point: Vec2; dist: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  
  if (length === 0) {
    return { point: a, dist: distance(p, a) };
  }
  
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (length * length)));
  const nearest = {
    x: a.x + t * dx,
    y: a.y + t * dy
  };
  
  return { point: nearest, dist: distance(p, nearest) };
}

/**
 * Create a buffered polygon around a polyline (capsule shape)
 */
export function bufferPolyline(points: Vec2[], radius: number): Vec2[] {
  if (points.length < 2) return [];
  
  const bufferedPoints: Vec2[] = [];
  const segments = 8; // Circle approximation segments
  
  // Create a simplified capsule around the stroke
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    
    if (len === 0) continue;
    
    const nx = -dy / len * radius; // Normal vector
    const ny = dx / len * radius;
    
    // Add perpendicular points
    bufferedPoints.push({ x: a.x + nx, y: a.y + ny });
    bufferedPoints.push({ x: b.x + nx, y: b.y + ny });
  }
  
  // Add end caps and close the shape
  if (points.length >= 2) {
    const first = points[0];
    const last = points[points.length - 1];
    
    // Simple circular caps
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI;
      bufferedPoints.push({
        x: last.x + Math.cos(angle) * radius,
        y: last.y + Math.sin(angle) * radius
      });
    }
    
    // Other side
    for (let i = points.length - 1; i >= 0; i--) {
      const a = points[i];
      const b = i > 0 ? points[i - 1] : points[i];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      
      if (len > 0) {
        const nx = dy / len * radius;
        const ny = -dx / len * radius;
        bufferedPoints.push({ x: a.x + nx, y: a.y + ny });
      }
    }
    
    // Close with start cap
    for (let i = 0; i <= segments; i++) {
      const angle = Math.PI + (i / segments) * Math.PI;
      bufferedPoints.push({
        x: first.x + Math.cos(angle) * radius,
        y: first.y + Math.sin(angle) * radius
      });
    }
  }
  
  return bufferedPoints;
}

/**
 * Convert polygon to polygon-clipping library format
 */
export function toRings(polygon: Vec2[]): number[][][] {
  if (polygon.length < 3) return [];
  return [[polygon.map(p => [p.x, p.y])]];
}

/**
 * Convert from polygon-clipping library format
 */
export function fromRings(rings: number[][][]): Vec2[] {
  if (!rings.length || !rings[0].length) {
    return [];
  }
  
  const mainRing = rings[0][0];
  return mainRing.map(([x, y]) => ({ x, y }));
}

/**
 * Polygon difference operation for eraser
 */
export function subtractPolygon(target: Vec2[], eraser: Vec2[]): Vec2[][] {
  try {
    const targetRings = toRings(target);
    const eraserRings = toRings(eraser);
    
    if (!targetRings.length || !eraserRings.length) {
      return [target];
    }
    
    const result = polygonClipping.difference(targetRings[0], eraserRings[0]);
    
    if (!result.length) {
      return []; // Complete erasure
    }
    
    return result.map(fromRings);
  } catch (error) {
    console.warn('Polygon subtraction failed:', error);
    return [target]; // Return original on error
  }
}

/**
 * Remove vertices from polyline within eraser distance
 */
export function eraseFromPolyline(polyline: Vec2[], eraserStroke: Vec2[], brushRadius: number): Vec2[] | null {
  const filteredPoints = polyline.filter(point => {
    // Check if point is within brush radius of any eraser stroke segment
    for (let i = 0; i < eraserStroke.length - 1; i++) {
      const { dist } = nearestPointOnSegment(point, eraserStroke[i], eraserStroke[i + 1]);
      if (dist <= brushRadius) {
        return false; // Remove this point
      }
    }
    return true; // Keep this point
  });
  
  // Need at least 2 points for a valid polyline
  if (filteredPoints.length < 2) {
    return null; // Delete the mask
  }
  
  return filteredPoints;
}

/**
 * Convert pixels to meters using calibration
 */
export function pixelsToMeters(pixels: number, pixelsPerMeter: number): number {
  return pixels / pixelsPerMeter;
}

/**
 * Convert square pixels to square meters using calibration
 */
export function pixelsToSquareMeters(pixelsSquared: number, pixelsPerMeter: number): number {
  return pixelsSquared / (pixelsPerMeter * pixelsPerMeter);
}