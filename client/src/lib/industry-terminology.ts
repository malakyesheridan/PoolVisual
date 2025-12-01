/**
 * Industry-specific terminology mapping
 * Provides industry-appropriate labels for common terms like "jobs", "quotes", "projects", etc.
 */

export const INDUSTRY_TERMINOLOGY: Record<string, Record<string, string>> = {
  pool: {
    job: 'Job',
    jobs: 'Jobs',
    quote: 'Quote',
    quotes: 'Quotes',
    project: 'Project',
    projects: 'Projects',
    client: 'Client',
    clients: 'Clients',
    material: 'Material',
    materials: 'Materials',
    createJob: 'Create New Job',
    createQuote: 'Create Quote',
    uploadPhoto: 'Upload Photo',
    uploadPhotos: 'Upload Photos',
  },
  landscaping: {
    job: 'Project',
    jobs: 'Projects',
    quote: 'Quote',
    quotes: 'Quotes',
    project: 'Project',
    projects: 'Projects',
    client: 'Client',
    clients: 'Clients',
    material: 'Material',
    materials: 'Materials',
    createJob: 'Create New Project',
    createQuote: 'Create Quote',
    uploadPhoto: 'Upload Photo',
    uploadPhotos: 'Upload Photos',
  },
  building: {
    job: 'Project',
    jobs: 'Projects',
    quote: 'Estimate',
    quotes: 'Estimates',
    project: 'Project',
    projects: 'Projects',
    client: 'Client',
    clients: 'Clients',
    material: 'Material',
    materials: 'Materials',
    createJob: 'Create New Project',
    createQuote: 'Create Estimate',
    uploadPhoto: 'Upload Photo',
    uploadPhotos: 'Upload Photos',
  },
  electrical: {
    job: 'Job',
    jobs: 'Jobs',
    quote: 'Quote',
    quotes: 'Quotes',
    project: 'Project',
    projects: 'Projects',
    client: 'Client',
    clients: 'Clients',
    material: 'Component',
    materials: 'Components',
    createJob: 'Create New Job',
    createQuote: 'Create Quote',
    uploadPhoto: 'Upload Photo',
    uploadPhotos: 'Upload Photos',
  },
  plumbing: {
    job: 'Job',
    jobs: 'Jobs',
    quote: 'Quote',
    quotes: 'Quotes',
    project: 'Project',
    projects: 'Projects',
    client: 'Client',
    clients: 'Clients',
    material: 'Component',
    materials: 'Components',
    createJob: 'Create New Job',
    createQuote: 'Create Quote',
    uploadPhoto: 'Upload Photo',
    uploadPhotos: 'Upload Photos',
  },
  real_estate: {
    job: 'Property',
    jobs: 'Properties',
    quote: 'Proposal',
    quotes: 'Opportunities',
    project: 'Property',
    projects: 'Properties',
    client: 'Client',
    clients: 'Clients',
    material: 'Enhancement',
    materials: 'Enhancements',
    createJob: 'Create New Property',
    createQuote: 'Create Opportunity',
    uploadPhoto: 'Upload Photo',
    uploadPhotos: 'Upload Photos',
  },
};

/**
 * Get industry-specific terminology
 */
export function getIndustryTerm(industry: string | undefined | null, term: string): string {
  const normalizedIndustry = (industry || 'pool').toLowerCase();
  const mapping = INDUSTRY_TERMINOLOGY[normalizedIndustry] || INDUSTRY_TERMINOLOGY.pool;
  return mapping[term] || term;
}

/**
 * Get industry-specific question options
 */
export function getIndustryQuestionOptions(industry: string | undefined | null) {
  const normalizedIndustry = (industry || 'pool').toLowerCase();
  
  const roleOptions: Record<string, string[]> = {
    pool: ['Business Owner', 'Project Manager', 'Estimator', 'Designer', 'Other'],
    landscaping: ['Business Owner', 'Project Manager', 'Landscape Designer', 'Estimator', 'Other'],
    building: ['Business Owner', 'Project Manager', 'Estimator', 'Architect', 'Other'],
    electrical: ['Business Owner', 'Project Manager', 'Electrician', 'Estimator', 'Other'],
    plumbing: ['Business Owner', 'Project Manager', 'Plumber', 'Estimator', 'Other'],
    real_estate: ['Real Estate Agent', 'Property Manager', 'Photographer', 'Staging Professional', 'Other'],
  };

  const useCaseOptions: Record<string, string[]> = {
    pool: ['Creating Quotes', 'Design Visualization', 'Project Management', 'All of the above'],
    landscaping: ['Creating Quotes', 'Design Visualization', 'Project Management', 'All of the above'],
    building: ['Creating Estimates', 'Design Visualization', 'Project Management', 'All of the above'],
    electrical: ['Creating Quotes', 'Design Visualization', 'Project Management', 'All of the above'],
    plumbing: ['Creating Quotes', 'Design Visualization', 'Project Management', 'All of the above'],
    real_estate: ['Creating Proposals', 'Property Staging', 'Photo Enhancement', 'All of the above'],
  };

  return {
    roles: roleOptions[normalizedIndustry] || roleOptions.pool,
    useCases: useCaseOptions[normalizedIndustry] || useCaseOptions.pool,
  };
}

