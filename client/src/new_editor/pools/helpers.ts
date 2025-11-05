/**
 * Pool Creation Helpers
 * Utilities for working with existing mask system
 */

import { useEditorStore } from '../store';

export interface CalibrationInfo {
  pixelsPerMeter: number;
  isValid: boolean;
}

/**
 * Get calibration data from editor store
 */
export function getCalibrationInfo(): CalibrationInfo {
  const state = useEditorStore.getState();
  const { calibration } = state;

  if (!calibration?.isCalibrated || !calibration.pixelsPerMeter || calibration.pixelsPerMeter <= 0) {
    return {
      pixelsPerMeter: 100, // Fallback: 100 px/m
      isValid: false
    };
  }

  return {
    pixelsPerMeter: calibration.pixelsPerMeter,
    isValid: true
  };
}

/**
 * Convert millimeters to pixels using calibration
 * @param mm - Value in millimeters
 * @param calibration - Optional calibration info (falls back to getCalibrationInfo)
 * @returns Value in pixels
 */
export function mmToPx(mm: number, calibration?: CalibrationInfo): number {
  const cal = calibration || getCalibrationInfo();
  // Convert: mm → meters → pixels
  return (mm / 1000) * cal.pixelsPerMeter;
}

/**
 * Validate pool section width against industry standards
 * @param sectionType - Type of section
 * @param widthMm - Width in millimeters
 * @returns Validation result with error message if invalid
 */
export function validateSectionWidth(
  sectionType: 'waterline' | 'coping' | 'paving',
  widthMm: number
): { isValid: boolean; error?: string } {
  const limits: Record<string, { min: number; max: number }> = {
    waterline: { min: 50, max: 300 },
    coping: { min: 100, max: 400 },
    paving: { min: 300, max: 2000 }
  };

  const limit = limits[sectionType];
  if (!limit) {
    return { isValid: false, error: 'Unknown section type' };
  }

  if (widthMm < limit.min || widthMm > limit.max) {
    return {
      isValid: false,
      error: `${sectionType} width must be between ${limit.min}-${limit.max}mm (current: ${widthMm}mm)`
    };
  }

  return { isValid: true };
}

