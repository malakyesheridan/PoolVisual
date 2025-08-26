/**
 * Calibration utilities for converting between pixel and real-world measurements
 */

import { Vec2, CalibrationData } from '@shared/schema';
import { distance } from './geometry';

/**
 * Compute pixels per meter from two calibration points and known real-world distance
 */
export function computePixelsPerMeter(a: Vec2, b: Vec2, meters: number): number {
  if (meters <= 0) {
    throw new Error('Reference length must be greater than 0');
  }
  
  const distancePx = distance(a, b);
  
  if (distancePx < 5) {
    throw new Error('Calibration points must be at least 5 pixels apart');
  }
  
  return distancePx / meters;
}

/**
 * Create calibration data from two points and reference length
 */
export function createCalibration(a: Vec2, b: Vec2, lengthMeters: number): CalibrationData {
  const pixelsPerMeter = computePixelsPerMeter(a, b, lengthMeters);
  
  return {
    pixelsPerMeter,
    a,
    b,
    lengthMeters
  };
}

/**
 * Validate calibration data
 */
export function validateCalibration(calibration: CalibrationData): boolean {
  try {
    const { a, b, lengthMeters, pixelsPerMeter } = calibration;
    
    // Check if points are valid
    if (!a || !b || typeof a.x !== 'number' || typeof a.y !== 'number' ||
        typeof b.x !== 'number' || typeof b.y !== 'number') {
      return false;
    }
    
    // Check if length is positive
    if (lengthMeters <= 0) {
      return false;
    }
    
    // Check if pixels per meter is reasonable (between 1 and 10000 pixels per meter)
    if (pixelsPerMeter <= 0 || pixelsPerMeter > 10000) {
      return false;
    }
    
    // Verify calculation is consistent
    const calculatedPPM = computePixelsPerMeter(a, b, lengthMeters);
    const tolerance = 0.001;
    
    return Math.abs(calculatedPPM - pixelsPerMeter) < tolerance;
  } catch {
    return false;
  }
}

/**
 * Convert pixel length to meters
 */
export function pixelsToMeters(pixels: number, calibration: CalibrationData): number {
  if (!validateCalibration(calibration)) {
    throw new Error('Invalid calibration data');
  }
  
  return pixels / calibration.pixelsPerMeter;
}

/**
 * Convert pixel area to square meters
 */
export function pixelsToSquareMeters(pixelArea: number, calibration: CalibrationData): number {
  if (!validateCalibration(calibration)) {
    throw new Error('Invalid calibration data');
  }
  
  return pixelArea / (calibration.pixelsPerMeter * calibration.pixelsPerMeter);
}

/**
 * Convert meters to pixels
 */
export function metersToPixels(meters: number, calibration: CalibrationData): number {
  if (!validateCalibration(calibration)) {
    throw new Error('Invalid calibration data');
  }
  
  return meters * calibration.pixelsPerMeter;
}

/**
 * Convert square meters to pixel area
 */
export function squareMetersToPixels(squareMeters: number, calibration: CalibrationData): number {
  if (!validateCalibration(calibration)) {
    throw new Error('Invalid calibration data');
  }
  
  return squareMeters * (calibration.pixelsPerMeter * calibration.pixelsPerMeter);
}

/**
 * Get calibration info for display
 */
export function getCalibrationInfo(calibration: CalibrationData): {
  lengthPixels: number;
  lengthMeters: number;
  pixelsPerMeter: number;
  scale: string;
} {
  const lengthPixels = distance(calibration.a, calibration.b);
  
  return {
    lengthPixels: Math.round(lengthPixels),
    lengthMeters: calibration.lengthMeters,
    pixelsPerMeter: Math.round(calibration.pixelsPerMeter * 100) / 100,
    scale: `1:${Math.round(calibration.pixelsPerMeter * 100)}`
  };
}