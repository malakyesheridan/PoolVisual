/**
 * useIndustryTerm Hook
 * 
 * Convenience hook for getting industry-specific terminology
 * CORRECTED: Uses onboarding data as single source of truth
 */

import { useOnboarding } from './useOnboarding';
import { getIndustryTerm } from '@/lib/industry-terminology';

/**
 * Hook to get industry-specific terminology
 * 
 * @example
 * ```tsx
 * const { job, quote, project } = useIndustryTerm();
 * 
 * <Button>Create {job}</Button>
 * ```
 */
export function useIndustryTerm() {
  const { industry } = useOnboarding();
  
  return {
    job: getIndustryTerm(industry, 'job'),
    jobs: getIndustryTerm(industry, 'jobs'),
    quote: getIndustryTerm(industry, 'quote'),
    quotes: getIndustryTerm(industry, 'quotes'),
    project: getIndustryTerm(industry, 'project'),
    projects: getIndustryTerm(industry, 'projects'),
    client: getIndustryTerm(industry, 'client'),
    clients: getIndustryTerm(industry, 'clients'),
    material: getIndustryTerm(industry, 'material'),
    materials: getIndustryTerm(industry, 'materials'),
    createJob: getIndustryTerm(industry, 'createJob'),
    createQuote: getIndustryTerm(industry, 'createQuote'),
    uploadPhoto: getIndustryTerm(industry, 'uploadPhoto'),
    uploadPhotos: getIndustryTerm(industry, 'uploadPhotos'),
    // Helper for getting any term
    get: (term: string) => getIndustryTerm(industry, term),
  };
}

