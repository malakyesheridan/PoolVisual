/**
 * Polygon triangulation using earcut
 * Converts arbitrary polygons to triangle meshes for WebGL rendering
 */

import earcut from 'earcut';

export interface TriangulatedMesh {
  vertices: Float32Array;
  indices: Uint16Array;
}

/**
 * Triangulate a polygon into a mesh suitable for WebGL rendering
 * @param points Polygon vertices in screen coordinates
 * @returns Triangulated mesh with vertices and indices, or null if invalid
 */
export function triangulate(points: { x: number; y: number }[]): TriangulatedMesh | null {
  if (points.length < 3) {
    console.warn('[triangulate] Insufficient points:', points.length);
    return null;
  }

  try {
    // Flatten points for earcut
    const coords: number[] = [];
    for (const point of points) {
      coords.push(point.x, point.y);
    }

    // Triangulate using earcut
    const indices = earcut(coords);
    
    if (indices.length === 0) {
      console.warn('[triangulate] No triangles generated');
      return null;
    }

    // Create vertices array (reuse input coordinates)
    const vertices = new Float32Array(coords);
    
    // Convert indices to Uint16Array for WebGL
    const indexArray = new Uint16Array(indices);

    console.debug('[triangulate] Generated mesh:', {
      vertices: vertices.length / 2,
      triangles: indexArray.length / 3,
      points: points.length
    });

    return {
      vertices,
      indices: indexArray
    };

  } catch (error) {
    console.error('[triangulate] Failed to triangulate polygon:', error);
    return null;
  }
}

/**
 * Validate that a polygon is suitable for triangulation
 * @param points Polygon vertices
 * @returns True if polygon is valid
 */
export function validatePolygon(points: { x: number; y: number }[]): boolean {
  if (points.length < 3) return false;

  // Check for duplicate consecutive points
  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    
    const dx = Math.abs(current.x - next.x);
    const dy = Math.abs(current.y - next.y);
    
    if (dx < 0.5 && dy < 0.5) {
      console.warn('[triangulate] Duplicate points detected at index:', i);
      return false;
    }
  }

  // Check for sufficient area
  const area = calculatePolygonArea(points);
  if (Math.abs(area) < 100) { // Minimum 100 square pixels
    console.warn('[triangulate] Polygon area too small:', area);
    return false;
  }

  return true;
}

/**
 * Calculate signed area of polygon (positive = counter-clockwise)
 */
function calculatePolygonArea(points: { x: number; y: number }[]): number {
  let area = 0;
  const n = points.length;
  
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  
  return area / 2;
}