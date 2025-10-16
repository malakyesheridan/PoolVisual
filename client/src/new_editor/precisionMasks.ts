// Precision Masks v1 - Straight-Line Drawing + Smoothing + Snapping
// Implements precision drawing tools with snapping and vertex editing

import { Point, MaskPoint, PhotoSpace, EditorState } from './types';
import { screenToImage, imageToScreen } from './utils';

export interface SnappingResult {
  snapped: boolean;
  point: Point;
  snapType?: 'grid' | 'angle' | 'edge' | 'orthogonal';
  snapDistance?: number;
}

export interface EdgeDetectionResult {
  hasEdge: boolean;
  strength: number;
  direction: number; // radians
}

/**
 * Convert legacy Point to MaskPoint
 */
export function pointToMaskPoint(point: Point): MaskPoint {
  return {
    x: point.x,
    y: point.y,
    kind: 'corner'
  };
}

/**
 * Convert MaskPoint to legacy Point
 */
export function maskPointToPoint(maskPoint: MaskPoint): Point {
  return {
    x: maskPoint.x,
    y: maskPoint.y
  };
}

/**
 * Apply snapping constraints to a point
 */
export function applySnapping(
  point: Point,
  photoSpace: PhotoSpace,
  snappingEnabled: EditorState['snappingEnabled'],
  gridSpacing: number,
  previousPoint?: Point,
  edgeMap?: ImageData
): SnappingResult {
  let snappedPoint = { ...point };
  let snapType: SnappingResult['snapType'];
  let snapDistance = 0;

  // Grid snapping
  if (snappingEnabled.grid) {
    const gridSnap = snapToGrid(point, gridSpacing);
    if (gridSnap.snapped) {
      snappedPoint = gridSnap.point;
      snapType = 'grid';
      snapDistance = gridSnap.distance;
    }
  }

  // Angle snapping (Shift key)
  if (snappingEnabled.angle) {
    const angleSnap = snapToAngle(snappedPoint, previousPoint);
    if (angleSnap.snapped) {
      snappedPoint = angleSnap.point;
      snapType = 'angle';
      snapDistance = angleSnap.distance;
    }
  }

  // Orthogonal snapping (Ctrl/Cmd key)
  if (snappingEnabled.orthogonal && previousPoint) {
    const orthogonalSnap = snapToOrthogonal(snappedPoint, previousPoint);
    if (orthogonalSnap.snapped) {
      snappedPoint = orthogonalSnap.point;
      snapType = 'orthogonal';
      snapDistance = orthogonalSnap.distance;
    }
  }

  // Edge snapping (experimental)
  if (snappingEnabled.edge && edgeMap) {
    const edgeSnap = snapToEdge(snappedPoint, edgeMap, photoSpace);
    if (edgeSnap.snapped) {
      snappedPoint = edgeSnap.point;
      snapType = 'edge';
      snapDistance = edgeSnap.distance;
    }
  }

  return {
    snapped: snapType !== undefined,
    point: snappedPoint,
    snapType,
    snapDistance
  };
}

/**
 * Snap point to grid
 */
function snapToGrid(point: Point, gridSpacing: number): { snapped: boolean; point: Point; distance: number } {
  const snappedX = Math.round(point.x / gridSpacing) * gridSpacing;
  const snappedY = Math.round(point.y / gridSpacing) * gridSpacing;
  
  const distance = Math.sqrt((point.x - snappedX) ** 2 + (point.y - snappedY) ** 2);
  const snapThreshold = gridSpacing * 0.3; // Snap within 30% of grid spacing
  
  if (distance <= snapThreshold) {
    return {
      snapped: true,
      point: { x: snappedX, y: snappedY },
      distance
    };
  }
  
  return {
    snapped: false,
    point,
    distance: 0
  };
}

/**
 * Snap to 0°, 45°, 90° angles (15° increments)
 */
function snapToAngle(point: Point, previousPoint?: Point): { snapped: boolean; point: Point; distance: number } {
  if (!previousPoint) return { snapped: false, point, distance: 0 };
  
  const dx = point.x - previousPoint.x;
  const dy = point.y - previousPoint.y;
  const angle = Math.atan2(dy, dx);
  
  // Snap to 15° increments
  const snapAngles = [0, Math.PI/12, Math.PI/6, Math.PI/4, Math.PI/3, 5*Math.PI/12, Math.PI/2, 7*Math.PI/12, 2*Math.PI/3, 3*Math.PI/4, 5*Math.PI/6, 11*Math.PI/12, Math.PI];
  
  let closestAngle = angle;
  let minDistance = Infinity;
  
  for (const snapAngle of snapAngles) {
    const distance = Math.abs(angle - snapAngle);
    if (distance < minDistance) {
      minDistance = distance;
      closestAngle = snapAngle;
    }
  }
  
  const snapThreshold = Math.PI / 24; // 7.5° threshold
  
  if (minDistance <= snapThreshold) {
    const length = Math.sqrt(dx * dx + dy * dy);
    const snappedPoint = {
      x: previousPoint.x + Math.cos(closestAngle) * length,
      y: previousPoint.y + Math.sin(closestAngle) * length
    };
    
    return {
      snapped: true,
      point: snappedPoint,
      distance: minDistance * length
    };
  }
  
  return {
    snapped: false,
    point,
    distance: 0
  };
}

/**
 * Snap to horizontal/vertical (Ctrl/Cmd key)
 */
function snapToOrthogonal(point: Point, previousPoint: Point): { snapped: boolean; point: Point; distance: number } {
  const dx = Math.abs(point.x - previousPoint.x);
  const dy = Math.abs(point.y - previousPoint.y);
  
  const snapThreshold = 20; // pixels
  
  if (dx < snapThreshold) {
    // Snap to vertical
    return {
      snapped: true,
      point: { x: previousPoint.x, y: point.y },
      distance: dx
    };
  } else if (dy < snapThreshold) {
    // Snap to horizontal
    return {
      snapped: true,
      point: { x: point.x, y: previousPoint.y },
      distance: dy
    };
  }
  
  return {
    snapped: false,
    point,
    distance: 0
  };
}

/**
 * Snap to detected edges (experimental)
 */
function snapToEdge(point: Point, edgeMap: ImageData, photoSpace: PhotoSpace): { snapped: boolean; point: Point; distance: number } {
  // Convert screen point to image coordinates
  const imagePoint = screenToImage(point, photoSpace);
  
  // Sample edge map around the point
  const searchRadius = 10; // pixels
  const { width, height } = edgeMap;
  
  let bestEdge: { x: number; y: number; strength: number } | null = null;
  let minDistance = Infinity;
  
  for (let y = Math.max(0, Math.floor(imagePoint.y - searchRadius)); y < Math.min(height, Math.ceil(imagePoint.y + searchRadius)); y++) {
    for (let x = Math.max(0, Math.floor(imagePoint.x - searchRadius)); x < Math.min(width, Math.ceil(imagePoint.x + searchRadius)); x++) {
      const index = (y * width + x) * 4;
      const edgeStrength = edgeMap.data[index]; // R channel contains edge strength
      
      if (edgeStrength > 128) { // Threshold for edge detection
        const distance = Math.sqrt((x - imagePoint.x) ** 2 + (y - imagePoint.y) ** 2);
        if (distance < minDistance) {
          minDistance = distance;
          bestEdge = { x, y, strength: edgeStrength };
        }
      }
    }
  }
  
  if (bestEdge && minDistance <= searchRadius) {
    // Convert back to screen coordinates
    const snappedScreenPoint = imageToScreen({ x: bestEdge.x, y: bestEdge.y }, photoSpace);
    
    return {
      snapped: true,
      point: snappedScreenPoint,
      distance: minDistance
    };
  }
  
  return {
    snapped: false,
    point,
    distance: 0
  };
}

/**
 * Apply freehand smoothing using moving average
 */
export function smoothFreehandPath(points: Point[], smoothingRadius: number = 4): Point[] {
  if (points.length < 3) return points;
  
  const smoothed: Point[] = [];
  
  for (let i = 0; i < points.length; i++) {
    let sumX = 0;
    let sumY = 0;
    let count = 0;
    
    // Apply moving average within smoothing radius
    for (let j = Math.max(0, i - smoothingRadius); j <= Math.min(points.length - 1, i + smoothingRadius); j++) {
      sumX += points[j].x;
      sumY += points[j].y;
      count++;
    }
    
    smoothed.push({
      x: sumX / count,
      y: sumY / count
    });
  }
  
  return smoothed;
}

/**
 * Simplify path using Ramer-Douglas-Peucker algorithm
 */
export function simplifyPath(points: Point[], epsilon: number = 2): Point[] {
  if (points.length < 3) return points;
  
  // Find the point with maximum distance from the line segment
  let maxDistance = 0;
  let maxIndex = 0;
  
  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(points[i], points[0], points[points.length - 1]);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = i;
    }
  }
  
  // If max distance is greater than epsilon, recursively simplify
  if (maxDistance > epsilon) {
    const leftPoints = simplifyPath(points.slice(0, maxIndex + 1), epsilon);
    const rightPoints = simplifyPath(points.slice(maxIndex), epsilon);
    
    // Combine results, avoiding duplicate middle point
    return [...leftPoints.slice(0, -1), ...rightPoints];
  } else {
    // All points are within epsilon, return just the endpoints
    return [points[0], points[points.length - 1]];
  }
}

/**
 * Calculate perpendicular distance from point to line segment
 */
function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const A = point.x - lineStart.x;
  const B = point.y - lineStart.y;
  const C = lineEnd.x - lineStart.x;
  const D = lineEnd.y - lineStart.y;
  
  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  
  if (lenSq === 0) {
    // Line segment is actually a point
    return Math.sqrt(A * A + B * B);
  }
  
  const param = dot / lenSq;
  
  let xx, yy;
  
  if (param < 0) {
    xx = lineStart.x;
    yy = lineStart.y;
  } else if (param > 1) {
    xx = lineEnd.x;
    yy = lineEnd.y;
  } else {
    xx = lineStart.x + param * C;
    yy = lineStart.y + param * D;
  }
  
  const dx = point.x - xx;
  const dy = point.y - yy;
  
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Generate edge map from image data using Sobel operator
 */
export function generateEdgeMap(imageData: ImageData): ImageData {
  const { width, height } = imageData;
  const edgeData = new Uint8ClampedArray(width * height * 4);
  
  // Sobel kernels
  const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0;
      let gy = 0;
      
      // Apply Sobel kernels
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const pixelIndex = ((y + ky) * width + (x + kx)) * 4;
          const gray = (imageData.data[pixelIndex] + imageData.data[pixelIndex + 1] + imageData.data[pixelIndex + 2]) / 3;
          
          const kernelIndex = (ky + 1) * 3 + (kx + 1);
          gx += gray * sobelX[kernelIndex];
          gy += gray * sobelY[kernelIndex];
        }
      }
      
      // Calculate edge magnitude
      const magnitude = Math.sqrt(gx * gx + gy * gy);
      const edgeStrength = Math.min(255, magnitude);
      
      const index = (y * width + x) * 4;
      edgeData[index] = edgeStrength;     // R channel
      edgeData[index + 1] = edgeStrength; // G channel
      edgeData[index + 2] = edgeStrength; // B channel
      edgeData[index + 3] = 255;         // A channel
    }
  }
  
  return new ImageData(edgeData, width, height);
}

/**
 * Calculate distance between two points
 */
export function distance(p1: Point, p2: Point): number {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
}

/**
 * Calculate angle between two points
 */
export function angle(p1: Point, p2: Point): number {
  return Math.atan2(p2.y - p1.y, p2.x - p1.x);
}

/**
 * Format angle for display
 */
export function formatAngle(radians: number): string {
  const degrees = (radians * 180 / Math.PI + 360) % 360;
  return `${degrees.toFixed(1)}°`;
}

/**
 * Format distance for display
 */
export function formatDistance(pixels: number, photoSpace: PhotoSpace): string {
  // If we have calibration info, convert to real units
  // For now, just show pixels
  return `${pixels.toFixed(1)}px`;
}

/**
 * Find closest edge to a point for insertion
 */
export function findClosestEdge(point: Point, maskPoints: MaskPoint[], threshold: number = 10): number | null {
  let closestEdgeIndex = null;
  let minDistance = threshold;
  
  for (let i = 0; i < maskPoints.length; i++) {
    const p1 = maskPoints[i];
    const p2 = maskPoints[(i + 1) % maskPoints.length];
    
    const distance = perpendicularDistance(point, p1, p2);
    if (distance < minDistance) {
      minDistance = distance;
      closestEdgeIndex = i;
    }
  }
  
  return closestEdgeIndex;
}

/**
 * Insert vertex into mask at specified edge
 */
export function insertVertexAtEdge(maskPoints: MaskPoint[], edgeIndex: number, newPoint: MaskPoint): MaskPoint[] {
  const newPoints = [...maskPoints];
  newPoints.splice(edgeIndex + 1, 0, newPoint);
  return newPoints;
}

/**
 * Remove vertex from mask while maintaining validity
 */
export function removeVertex(maskPoints: MaskPoint[], vertexIndex: number): MaskPoint[] {
  if (maskPoints.length <= 3) return maskPoints; // Can't remove vertex from triangle
  
  const newPoints = [...maskPoints];
  newPoints.splice(vertexIndex, 1);
  return newPoints;
}

/**
 * Move vertex to new position
 */
export function moveVertex(maskPoints: MaskPoint[], vertexIndex: number, newPoint: MaskPoint): MaskPoint[] {
  const newPoints = [...maskPoints];
  newPoints[vertexIndex] = newPoint;
  return newPoints;
}

/**
 * Toggle vertex between corner and smooth
 */
export function toggleVertexKind(maskPoints: MaskPoint[], vertexIndex: number): MaskPoint[] {
  const newPoints = [...maskPoints];
  const vertex = newPoints[vertexIndex];
  
  if (vertex.kind === 'corner') {
    // Convert to smooth - add bezier handles
    const prevVertex = newPoints[(vertexIndex - 1 + maskPoints.length) % maskPoints.length];
    const nextVertex = newPoints[(vertexIndex + 1) % maskPoints.length];
    
    // Calculate handle positions (simple approach)
    const handleLength = distance(vertex, prevVertex) * 0.3;
    const handleAngle1 = angle(prevVertex, vertex);
    const handleAngle2 = angle(vertex, nextVertex);
    
    vertex.kind = 'smooth';
    vertex.h1 = {
      x: vertex.x + Math.cos(handleAngle1) * handleLength,
      y: vertex.y + Math.sin(handleAngle1) * handleLength
    };
    vertex.h2 = {
      x: vertex.x + Math.cos(handleAngle2) * handleLength,
      y: vertex.y + Math.sin(handleAngle2) * handleLength
    };
  } else {
    // Convert to corner - remove bezier handles
    vertex.kind = 'corner';
    delete vertex.h1;
    delete vertex.h2;
  }
  
  return newPoints;
}

/**
 * Find closest vertex to a point
 */
export function findClosestVertex(point: Point, maskPoints: MaskPoint[], photoSpace: PhotoSpace, threshold: number = 8): number | null {
  let closestIndex = null;
  let minDistance = threshold;
  
  for (let i = 0; i < maskPoints.length; i++) {
    const vertex = maskPoints[i];
    const vertexScreen = imageToScreen(vertex, photoSpace);
    const dist = distance(point, vertexScreen);
    
    if (dist < minDistance) {
      minDistance = dist;
      closestIndex = i;
    }
  }
  
  return closestIndex;
}

/**
 * Convert image point to screen point
 */
export function imageToScreen(imagePoint: Point, photoSpace: PhotoSpace): Point {
  return {
    x: (imagePoint.x * photoSpace.scale) + photoSpace.panX,
    y: (imagePoint.y * photoSpace.scale) + photoSpace.panY
  };
}
