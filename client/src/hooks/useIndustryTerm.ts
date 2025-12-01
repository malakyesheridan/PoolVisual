/**
 * useIndustryTerm Hook
 * 
 * Convenience hook for getting industry-specific terminology
 * Checks both user.industryType and onboarding data
 */

import { useOnboarding } from './useOnboarding';
import { useAuthStore } from '@/stores/auth-store';
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
  const { user } = useAuthStore();
  const { industry: onboardingIndustry } = useOnboarding();
  
  // Use user.industryType first, fallback to onboarding industry
  const industry = user?.industryType || onboardingIndustry;
  
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

