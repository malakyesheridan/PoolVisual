/**
 * Email Verification Service
 * 
 * Handles email verification for user accounts
 * Similar pattern to PasswordResetService
 */

import { randomBytes } from 'crypto';
import { storage } from '../storage.js';
import { Resend } from 'resend';

export interface EmailVerificationResult {
  success: boolean;
  message: string;
  error?: string;
}

export class EmailVerificationService {
  private resend: Resend | null;
  private fromEmail: string;
  private static readonly TOKEN_EXPIRY_HOURS = 24;
  private static readonly RATE_LIMIT_WINDOW_MINUTES = 60;
  private static readonly MAX_ATTEMPTS_PER_WINDOW = 3;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn('[EmailVerificationService] RESEND_API_KEY not found, email functionality will be disabled');
      this.resend = null;
    } else {
      this.resend = new Resend(apiKey);
    }
    this.fromEmail = process.env.FROM_EMAIL || 'noreply@easyflow.studio';
  }

  /**
   * Generate a secure verification token
   */
  private generateSecureToken(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Check if email is valid format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Check rate limiting for verification emails
   */
  private async checkRateLimit(email: string): Promise<boolean> {
    try {
      // Get recent verification tokens for this email
      const recentTokens = await storage.getVerificationTokensForIdentifier(email);
      const windowStart = new Date(Date.now() - EmailVerificationService.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000);
      
      const recentCount = recentTokens.filter(token => 
        new Date(token.createdAt) > windowStart
      ).length;

      return recentCount >= EmailVerificationService.MAX_ATTEMPTS_PER_WINDOW;
    } catch (error) {
      console.error('[EmailVerificationService] Error checking rate limit:', error);
      return false; // Fail open to avoid blocking legitimate users
    }
  }

  /**
   * Send verification email
   */
  private async sendVerificationEmail(email: string, token: string, username: string): Promise<void> {
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5001'}/verify-email?token=${token}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your Email - EasyFlow Studio</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #fafafa; border-radius: 8px; padding: 30px; margin: 20px 0;">
            <h1 style="color: #000; margin-top: 0;">Verify Your Email Address</h1>
            <p>Hi ${username},</p>
            <p>Thank you for signing up for EasyFlow Studio! Please verify your email address by clicking the button below:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">Verify Email Address</a>
            </div>
            <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
            <p style="color: #666; font-size: 12px; word-break: break-all;">${verificationUrl}</p>
            <p style="color: #666; font-size: 14px; margin-top: 30px;">This link will expire in 24 hours.</p>
            <p style="color: #666; font-size: 14px;">If you didn't create an account, you can safely ignore this email.</p>
          </div>
          <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">© ${new Date().getFullYear()} EasyFlow Studio. All rights reserved.</p>
        </body>
      </html>
    `;

    if (!this.resend) {
      throw new Error('Email service not configured - RESEND_API_KEY is missing');
    }

    await this.resend.emails.send({
      from: this.fromEmail,
      to: email,
      subject: 'Verify Your Email - EasyFlow Studio',
      html,
    });
  }

  /**
   * Send verification email to user
   */
  async sendVerificationEmailToUser(userId: string): Promise<EmailVerificationResult> {
    try {
      const user = await storage.getUser(userId);
      if (!user) {
        return {
          success: false,
          message: 'User not found',
          error: 'USER_NOT_FOUND'
        };
      }

      if (user.emailVerified) {
        return {
          success: false,
          message: 'Email is already verified',
          error: 'ALREADY_VERIFIED'
        };
      }

      // Check rate limiting
      const isRateLimited = await this.checkRateLimit(user.email);
      if (isRateLimited) {
        return {
          success: false,
          message: 'Too many verification email attempts. Please try again later.',
          error: 'RATE_LIMITED'
        };
      }

      // Generate token
      const token = this.generateSecureToken();
      const expiresAt = new Date(Date.now() + EmailVerificationService.TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

      // Store token
      await storage.createVerificationToken({
        identifier: user.email,
        token,
        expires: expiresAt
      });

      // Send email
      await this.sendVerificationEmail(user.email, token, user.username || user.email);

      return {
        success: true,
        message: 'Verification email sent successfully'
      };
    } catch (error) {
      console.error('[EmailVerificationService] Error sending verification email:', error);
      return {
        success: false,
        message: 'Failed to send verification email',
        error: 'INTERNAL_ERROR'
      };
    }
  }

  /**
   * Verify email using token
   */
  async verifyEmail(token: string): Promise<EmailVerificationResult> {
    try {
      if (!token) {
        return {
          success: false,
          message: 'Verification token is required',
          error: 'MISSING_TOKEN'
        };
      }

      // Get token from database
      const tokenData = await storage.getVerificationToken(token);
      if (!tokenData) {
        return {
          success: false,
          message: 'Invalid or expired verification token',
          error: 'INVALID_TOKEN'
        };
      }

      // Check if token is expired
      if (new Date() > new Date(tokenData.expires)) {
        await storage.deleteVerificationToken(token);
        return {
          success: false,
          message: 'Verification token has expired',
          error: 'EXPIRED_TOKEN'
        };
      }

      // Find user by email
      const user = await storage.getUserByEmail(tokenData.identifier);
      if (!user) {
        return {
          success: false,
          message: 'User not found',
          error: 'USER_NOT_FOUND'
        };
      }

      // Update user as verified
      await storage.updateUser(user.id, {
        emailVerified: true,
        emailVerifiedAt: new Date()
      });

      // Delete used token
      await storage.deleteVerificationToken(token);

      // Log security event
      try {
        await storage.createSecurityEvent({
          userId: user.id,
          eventType: 'email_verified',
          ipAddress: undefined, // Not available in this context
          userAgent: undefined,
        });
      } catch (logError) {
        console.warn('[EmailVerificationService] Failed to log security event:', logError);
      }

      return {
        success: true,
        message: 'Email verified successfully'
      };
    } catch (error) {
      console.error('[EmailVerificationService] Error verifying email:', error);
      return {
        success: false,
        message: 'Failed to verify email',
        error: 'INTERNAL_ERROR'
      };
    }
  }
}

