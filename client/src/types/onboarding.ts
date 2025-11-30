/**
 * Onboarding Type Definitions
 * 
 * CORRECTED: Matches API contract - API always returns object, never null
 */

export type OnboardingStep = 
  | 'welcome' 
  | 'industry_selection' 
  | 'questionnaire' 
  | 'preview' 
  | 'upload' 
  | 'material_demo' 
  | 'workspace_setup' 
  | 'completed';

export type Industry = 
  | 'pool' 
  | 'landscaping' 
  | 'building' 
  | 'electrical' 
  | 'plumbing' 
  | 'real_estate' 
  | 'other';

export type UserRole = 
  | 'owner' 
  | 'manager' 
  | 'estimator' 
  | 'designer' 
  | 'other';

export type UseCase = 
  | 'quotes' 
  | 'design' 
  | 'project_management' 
  | 'all';

export type ExperienceLevel = 
  | 'beginner' 
  | 'intermediate' 
  | 'advanced';

export interface OnboardingResponses {
  industry?: Industry;
  role?: UserRole;
  useCase?: UseCase;
  experience?: ExperienceLevel;
}

/**
 * CORRECTED: Matches API contract - API always returns object, never null
 * Dates can be Date objects or ISO strings (handled in normalization)
 */
export interface OnboardingData {
  userId: string;
  step: OnboardingStep;
  completed: boolean;
  responses: OnboardingResponses;
  firstJobId: string | null;
  firstPhotoId: string | null;
  completedAt: Date | string | null; // Can be Date or ISO string
  createdAt: Date | string; // Can be Date or ISO string
  updatedAt: Date | string; // Can be Date or ISO string
}

/**
 * Normalized onboarding data for client-side use
 * CORRECTED: All dates are Date objects after normalization
 */
export interface NormalizedOnboardingData {
  industry: Industry;
  role: UserRole;
  useCase: UseCase;
  experience: ExperienceLevel;
  completed: boolean;
  isNewUser: boolean; // Completed within last 7 days
}

export interface FeatureFlagConditions {
  industries?: Industry[];
  roles?: UserRole[];
  useCases?: UseCase[];
  minExperience?: ExperienceLevel;
  maxExperience?: ExperienceLevel;
  excludeIndustries?: Industry[];
  excludeRoles?: UserRole[];
}

export interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  conditions: FeatureFlagConditions;
  enabled: boolean;
  metadata?: {
    category?: string;
    priority?: number;
    tags?: string[];
  };
}

