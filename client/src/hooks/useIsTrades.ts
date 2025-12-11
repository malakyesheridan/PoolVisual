/**
 * Hook to check if the current user is in the trades industry
 * Used for conditional rendering of trades-specific features
 */

import { useAuthStore } from '@/stores/auth-store';
import { useOnboarding } from '@/hooks/useOnboarding';

export function useIsTrades(): boolean {
  const { user } = useAuthStore();
  const { industry } = useOnboarding();
  const effectiveIndustry = user?.industryType || industry;
  // Trades includes: pool, landscaping, building, electrical, plumbing, other
  // Real estate is: real_estate
  return effectiveIndustry !== 'real_estate';
}

