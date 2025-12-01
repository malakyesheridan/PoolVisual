/**
 * Feature Access Utility
 * Client-side feature access checking based on subscription tier
 */

import { useAuthStore } from '../stores/auth-store';

export type Feature = 
  | 'brushTool'
  | 'maskedPrompts'
  | 'presetLibrary'
  | 'beforeAfterExport'
  | 'whiteLabel'
  | 'priorityQueue';

/**
 * Check if user has access to a feature based on subscription tier
 */
export function checkFeatureAccess(feature: Feature): boolean {
  const user = useAuthStore.getState().user;
  if (!user) return false;

  const tier = user.subscriptionTier || 't1';

  // Feature mapping by tier
  const featureMap: Record<string, Feature[]> = {
    't1': [], // Solo - no premium features
    't2': ['brushTool', 'maskedPrompts', 'presetLibrary', 'beforeAfterExport'], // Pro
    't3': ['brushTool', 'maskedPrompts', 'presetLibrary', 'beforeAfterExport', 'whiteLabel', 'priorityQueue'], // Business - all features
  };

  const allowedFeatures = featureMap[tier] || [];
  return allowedFeatures.includes(feature);
}

/**
 * Get all feature access for current user
 */
export function getFeatureAccess(): Record<Feature, boolean> {
  const user = useAuthStore.getState().user;
  if (!user) {
    return {
      brushTool: false,
      maskedPrompts: false,
      presetLibrary: false,
      beforeAfterExport: false,
      whiteLabel: false,
      priorityQueue: false,
    };
  }

  const tier = user.subscriptionTier || 't1';

  const accessByTier: Record<string, Record<Feature, boolean>> = {
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

/**
 * Get upgrade message for a locked feature
 */
export function getUpgradeMessage(feature: Feature): string {
  const messages: Record<Feature, string> = {
    brushTool: 'Upgrade to Pro or Business to unlock the brush tool',
    maskedPrompts: 'Upgrade to Pro or Business to use masked prompts',
    presetLibrary: 'Upgrade to Pro or Business to access the preset library',
    beforeAfterExport: 'Upgrade to Pro or Business to export before/after comparisons',
    whiteLabel: 'Upgrade to Business to enable white-label branding',
    priorityQueue: 'Upgrade to Business for priority processing',
  };

  return messages[feature] || 'Upgrade your plan to access this feature';
}
