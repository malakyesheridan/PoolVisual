/**
 * PhotoReal UV Mapping System - World-space material texturing
 * Converts image-space coordinates to world-space UVs for realistic material rendering
 */

/**
 * Compute photorealistic world-space UV coordinates for polygon vertices
 * Uses proper perspective-corrected UV mapping based on physical material dimensions
 * 
 * @param points Polygon vertices in IMAGE SPACE pixels (not screen space)
 * @param pxPerMeter Calibration factor (pixels per meter from calibration)
 * @param material Material with physical dimensions for repeat calculation
 * @param rotationDeg Material rotation in degrees (user adjustment)
 * @param offsetX Material U offset in material units (user adjustment)
 * @param offsetY Material V offset in material units (user adjustment)
 * @returns UV coordinates as Float32Array for shader use
 */
export function computeWorldUVs(
  points: { x: number; y: number }[],
  pxPerMeter: number,
  material?: any,
  rotationDeg = 0,
  offsetX = 0,
  offsetY = 0
): Float32Array {
  if (points.length === 0) {
    return new Float32Array();
  }

  // Calculate physical repeat size from material properties
  const repeatM = calculatePhysicalRepeat(material);
  
  // Find polygon bounds for basis calculation
  const bounds = calculateBounds(points);
  const localBasis = calculateLocalBasis(points, bounds);
  
  // Reference point (typically first vertex or centroid)
  const p0 = points[0];
  
  // Rotation transformation matrices
  const rotRad = (rotationDeg * Math.PI) / 180;
  const cosR = Math.cos(rotRad);
  const sinR = Math.sin(rotRad);
  
  // Compute UVs for each vertex in world space
  const uvs = new Float32Array(points.length * 2);
  let minU = Infinity, maxU = -Infinity;
  let minV = Infinity, maxV = -Infinity;
  
  // First pass: compute world-space UVs
  const worldUVs = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    
    // Convert to world coordinates (meters from reference point)
    const worldU = ((p.x - p0.x) * localBasis.uDir.x + (p.y - p0.y) * localBasis.uDir.y) / pxPerMeter;
    const worldV = ((p.x - p0.x) * localBasis.vDir.x + (p.y - p0.y) * localBasis.vDir.y) / pxPerMeter;
    
    // Apply user rotation around origin
    const rotatedU = worldU * cosR - worldV * sinR;
    const rotatedV = worldU * sinR + worldV * cosR;
    
    // Convert to material UV space (tiles per meter)
    let u = rotatedU / repeatM + offsetX;
    let v = rotatedV / repeatM + offsetY;
    
    worldUVs.push({ u, v });
    minU = Math.min(minU, u);
    maxU = Math.max(maxU, u);
    minV = Math.min(minV, v);
    maxV = Math.max(maxV, v);
  }
  
  // Second pass: normalize to prevent negative UVs while preserving tiling
  for (let i = 0; i < points.length; i++) {
    let { u, v } = worldUVs[i];
    
    // Shift to ensure all UVs are positive (preserves tiling pattern)
    u = u - Math.floor(minU);
    v = v - Math.floor(minV);
    
    // Store UV coordinates
    uvs[i * 2] = u;
    uvs[i * 2 + 1] = v;
  }

  console.debug('[uv] Computed PhotoReal UVs:', {
    points: points.length,
    pxPerMeter,
    repeatM,
    rotation: rotationDeg,
    offset: { x: offsetX, y: offsetY },
    bounds,
    basis: localBasis,
    uvRange: {
      u: [Math.min(...Array.from(uvs).filter((_, i) => i % 2 === 0)), 
          Math.max(...Array.from(uvs).filter((_, i) => i % 2 === 0))],
      v: [Math.min(...Array.from(uvs).filter((_, i) => i % 2 === 1)), 
          Math.max(...Array.from(uvs).filter((_, i) => i % 2 === 1))]
    }
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

    if (u === undefined || v === undefined) continue;

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