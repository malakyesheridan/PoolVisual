/**
 * Hook to check if the current user is in the real estate industry
 * Used for conditional rendering of real estate-specific features
 */

import { useAuthStore } from '@/stores/auth-store';
import { useOnboarding } from '@/hooks/useOnboarding';

export function useIsRealEstate(): boolean {
  const { user } = useAuthStore();
  const { industry } = useOnboarding();
  const effectiveIndustry = user?.industryType || industry;
  return effectiveIndustry === 'real_estate';
}

