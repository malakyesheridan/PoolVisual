/**
 * Unified Password Service
 * 
 * Standardizes password hashing across the application
 * Ensures consistent bcrypt rounds and provides centralized password management
 */

import * as bcrypt from 'bcryptjs';

export class PasswordService {
  /**
   * Standardized bcrypt rounds for production security
   * Using 12 rounds as recommended for production applications
   */
  private static readonly ROUNDS = 12;

  /**
   * Hash a password with standardized rounds
   * @param password Plain text password
   * @returns Promise<string> Hashed password
   */
  static async hashPassword(password: string): Promise<string> {
    if (!password || password.length === 0) {
      throw new Error('Password cannot be empty');
    }
    
    if (password.length < 12) {
      throw new Error('Password must be at least 12 characters long');
    }

    return bcrypt.hash(password, this.ROUNDS);
  }

  /**
   * Verify a password against its hash
   * @param password Plain text password
   * @param hash Stored password hash
   * @returns Promise<boolean> True if password matches
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    if (!password || !hash) {
      return false;
    }

    return bcrypt.compare(password, hash);
  }

  /**
   * Check if a password needs rehashing (e.g., if it was hashed with fewer rounds)
   * @param hash Stored password hash
   * @returns boolean True if password should be rehashed
   */
  static needsRehash(hash: string): boolean {
    // Extract rounds from bcrypt hash
    const rounds = parseInt(hash.split('$')[2]);
    return rounds < this.ROUNDS;
  }

  /**
   * Get the current bcrypt rounds configuration
   * @returns number Current rounds setting
   */
  static getRounds(): number {
    return this.ROUNDS;
  }
}

/**
 * Password validation utilities
 */
export class PasswordValidator {
  /**
   * Validate password strength
   * @param password Plain text password
   * @returns { valid: boolean; errors: string[] }
   */
  static validate(password: string): { valid: boolean; errors: string[]; strength?: 'weak' | 'medium' | 'strong' } {
    const errors: string[] = [];

    if (!password) {
      errors.push('Password is required');
      return { valid: false, errors };
    }

    // Minimum 12 characters (industry standard)
    if (password.length < 12) {
      errors.push('Password must be at least 12 characters long');
    }

    if (password.length > 128) {
      errors.push('Password must be less than 128 characters');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[^a-zA-Z0-9]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    // Check for common/weak passwords
    if (this.isWeakPassword(password)) {
      errors.push('Password is too common or weak. Please choose a stronger password.');
    }

    // Calculate strength
    let strength: 'weak' | 'medium' | 'strong' = 'weak';
    if (errors.length === 0) {
      if (password.length >= 16 && /[^a-zA-Z0-9]/.test(password)) {
        strength = 'strong';
      } else if (password.length >= 12) {
        strength = 'medium';
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      strength
    };
  }

  /**
   * Check if password is common/weak
   * @param password Plain text password
   * @returns boolean True if password is weak
   */
  static isWeakPassword(password: string): boolean {
    const commonPasswords = [
      'password', '123456', 'password123', 'admin', 'qwerty',
      'letmein', 'welcome', 'monkey', '1234567890', 'abc123'
    ];

    return commonPasswords.includes(password.toLowerCase());
  }
}
