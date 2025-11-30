/**
 * Feature Flag Hooks
 * 
 * CORRECTED: Memoized to prevent unnecessary recalculations
 */

import { useMemo } from 'react';
import { useOnboarding } from './useOnboarding';
import { isFeatureEnabled, FEATURE_FLAGS, getEnabledFeatures } from '@/lib/featureFlags';
import { FeatureFlag } from '@/types/onboarding';

/**
 * CORRECTED: Hook to check if a feature is enabled for the current user
 * Performance: Memoized to prevent unnecessary recalculations
 * 
 * @example
 * ```tsx
 * const { isEnabled, flag } = useFeatureFlag('aiEnhancement');
 * 
 * {isEnabled && <AIEnhancementButton />}
 * ```
 */
export function useFeatureFlag(featureId: string) {
  const { industry, role, useCase, experience } = useOnboarding();
  
  // CORRECTED: Memoize with all dependencies to prevent unnecessary recalculations
  const isEnabled = useMemo(() => {
    return isFeatureEnabled(featureId, {
      industry,
      role,
      useCase,
      experience,
    });
  }, [featureId, industry, role, useCase, experience]);
  
  const flag: FeatureFlag | undefined = FEATURE_FLAGS[featureId];
  
  return {
    isEnabled,
    flag,
  };
}

/**
 * Hook to get all enabled features for the current user
 * 
 * @example
 * ```tsx
 * const enabledFeatures = useEnabledFeatures();
 * console.log('User has access to:', enabledFeatures);
 * ```
 */
export function useEnabledFeatures() {
  const { industry, role, useCase, experience } = useOnboarding();
  
  // CORRECTED: Memoize to prevent unnecessary recalculations
  return useMemo(() => {
    return getEnabledFeatures({
      industry,
      role,
      useCase,
      experience,
    });
  }, [industry, role, useCase, experience]);
}

/**
 * Hook to check multiple features at once
 * 
 * @example
 * ```tsx
 * const { aiEnhancement, bulkOperations } = useFeatureFlags(['aiEnhancement', 'bulkOperations']);
 * ```
 */
export function useFeatureFlags(featureIds: string[]) {
  const { industry, role, useCase, experience } = useOnboarding();
  
  // CORRECTED: Memoize with stable array reference
  const featureIdsKey = featureIds.join(',');
  return useMemo(() => {
    const userData = { industry, role, useCase, experience };
    return featureIds.reduce((acc, id) => {
      acc[id] = isFeatureEnabled(id, userData);
      return acc;
    }, {} as Record<string, boolean>);
  }, [featureIdsKey, industry, role, useCase, experience]); // CORRECTED: Use join for stable comparison
}

