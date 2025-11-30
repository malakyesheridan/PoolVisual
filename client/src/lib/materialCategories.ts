/**
 * Material Category Utilities
 * Provides runtime mapping of enum values to industry-specific labels
 * This allows the same enum values to have different display labels per industry
 * while maintaining backward compatibility with existing material_category enum
 */

// Runtime mapping of enum values to industry-specific labels
export const MATERIAL_CATEGORY_MAPPING: Record<string, Record<string, string>> = {
  pool: {
    'coping': 'Coping',
    'waterline_tile': 'Waterline Tile',
    'interior': 'Interior Finish',
    'paving': 'Paving',
    'fencing': 'Fencing',
  },
  landscaping: {
    'paving': 'Paving',
    'fencing': 'Fencing',
    'interior': 'Turf & Plants',
    'coping': 'Edging',
    'waterline_tile': 'Lighting',
  },
  building: {
    'paving': 'Flooring',
    'interior': 'Tiles',
    'coping': 'Countertops',
    'waterline_tile': 'Paint',
    'fencing': 'Cabinetry',
  },
  electrical: {
    'paving': 'Wiring',
    'interior': 'Fixtures',
    'coping': 'Outlets',
    'waterline_tile': 'Lighting',
    'fencing': 'Panels',
  },
  plumbing: {
    'paving': 'Piping',
    'interior': 'Fixtures',
    'coping': 'Fittings',
    'waterline_tile': 'Valves',
    'fencing': 'Accessories',
  },
  real_estate: {
    'interior': 'Staging',
    'paving': 'Declutter',
    'coping': 'Lighting',
    'waterline_tile': 'Sky Replacement',
    'fencing': 'Enhancements',
  },
};

// Type-safe category keys (from enum)
export type MaterialCategory = 'coping' | 'waterline_tile' | 'interior' | 'paving' | 'fencing';

/**
 * Get display label for category based on industry
 */
export function getCategoryLabel(
  category: MaterialCategory,
  industry: string = 'pool'
): string {
  const mapping = MATERIAL_CATEGORY_MAPPING[industry] || MATERIAL_CATEGORY_MAPPING.pool;
  return mapping?.[category] || category;
}

/**
 * Get valid categories for industry
 */
export function getCategoriesForIndustry(industry: string): MaterialCategory[] {
  const mapping = MATERIAL_CATEGORY_MAPPING[industry] || MATERIAL_CATEGORY_MAPPING.pool;
  if (!mapping) return [];
  return Object.keys(mapping) as MaterialCategory[];
}

/**
 * Get default categories for industry (fallback when API is unavailable)
 */
export function getDefaultCategoriesForIndustry(industry: string): Array<{ categoryKey: string; categoryLabel: string; displayOrder: number }> {
  const mapping = MATERIAL_CATEGORY_MAPPING[industry] || MATERIAL_CATEGORY_MAPPING.pool;
  if (!mapping) return [];
  return Object.entries(mapping).map(([key, label], index) => ({
    categoryKey: key,
    categoryLabel: label,
    displayOrder: index + 1,
  }));
}

/**
 * Filter materials by industry (runtime, not type-level)
 */
export function filterMaterialsByIndustry<T extends { category: string }>(
  materials: T[],
  industry: string
): T[] {
  const validCategories = getCategoriesForIndustry(industry);
  if (validCategories.length === 0) return [];
  return materials.filter(m => validCategories.includes(m.category as MaterialCategory));
}

