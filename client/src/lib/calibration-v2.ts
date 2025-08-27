/**
 * Robust Calibration System V2
 * Implements state machine for accurate pixel-to-meter calibration
 */

import { CalState, CalSample, Calibration, Vec2 } from '@shared/schema';
import { v4 as uuidv4 } from 'uuid';

/**
 * Compute pixels per meter from two points and reference length
 */
export function computePixelsPerMeter(a: Vec2, b: Vec2, meters: number): number {
  if (meters < 0.25) {
    throw new Error('Reference length must be at least 0.25m for accuracy');
  }
  
  const distancePx = Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
  
  if (distancePx < 10) {
    throw new Error('Calibration points must be at least 10 pixels apart');
  }
  
  return distancePx / meters;
}

/**
 * Create a calibration sample
 */
export function createCalSample(a: Vec2, b: Vec2, meters: number): CalSample {
  const ppm = computePixelsPerMeter(a, b, meters);
  
  return {
    id: uuidv4(),
    a,
    b,
    meters,
    ppm,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Compute global calibration from samples with outlier detection
 */
export function computeGlobalCalibration(samples: CalSample[]): Calibration {
  if (samples.length === 0) {
    throw new Error('At least one sample is required');
  }

  if (samples.length === 1) {
    return {
      ppm: samples[0].ppm,
      samples,
      stdevPct: 0,
    };
  }

  // Calculate mean and standard deviation
  const ppms = samples.map(s => s.ppm);
  const mean = ppms.reduce((sum, ppm) => sum + ppm, 0) / ppms.length;
  const variance = ppms.reduce((sum, ppm) => sum + Math.pow(ppm - mean, 2), 0) / ppms.length;
  const stdev = Math.sqrt(variance);
  const stdevPct = (stdev / mean) * 100;

  // Filter outliers (more than 2.5 standard deviations from mean)
  const validSamples = samples.filter(sample => {
    const deviationFromMean = Math.abs(sample.ppm - mean);
    return deviationFromMean <= (2.5 * stdev);
  });

  // Recompute with valid samples if we filtered any
  if (validSamples.length < samples.length && validSamples.length > 0) {
    return computeGlobalCalibration(validSamples);
  }

  return {
    ppm: mean,
    samples,
    stdevPct,
  };
}

/**
 * Get confidence level based on standard deviation
 */
export function getConfidenceLevel(stdevPct?: number): 'high' | 'medium' | 'low' {
  if (!stdevPct || stdevPct < 1.5) return 'high';
  if (stdevPct <= 3) return 'medium';
  return 'low';
}

/**
 * Get confidence description
 */
export function getConfidenceDescription(confidence: 'high' | 'medium' | 'low'): string {
  switch (confidence) {
    case 'high':
      return 'High confidence - measurements are consistent';
    case 'medium':
      return 'Medium confidence - slight variation in measurements';
    case 'low':
      return 'Low confidence - significant variation detected';
  }
}

/**
 * Format pixels per meter for display
 */
export function formatPixelsPerMeter(ppm: number): string {
  const metersPerPixel = 1 / ppm;
  
  if (metersPerPixel >= 1) {
    return `1px = ${metersPerPixel.toFixed(2)}m`;
  } else if (metersPerPixel >= 0.01) {
    return `1px = ${(metersPerPixel * 100).toFixed(1)}cm`;
  } else {
    return `1px = ${(metersPerPixel * 1000).toFixed(1)}mm`;
  }
}

/**
 * Convert pixel measurements to meters
 */
export function pixelsToMeters(pixels: number, ppm: number): number {
  return pixels / ppm;
}

/**
 * Convert pixel area to square meters
 */
export function pixelsToSquareMeters(pixelArea: number, ppm: number): number {
  return pixelArea / (ppm * ppm);
}

/**
 * Convert meters to pixels
 */
export function metersToPixels(meters: number, ppm: number): number {
  return meters * ppm;
}

/**
 * Validate calibration sample
 */
export function validateCalSample(sample: CalSample): boolean {
  try {
    // Check basic structure
    if (!sample.id || !sample.a || !sample.b || !sample.createdAt) {
      return false;
    }

    // Check coordinates
    if (typeof sample.a.x !== 'number' || typeof sample.a.y !== 'number' ||
        typeof sample.b.x !== 'number' || typeof sample.b.y !== 'number') {
      return false;
    }

    // Check meters
    if (sample.meters < 0.25) {
      return false;
    }

    // Check ppm is reasonable (1-10000 px/m)
    if (sample.ppm <= 0 || sample.ppm > 10000) {
      return false;
    }

    // Verify calculation consistency
    const calculatedPpm = computePixelsPerMeter(sample.a, sample.b, sample.meters);
    const tolerance = 0.001;
    
    return Math.abs(calculatedPpm - sample.ppm) < tolerance;
  } catch {
    return false;
  }
}

/**
 * Validate full calibration
 */
export function validateCalibration(calibration: Calibration): boolean {
  try {
    // Check basic structure
    if (!calibration.samples || calibration.samples.length === 0) {
      return false;
    }

    // Check ppm
    if (calibration.ppm <= 0 || calibration.ppm > 10000) {
      return false;
    }

    // Validate all samples
    for (const sample of calibration.samples) {
      if (!validateCalSample(sample)) {
        return false;
      }
    }

    // Verify global ppm calculation
    const recomputed = computeGlobalCalibration(calibration.samples);
    const tolerance = 0.001;
    
    return Math.abs(recomputed.ppm - calibration.ppm) < tolerance;
  } catch {
    return false;
  }
}

/**
 * Check if two samples are likely on the same plane
 */
export function areSamplesCompatible(sample1: CalSample, sample2: CalSample): boolean {
  const ppmDiff = Math.abs(sample1.ppm - sample2.ppm);
  const avgPpm = (sample1.ppm + sample2.ppm) / 2;
  const percentDiff = (ppmDiff / avgPpm) * 100;
  
  // Consider compatible if within 10% of each other
  return percentDiff <= 10;
}

/**
 * Get distance between two points in pixels
 */
export function getPixelDistance(a: Vec2, b: Vec2): number {
  return Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
}

/**
 * Check if a point would create a valid reference line
 */
export function isValidReferenceDistance(a: Vec2, b: Vec2): boolean {
  return getPixelDistance(a, b) >= 10;
}

// Enhanced conversion functions for V2 calibration
export function pixelsToMetersV2(pixels: number, ppm: number): number {
  return pixels / ppm;
}

export function pixelsToSquareMetersV2(pixelsSquared: number, ppm: number): number {
  return pixelsSquared / (ppm * ppm);
}