/**
 * Authentication Audit Service
 * 
 * Logs login attempts and security events for compliance and monitoring
 */

import { storage } from '../storage.js';

export interface LoginAttemptData {
  email: string;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  reason?: string;
}

export interface SecurityEventData {
  userId?: string;
  eventType: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, any>;
}

export class AuthAuditService {
  /**
   * Log a login attempt (non-blocking)
   */
  static async logLoginAttempt(data: LoginAttemptData): Promise<void> {
    try {
      await storage.createLoginAttempt(data);
    } catch (error) {
      // Non-blocking: don't fail login if logging fails
      console.error('[AuthAudit] Failed to log login attempt:', error);
    }
  }

  /**
   * Log a security event (non-blocking)
   */
  static async logSecurityEvent(data: SecurityEventData): Promise<void> {
    try {
      await storage.createSecurityEvent(data);
    } catch (error) {
      // Non-blocking: don't fail operations if logging fails
      console.error('[AuthAudit] Failed to log security event:', error);
    }
  }

  /**
   * Get recent failed login attempts for an email
   */
  static async getRecentFailedAttempts(email: string, windowMinutes: number = 15): Promise<number> {
    try {
      return await storage.getRecentFailedLoginAttempts(email, windowMinutes);
    } catch (error) {
      console.error('[AuthAudit] Failed to get failed attempts:', error);
      return 0;
    }
  }
}

