/**
 * Route Utilities
 * 
 * Helper functions for getting industry-specific routes
 */

import { useIsRealEstate } from '@/hooks/useIsRealEstate';

/**
 * Get the base route for jobs/properties based on industry
 * Real estate: /properties
 * Trades: /jobs
 */
export function getJobsRoute(): string {
  // This is a hook, so we can't use it here directly
  // Instead, we'll create a hook version
  return '/jobs'; // Default fallback
}

/**
 * Hook to get the base route for jobs/properties
 */
export function useJobsRoute(): string {
  const isRealEstate = useIsRealEstate();
  return isRealEstate ? '/properties' : '/jobs';
}

/**
 * Get the detail route for a specific job/property
 */
export function useJobDetailRoute(jobId: string): string {
  const baseRoute = useJobsRoute();
  return `${baseRoute}/${jobId}`;
}

/**
 * Get the new job/property route
 */
export function useNewJobRoute(): string {
  const baseRoute = useJobsRoute();
  return `${baseRoute}/new`;
}

