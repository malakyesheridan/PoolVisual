// Underwater v2.0 - Realistic Pool Optics Pipeline
// Implements 5-layer compositing system for photorealistic underwater effects

import { UnderwaterRealismSettings, Point, PhotoSpace, MaskPoint } from './types';
import { getMaskBounds, maskPointsToPoints } from './utils';

export interface UnderwaterV2Cache {
  waterHue?: { h: number; s: number; v: number };
  causticMask?: ImageData;
  depthGradient?: ImageData;
  meniscusMask?: ImageData;
  lastSettings?: string; // JSON string for cache invalidation
}

// Cache for underwater v2.0 effects
const underwaterV2Cache = new Map<string, UnderwaterV2Cache>();

/**
 * Sample water hue from original photo inside mask
 * Picks 300-1000 random points, skips bright pixels, computes median HSV
 */
export function sampleWaterHue(
  photoImageData: ImageData,
  maskPoints: MaskPoint[],
  photoSpace: PhotoSpace
): { h: number; s: number; v: number } {
  const { width, height } = photoImageData;
  const data = photoImageData.data;
  
  // Create mask bounds for sampling
  const bounds = getMaskBounds(maskPointsToPoints(maskPoints));
  const maskWidth = bounds.maxX - bounds.minX;
  const maskHeight = bounds.maxY - bounds.minY;
  
  // Sample 500-800 points inside mask
  const numSamples = Math.min(800, Math.max(300, Math.floor(maskWidth * maskHeight * 0.01)));
  const samples: { h: number; s: number; v: number }[] = [];
  
  for (let i = 0; i < numSamples; i++) {
    // Random point inside mask bounds
    const x = bounds.minX + Math.random() * maskWidth;
    const y = bounds.minY + Math.random() * maskHeight;
    
    // Check if point is inside mask polygon
    if (!pointInPolygon({ x, y }, maskPoints)) continue;
    
    // Convert to image coordinates and sample
    const imageX = Math.floor(x);
    const imageY = Math.floor(y);
    
    if (imageX >= 0 && imageX < width && imageY >= 0 && imageY < height) {
      const pixelIndex = (imageY * width + imageX) * 4;
      const r = data[pixelIndex] || 0;
      const g = data[pixelIndex + 1] || 0;
      const b = data[pixelIndex + 2] || 0;
      
      // Skip very bright pixels (likely highlights/specular)
      const luminance = (r * 0.299 + g * 0.587 + b * 0.114);
      if (luminance > 200) continue;
      
      // Convert RGB to HSV
      const hsv = rgbToHsv(r, g, b);
      samples.push(hsv);
    }
  }
  
  if (samples.length === 0) {
    // Fallback to default pool water hue
    return { h: 180, s: 0.3, v: 0.8 }; // Cyan-blue
  }
  
  // Compute median HSV
  const sortedH = samples.map(s => s.h).sort((a, b) => a - b);
  const sortedS = samples.map(s => s.s).sort((a, b) => a - b);
  const sortedV = samples.map(s => s.v).sort((a, b) => a - b);
  
  const medianIndex = Math.floor(samples.length / 2);
  
  return {
    h: sortedH[medianIndex],
    s: Math.min(sortedS[medianIndex], 0.35), // Cap saturation
    v: sortedV[medianIndex]
  };
}

/**
 * Convert RGB to HSV
 */
function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;
  
  let h = 0;
  if (diff !== 0) {
    if (max === r) {
      h = ((g - b) / diff) % 6;
    } else if (max === g) {
      h = (b - r) / diff + 2;
    } else {
      h = (r - g) / diff + 4;
    }
  }
  
  h = (h * 60 + 360) % 360;
  const s = max === 0 ? 0 : diff / max;
  const v = max;
  
  return { h, s, v };
}

/**
 * Convert HSV to RGB
 */
function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  
  let r = 0, g = 0, b = 0;
  
  if (h >= 0 && h < 60) {
    r = c; g = x; b = 0;
  } else if (h >= 60 && h < 120) {
    r = x; g = c; b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0; g = c; b = x;
  } else if (h >= 180 && h < 240) {
    r = 0; g = x; b = c;
  } else if (h >= 240 && h < 300) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }
  
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255)
  };
}

/**
 * Check if point is inside polygon using ray casting algorithm
 */
function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    if (((polygon[i].y > point.y) !== (polygon[j].y > point.y)) &&
        (point.x < (polygon[j].x - polygon[i].x) * (point.y - polygon[i].y) / (polygon[j].y - polygon[i].y) + polygon[i].x)) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * L1 - Depth Tint & Attenuation
 * Compute depth gradient and apply water hue tint with contrast reduction
 */
export function applyDepthTintAndAttenuation(
  ctx: CanvasRenderingContext2D,
  maskPoints: MaskPoint[],
  settings: UnderwaterRealismSettings,
  photoSpace: PhotoSpace
): void {
  const bounds = getMaskBounds(maskPointsToPoints(maskPoints));
  const intensity = settings.blend / 100;
  const depthBias = settings.depthBias / 100;
  const tintStrength = settings.tint / 100;
  
  // Get sampled water hue or use default
  const waterHue = settings.sampledWaterHue || { h: 180, s: 0.3, v: 0.8 };
  const waterRgb = hsvToRgb(waterHue.h, waterHue.s, waterHue.v);
  
  // Create depth gradient
  const gradient = ctx.createLinearGradient(
    bounds.minX,
    bounds.minY,
    bounds.minX,
    bounds.maxY
  );
  
  // Top (shallow) - lighter, less tinted
  const shallowTint = {
    r: 1.0 + (waterRgb.r / 255 - 0.5) * tintStrength * 0.3,
    g: 1.0 + (waterRgb.g / 255 - 0.5) * tintStrength * 0.3,
    b: 1.0 + (waterRgb.b / 255 - 0.5) * tintStrength * 0.3,
    brightness: 1.0 - intensity * 0.05
  };
  
  // Bottom (deep) - darker, more tinted
  const deepTint = {
    r: 1.0 + (waterRgb.r / 255 - 0.5) * tintStrength * 0.8,
    g: 1.0 + (waterRgb.g / 255 - 0.5) * tintStrength * 0.8,
    b: 1.0 + (waterRgb.b / 255 - 0.5) * tintStrength * 0.8,
    brightness: 1.0 - intensity * 0.12
  };
  
  // Interpolate based on depth bias
  const midTint = {
    r: shallowTint.r + (deepTint.r - shallowTint.r) * depthBias,
    g: shallowTint.g + (deepTint.g - shallowTint.g) * depthBias,
    b: shallowTint.b + (deepTint.b - shallowTint.b) * depthBias,
    brightness: shallowTint.brightness + (deepTint.brightness - shallowTint.brightness) * depthBias
  };
  
  gradient.addColorStop(0, `rgba(${Math.floor(255 * shallowTint.r)}, ${Math.floor(255 * shallowTint.g)}, ${Math.floor(255 * shallowTint.b)}, ${intensity})`);
  gradient.addColorStop(0.5, `rgba(${Math.floor(255 * midTint.r)}, ${Math.floor(255 * midTint.g)}, ${Math.floor(255 * midTint.b)}, ${intensity})`);
  gradient.addColorStop(1, `rgba(${Math.floor(255 * deepTint.r)}, ${Math.floor(255 * deepTint.g)}, ${Math.floor(255 * deepTint.b)}, ${intensity})`);
  
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = gradient;
  
  // Draw mask with gradient
  ctx.beginPath();
  ctx.moveTo(maskPoints[0].x, maskPoints[0].y);
  for (let i = 1; i < maskPoints.length; i++) {
    ctx.lineTo(maskPoints[i].x, maskPoints[i].y);
  }
  ctx.closePath();
  ctx.fill();
}

/**
 * L2 - Meniscus Edge Highlight
 * Generate 1-3px inner stroke along mask boundary
 */
export function applyMeniscusHighlight(
  ctx: CanvasRenderingContext2D,
  maskPoints: MaskPoint[],
  settings: UnderwaterRealismSettings,
  photoSpace: PhotoSpace
): void {
  const meniscusStrength = settings.meniscus / 100;
  if (meniscusStrength <= 0) return;
  
  const bounds = getMaskBounds(maskPointsToPoints(maskPoints));
  const waterHue = settings.sampledWaterHue || { h: 180, s: 0.3, v: 0.8 };
  
  // Create meniscus highlight color (near white with water hue touch)
  const highlightRgb = {
    r: 0.95 + (waterHue.h - 180) / 360 * 0.1, // Slight hue shift
    g: 0.95 + (waterHue.h - 180) / 360 * 0.1,
    b: 0.95 + (waterHue.h - 180) / 360 * 0.1
  };
  
  // Create inner stroke by offsetting mask points inward
  const strokeWidth = Math.min(3, Math.max(1, photoSpace.dpr));
  const offsetPoints = offsetPolygonInward(maskPoints, strokeWidth);
  
  if (offsetPoints.length === 0) return;
  
  // Create gradient for feathering
  const gradient = ctx.createRadialGradient(
    bounds.minX + (bounds.maxX - bounds.minX) / 2,
    bounds.minY + (bounds.maxY - bounds.minY) / 2,
    0,
    bounds.minX + (bounds.maxX - bounds.minX) / 2,
    bounds.minY + (bounds.maxY - bounds.minY) / 2,
    Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) / 2
  );
  
  gradient.addColorStop(0, `rgba(${Math.floor(255 * highlightRgb.r)}, ${Math.floor(255 * highlightRgb.g)}, ${Math.floor(255 * highlightRgb.b)}, ${meniscusStrength * 0.4})`);
  gradient.addColorStop(0.7, `rgba(${Math.floor(255 * highlightRgb.r)}, ${Math.floor(255 * highlightRgb.g)}, ${Math.floor(255 * highlightRgb.b)}, ${meniscusStrength * 0.2})`);
  gradient.addColorStop(1, `rgba(${Math.floor(255 * highlightRgb.r)}, ${Math.floor(255 * highlightRgb.g)}, ${Math.floor(255 * highlightRgb.b)}, 0)`);
  
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = gradient;
  
  // Draw offset polygon
  ctx.beginPath();
  ctx.moveTo(offsetPoints[0].x, offsetPoints[0].y);
  for (let i = 1; i < offsetPoints.length; i++) {
    ctx.lineTo(offsetPoints[i].x, offsetPoints[i].y);
  }
  ctx.closePath();
  ctx.fill();
}

/**
 * Offset polygon points inward by given distance
 */
function offsetPolygonInward(points: MaskPoint[], distance: number): MaskPoint[] {
  if (points.length < 3) return [];
  
  const offsetPoints: MaskPoint[] = [];
  
  for (let i = 0; i < points.length; i++) {
    const prev = points[(i - 1 + points.length) % points.length];
    const curr = points[i];
    const next = points[(i + 1) % points.length];
    
    // Calculate inward normal
    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;
    
    // Normalize
    const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
    
    if (len1 === 0 || len2 === 0) {
      offsetPoints.push(curr);
      continue;
    }
    
    const nx1 = -dy1 / len1;
    const ny1 = dx1 / len1;
    const nx2 = -dy2 / len2;
    const ny2 = dx2 / len2;
    
    // Average normals
    const nx = (nx1 + nx2) / 2;
    const ny = (ny1 + ny2) / 2;
    const len = Math.sqrt(nx * nx + ny * ny);
    
    if (len === 0) {
      offsetPoints.push(curr);
      continue;
    }
    
    // Apply inward offset
    offsetPoints.push({
      x: curr.x + (nx / len) * distance,
      y: curr.y + (ny / len) * distance,
      kind: curr.kind || 'corner'
    });
  }
  
  return offsetPoints;
}

/**
 * L3 - Caustic Highlight Modulation
 * Extract or generate caustic patterns and apply as screen blend
 */
export function applyCausticModulation(
  ctx: CanvasRenderingContext2D,
  maskPoints: MaskPoint[],
  settings: UnderwaterRealismSettings,
  photoSpace: PhotoSpace,
  originalImageData?: ImageData
): void {
  const highlightsStrength = settings.highlights / 100;
  if (highlightsStrength <= 0) return;
  
  const bounds = getMaskBounds(maskPointsToPoints(maskPoints));
  
  // Create caustic pattern
  const causticPattern = createCausticPattern(
    bounds.maxX - bounds.minX,
    bounds.maxY - bounds.minY,
    originalImageData,
    maskPoints
  );
  
  if (!causticPattern) return;
  
  // Apply caustic as screen blend
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = highlightsStrength * 0.35;
  
  // Draw caustic pattern
  ctx.drawImage(causticPattern, bounds.minX, bounds.minY);
  
  ctx.globalAlpha = 1.0;
}

/**
 * Create caustic pattern from original image or procedural generation
 */
function createCausticPattern(
  width: number,
  height: number,
  originalImageData?: ImageData,
  maskPoints?: MaskPoint[]
): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) return null;
  
  // Try to extract caustics from original image first
  if (originalImageData && maskPoints) {
    const extracted = extractCausticsFromImage(originalImageData, maskPoints, width, height);
    if (extracted) {
      ctx.putImageData(extracted, 0, 0);
      return canvas;
    }
  }
  
  // Fallback to procedural caustics
  const proceduralCaustics = generateProceduralCaustics(width, height);
  ctx.putImageData(proceduralCaustics, 0, 0);
  
  return canvas;
}

/**
 * Extract caustic highlights from original image using high-pass filter
 */
function extractCausticsFromImage(
  imageData: ImageData,
  maskPoints: MaskPoint[],
  targetWidth: number,
  targetHeight: number
): ImageData | null {
  const { width, height } = imageData;
  const data = imageData.data;
  const bounds = getMaskBounds(maskPointsToPoints(maskPoints));
  
  // Create high-pass filter for blue/cyan channels
  const causticData = new Uint8ClampedArray(targetWidth * targetHeight * 4);
  
  for (let y = 0; y < targetHeight; y++) {
    for (let x = 0; x < targetWidth; x++) {
      const sourceX = Math.floor(bounds.minX + (x / targetWidth) * (bounds.maxX - bounds.minX));
      const sourceY = Math.floor(bounds.minY + (y / targetHeight) * (bounds.maxY - bounds.minY));
      
      if (sourceX >= 0 && sourceX < width && sourceY >= 0 && sourceY < height) {
        const sourceIndex = (sourceY * width + sourceX) * 4;
        const targetIndex = (y * targetWidth + x) * 4;
        
        const r = data[sourceIndex] || 0;
        const g = data[sourceIndex + 1] || 0;
        const b = data[sourceIndex + 2] || 0;
        
        // High-pass filter: emphasize blue/cyan highlights
        const blueIntensity = b - (r + g) / 2;
        const causticValue = Math.max(0, Math.min(255, blueIntensity + 128));
        
        causticData[targetIndex] = causticValue;
        causticData[targetIndex + 1] = causticValue;
        causticData[targetIndex + 2] = causticValue;
        causticData[targetIndex + 3] = 255;
      }
    }
  }
  
  return new ImageData(causticData, targetWidth, targetHeight);
}

/**
 * Generate procedural caustic pattern using noise
 */
function generateProceduralCaustics(width: number, height: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      
      // Simple noise-based caustic pattern
      const noise1 = Math.sin(x * 0.02) * Math.cos(y * 0.03) * 0.5;
      const noise2 = Math.sin(x * 0.05 + y * 0.02) * 0.3;
      const noise3 = Math.sin(x * 0.01 + y * 0.04) * 0.2;
      
      const causticValue = Math.max(0, Math.min(255, (noise1 + noise2 + noise3 + 1) * 128));
      
      data[index] = causticValue;
      data[index + 1] = causticValue;
      data[index + 2] = causticValue;
      data[index + 3] = 255;
    }
  }
  
  return new ImageData(data, width, height);
}

/**
 * L4 - Micro-Ripple Displacement
 * Apply subtle displacement to texture sampling coordinates
 */
export function applyMicroRippleDisplacement(
  ctx: CanvasRenderingContext2D,
  maskPoints: MaskPoint[],
  settings: UnderwaterRealismSettings,
  photoSpace: PhotoSpace
): void {
  const rippleStrength = settings.ripple / 100;
  if (rippleStrength <= 0) return;
  
  const bounds = getMaskBounds(maskPointsToPoints(maskPoints));
  const maxDisplacement = Math.min(2, rippleStrength * 2); // Max 2px at 1x scale
  
  // Create displacement map
  const displacementMap = createDisplacementMap(
    bounds.maxX - bounds.minX,
    bounds.maxY - bounds.minY,
    maxDisplacement
  );
  
  if (!displacementMap) return;
  
  // Apply displacement as subtle distortion
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = rippleStrength * 0.1;
  
  // Draw displacement pattern
  ctx.drawImage(displacementMap, bounds.minX, bounds.minY);
  
  ctx.globalAlpha = 1.0;
}

/**
 * Create displacement map for micro-ripple effect
 */
function createDisplacementMap(width: number, height: number, maxDisplacement: number): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) return null;
  
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      
      // Generate blue noise displacement
      const displacement = (Math.random() - 0.5) * maxDisplacement;
      
      data[index] = 128 + displacement; // R channel for X displacement
      data[index + 1] = 128 + displacement; // G channel for Y displacement
      data[index + 2] = 128; // B channel unused
      data[index + 3] = 255; // Alpha
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Main underwater v2.0 compositing function
 * Applies all 5 layers in sequence
 */
export function applyUnderwaterV2(
  ctx: CanvasRenderingContext2D,
  maskPoints: MaskPoint[],
  settings: UnderwaterRealismSettings,
  photoSpace: PhotoSpace,
  originalImageData?: ImageData
): void {
  if (!settings.enabled || settings.underwaterVersion !== 'v2') return;
  
  // Sample water hue if not cached
  if (!settings.sampledWaterHue && originalImageData) {
    const waterHue = sampleWaterHue(originalImageData, maskPoints, photoSpace);
    // Note: This would need to be saved back to settings via dispatch
    // For now, we'll use it locally
    settings.sampledWaterHue = waterHue;
  }
  
  // L1 - Depth Tint & Attenuation
  applyDepthTintAndAttenuation(ctx, maskPoints, settings, photoSpace);
  
  // L2 - Meniscus Edge Highlight
  applyMeniscusHighlight(ctx, maskPoints, settings, photoSpace);
  
  // L3 - Caustic Highlight Modulation
  applyCausticModulation(ctx, maskPoints, settings, photoSpace, originalImageData);
  
  // L4 - Micro-Ripple Displacement
  applyMicroRippleDisplacement(ctx, maskPoints, settings, photoSpace);
  
  // L5 - Edge Feather (already implemented in existing system)
  // This is handled by the existing edgeFeather parameter
}

/**
 * Get cache key for underwater v2.0 effects
 */
export function getUnderwaterV2CacheKey(
  maskId: string,
  settings: UnderwaterRealismSettings,
  photoSpace: PhotoSpace
): string {
  const relevantSettings = {
    underwaterVersion: settings.underwaterVersion,
    blend: settings.blend,
    depthBias: settings.depthBias,
    tint: settings.tint,
    highlights: settings.highlights,
    ripple: settings.ripple,
    meniscus: settings.meniscus,
    softness: settings.softness,
    edgeFeather: settings.edgeFeather
  };
  
  return `underwater_v2_${maskId}_${JSON.stringify(relevantSettings)}_${photoSpace.scale}_${photoSpace.dpr}`;
}

/**
 * Clear underwater v2.0 cache
 */
export function clearUnderwaterV2Cache(): void {
  underwaterV2Cache.clear();
}
