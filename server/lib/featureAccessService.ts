/**
 * Feature Access Service
 * Manages plan-based feature gating
 */

import { User } from '../../shared/schema.js';
import { logger } from './logger.js';

export interface FeatureAccess {
  brushTool: boolean;
  maskedPrompts: boolean;
  presetLibrary: boolean;
  beforeAfterExport: boolean;
  whiteLabel: boolean;
  priorityQueue: boolean;
}

/**
 * Check if user has access to a specific feature
 */
export function checkFeatureAccess(user: User, feature: string): boolean {
  const tier = user.subscriptionTier || 't1';
  
  // Feature mapping by tier
  const featureMap: Record<string, string[]> = {
    't1': [], // Solo - no premium features
    't2': ['brushTool', 'maskedPrompts', 'presetLibrary', 'beforeAfterExport'], // Pro
    't3': ['brushTool', 'maskedPrompts', 'presetLibrary', 'beforeAfterExport', 'whiteLabel', 'priorityQueue'], // Business - all features
  };

  const allowedFeatures = featureMap[tier] || [];
  return allowedFeatures.includes(feature);
}

/**
 * Get all feature access for a user
 */
export function getFeatureAccess(user: User): FeatureAccess {
  const tier = user.subscriptionTier || 't1';

  // Feature access by tier
  const accessByTier: Record<string, FeatureAccess> = {
    't1': {
      brushTool: false,
      maskedPrompts: false,
      presetLibrary: false,
      beforeAfterExport: false,
      whiteLabel: false,
      priorityQueue: false,
    },
    't2': {
      brushTool: true,
      maskedPrompts: true,
      presetLibrary: true,
      beforeAfterExport: true,
      whiteLabel: false,
      priorityQueue: false,
    },
    't3': {
      brushTool: true,
      maskedPrompts: true,
      presetLibrary: true,
      beforeAfterExport: true,
      whiteLabel: true,
      priorityQueue: true,
    },
  };

  return accessByTier[tier] || accessByTier['t1'];
}
