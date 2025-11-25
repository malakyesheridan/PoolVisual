/**
 * Shared hook for fetching organizations
 * Optimized with proper staleTime to avoid redundant requests
 */
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export function useOrgs() {
  return useQuery({
    queryKey: ['/api/me/orgs'],
    queryFn: () => apiClient.getMyOrgs(),
    staleTime: 5 * 60 * 1000, // 5 minutes - orgs rarely change
  });
}

