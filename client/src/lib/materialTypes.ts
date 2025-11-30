/**
 * Material Type Helpers
 * Keep existing Material types but add industry-aware helpers
 */

import type { Material } from '@shared/schema';
import { getCategoryLabel, getCategoriesForIndustry, filterMaterialsByIndustry } from './materialCategories';

// Re-export Material type from schema
export type { Material } from '@shared/schema';

// Type-safe category keys (from enum)
export type MaterialCategory = 'coping' | 'waterline_tile' | 'interior' | 'paving' | 'fencing';

/**
 * Get display label for category based on industry
 */
export function getMaterialCategoryLabel(
  category: MaterialCategory,
  industry: string = 'pool'
): string {
  return getCategoryLabel(category, industry);
}

/**
 * Filter materials by industry (runtime, not type-level)
 */
export function filterMaterialsByIndustryType(
  materials: Material[],
  industry: string
): Material[] {
  return filterMaterialsByIndustry(materials, industry);
}

/**
 * Get valid categories for industry
 */
export function getValidCategoriesForIndustry(industry: string): MaterialCategory[] {
  return getCategoriesForIndustry(industry);
}

