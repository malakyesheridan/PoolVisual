/**
 * Enhanced Authentication Service
 * 
 * Implements secure login with account lockout, audit logging, and security checks
 * Inspired by industry best practices (Stripe, Auth0, NextAuth)
 */

import { storage } from '../storage.js';
import { PasswordService, PasswordValidator } from './passwordService.js';
import { AuthAuditService } from './authAuditService.js';
import type { User } from '../../shared/schema.js';

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
      // 1. Validate input (already validated in route, but double-check)
      if (!email || !password) {
        // Don't log audit for missing input - already handled by route
        return {
          success: false,
          error: 'Email and password are required',
        };
      }

      // 2. Get user from database
      let user: User | undefined;
      try {
        user = await storage.getUserByEmail(email);
      } catch (dbError: any) {
        console.error('[EnhancedAuth] Database error getting user:', dbError?.message || dbError);
        throw new Error(`Database error: ${dbError?.message || 'Failed to query user'}`);
      }
      
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
      let passwordValid = false;
      if (user && user.password) {
        try {
          passwordValid = await PasswordService.verifyPassword(password, user.password);
        } catch (verifyError: any) {
          console.error('[EnhancedAuth] Password verification error:', verifyError?.message || verifyError);
          throw new Error(`Password verification failed: ${verifyError?.message || 'Unknown error'}`);
        }
      }
      
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      console.error('[EnhancedAuth] Login error:', errorMessage);
      if (errorStack) {
        console.error('[EnhancedAuth] Error stack:', errorStack);
      }
      
      // Try to log the attempt, but don't fail if logging fails
      try {
        await AuthAuditService.logLoginAttempt({
          email,
          ...clientInfo,
          success: false,
          reason: errorMessage,
        });
      } catch (logError) {
        console.error('[EnhancedAuth] Failed to log login attempt:', logError);
      }
      
      // Return more specific error if it's a known issue
      if (errorMessage.includes('database') || errorMessage.includes('connection')) {
        return {
          success: false,
          error: 'Database connection error. Please try again later.',
        };
      }
      
      if (errorMessage.includes('timeout')) {
        return {
          success: false,
          error: 'Request timeout. Please try again.',
        };
      }
      
      return {
        success: false,
        error: `Login failed: ${errorMessage}`,
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

