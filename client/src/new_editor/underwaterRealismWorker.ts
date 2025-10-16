// Underwater Realism Worker - Fast compositing pipeline for realistic underwater materials
// Runs off-main-thread to keep UI responsive during compositing

export interface UnderwaterRealismSettings {
  enabled: boolean;
  blend: number; // 0-100% - overall tint/attenuation strength
  refraction: number; // 0-100% - how much pattern warps with ripples
  edgeSoftness: number; // 0-12px - feather/inner shadow falloff
}

export interface UnderwaterRealismInput {
  backgroundImageData: ImageData;
  materialImageData: ImageData;
  maskPoints: { x: number; y: number }[];
  settings: UnderwaterRealismSettings;
  imageWidth: number;
  imageHeight: number;
}

export interface UnderwaterRealismResult {
  success: boolean;
  resultImageData?: ImageData;
  error?: string;
  processingTime?: number;
}

// Color space conversion utilities
function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  // Simplified RGB to LAB conversion
  // In a real implementation, you'd use proper color space conversion
  const l = (r * 0.299 + g * 0.587 + b * 0.114) / 255 * 100;
  const a = ((r - g) / 255) * 100;
  const b_lab = ((r + g - 2 * b) / 255) * 100;
  return [l, a, b_lab];
}

function labToRgb(l: number, a: number, b_lab: number): [number, number, number] {
  // Simplified LAB to RGB conversion
  const r = Math.max(0, Math.min(255, (l + a + b_lab) / 3 * 255));
  const g = Math.max(0, Math.min(255, (l - a) / 2 * 255));
  const b = Math.max(0, Math.min(255, (l - b_lab) / 2 * 255));
  return [r, g, b];
}

// Create mask from points
function createMaskFromPoints(
  points: { x: number; y: number }[],
  width: number,
  height: number
): Uint8Array {
  const mask = new Uint8Array(width * height);
  
  // Simple polygon fill algorithm
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pointInPolygon(x, y, points)) {
        mask[y * width + x] = 255;
      }
    }
  }
  
  return mask;
}

// Point in polygon test
function pointInPolygon(x: number, y: number, points: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    if (((points[i].y > y) !== (points[j].y > y)) &&
        (x < (points[j].x - points[i].x) * (y - points[i].y) / (points[j].y - points[i].y) + points[i].x)) {
      inside = !inside;
    }
  }
  return inside;
}

// Apply underwater tint and attenuation
function applyUnderwaterTint(
  imageData: ImageData,
  mask: Uint8Array,
  blendStrength: number
): ImageData {
  const { data, width, height } = imageData;
  const result = new ImageData(width, height);
  const resultData = result.data;
  
  // Underwater tint: blue-green shift + brightness reduction
  const tintR = 0.8; // Reduce red
  const tintG = 0.9; // Slight green boost
  const tintB = 1.1; // Blue boost
  const brightness = 0.85; // Overall brightness reduction
  
  for (let i = 0; i < data.length; i += 4) {
    const pixelIndex = i / 4;
    const maskValue = mask[pixelIndex] / 255;
    
    if (maskValue > 0) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      
      // Apply underwater tint
      const newR = Math.max(0, Math.min(255, r * tintR * brightness));
      const newG = Math.max(0, Math.min(255, g * tintG * brightness));
      const newB = Math.max(0, Math.min(255, b * tintB * brightness));
      
      // Blend with original based on blend strength
      const blendFactor = blendStrength / 100;
      resultData[i] = r * (1 - blendFactor) + newR * blendFactor;
      resultData[i + 1] = g * (1 - blendFactor) + newG * blendFactor;
      resultData[i + 2] = b * (1 - blendFactor) + newB * blendFactor;
      resultData[i + 3] = a;
    } else {
      // Copy original pixel
      resultData[i] = data[i];
      resultData[i + 1] = data[i + 1];
      resultData[i + 2] = data[i + 2];
      resultData[i + 3] = data[i + 3];
    }
  }
  
  return result;
}

// Apply subtle refraction effect
function applyRefraction(
  imageData: ImageData,
  mask: Uint8Array,
  refractionStrength: number,
  width: number,
  height: number
): ImageData {
  const { data } = imageData;
  const result = new ImageData(width, height);
  const resultData = result.data;
  
  // Create a simple ripple pattern for refraction
  const rippleScale = refractionStrength / 100 * 2; // Max 2 pixel offset
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixelIndex = y * width + x;
      const maskValue = mask[pixelIndex] / 255;
      
      if (maskValue > 0) {
        // Simple sine wave ripple effect
        const rippleX = Math.sin(y * 0.1) * rippleScale;
        const rippleY = Math.cos(x * 0.1) * rippleScale;
        
        const sourceX = Math.max(0, Math.min(width - 1, Math.floor(x + rippleX)));
        const sourceY = Math.max(0, Math.min(height - 1, Math.floor(y + rippleY)));
        const sourceIndex = sourceY * width + sourceX;
        
        // Copy pixel with refraction offset
        resultData[pixelIndex * 4] = data[sourceIndex * 4];
        resultData[pixelIndex * 4 + 1] = data[sourceIndex * 4 + 1];
        resultData[pixelIndex * 4 + 2] = data[sourceIndex * 4 + 2];
        resultData[pixelIndex * 4 + 3] = data[sourceIndex * 4 + 3];
      } else {
        // Copy original pixel
        resultData[pixelIndex * 4] = data[pixelIndex * 4];
        resultData[pixelIndex * 4 + 1] = data[pixelIndex * 4 + 1];
        resultData[pixelIndex * 4 + 2] = data[pixelIndex * 4 + 2];
        resultData[pixelIndex * 4 + 3] = data[pixelIndex * 4 + 3];
      }
    }
  }
  
  return result;
}

// Apply edge softening and inner shadow
function applyEdgeSoftening(
  imageData: ImageData,
  mask: Uint8Array,
  edgeSoftness: number,
  width: number,
  height: number
): ImageData {
  const { data } = imageData;
  const result = new ImageData(width, height);
  const resultData = result.data;
  
  // Create softened mask
  const softMask = new Uint8Array(width * height);
  const kernelSize = Math.ceil(edgeSoftness);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixelIndex = y * width + x;
      
      if (mask[pixelIndex] > 0) {
        let totalWeight = 0;
        let weightedSum = 0;
        
        // Apply gaussian-like blur to mask edges
        for (let ky = -kernelSize; ky <= kernelSize; ky++) {
          for (let kx = -kernelSize; kx <= kernelSize; kx++) {
            const nx = x + kx;
            const ny = y + ky;
            
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const distance = Math.sqrt(kx * kx + ky * ky);
              const weight = Math.exp(-(distance * distance) / (2 * edgeSoftness * edgeSoftness));
              
              if (mask[ny * width + nx] > 0) {
                weightedSum += weight;
              }
              totalWeight += weight;
            }
          }
        }
        
        softMask[pixelIndex] = (weightedSum / totalWeight) * 255;
      }
    }
  }
  
  // Apply inner shadow effect
  for (let i = 0; i < data.length; i += 4) {
    const pixelIndex = i / 4;
    const maskValue = softMask[pixelIndex] / 255;
    
    if (maskValue > 0) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      
      // Apply inner shadow (darken edges)
      const shadowFactor = 1 - (maskValue * 0.3); // Up to 30% darkening at edges
      
      resultData[i] = Math.max(0, Math.min(255, r * shadowFactor));
      resultData[i + 1] = Math.max(0, Math.min(255, g * shadowFactor));
      resultData[i + 2] = Math.max(0, Math.min(255, b * shadowFactor));
      resultData[i + 3] = a;
    } else {
      // Copy original pixel
      resultData[i] = data[i];
      resultData[i + 1] = data[i + 1];
      resultData[i + 2] = data[i + 2];
      resultData[i + 3] = data[i + 3];
    }
  }
  
  return result;
}

// Main compositing function
export function performUnderwaterRealism(input: UnderwaterRealismInput): UnderwaterRealismResult {
  const startTime = performance.now();
  
  try {
    const { backgroundImageData, materialImageData, maskPoints, settings, imageWidth, imageHeight } = input;
    
    if (!settings.enabled) {
      return {
        success: true,
        resultImageData: materialImageData,
        processingTime: performance.now() - startTime
      };
    }
    
    // Create mask from points
    const mask = createMaskFromPoints(maskPoints, imageWidth, imageHeight);
    
    // Start with material image
    let result = new ImageData(materialImageData.data.slice(), imageWidth, imageHeight);
    
    // Apply underwater tint and attenuation
    if (settings.blend > 0) {
      result = applyUnderwaterTint(result, mask, settings.blend);
    }
    
    // Apply refraction effect
    if (settings.refraction > 0) {
      result = applyRefraction(result, mask, settings.refraction, imageWidth, imageHeight);
    }
    
    // Apply edge softening and inner shadow
    if (settings.edgeSoftness > 0) {
      result = applyEdgeSoftening(result, mask, settings.edgeSoftness, imageWidth, imageHeight);
    }
    
    return {
      success: true,
      resultImageData: result,
      processingTime: performance.now() - startTime
    };
    
  } catch (error) {
    console.error('Underwater realism processing failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime: performance.now() - startTime
    };
  }
}

// Web Worker message handler
if (typeof self !== 'undefined' && 'postMessage' in self) {
  self.onmessage = (event: MessageEvent) => {
    const { type, payload } = event.data;
    
    if (type === 'PERFORM_UNDERWATER_REALISM') {
      const result = performUnderwaterRealism(payload);
      self.postMessage({
        type: 'UNDERWATER_REALISM_RESULT',
        payload: result
      });
    }
  };
}
