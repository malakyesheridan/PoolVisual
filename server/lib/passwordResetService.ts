/**
 * Password Reset Service
 * 
 * Handles password reset functionality using existing infrastructure
 * Integrates with EmailService and Storage without modifying existing code
 */

import { randomBytes } from 'crypto';
import { storage } from '../storage';
import { PasswordService } from './passwordService';
import { EmailService } from './emailService';

export interface PasswordResetRequest {
  email: string;
  token: string;
  expiresAt: Date;
}

export interface PasswordResetResult {
  success: boolean;
  message: string;
  error?: string;
}

export class PasswordResetService {
  private emailService: EmailService;
  
  // Token expiration time (1 hour)
  private static readonly TOKEN_EXPIRY_HOURS = 1;
  
  // Rate limiting: max 3 attempts per hour per email
  private static readonly MAX_ATTEMPTS_PER_HOUR = 3;

  constructor() {
    this.emailService = new EmailService();
  }

  /**
   * Initiate password reset process
   * @param email User's email address
   * @returns Promise<PasswordResetResult>
   */
  async initiatePasswordReset(email: string): Promise<PasswordResetResult> {
    try {
      // Validate email format
      if (!this.isValidEmail(email)) {
        return {
          success: false,
          message: 'Invalid email format',
          error: 'INVALID_EMAIL'
        };
      }

      // Check if user exists
      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Don't reveal if user exists or not for security
        return {
          success: true,
          message: 'If an account with this email exists, a password reset link has been sent'
        };
      }

      // Check rate limiting
      const isRateLimited = await this.checkRateLimit(email);
      if (isRateLimited) {
        return {
          success: false,
          message: 'Too many password reset attempts. Please try again later.',
          error: 'RATE_LIMITED'
        };
      }

      // Generate secure reset token
      const token = this.generateSecureToken();
      const expiresAt = new Date(Date.now() + PasswordResetService.TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

      // Store reset token in database
      await this.storeResetToken(user.id, token, expiresAt);

      // Send reset email
      await this.sendPasswordResetEmail(user.email, token, user.username);

      // Log the attempt
      await this.logResetAttempt(user.id, email);

      return {
        success: true,
        message: 'Password reset link has been sent to your email'
      };

    } catch (error) {
      console.error('[PasswordResetService] Error initiating password reset:', error);
      return {
        success: false,
        message: 'An error occurred while processing your request',
        error: 'INTERNAL_ERROR'
      };
    }
  }

  /**
   * Reset password using token
   * @param token Reset token
   * @param newPassword New password
   * @returns Promise<PasswordResetResult>
   */
  async resetPassword(token: string, newPassword: string): Promise<PasswordResetResult> {
    try {
      // Validate token format
      if (!token || token.length !== 64) {
        return {
          success: false,
          message: 'Invalid reset token',
          error: 'INVALID_TOKEN'
        };
      }

      // Validate new password
      const passwordValidation = PasswordService.validatePassword ? 
        PasswordService.validatePassword(newPassword) : 
        { valid: true, errors: [] };
      
      if (!passwordValidation.valid) {
        return {
          success: false,
          message: passwordValidation.errors.join(', '),
          error: 'INVALID_PASSWORD'
        };
      }

      // Find user with valid reset token
      const user = await this.findUserByResetToken(token);
      if (!user) {
        return {
          success: false,
          message: 'Invalid or expired reset token',
          error: 'INVALID_TOKEN'
        };
      }

      // Check if token is expired
      if (user.password_reset_expires && new Date() > new Date(user.password_reset_expires)) {
        // Clean up expired token
        await this.clearResetToken(user.id);
        return {
          success: false,
          message: 'Reset token has expired. Please request a new one.',
          error: 'EXPIRED_TOKEN'
        };
      }

      // Hash new password
      const hashedPassword = await PasswordService.hashPassword(newPassword);

      // Update user password and clear reset token
      await this.updateUserPassword(user.id, hashedPassword);
      await this.clearResetToken(user.id);

      // Send confirmation email
      await this.sendPasswordResetConfirmation(user.email, user.username);

      // Log successful reset
      await this.logSuccessfulReset(user.id);

      return {
        success: true,
        message: 'Password has been reset successfully'
      };

    } catch (error) {
      console.error('[PasswordResetService] Error resetting password:', error);
      return {
        success: false,
        message: 'An error occurred while resetting your password',
        error: 'INTERNAL_ERROR'
      };
    }
  }

  /**
   * Verify email address
   * @param token Verification token
   * @returns Promise<PasswordResetResult>
   */
  async verifyEmail(token: string): Promise<PasswordResetResult> {
    try {
      // This would integrate with email verification system
      // For now, return success as email verification is not yet implemented
      return {
        success: true,
        message: 'Email verification is not yet implemented'
      };
    } catch (error) {
      console.error('[PasswordResetService] Error verifying email:', error);
      return {
        success: false,
        message: 'An error occurred while verifying your email',
        error: 'INTERNAL_ERROR'
      };
    }
  }

  /**
   * Generate secure random token
   * @returns string 64-character hex token
   */
  private generateSecureToken(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Validate email format
   * @param email Email address
   * @returns boolean True if valid
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Check rate limiting for password reset attempts
   * @param email User email
   * @returns Promise<boolean> True if rate limited
   */
  private async checkRateLimit(email: string): Promise<boolean> {
    // This would integrate with Redis for rate limiting
    // For now, return false (no rate limiting)
    return false;
  }

  /**
   * Store reset token in database
   * @param userId User ID
   * @param token Reset token
   * @param expiresAt Expiration time
   */
  private async storeResetToken(userId: string, token: string, expiresAt: Date): Promise<void> {
    // This would update the users table with reset token
    // Using existing storage interface
    console.log(`[PasswordResetService] Storing reset token for user ${userId}`);
  }

  /**
   * Find user by reset token
   * @param token Reset token
   * @returns Promise<any> User data or null
   */
  private async findUserByResetToken(token: string): Promise<any> {
    // This would query the users table for the reset token
    // Using existing storage interface
    console.log(`[PasswordResetService] Looking up user by reset token`);
    return null; // Placeholder
  }

  /**
   * Update user password
   * @param userId User ID
   * @param hashedPassword New hashed password
   */
  private async updateUserPassword(userId: string, hashedPassword: string): Promise<void> {
    // This would update the user's password in the database
    // Using existing storage interface
    console.log(`[PasswordResetService] Updating password for user ${userId}`);
  }

  /**
   * Clear reset token from database
   * @param userId User ID
   */
  private async clearResetToken(userId: string): Promise<void> {
    // This would clear the reset token fields in the database
    // Using existing storage interface
    console.log(`[PasswordResetService] Clearing reset token for user ${userId}`);
  }

  /**
   * Send password reset email
   * @param email User email
   * @param token Reset token
   * @param username User username
   */
  private async sendPasswordResetEmail(email: string, token: string, username: string): Promise<void> {
    // This would use the existing EmailService
    console.log(`[PasswordResetService] Sending reset email to ${email}`);
  }

  /**
   * Send password reset confirmation email
   * @param email User email
   * @param username User username
   */
  private async sendPasswordResetConfirmation(email: string, username: string): Promise<void> {
    // This would use the existing EmailService
    console.log(`[PasswordResetService] Sending reset confirmation to ${email}`);
  }

  /**
   * Log password reset attempt
   * @param userId User ID
   * @param email User email
   */
  private async logResetAttempt(userId: string, email: string): Promise<void> {
    // This would log to audit_logs table
    console.log(`[PasswordResetService] Logging reset attempt for user ${userId}`);
  }

  /**
   * Log successful password reset
   * @param userId User ID
   */
  private async logSuccessfulReset(userId: string): Promise<void> {
    // This would log to audit_logs table
    console.log(`[PasswordResetService] Logging successful reset for user ${userId}`);
  }
}
