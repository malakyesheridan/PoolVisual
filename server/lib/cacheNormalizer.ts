/**
 * Cache Normalizer - Deterministic hashing for cache keys
 */

import crypto from 'crypto';

interface CacheKeyInput {
  inputHash: string;
  masks: Array<{
    id: string;
    points: Array<{ x: number; y: number }>;
    materialId?: string;
    regionType?: string;
  }>;
  calibration?: number;
  options: Record<string, any>;
  provider: string;
  model: string;
}

function normalizeMasks(masks: CacheKeyInput['masks']): string {
  const normalized = masks
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(mask => ({
      id: mask.id,
      points: mask.points
        .map(p => ({
          x: Math.round(p.x * 100) / 100,
          y: Math.round(p.y * 100) / 100
        }))
        .sort((a, b) => a.x - b.x || a.y - b.y),
      materialId: mask.materialId || null,
      regionType: mask.regionType || null
    }));
  
  return JSON.stringify(normalized);
}

function normalizeOptions(options: Record<string, any>): string {
  const normalized = {
    style: options.style || 'realistic',
    relight: options.relight || null,
    preserveWaterCaustics: options.preserveWaterCaustics ?? true,
    preserveEdges: options.preserveEdges || [],
    ...(options.feather ? { feather: Math.round(options.feather) } : {})
  };
  
  return JSON.stringify(normalized, Object.keys(normalized).sort());
}

/**
 * Generate normalized cache key
 */
export function generateCacheKey(input: CacheKeyInput): string {
  const components = [
    input.inputHash,
    normalizeMasks(input.masks),
    input.calibration?.toString() || '0',
    normalizeOptions(input.options),
    input.provider,
    input.model
  ];
  
  const keyString = components.join('|');
  
  return crypto.createHash('sha256').update(keyString).digest('hex');
}

