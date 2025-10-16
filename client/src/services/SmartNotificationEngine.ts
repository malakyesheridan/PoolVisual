/**
 * Smart Notification Engine
 * Provides intelligent, context-aware notifications and workflow suggestions
 */

import { Notification, NotificationType } from '../types/statusSync';
import { ProjectActivity } from '../stores/projectStore';
import { Mask } from '../maskcore/store';

export interface SmartNotification extends Notification {
  // Enhanced fields
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: 'workflow' | 'deadline' | 'collaboration' | 'system' | 'achievement';
  context: NotificationContext;
  suggestions: WorkflowSuggestion[];
  actionable: boolean;
  expiresAt?: Date;
  relatedEntities: RelatedEntity[];
}

export interface NotificationContext {
  projectId?: string;
  projectName?: string;
  photoId?: string;
  photoName?: string;
  maskId?: string;
  maskName?: string;
  quoteId?: string;
  quoteName?: string;
  userId?: string;
  userName?: string;
  currentWorkflow?: string;
  timeOfDay?: 'morning' | 'afternoon' | 'evening';
  userActivity?: 'active' | 'idle' | 'away';
}

export interface WorkflowSuggestion {
  id: string;
  title: string;
  description: string;
  action: string;
  actionType: 'navigate' | 'execute' | 'schedule' | 'contact';
  actionData?: any;
  priority: 'low' | 'medium' | 'high';
  estimatedTime?: number; // in minutes
  prerequisites?: string[];
}

export interface RelatedEntity {
  type: 'project' | 'photo' | 'mask' | 'quote' | 'material' | 'client';
  id: string;
  name: string;
  status?: string;
}

export interface NotificationPattern {
  type: NotificationType;
  conditions: NotificationCondition[];
  suggestions: WorkflowSuggestion[];
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: 'workflow' | 'deadline' | 'collaboration' | 'system' | 'achievement';
}

export interface NotificationCondition {
  field: string;
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains' | 'exists' | 'not_exists';
  value: any;
}

class SmartNotificationEngine {
  private patterns: NotificationPattern[] = [];
  private filters: NotificationFilter[] = [];
  private userPreferences: UserNotificationPreferences = {
    enableWorkflowSuggestions: true,
    enableDeadlineAlerts: true,
    enableCollaborationNotifications: true,
    enableAchievementNotifications: true,
    quietHours: { start: '22:00', end: '08:00' },
    maxNotificationsPerDay: 50,
    priorityThreshold: 'medium',
    categoryFilters: {
      workflow: true,
      deadline: true,
      collaboration: true,
      system: true,
      achievement: true
    },
    projectFilters: {
      enabled: false,
      projectIds: [],
      excludeProjectIds: []
    },
    timeBasedFiltering: {
      enabled: true,
      maxAgeHours: 72,
      respectBusinessHours: true,
      businessHours: { start: '09:00', end: '17:00', days: [1, 2, 3, 4, 5] }
    },
    frequencyLimits: {
      maxPerCategory: { workflow: 10, deadline: 5, collaboration: 8, system: 3, achievement: 2 },
      maxPerProject: {},
      cooldownMinutes: 30
    },
    smartGrouping: {
      enabled: true,
      groupSimilar: true,
      batchThreshold: 3
    }
  };

  constructor() {
    this.initializePatterns();
    this.initializeFilters();
  }

  private initializePatterns() {
    // Workflow suggestion patterns
    this.patterns.push({
      type: 'mask_created',
      conditions: [
        { field: 'maskCount', operator: 'greater_than', value: 2 },
        { field: 'hasMaterial', operator: 'equals', value: false }
      ],
      suggestions: [
        {
          id: 'assign-materials',
          title: 'Assign Materials to Masks',
          description: 'You have 3+ masks without materials. Assign materials to generate accurate quotes.',
          action: 'navigate',
          actionType: 'navigate',
          actionData: { path: '/materials' },
          priority: 'high',
          estimatedTime: 5
        }
      ],
      priority: 'medium',
      category: 'workflow'
    });

    this.patterns.push({
      type: 'material_assigned',
      conditions: [
        { field: 'maskCount', operator: 'greater_than', value: 1 },
        { field: 'quoteCount', operator: 'equals', value: 0 }
      ],
      suggestions: [
        {
          id: 'generate-quote',
          title: 'Generate Quote',
          description: 'Materials are assigned to masks. Generate a quote to finalize estimates.',
          action: 'navigate',
          actionType: 'navigate',
          actionData: { path: '/quotes' },
          priority: 'high',
          estimatedTime: 10
        }
      ],
      priority: 'high',
      category: 'workflow'
    });

    this.patterns.push({
      type: 'quote_generated',
      conditions: [
        { field: 'quoteStatus', operator: 'equals', value: 'draft' },
        { field: 'daysSinceCreation', operator: 'greater_than', value: 1 }
      ],
      suggestions: [
        {
          id: 'finalize-quote',
          title: 'Finalize Quote',
          description: 'Your quote has been in draft for over a day. Review and finalize it.',
          action: 'navigate',
          actionType: 'navigate',
          actionData: { path: '/quotes' },
          priority: 'medium',
          estimatedTime: 15
        }
      ],
      priority: 'medium',
      category: 'workflow'
    });

    // Achievement patterns
    this.patterns.push({
      type: 'mask_created',
      conditions: [
        { field: 'maskCount', operator: 'equals', value: 5 }
      ],
      suggestions: [
        {
          id: 'milestone-celebration',
          title: 'Milestone Achieved!',
          description: 'You\'ve created 5 masks. Great progress on this project!',
          action: 'execute',
          actionType: 'execute',
          actionData: { type: 'celebration' },
          priority: 'low',
          estimatedTime: 1
        }
      ],
      priority: 'low',
      category: 'achievement'
    });

    // Deadline patterns
    this.patterns.push({
      type: 'project_created',
      conditions: [
        { field: 'daysSinceCreation', operator: 'greater_than', value: 7 },
        { field: 'completionPercentage', operator: 'less_than', value: 50 }
      ],
      suggestions: [
        {
          id: 'project-review',
          title: 'Project Review Needed',
          description: 'This project has been active for a week with low completion. Time for a review.',
          action: 'navigate',
          actionType: 'navigate',
          actionData: { path: '/dashboard' },
          priority: 'high',
          estimatedTime: 20
        }
      ],
      priority: 'high',
      category: 'deadline'
    });
  }

  private initializeFilters() {
    // High priority filter - always show urgent notifications
    this.filters.push({
      id: 'urgent-always-show',
      name: 'Always Show Urgent',
      description: 'Always display urgent priority notifications',
      conditions: [
        { field: 'priority', operator: 'equals', value: 'urgent' }
      ],
      actions: [
        { type: 'prioritize', parameters: { priority: 'urgent' } }
      ],
      enabled: true,
      priority: 1
    });

    // Category filter - respect user category preferences
    this.filters.push({
      id: 'category-filter',
      name: 'Category Filter',
      description: 'Filter notifications based on category preferences',
      conditions: [
        { field: 'category', operator: 'in', value: ['workflow', 'deadline', 'collaboration', 'system', 'achievement'] }
      ],
      actions: [
        { type: 'hide', parameters: { condition: 'category_disabled' } }
      ],
      enabled: true,
      priority: 2
    });

    // Project filter - respect project-specific settings
    this.filters.push({
      id: 'project-filter',
      name: 'Project Filter',
      description: 'Filter notifications based on project preferences',
      conditions: [
        { field: 'context.projectId', operator: 'exists', value: true }
      ],
      actions: [
        { type: 'hide', parameters: { condition: 'project_excluded' } }
      ],
      enabled: true,
      priority: 3
    });

    // Time-based filter - respect business hours and age limits
    this.filters.push({
      id: 'time-filter',
      name: 'Time-based Filter',
      description: 'Filter notifications based on time and age',
      conditions: [
        { field: 'createdAt', operator: 'exists', value: true }
      ],
      actions: [
        { type: 'hide', parameters: { condition: 'outside_business_hours' } },
        { type: 'hide', parameters: { condition: 'too_old' } }
      ],
      enabled: true,
      priority: 4
    });

    // Frequency limit filter - prevent notification spam
    this.filters.push({
      id: 'frequency-filter',
      name: 'Frequency Filter',
      description: 'Limit notification frequency to prevent spam',
      conditions: [
        { field: 'category', operator: 'exists', value: true }
      ],
      actions: [
        { type: 'delay', parameters: { condition: 'frequency_exceeded' } }
      ],
      enabled: true,
      priority: 5
    });

    // Smart grouping filter - group similar notifications
    this.filters.push({
      id: 'grouping-filter',
      name: 'Smart Grouping',
      description: 'Group similar notifications together',
      conditions: [
        { field: 'category', operator: 'equals', value: 'workflow' }
      ],
      actions: [
        { type: 'group', parameters: { groupBy: 'category', threshold: 3 } }
      ],
      enabled: true,
      priority: 6
    });
  }

  /**
   * Apply smart filtering to notifications
   */
  applySmartFiltering(
    notifications: SmartNotification[],
    recentNotifications: SmartNotification[] = []
  ): { filtered: SmartNotification[]; grouped: NotificationGroup[] } {
    let filtered = [...notifications];
    const grouped: NotificationGroup[] = [];

    // Apply filters in priority order
    const sortedFilters = this.filters
      .filter(f => f.enabled)
      .sort((a, b) => a.priority - b.priority);

    for (const filter of sortedFilters) {
      filtered = this.applyFilter(filter, filtered, recentNotifications);
    }

    // Apply smart grouping if enabled
    if (this.userPreferences.smartGrouping.enabled) {
      const { groupedNotifications, remainingNotifications } = this.applySmartGrouping(filtered);
      grouped.push(...groupedNotifications);
      filtered = remainingNotifications;
    }

    return { filtered, grouped };
  }

  /**
   * Apply individual filter to notifications
   */
  private applyFilter(
    filter: NotificationFilter,
    notifications: SmartNotification[],
    recentNotifications: SmartNotification[]
  ): SmartNotification[] {
    return notifications.filter(notification => {
      // Check if notification matches filter conditions
      const matches = filter.conditions.every(condition => 
        this.evaluateFilterCondition(condition, notification)
      );

      if (!matches) return true; // Keep notification if it doesn't match filter

      // Apply filter actions
      for (const action of filter.actions) {
        const shouldHide = this.evaluateFilterAction(action, notification, recentNotifications);
        if (shouldHide) return false; // Hide notification
      }

      return true; // Keep notification
    });
  }

  /**
   * Evaluate filter condition
   */
  private evaluateFilterCondition(
    condition: FilterCondition,
    notification: SmartNotification
  ): boolean {
    const value = this.getNestedValue(notification, condition.field);
    
    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      case 'not_equals':
        return value !== condition.value;
      case 'contains':
        return value && value.toString().toLowerCase().includes(condition.value.toString().toLowerCase());
      case 'not_contains':
        return !value || !value.toString().toLowerCase().includes(condition.value.toString().toLowerCase());
      case 'greater_than':
        return value > condition.value;
      case 'less_than':
        return value < condition.value;
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(value);
      case 'not_in':
        return !Array.isArray(condition.value) || !condition.value.includes(value);
      case 'exists':
        return value !== undefined && value !== null;
      case 'not_exists':
        return value === undefined || value === null;
      default:
        return false;
    }
  }

  /**
   * Evaluate filter action
   */
  private evaluateFilterAction(
    action: FilterAction,
    notification: SmartNotification,
    recentNotifications: SmartNotification[]
  ): boolean {
    switch (action.type) {
      case 'hide':
        return this.shouldHideNotification(action.parameters, notification, recentNotifications);
      case 'prioritize':
        this.prioritizeNotification(action.parameters, notification);
        return false;
      case 'group':
        return false; // Grouping is handled separately
      case 'delay':
        return this.shouldDelayNotification(action.parameters, notification, recentNotifications);
      case 'transform':
        this.transformNotification(action.parameters, notification);
        return false;
      default:
        return false;
    }
  }

  /**
   * Apply smart grouping to notifications
   */
  private applySmartGrouping(notifications: SmartNotification[]): {
    groupedNotifications: NotificationGroup[];
    remainingNotifications: SmartNotification[];
  } {
    const grouped: NotificationGroup[] = [];
    const remaining: SmartNotification[] = [];
    const groups = new Map<string, SmartNotification[]>();

    // Group notifications by category and project
    for (const notification of notifications) {
      const groupKey = `${notification.category}-${notification.context.projectId || 'global'}`;
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      
      groups.get(groupKey)!.push(notification);
    }

    // Create notification groups for groups that meet threshold
    for (const [groupKey, groupNotifications] of groups) {
      if (groupNotifications.length >= this.userPreferences.smartGrouping.batchThreshold) {
        const [category, projectId] = groupKey.split('-');
        const group: NotificationGroup = {
          id: `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          title: this.generateGroupTitle(category, projectId, groupNotifications.length),
          notifications: groupNotifications,
          priority: this.calculateGroupPriority(groupNotifications),
          category,
          createdAt: new Date(),
          expiresAt: this.calculateGroupExpiration(groupNotifications)
        };
        grouped.push(group);
      } else {
        remaining.push(...groupNotifications);
      }
    }

    return { groupedNotifications: grouped, remainingNotifications: remaining };
  }

  /**
   * Generate smart notification from basic notification
   */
  generateSmartNotification(
    notification: Notification,
    context: NotificationContext,
    projectData?: any,
    userActivity?: any
  ): SmartNotification {
    const pattern = this.findMatchingPattern(notification.type, context, projectData);
    
    const smartNotification: SmartNotification = {
      ...notification,
      priority: pattern?.priority || 'medium',
      category: pattern?.category || 'system',
      context: {
        ...context,
        timeOfDay: this.getTimeOfDay(),
        userActivity: userActivity || 'active'
      },
      suggestions: pattern?.suggestions || [],
      actionable: (pattern?.suggestions?.length || 0) > 0,
      relatedEntities: this.extractRelatedEntities(notification, context),
      expiresAt: this.calculateExpiration(notification.type, pattern?.priority)
    };

    return smartNotification;
  }

  /**
   * Generate workflow suggestions based on current project state
   */
  generateWorkflowSuggestions(
    projectId: string,
    projectData: any,
    recentActivities: ProjectActivity[]
  ): WorkflowSuggestion[] {
    const suggestions: WorkflowSuggestion[] = [];

    // Analyze project state and generate suggestions
    if (projectData.photos.length === 0) {
      suggestions.push({
        id: 'upload-photos',
        title: 'Upload Project Photos',
        description: 'Start by uploading photos of the project area.',
        action: 'navigate',
        actionType: 'navigate',
        actionData: { path: `/jobs/${projectData.jobId}/photos/add` },
        priority: 'high',
        estimatedTime: 10
      });
    }

    if (projectData.photos.length > 0 && projectData.masks.length === 0) {
      suggestions.push({
        id: 'create-masks',
        title: 'Create Masks',
        description: 'Define work areas by creating masks on your photos.',
        action: 'navigate',
        actionType: 'navigate',
        actionData: { path: `/jobs/${projectData.jobId}/photo/${projectData.photos[0].id}/edit` },
        priority: 'high',
        estimatedTime: 15
      });
    }

    if (projectData.masks.length > 0 && projectData.masksWithMaterials === 0) {
      suggestions.push({
        id: 'assign-materials',
        title: 'Assign Materials',
        description: 'Assign materials to masks for accurate cost estimation.',
        action: 'navigate',
        actionType: 'navigate',
        actionData: { path: '/materials' },
        priority: 'high',
        estimatedTime: 5
      });
    }

    if (projectData.masksWithMaterials > 0 && projectData.quotes.length === 0) {
      suggestions.push({
        id: 'generate-quote',
        title: 'Generate Quote',
        description: 'Create a professional quote for your client.',
        action: 'navigate',
        actionType: 'navigate',
        actionData: { path: '/quotes' },
        priority: 'high',
        estimatedTime: 10
      });
    }

    // Check for stale activities
    const staleActivities = recentActivities.filter(activity => {
      const daysSince = (Date.now() - activity.timestamp.getTime()) / (1000 * 60 * 60 * 24);
      return daysSince > 3;
    });

    if (staleActivities.length > 0) {
      suggestions.push({
        id: 'review-stale-work',
        title: 'Review Stale Work',
        description: 'You have work that hasn\'t been updated in 3+ days.',
        action: 'navigate',
        actionType: 'navigate',
        actionData: { path: '/dashboard' },
        priority: 'medium',
        estimatedTime: 20
      });
    }

    return suggestions;
  }

  /**
   * Check if notification should be shown based on user preferences
   */
  shouldShowNotification(notification: SmartNotification): boolean {
    // Check quiet hours
    if (this.isQuietHours()) {
      return notification.priority === 'urgent';
    }

    // Check priority threshold
    const priorityLevels = { low: 1, medium: 2, high: 3, urgent: 4 };
    const userThreshold = priorityLevels[this.userPreferences.priorityThreshold];
    const notificationPriority = priorityLevels[notification.priority];

    return notificationPriority >= userThreshold;
  }

  /**
   * Get contextual message based on notification type and context
   */
  getContextualMessage(notification: SmartNotification): string {
    const { type, context, suggestions } = notification;
    
    let baseMessage = notification.message;
    
    // Add contextual information
    if (context.projectName) {
      baseMessage = `${baseMessage} in project "${context.projectName}"`;
    }
    
    if (context.timeOfDay === 'morning') {
      baseMessage = `Good morning! ${baseMessage}`;
    } else if (context.timeOfDay === 'evening') {
      baseMessage = `Good evening! ${baseMessage}`;
    }
    
    // Add suggestion hint
    if (suggestions.length > 0) {
      const suggestion = suggestions[0];
      baseMessage = `${baseMessage} ${suggestion.description}`;
    }
    
    return baseMessage;
  }

  private findMatchingPattern(
    type: NotificationType,
    context: NotificationContext,
    projectData?: any
  ): NotificationPattern | null {
    return this.patterns.find(pattern => {
      if (pattern.type !== type) return false;
      
      return pattern.conditions.every(condition => {
        return this.evaluateCondition(condition, context, projectData);
      });
    }) || null;
  }

  private evaluateCondition(
    condition: NotificationCondition,
    context: NotificationContext,
    projectData?: any
  ): boolean {
    let value: any;
    
    // Get value from context or project data
    if (condition.field.includes('.')) {
      const [parent, child] = condition.field.split('.');
      value = projectData?.[parent]?.[child];
    } else {
      value = context[condition.field as keyof NotificationContext] || 
              projectData?.[condition.field];
    }
    
    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      case 'greater_than':
        return value > condition.value;
      case 'less_than':
        return value < condition.value;
      case 'contains':
        return value && value.toString().includes(condition.value);
      case 'exists':
        return value !== undefined && value !== null;
      case 'not_exists':
        return value === undefined || value === null;
      default:
        return false;
    }
  }

  private extractRelatedEntities(
    notification: Notification,
    context: NotificationContext
  ): RelatedEntity[] {
    const entities: RelatedEntity[] = [];
    
    if (context.projectId && context.projectName) {
      entities.push({
        type: 'project',
        id: context.projectId,
        name: context.projectName
      });
    }
    
    if (context.photoId && context.photoName) {
      entities.push({
        type: 'photo',
        id: context.photoId,
        name: context.photoName
      });
    }
    
    if (context.maskId && context.maskName) {
      entities.push({
        type: 'mask',
        id: context.maskId,
        name: context.maskName
      });
    }
    
    if (context.quoteId && context.quoteName) {
      entities.push({
        type: 'quote',
        id: context.quoteId,
        name: context.quoteName
      });
    }
    
    return entities;
  }

  private calculateExpiration(type: NotificationType, priority?: string): Date {
    const now = new Date();
    const expirationHours = {
      urgent: 24,
      high: 48,
      medium: 72,
      low: 168 // 1 week
    };
    
    const hours = expirationHours[priority as keyof typeof expirationHours] || 72;
    return new Date(now.getTime() + hours * 60 * 60 * 1000);
  }

  private getTimeOfDay(): 'morning' | 'afternoon' | 'evening' {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';
    return 'evening';
  }

  private isQuietHours(): boolean {
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);
    const { start, end } = this.userPreferences.quietHours;
    
    if (start < end) {
      return currentTime >= start && currentTime <= end;
    } else {
      return currentTime >= start || currentTime <= end;
    }
  }

  /**
   * Helper methods for enhanced filtering
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private shouldHideNotification(
    parameters: any,
    notification: SmartNotification,
    recentNotifications: SmartNotification[]
  ): boolean {
    const { condition } = parameters;

    switch (condition) {
      case 'category_disabled':
        return !this.userPreferences.categoryFilters[notification.category as keyof typeof this.userPreferences.categoryFilters];
      
      case 'project_excluded':
        if (!this.userPreferences.projectFilters.enabled) return false;
        if (this.userPreferences.projectFilters.projectIds.length > 0) {
          return !this.userPreferences.projectFilters.projectIds.includes(notification.context.projectId || '');
        }
        return this.userPreferences.projectFilters.excludeProjectIds.includes(notification.context.projectId || '');
      
      case 'outside_business_hours':
        if (!this.userPreferences.timeBasedFiltering.respectBusinessHours) return false;
        return !this.isBusinessHours();
      
      case 'too_old':
        if (!this.userPreferences.timeBasedFiltering.enabled) return false;
        const ageHours = (Date.now() - notification.createdAt.getTime()) / (1000 * 60 * 60);
        return ageHours > this.userPreferences.timeBasedFiltering.maxAgeHours;
      
      default:
        return false;
    }
  }

  private shouldDelayNotification(
    parameters: any,
    notification: SmartNotification,
    recentNotifications: SmartNotification[]
  ): boolean {
    const { condition } = parameters;

    if (condition === 'frequency_exceeded') {
      const categoryLimit = this.userPreferences.frequencyLimits.maxPerCategory[notification.category] || 10;
      const projectLimit = this.userPreferences.frequencyLimits.maxPerProject[notification.context.projectId || ''] || 5;
      
      const recentCategoryCount = recentNotifications.filter(n => 
        n.category === notification.category && 
        (Date.now() - n.createdAt.getTime()) < (this.userPreferences.frequencyLimits.cooldownMinutes * 60 * 1000)
      ).length;
      
      const recentProjectCount = recentNotifications.filter(n => 
        n.context.projectId === notification.context.projectId && 
        (Date.now() - n.createdAt.getTime()) < (this.userPreferences.frequencyLimits.cooldownMinutes * 60 * 1000)
      ).length;
      
      return recentCategoryCount >= categoryLimit || recentProjectCount >= projectLimit;
    }

    return false;
  }

  private prioritizeNotification(parameters: any, notification: SmartNotification): void {
    const { priority } = parameters;
    if (priority && ['low', 'medium', 'high', 'urgent'].includes(priority)) {
      notification.priority = priority;
    }
  }

  private transformNotification(parameters: any, notification: SmartNotification): void {
    // Apply transformations to notification
    // This could include modifying message, adding context, etc.
  }

  private generateGroupTitle(category: string, projectId: string, count: number): string {
    const categoryNames = {
      workflow: 'Workflow Updates',
      deadline: 'Deadline Alerts',
      collaboration: 'Team Activity',
      system: 'System Notifications',
      achievement: 'Achievements'
    };

    const categoryName = categoryNames[category as keyof typeof categoryNames] || category;
    const projectText = projectId && projectId !== 'global' ? ` for Project ${projectId}` : '';
    
    return `${categoryName}${projectText} (${count} items)`;
  }

  private calculateGroupPriority(notifications: SmartNotification[]): 'low' | 'medium' | 'high' | 'urgent' {
    const priorities = notifications.map(n => n.priority);
    if (priorities.includes('urgent')) return 'urgent';
    if (priorities.includes('high')) return 'high';
    if (priorities.includes('medium')) return 'medium';
    return 'low';
  }

  private calculateGroupExpiration(notifications: SmartNotification[]): Date {
    const maxExpiration = Math.max(...notifications.map(n => n.expiresAt?.getTime() || 0));
    return new Date(maxExpiration);
  }

  private isBusinessHours(): boolean {
    if (!this.userPreferences.timeBasedFiltering.respectBusinessHours) return true;
    
    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = now.toTimeString().slice(0, 5);
    const { start, end, days } = this.userPreferences.timeBasedFiltering.businessHours;
    
    if (!days.includes(currentDay)) return false;
    
    return currentTime >= start && currentTime <= end;
  }

  /**
   * Update user preferences
   */
  updateUserPreferences(preferences: Partial<UserNotificationPreferences>): void {
    this.userPreferences = { ...this.userPreferences, ...preferences };
  }

  /**
   * Get current user preferences
   */
  getUserPreferences(): UserNotificationPreferences {
    return { ...this.userPreferences };
  }

  /**
   * Add custom filter
   */
  addCustomFilter(filter: NotificationFilter): void {
    this.filters.push(filter);
  }

  /**
   * Remove custom filter
   */
  removeCustomFilter(filterId: string): void {
    this.filters = this.filters.filter(f => f.id !== filterId);
  }
}

export interface UserNotificationPreferences {
  enableWorkflowSuggestions: boolean;
  enableDeadlineAlerts: boolean;
  enableCollaborationNotifications: boolean;
  enableAchievementNotifications: boolean;
  quietHours: { start: string; end: string };
  maxNotificationsPerDay: number;
  priorityThreshold: 'low' | 'medium' | 'high' | 'urgent';
  // Enhanced filtering preferences
  categoryFilters: {
    workflow: boolean;
    deadline: boolean;
    collaboration: boolean;
    system: boolean;
    achievement: boolean;
  };
  projectFilters: {
    enabled: boolean;
    projectIds: string[];
    excludeProjectIds: string[];
  };
  timeBasedFiltering: {
    enabled: boolean;
    maxAgeHours: number;
    respectBusinessHours: boolean;
    businessHours: { start: string; end: string; days: number[] };
  };
  frequencyLimits: {
    maxPerCategory: Record<string, number>;
    maxPerProject: Record<string, number>;
    cooldownMinutes: number;
  };
  smartGrouping: {
    enabled: boolean;
    groupSimilar: boolean;
    batchThreshold: number;
  };
}

export interface NotificationFilter {
  id: string;
  name: string;
  description: string;
  conditions: FilterCondition[];
  actions: FilterAction[];
  enabled: boolean;
  priority: number;
}

export interface FilterCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'in' | 'not_in' | 'exists' | 'not_exists';
  value: any;
  caseSensitive?: boolean;
}

export interface FilterAction {
  type: 'hide' | 'prioritize' | 'group' | 'delay' | 'transform';
  parameters: any;
}

export interface NotificationGroup {
  id: string;
  title: string;
  notifications: SmartNotification[];
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  createdAt: Date;
  expiresAt?: Date;
}

export const smartNotificationEngine = new SmartNotificationEngine();
