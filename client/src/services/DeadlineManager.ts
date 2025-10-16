/**
 * Deadline and Timeline Management System
 * Handles project deadlines, milestones, and timeline alerts
 */

import { Project } from '../types/project';
import { ProjectActivity } from '../stores/projectStore';

export interface ProjectDeadline {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  dueDate: Date;
  type: 'milestone' | 'deadline' | 'review' | 'delivery' | 'meeting';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'in_progress' | 'completed' | 'overdue' | 'cancelled';
  assignedTo?: string;
  createdAt: Date;
  lastModified: Date;
  completedAt?: Date;
  dependencies?: string[]; // IDs of other deadlines that must be completed first
  estimatedDuration?: number; // in hours
  actualDuration?: number; // in hours
  notes?: string;
}

export interface ProjectTimeline {
  projectId: string;
  milestones: ProjectDeadline[];
  phases: ProjectPhase[];
  totalDuration: number; // in days
  startDate: Date;
  endDate: Date;
  currentPhase?: string;
  progressPercentage: number;
  lastUpdated: Date;
}

export interface ProjectPhase {
  id: string;
  name: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  status: 'not_started' | 'in_progress' | 'completed' | 'delayed';
  milestones: string[]; // Deadline IDs
  dependencies?: string[]; // Phase IDs that must complete first
}

export interface DeadlineAlert {
  id: string;
  deadlineId: string;
  projectId: string;
  type: 'approaching' | 'overdue' | 'milestone_reached' | 'phase_complete';
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  dueDate: Date;
  daysUntilDue: number;
  createdAt: Date;
  acknowledged: boolean;
  acknowledgedAt?: Date;
  actionRequired: boolean;
  suggestedActions?: string[];
}

class DeadlineManager {
  private deadlines: Map<string, ProjectDeadline[]> = new Map();
  private timelines: Map<string, ProjectTimeline> = new Map();
  private alerts: DeadlineAlert[] = [];

  /**
   * Add a deadline to a project
   */
  addDeadline(projectId: string, deadline: Omit<ProjectDeadline, 'id' | 'createdAt' | 'lastModified'>): ProjectDeadline {
    const newDeadline: ProjectDeadline = {
      ...deadline,
      id: `deadline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      lastModified: new Date(),
    };

    const projectDeadlines = this.deadlines.get(projectId) || [];
    projectDeadlines.push(newDeadline);
    this.deadlines.set(projectId, projectDeadlines);

    // Generate alerts if needed
    this.generateDeadlineAlerts(projectId, newDeadline);

    console.log('[DeadlineManager] Added deadline:', newDeadline);
    return newDeadline;
  }

  /**
   * Update deadline status
   */
  updateDeadlineStatus(projectId: string, deadlineId: string, status: ProjectDeadline['status']): void {
    const projectDeadlines = this.deadlines.get(projectId);
    if (!projectDeadlines) return;

    const deadline = projectDeadlines.find(d => d.id === deadlineId);
    if (!deadline) return;

    deadline.status = status;
    deadline.lastModified = new Date();
    
    if (status === 'completed') {
      deadline.completedAt = new Date();
    }

    // Update timeline progress
    this.updateTimelineProgress(projectId);

    console.log('[DeadlineManager] Updated deadline status:', { deadlineId, status });
  }

  /**
   * Get deadlines for a project
   */
  getProjectDeadlines(projectId: string): ProjectDeadline[] {
    return this.deadlines.get(projectId) || [];
  }

  /**
   * Get upcoming deadlines (within specified days)
   */
  getUpcomingDeadlines(projectId: string, daysAhead: number = 7): ProjectDeadline[] {
    const deadlines = this.getProjectDeadlines(projectId);
    const now = new Date();
    const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    return deadlines.filter(deadline => {
      const dueDate = new Date(deadline.dueDate);
      return dueDate >= now && dueDate <= futureDate && deadline.status !== 'completed';
    }).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }

  /**
   * Get overdue deadlines
   */
  getOverdueDeadlines(projectId: string): ProjectDeadline[] {
    const deadlines = this.getProjectDeadlines(projectId);
    const now = new Date();

    return deadlines.filter(deadline => {
      const dueDate = new Date(deadline.dueDate);
      return dueDate < now && deadline.status !== 'completed';
    }).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }

  /**
   * Create project timeline
   */
  createProjectTimeline(projectId: string, phases: Omit<ProjectPhase, 'id'>[]): ProjectTimeline {
    const deadlines = this.getProjectDeadlines(projectId);
    
    const projectPhases: ProjectPhase[] = phases.map(phase => ({
      ...phase,
      id: `phase_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    }));

    const startDate = new Date(Math.min(...projectPhases.map(p => new Date(p.startDate).getTime())));
    const endDate = new Date(Math.max(...projectPhases.map(p => new Date(p.endDate).getTime())));
    const totalDuration = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    const timeline: ProjectTimeline = {
      projectId,
      milestones: deadlines,
      phases: projectPhases,
      totalDuration,
      startDate,
      endDate,
      currentPhase: this.determineCurrentPhase(projectPhases),
      progressPercentage: this.calculateProgressPercentage(deadlines, projectPhases),
      lastUpdated: new Date(),
    };

    this.timelines.set(projectId, timeline);
    console.log('[DeadlineManager] Created timeline:', timeline);
    return timeline;
  }

  /**
   * Get project timeline
   */
  getProjectTimeline(projectId: string): ProjectTimeline | null {
    return this.timelines.get(projectId) || null;
  }

  /**
   * Generate deadline alerts
   */
  private generateDeadlineAlerts(projectId: string, deadline: ProjectDeadline): void {
    const now = new Date();
    const dueDate = new Date(deadline.dueDate);
    const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Generate approaching deadline alert (7 days before)
    if (daysUntilDue <= 7 && daysUntilDue > 0) {
      this.addAlert({
        deadlineId: deadline.id,
        projectId,
        type: 'approaching',
        severity: daysUntilDue <= 3 ? 'warning' : 'info',
        message: `Deadline "${deadline.title}" is approaching (${daysUntilDue} days)`,
        dueDate,
        daysUntilDue,
        createdAt: now,
        acknowledged: false,
        actionRequired: true,
        suggestedActions: this.getSuggestedActions(deadline),
      });
    }

    // Generate overdue alert
    if (daysUntilDue < 0) {
      this.addAlert({
        deadlineId: deadline.id,
        projectId,
        type: 'overdue',
        severity: 'error',
        message: `Deadline "${deadline.title}" is overdue by ${Math.abs(daysUntilDue)} days`,
        dueDate,
        daysUntilDue,
        createdAt: now,
        acknowledged: false,
        actionRequired: true,
        suggestedActions: this.getSuggestedActions(deadline),
      });
    }
  }

  /**
   * Add alert
   */
  private addAlert(alertData: Omit<DeadlineAlert, 'id'>): void {
    const alert: DeadlineAlert = {
      ...alertData,
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    this.alerts.push(alert);
    console.log('[DeadlineManager] Added alert:', alert);
  }

  /**
   * Get active alerts for a project
   */
  getProjectAlerts(projectId: string): DeadlineAlert[] {
    return this.alerts.filter(alert => 
      alert.projectId === projectId && !alert.acknowledged
    ).sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedAt = new Date();
      console.log('[DeadlineManager] Acknowledged alert:', alertId);
    }
  }

  /**
   * Get suggested actions for deadline
   */
  private getSuggestedActions(deadline: ProjectDeadline): string[] {
    const actions: string[] = [];

    switch (deadline.type) {
      case 'milestone':
        actions.push('Review progress and update status');
        actions.push('Schedule team check-in');
        break;
      case 'deadline':
        actions.push('Prioritize remaining tasks');
        actions.push('Request deadline extension if needed');
        break;
      case 'review':
        actions.push('Prepare review materials');
        actions.push('Schedule review meeting');
        break;
      case 'delivery':
        actions.push('Finalize deliverables');
        actions.push('Prepare delivery documentation');
        break;
      case 'meeting':
        actions.push('Send meeting reminders');
        actions.push('Prepare agenda and materials');
        break;
    }

    if (deadline.priority === 'critical' || deadline.priority === 'high') {
      actions.push('Escalate to project manager');
    }

    return actions;
  }

  /**
   * Determine current phase
   */
  private determineCurrentPhase(phases: ProjectPhase[]): string | undefined {
    const now = new Date();
    
    for (const phase of phases) {
      const startDate = new Date(phase.startDate);
      const endDate = new Date(phase.endDate);
      
      if (now >= startDate && now <= endDate) {
        return phase.id;
      }
    }
    
    return undefined;
  }

  /**
   * Calculate progress percentage
   */
  private calculateProgressPercentage(deadlines: ProjectDeadline[], phases: ProjectPhase[]): number {
    const completedDeadlines = deadlines.filter(d => d.status === 'completed').length;
    const totalDeadlines = deadlines.length;
    
    if (totalDeadlines === 0) return 0;
    
    return Math.round((completedDeadlines / totalDeadlines) * 100);
  }

  /**
   * Update timeline progress
   */
  private updateTimelineProgress(projectId: string): void {
    const timeline = this.timelines.get(projectId);
    if (!timeline) return;

    const deadlines = this.getProjectDeadlines(projectId);
    timeline.progressPercentage = this.calculateProgressPercentage(deadlines, timeline.phases);
    timeline.currentPhase = this.determineCurrentPhase(timeline.phases);
    timeline.lastUpdated = new Date();
  }

  /**
   * Generate default timeline for new project
   */
  generateDefaultTimeline(projectId: string, projectData: any): ProjectTimeline {
    const now = new Date();
    const phases: Omit<ProjectPhase, 'id'>[] = [
      {
        name: 'Planning & Setup',
        startDate: now,
        endDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000), // 3 days
        status: 'not_started',
        milestones: [],
      },
      {
        name: 'Design & Estimation',
        startDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
        endDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days
        status: 'not_started',
        milestones: [],
      },
      {
        name: 'Client Review',
        startDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        endDate: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000), // 10 days
        status: 'not_started',
        milestones: [],
      },
      {
        name: 'Finalization',
        startDate: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
        endDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000), // 14 days
        status: 'not_started',
        milestones: [],
      },
    ];

    return this.createProjectTimeline(projectId, phases);
  }
}

export const deadlineManager = new DeadlineManager();
