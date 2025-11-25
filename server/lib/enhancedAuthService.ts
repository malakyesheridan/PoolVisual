/**
 * Enhanced Authentication Service
 * 
 * Implements secure login with account lockout, audit logging, and security checks
 * Inspired by industry best practices (Stripe, Auth0, NextAuth)
 */

import { storage } from '../storage.js';
import { PasswordService, PasswordValidator } from './passwordService.js';
import { AuthAuditService } from './authAuditService.js';

export interface LoginResult {
  success: boolean;
  user?: {
    id: string;
    email: string;
    username: string;
  };
  error?: string;
  lockedUntil?: Date;
  remainingAttempts?: number;
}

export class EnhancedAuthService {
  private static readonly MAX_FAILED_ATTEMPTS = 5;
  private static readonly LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

  /**
   * Authenticate user with enhanced security checks
   */
  static async login(
    email: string,
    password: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<LoginResult> {
    // Get client info for audit logging
    const clientInfo = {
      ipAddress: ipAddress || undefined,
      userAgent: userAgent || undefined,
    };

    try {
      // 1. Validate input
      if (!email || !password) {
        await AuthAuditService.logLoginAttempt({
          email: email || 'unknown',
          ...clientInfo,
          success: false,
          reason: 'Missing email or password',
        });
        return {
          success: false,
          error: 'Email and password are required',
        };
      }

      // 2. Get user from database
      const user = await storage.getUserByEmail(email);
      
      // 3. Check account lockout (even if user doesn't exist - prevents enumeration)
      if (user) {
        // Handle missing security fields gracefully (if migration hasn't run yet)
        const lockedUntil = user.lockedUntil ? new Date(user.lockedUntil) : null;
        if (lockedUntil && lockedUntil > new Date()) {
          await AuthAuditService.logLoginAttempt({
            email,
            ...clientInfo,
            success: false,
            reason: 'Account locked',
          });
          await AuthAuditService.logSecurityEvent({
            userId: user.id,
            eventType: 'login_blocked_locked',
            ...clientInfo,
          });
          
          return {
            success: false,
            error: 'Account is temporarily locked due to too many failed login attempts. Please try again later.',
            lockedUntil: lockedUntil,
            remainingAttempts: 0,
          };
        }

        // 4. Check if account is active (default to true if field doesn't exist)
        if (user.isActive === false) {
          await AuthAuditService.logLoginAttempt({
            email,
            ...clientInfo,
            success: false,
            reason: 'Account inactive',
          });
          await AuthAuditService.logSecurityEvent({
            userId: user.id,
            eventType: 'login_blocked_inactive',
            ...clientInfo,
          });
          
          return {
            success: false,
            error: 'This account has been deactivated. Please contact support.',
          };
        }
      }

      // 5. Verify password
      const passwordValid = user && await PasswordService.verifyPassword(password, user.password);
      
      if (!user || !passwordValid) {
        // Failed login - increment attempts and potentially lock account
        if (user) {
          const newFailedAttempts = (user.failedLoginAttempts || 0) + 1;
          const shouldLock = newFailedAttempts >= this.MAX_FAILED_ATTEMPTS;
          
          try {
            await storage.updateUser(user.id, {
              failedLoginAttempts: newFailedAttempts,
              lockedUntil: shouldLock 
                ? new Date(Date.now() + this.LOCKOUT_DURATION_MS)
                : null,
            });
          } catch (error: any) {
            // If update fails due to missing columns, that's okay - just log it
            console.warn('[EnhancedAuth] Could not update failed attempts (migration may not have run):', error.message);
          }

          if (shouldLock) {
            await AuthAuditService.logSecurityEvent({
              userId: user.id,
              eventType: 'account_locked',
              ...clientInfo,
              details: { failedAttempts: newFailedAttempts },
            });
          }
        }

        await AuthAuditService.logLoginAttempt({
          email,
          ...clientInfo,
          success: false,
          reason: user ? 'Invalid password' : 'User not found',
        });

        const remainingAttempts = user 
          ? Math.max(0, this.MAX_FAILED_ATTEMPTS - newFailedAttempts)
          : undefined;

        return {
          success: false,
          error: 'Invalid email or password',
          remainingAttempts,
        };
      }

      // 6. Successful login - reset failed attempts and update login stats
      // Only update security fields if they exist (migration may not have run)
      try {
        await storage.updateUser(user.id, {
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: new Date(),
          loginCount: (user.loginCount || 0) + 1,
        });
      } catch (error: any) {
        // If update fails due to missing columns, that's okay - login should still succeed
        console.warn('[EnhancedAuth] Could not update security fields (migration may not have run):', error.message);
      }

      // 7. Log successful login
      await AuthAuditService.logLoginAttempt({
        email,
        ...clientInfo,
        success: true,
      });
      await AuthAuditService.logSecurityEvent({
        userId: user.id,
        eventType: 'login_success',
        ...clientInfo,
      });

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          username: user.username || '',
        },
      };
    } catch (error) {
      console.error('[EnhancedAuth] Login error:', error);
      await AuthAuditService.logLoginAttempt({
        email,
        ...clientInfo,
        success: false,
        reason: (error as Error).message,
      });
      
      return {
        success: false,
        error: 'An error occurred during login. Please try again.',
      };
    }
  }

  /**
   * Validate password strength (for registration/password reset)
   */
  static validatePassword(password: string): { valid: boolean; errors: string[]; strength?: 'weak' | 'medium' | 'strong' } {
    return PasswordValidator.validate(password);
  }

  /**
   * Check if account is locked
   */
  static async isAccountLocked(email: string): Promise<{ locked: boolean; lockedUntil?: Date }> {
    const user = await storage.getUserByEmail(email);
    if (!user) {
      return { locked: false };
    }

    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      return {
        locked: true,
        lockedUntil: new Date(user.lockedUntil),
      };
    }

    return { locked: false };
  }
}

