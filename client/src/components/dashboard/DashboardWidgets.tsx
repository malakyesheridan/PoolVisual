/**
 * Dashboard Widget System
 * 
 * Defines all available dashboard widgets with their conditions
 */

import React from 'react';
import { Industry, UserRole, UseCase, ExperienceLevel } from '@/types/onboarding';

// Import existing dashboard components as widgets
import { MetricCards } from './MetricCards';
import { QuickInsights } from './QuickInsights';
import { RecentWork } from './RecentWork';
import { ProjectPipeline } from './ProjectPipeline';
import { RevenueIntelligence } from './RevenueIntelligence';
import { PerformanceAnalytics } from './PerformanceAnalytics';
import { SmartInsights } from './SmartInsights';
import { ActionCenter } from './ActionCenter';
import { ActivityFeed } from './ActivityFeed';
import { WorkflowSuggestions } from './WorkflowSuggestions';
import { DeadlineAlerts } from './DeadlineAlerts';
import { CollaborationNotifications } from './CollaborationNotifications';

export interface DashboardWidget {
  id: string;
  component: React.ComponentType<any>;
  priority: number; // Lower = higher priority
  conditions?: {
    industries?: Industry[];
    roles?: UserRole[];
    useCases?: UseCase[];
    minExperience?: ExperienceLevel;
    maxExperience?: ExperienceLevel;
    features?: string[]; // Required feature flags
  };
  defaultVisible?: boolean;
  config?: Record<string, any>;
}

/**
 * CORRECTED: Experience level hierarchy (same as feature flags)
 */
const EXPERIENCE_LEVELS: Record<ExperienceLevel, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
};

/**
 * All available dashboard widgets
 * CORRECTED: Using real components, not placeholders
 */
export const DASHBOARD_WIDGETS: DashboardWidget[] = [
  // Quote-focused widgets
  {
    id: 'recentQuotes',
    component: RecentWork,
    priority: 1,
    conditions: {
      useCases: ['quotes', 'all'],
    },
    defaultVisible: true,
    config: { type: 'quotes' },
  },
  {
    id: 'quoteMetrics',
    component: MetricCards,
    priority: 2,
    conditions: {
      useCases: ['quotes', 'all'],
      roles: ['owner', 'manager', 'estimator'],
    },
    defaultVisible: true,
  },
  
  // Design-focused widgets
  {
    id: 'materialLibrary',
    component: QuickInsights,
    priority: 1,
    conditions: {
      useCases: ['design', 'all'],
    },
    defaultVisible: true,
  },
  {
    id: 'recentDesigns',
    component: RecentWork,
    priority: 2,
    conditions: {
      useCases: ['design', 'all'],
    },
    defaultVisible: true,
    config: { type: 'designs' },
  },
  
  // Project management widgets
  {
    id: 'activeProjects',
    component: ProjectPipeline,
    priority: 1,
    conditions: {
      useCases: ['project_management', 'all'],
    },
    defaultVisible: true,
  },
  {
    id: 'projectMetrics',
    component: MetricCards,
    priority: 2,
    conditions: {
      useCases: ['project_management', 'all'],
    },
    defaultVisible: true,
  },
  {
    id: 'workflowSuggestions',
    component: WorkflowSuggestions,
    priority: 3,
    conditions: {
      useCases: ['project_management', 'all'],
    },
    defaultVisible: false,
  },
  
  // Role-specific widgets
  {
    id: 'businessMetrics',
    component: RevenueIntelligence,
    priority: 1,
    conditions: {
      roles: ['owner'],
    },
    defaultVisible: true,
  },
  {
    id: 'revenueIntelligence',
    component: RevenueIntelligence,
    priority: 2,
    conditions: {
      roles: ['owner', 'manager'],
      minExperience: 'intermediate',
    },
    defaultVisible: true,
  },
  {
    id: 'performanceAnalytics',
    component: PerformanceAnalytics,
    priority: 3,
    conditions: {
      roles: ['owner', 'manager'],
      minExperience: 'intermediate',
    },
    defaultVisible: false,
  },
  
  // Experience-based widgets
  {
    id: 'quickInsights',
    component: QuickInsights,
    priority: 1,
    conditions: {
      maxExperience: 'beginner',
    },
    defaultVisible: true,
  },
  {
    id: 'smartInsights',
    component: SmartInsights,
    priority: 1,
    conditions: {
      minExperience: 'advanced',
    },
    defaultVisible: true,
  },
  
  // Collaboration widgets
  {
    id: 'teamActivity',
    component: ActivityFeed,
    priority: 1,
    conditions: {
      roles: ['owner', 'manager'],
    },
    defaultVisible: false,
  },
  {
    id: 'deadlineAlerts',
    component: DeadlineAlerts,
    priority: 2,
    conditions: {
      roles: ['owner', 'manager'],
    },
    defaultVisible: true,
  },
  {
    id: 'collaborationNotifications',
    component: CollaborationNotifications,
    priority: 3,
    conditions: {
      roles: ['owner', 'manager'],
    },
    defaultVisible: false,
  },
  
  // Action center (always visible but prioritized)
  {
    id: 'actionCenter',
    component: ActionCenter,
    priority: 1,
    conditions: {}, // Always visible
    defaultVisible: true,
  },
];

/**
 * Filter widgets based on user onboarding data
 * CORRECTED: Proper type checking and feature flag evaluation
 */
export function getFilteredWidgets(
  userData: {
    industry: Industry;
    role: UserRole;
    useCase: UseCase;
    experience: ExperienceLevel;
  },
  enabledFeatures: string[]
): DashboardWidget[] {
  return DASHBOARD_WIDGETS.filter(widget => {
    const { conditions } = widget;
    if (!conditions) return true;
    
    // Industry check
    if (conditions.industries && !conditions.industries.includes(userData.industry)) {
      return false;
    }
    
    // Role check
    if (conditions.roles && !conditions.roles.includes(userData.role)) {
      return false;
    }
    
    // Use case check
    if (conditions.useCases && !conditions.useCases.includes(userData.useCase) && userData.useCase !== 'all') {
      return false;
    }
    
    // Experience check
    if (conditions.minExperience) {
      const userLevel = EXPERIENCE_LEVELS[userData.experience];
      const minLevel = EXPERIENCE_LEVELS[conditions.minExperience];
      if (userLevel < minLevel) return false;
    }
    
    if (conditions.maxExperience) {
      const userLevel = EXPERIENCE_LEVELS[userData.experience];
      const maxLevel = EXPERIENCE_LEVELS[conditions.maxExperience];
      if (userLevel > maxLevel) return false;
    }
    
    // Feature flag check
    if (conditions.features) {
      const hasAllFeatures = conditions.features.every(feature => 
        enabledFeatures.includes(feature)
      );
      if (!hasAllFeatures) return false;
    }
    
    return true;
  }).sort((a, b) => a.priority - b.priority);
}

