/**
 * Feature Flags System
 * 
 * CORRECTED: Proper evaluation logic with memoization support
 */

import { 
  FeatureFlag, 
  Industry, 
  UserRole, 
  UseCase, 
  ExperienceLevel 
} from '@/types/onboarding';

/**
 * CORRECTED: Experience level hierarchy for comparison
 */
const EXPERIENCE_LEVELS: Record<ExperienceLevel, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
};

/**
 * All feature flags in the system
 * 
 * Pattern: Feature flags are defined here and evaluated at runtime
 * based on user onboarding data.
 */
export const FEATURE_FLAGS: Record<string, FeatureFlag> = {
  // Material & Design Features
  advancedMaterials: {
    id: 'advancedMaterials',
    name: 'Advanced Materials',
    description: 'Access to advanced material editing and customization',
    conditions: {
      minExperience: 'intermediate',
    },
    enabled: true,
    metadata: {
      category: 'materials',
      priority: 1,
      tags: ['materials', 'advanced'],
    },
  },
  
  bulkMaterialOperations: {
    id: 'bulkMaterialOperations',
    name: 'Bulk Material Operations',
    description: 'Bulk import, export, and update materials',
    conditions: {
      roles: ['owner', 'manager'],
      minExperience: 'intermediate',
    },
    enabled: true,
    metadata: {
      category: 'materials',
      priority: 2,
      tags: ['materials', 'bulk', 'admin'],
    },
  },
  
  // AI & Enhancement Features
  aiEnhancement: {
    id: 'aiEnhancement',
    name: 'AI Photo Enhancement',
    description: 'AI-powered photo enhancement and sky replacement',
    conditions: {
      industries: ['real_estate', 'pool'],
      minExperience: 'beginner',
    },
    enabled: true,
    metadata: {
      category: 'ai',
      priority: 1,
      tags: ['ai', 'enhancement', 'photos'],
    },
  },
  
  // Project Management Features
  projectTemplates: {
    id: 'projectTemplates',
    name: 'Project Templates',
    description: 'Save and reuse project templates',
    conditions: {
      useCases: ['project_management', 'all'],
      minExperience: 'intermediate',
    },
    enabled: true,
    metadata: {
      category: 'projects',
      priority: 2,
      tags: ['templates', 'projects'],
    },
  },
  
  advancedProjectAnalytics: {
    id: 'advancedProjectAnalytics',
    name: 'Advanced Project Analytics',
    description: 'Detailed project analytics and reporting',
    conditions: {
      roles: ['owner', 'manager'],
      minExperience: 'intermediate',
    },
    enabled: true,
    metadata: {
      category: 'analytics',
      priority: 3,
      tags: ['analytics', 'reports', 'admin'],
    },
  },
  
  // Quote Features
  quoteTemplates: {
    id: 'quoteTemplates',
    name: 'Quote Templates',
    description: 'Save and reuse quote templates',
    conditions: {
      useCases: ['quotes', 'all'],
      minExperience: 'beginner',
    },
    enabled: true,
    metadata: {
      category: 'quotes',
      priority: 1,
      tags: ['quotes', 'templates'],
    },
  },
  
  bulkQuoteOperations: {
    id: 'bulkQuoteOperations',
    name: 'Bulk Quote Operations',
    description: 'Bulk quote generation and management',
    conditions: {
      roles: ['owner', 'manager', 'estimator'],
      minExperience: 'intermediate',
    },
    enabled: true,
    metadata: {
      category: 'quotes',
      priority: 2,
      tags: ['quotes', 'bulk', 'admin'],
    },
  },
  
  // Design Features
  advancedDesignTools: {
    id: 'advancedDesignTools',
    name: 'Advanced Design Tools',
    description: 'Advanced design and visualization tools',
    conditions: {
      useCases: ['design', 'all'],
      minExperience: 'intermediate',
    },
    enabled: true,
    metadata: {
      category: 'design',
      priority: 1,
      tags: ['design', 'tools'],
    },
  },
  
  // Collaboration Features
  teamCollaboration: {
    id: 'teamCollaboration',
    name: 'Team Collaboration',
    description: 'Team collaboration and sharing features',
    conditions: {
      roles: ['owner', 'manager'],
      minExperience: 'beginner',
    },
    enabled: true,
    metadata: {
      category: 'collaboration',
      priority: 1,
      tags: ['team', 'collaboration'],
    },
  },
  
  // Admin Features
  adminPanel: {
    id: 'adminPanel',
    name: 'Admin Panel',
    description: 'Access to admin panel and system settings',
    conditions: {
      roles: ['owner'],
      minExperience: 'intermediate',
    },
    enabled: true,
    metadata: {
      category: 'admin',
      priority: 1,
      tags: ['admin', 'settings'],
    },
  },
  
  // Beginner-Friendly Features (shown to beginners)
  guidedTours: {
    id: 'guidedTours',
    name: 'Guided Tours',
    description: 'Interactive guided tours and tutorials',
    conditions: {
      maxExperience: 'beginner',
    },
    enabled: true,
    metadata: {
      category: 'help',
      priority: 1,
      tags: ['help', 'tutorials', 'beginner'],
    },
  },
  
  contextualHelp: {
    id: 'contextualHelp',
    name: 'Contextual Help',
    description: 'Contextual tooltips and help text',
    conditions: {
      maxExperience: 'intermediate',
    },
    enabled: true,
    metadata: {
      category: 'help',
      priority: 1,
      tags: ['help', 'tooltips'],
    },
  },
};

/**
 * CORRECTED: Evaluate if a feature flag should be enabled for a user
 * Performance: Memoized in hook to prevent unnecessary recalculations
 */
export function evaluateFeatureFlag(
  flag: FeatureFlag,
  userData: {
    industry: Industry;
    role: UserRole;
    useCase: UseCase;
    experience: ExperienceLevel;
  }
): boolean {
  // Global disable
  if (!flag.enabled) {
    return false;
  }
  
  const { conditions } = flag;
  
  // Industry check
  if (conditions.industries && !conditions.industries.includes(userData.industry)) {
    return false;
  }
  
  if (conditions.excludeIndustries && conditions.excludeIndustries.includes(userData.industry)) {
    return false;
  }
  
  // Role check
  if (conditions.roles && !conditions.roles.includes(userData.role)) {
    return false;
  }
  
  if (conditions.excludeRoles && conditions.excludeRoles.includes(userData.role)) {
    return false;
  }
  
  // Use case check
  if (conditions.useCases && !conditions.useCases.includes(userData.useCase) && userData.useCase !== 'all') {
    return false;
  }
  
  // Experience level check
  if (conditions.minExperience) {
    const userLevel = EXPERIENCE_LEVELS[userData.experience];
    const minLevel = EXPERIENCE_LEVELS[conditions.minExperience];
    if (userLevel < minLevel) {
      return false;
    }
  }
  
  if (conditions.maxExperience) {
    const userLevel = EXPERIENCE_LEVELS[userData.experience];
    const maxLevel = EXPERIENCE_LEVELS[conditions.maxExperience];
    if (userLevel > maxLevel) {
      return false;
    }
  }
  
  return true;
}

/**
 * Get all enabled feature flags for a user
 */
export function getEnabledFeatures(userData: {
  industry: Industry;
  role: UserRole;
  useCase: UseCase;
  experience: ExperienceLevel;
}): string[] {
  return Object.values(FEATURE_FLAGS)
    .filter(flag => evaluateFeatureFlag(flag, userData))
    .map(flag => flag.id);
}

/**
 * Check if a specific feature is enabled
 */
export function isFeatureEnabled(
  featureId: string,
  userData: {
    industry: Industry;
    role: UserRole;
    useCase: UseCase;
    experience: ExperienceLevel;
  }
): boolean {
  const flag = FEATURE_FLAGS[featureId];
  if (!flag) {
    console.warn(`[FeatureFlags] Unknown feature: ${featureId}`);
    return false;
  }
  
  return evaluateFeatureFlag(flag, userData);
}

