/**
 * UV coordinate mapping for world-space material texturing
 * Converts screen coordinates to world-space UVs based on calibration
 */

/**
 * Compute world-space UV coordinates for polygon vertices
 * @param points Polygon vertices in screen pixels
 * @param pxPerMeter Calibration factor (pixels per meter)
 * @param rotationDeg Material rotation in degrees
 * @param offsetX Material offset in world space (meters)
 * @param offsetY Material offset in world space (meters)
 * @returns UV coordinates as Float32Array
 */
export function computeWorldUVs(
  points: { x: number; y: number }[],
  pxPerMeter: number,
  rotationDeg = 0,
  offsetX = 0,
  offsetY = 0
): Float32Array {
  if (points.length === 0) {
    return new Float32Array();
  }

  // Calculate polygon bounds and orientation
  const bounds = calculateBounds(points);
  const basis = calculateLocalBasis(points, bounds);

  // Convert rotation to radians
  const rotationRad = (rotationDeg * Math.PI) / 180;
  const cosR = Math.cos(rotationRad);
  const sinR = Math.sin(rotationRad);

  // Compute UVs for each vertex
  const uvs = new Float32Array(points.length * 2);
  
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    
    // Convert to world space (meters)
    const worldX = (point.x - bounds.minX) / pxPerMeter;
    const worldY = (point.y - bounds.minY) / pxPerMeter;
    
    // Apply local basis transformation
    const localU = worldX * basis.uDir.x + worldY * basis.uDir.y;
    const localV = worldX * basis.vDir.x + worldY * basis.vDir.y;
    
    // Apply material rotation
    const rotatedU = localU * cosR - localV * sinR;
    const rotatedV = localU * sinR + localV * cosR;
    
    // Apply offsets and store
    uvs[i * 2] = rotatedU + offsetX;
    uvs[i * 2 + 1] = rotatedV + offsetY;
  }

  console.debug('[uv] Computed UVs:', {
    points: points.length,
    pxPerMeter,
    rotation: rotationDeg,
    offset: { x: offsetX, y: offsetY },
    bounds: bounds,
    basis: basis
  });

  return uvs;
}

/**
 * Calculate bounding box of polygon
 */
function calculateBounds(points: { x: number; y: number }[]) {
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  for (const point of points) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }

  return { minX, maxX, minY, maxY };
}

/**
 * Calculate local coordinate basis for the polygon
 * U axis: along longest edge direction
 * V axis: perpendicular to U in image plane
 */
function calculateLocalBasis(
  points: { x: number; y: number }[],
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
) {
  // Find the longest edge to determine primary orientation
  let longestEdge = { length: 0, dir: { x: 1, y: 0 } };
  
  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    
    const dx = next.x - current.x;
    const dy = next.y - current.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length > longestEdge.length) {
      longestEdge = {
        length,
        dir: { x: dx / length, y: dy / length }
      };
    }
  }

  // U direction: along longest edge
  const uDir = longestEdge.dir;
  
  // V direction: perpendicular to U (90° counter-clockwise)
  const vDir = { x: -uDir.y, y: uDir.x };

  return { uDir, vDir };
}

/**
 * Calculate physical repeat size from material properties
 * @param material Material object with dimensions
 * @returns Repeat size in meters
 */
export function calculatePhysicalRepeat(material: any): number {
  // Try physical repeat first
  if (material.physicalRepeatM || material.physical_repeat_m) {
    return parseFloat(material.physicalRepeatM || material.physical_repeat_m);
  }

  // Try sheet dimensions
  if (material.sheetWidthMm || material.sheet_width_mm) {
    return (material.sheetWidthMm || material.sheet_width_mm) / 1000;
  }

  // Try tile dimensions
  if (material.tileWidthMm || material.tile_width_mm) {
    return (material.tileWidthMm || material.tile_width_mm) / 1000;
  }

  // Default to 30cm for most pool materials
  return 0.30;
}

/**
 * Apply bond pattern transformation to UV coordinates
 * @param uvs UV coordinates
 * @param bond Bond pattern type
 * @returns Modified UV coordinates
 */
export function applyBondPattern(
  uvs: Float32Array,
  bond: 'straight' | 'brick50' | 'herringbone'
): Float32Array {
  if (bond === 'straight') {
    return uvs; // No transformation needed
  }

  const modifiedUVs = new Float32Array(uvs);

  for (let i = 0; i < uvs.length; i += 2) {
    const u = uvs[i];
    const v = uvs[i + 1];

    switch (bond) {
      case 'brick50':
        // Offset every other row by half tile width
        const row = Math.floor(v);
        if (row % 2 === 1) {
          modifiedUVs[i] = u + 0.5; // Offset U by half tile
        }
        break;

      case 'herringbone':
        // Rotate alternating tiles by 90 degrees
        const tileIndex = Math.floor(u) + Math.floor(v);
        if (tileIndex % 2 === 1) {
          modifiedUVs[i] = v;     // Swap U and V
          modifiedUVs[i + 1] = u;
        }
        break;
    }
  }

  return modifiedUVs;
}