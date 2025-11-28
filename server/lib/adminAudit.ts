/**
 * Admin Audit Logging Service
 * 
 * Logs all administrative actions for security and compliance.
 * All admin actions are recorded with full context.
 */

import { storage } from '../storage.js';
import type { InsertAdminAction } from '../../shared/schema.js';

export interface AdminActionDetails {
  resourceType?: string;
  resourceId?: string;
  changes?: Record<string, any>;
  previousValue?: any;
  newValue?: any;
  reason?: string;
  metadata?: Record<string, any>;
}

/**
 * Log an admin action
 */
export async function logAdminAction(
  adminUserId: string,
  actionType: string,
  details: AdminActionDetails & {
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<void> {
  try {
    await storage.createAdminAction({
      adminUserId,
      actionType,
      resourceType: details.resourceType,
      resourceId: details.resourceId,
      details: {
        changes: details.changes,
        previousValue: details.previousValue,
        newValue: details.newValue,
        reason: details.reason,
        metadata: details.metadata,
      },
      ipAddress: details.ipAddress,
      userAgent: details.userAgent,
    });
  } catch (error) {
    // Don't fail the operation if logging fails, but log the error
    console.error('[AdminAudit] Failed to log admin action:', error);
  }
}

/**
 * Common admin action types
 */
export const AdminActionTypes = {
  // User management
  USER_CREATE: 'user.create',
  USER_UPDATE: 'user.update',
  USER_DELETE: 'user.delete',
  USER_IMPERSONATE: 'user.impersonate',
  USER_RESET_PASSWORD: 'user.reset_password',
  USER_ACTIVATE: 'user.activate',
  USER_DEACTIVATE: 'user.deactivate',
  
  // Organization management
  ORG_CREATE: 'org.create',
  ORG_UPDATE: 'org.update',
  ORG_DELETE: 'org.delete',
  ORG_MEMBER_ADD: 'org.member.add',
  ORG_MEMBER_REMOVE: 'org.member.remove',
  ORG_MEMBER_UPDATE: 'org.member.update',
  
  // System settings
  SETTINGS_UPDATE: 'settings.update',
  FEATURE_FLAG_UPDATE: 'feature_flag.update',
  
  // Analytics
  ANALYTICS_VIEW: 'analytics.view',
  ANALYTICS_EXPORT: 'analytics.export',
  
  // Audit logs
  AUDIT_VIEW: 'audit.view',
  AUDIT_EXPORT: 'audit.export',
} as const;

export type AdminActionType = typeof AdminActionTypes[keyof typeof AdminActionTypes];

