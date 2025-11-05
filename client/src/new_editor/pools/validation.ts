/**
 * Pool Validation
 * Validates mask geometry for pool creation
 */

import { Mask } from '../../maskcore/store';
import { calculatePolygonArea } from '../utils';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validate interior mask for pool creation
 * Checks: minimum 3 points, minimum area
 */
export function validateInteriorMask(mask: Mask): ValidationResult {
  const errors: string[] = [];

  if (!mask.pts || mask.pts.length < 3) {
    errors.push('Pool interior must have at least 3 points');
    return { isValid: false, errors };
  }

  // Check if area is too small
  const area = calculatePolygonArea(mask.pts);
  if (area < 100) {
    errors.push('Pool interior is too small (minimum 100 square pixels)');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

