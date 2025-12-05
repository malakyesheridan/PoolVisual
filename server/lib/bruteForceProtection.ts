/**
 * Brute Force Protection Service
 * 
 * Provides rate limiting and brute force protection using existing Redis infrastructure
 * Integrates with existing authentication system without modifying existing code
 */

// Guarded import - only load Redis if enabled
// Redis will be imported dynamically when needed

export interface BruteForceConfig {
  maxAttempts: number;
  windowMs: number;
  blockDurationMs: number;
}

export interface AttemptResult {
  allowed: boolean;
  remainingAttempts: number;
  resetTime?: Date;
  blockExpiry?: Date;
}

export class BruteForceProtection {
  private redis: any;
  private config: BruteForceConfig;

  constructor(config?: Partial<BruteForceConfig>) {
    // Use existing Redis URL from environment
    // Check if Redis is configured - if not, disable brute force protection gracefully
    const redisUrl = process.env.REDIS_URL;
    
    // Initialize Redis lazily if enabled and URL is provided
    this.redis = null;
    if (redisUrl && process.env.REDIS_ENABLED === 'true' && process.env.BRUTE_FORCE_PROTECTION_ENABLED === 'true') {
      this.initializeRedis(redisUrl).catch((error) => {
        console.warn('[BruteForceProtection] Redis initialization failed, using no-op mode:', error.message);
        this.redis = null;
      });
    } else {
      if (!redisUrl) {
        console.log('[BruteForceProtection] REDIS_URL not configured, running in no-op mode (brute force protection disabled)');
      } else {
        console.log('[BruteForceProtection] REDIS_ENABLED or BRUTE_FORCE_PROTECTION_ENABLED not set, running in no-op mode');
      }
    }

    // Default configuration
    this.config = {
      maxAttempts: 5,           // Max attempts per window
      windowMs: 15 * 60 * 1000, // 15 minutes window
      blockDurationMs: 60 * 60 * 1000, // 1 hour block
      ...config
    };
  }

  /**
   * Check if an action is allowed for a given identifier
   * @param identifier Unique identifier (IP, email, user ID)
   * @param action Action type (login, password_reset, etc.)
   * @returns Promise<AttemptResult>
   */
  async checkAttempt(identifier: string, action: string = 'default'): Promise<AttemptResult> {
    try {
      // No-op mode: always allow
      if (!this.redis) {
        return { allowed: true, remainingAttempts: 999, resetTime: new Date() };
      }
      
      const key = this.getKey(identifier, action);
      
      // Check if currently blocked
      const blockKey = this.getBlockKey(identifier, action);
      let blockExpiry: string | null = null;
      let attempts: string | null = null;
      
      try {
        blockExpiry = await Promise.race([
          this.redis.get(blockKey),
          new Promise<null>((_, reject) => 
            setTimeout(() => reject(new Error('Redis get timeout')), 5000)
          )
        ]) as string | null;
      } catch (error: any) {
        // On Redis error, allow the request (fail open)
        if (error?.message?.includes('timeout') || error?.code === 'ETIMEDOUT' || error?.code === 'ECONNREFUSED') {
          console.warn('[BruteForceProtection] Redis timeout (non-fatal), allowing request');
        }
        return { allowed: true, remainingAttempts: this.config.maxAttempts };
      }
      
      if (blockExpiry) {
        return {
          allowed: false,
          remainingAttempts: 0,
          blockExpiry: new Date(parseInt(blockExpiry))
        };
      }

      // Get current attempt count
      try {
        attempts = await Promise.race([
          this.redis.get(key),
          new Promise<null>((_, reject) => 
            setTimeout(() => reject(new Error('Redis get timeout')), 5000)
          )
        ]) as string | null;
      } catch (error: any) {
        // On Redis error, allow the request (fail open)
        if (error?.message?.includes('timeout') || error?.code === 'ETIMEDOUT' || error?.code === 'ECONNREFUSED') {
          console.warn('[BruteForceProtection] Redis timeout (non-fatal), allowing request');
        }
        return { allowed: true, remainingAttempts: this.config.maxAttempts };
      }
      
      const attemptCount = attempts ? parseInt(attempts) : 0;

      // Check if max attempts reached
      if (attemptCount >= this.config.maxAttempts) {
        // Block the identifier
        await this.blockIdentifier(identifier, action);
        
        return {
          allowed: false,
          remainingAttempts: 0,
          blockExpiry: new Date(Date.now() + this.config.blockDurationMs)
        };
      }

      return {
        allowed: true,
        remainingAttempts: this.config.maxAttempts - attemptCount - 1,
        resetTime: new Date(Date.now() + this.config.windowMs)
      };

    } catch (error) {
      console.error('[BruteForceProtection] Error checking attempt:', error);
      // Fail open - allow the attempt if Redis is unavailable
      return {
        allowed: true,
        remainingAttempts: this.config.maxAttempts
      };
    }
  }

  /**
   * Record a failed attempt
   * @param identifier Unique identifier
   * @param action Action type
   * @returns Promise<void>
   */
  async recordFailedAttempt(identifier: string, action: string = 'default'): Promise<void> {
    try {
      const key = this.getKey(identifier, action);
      
      // Increment attempt count
      const attempts = await this.redis.incr(key);
      
      // Set expiration on first attempt
      if (attempts === 1) {
        await this.redis.expire(key, Math.ceil(this.config.windowMs / 1000));
      }

      // Log the attempt
      await this.logAttempt(identifier, action, 'failed', attempts);

    } catch (error) {
      console.error('[BruteForceProtection] Error recording failed attempt:', error);
    }
  }

  /**
   * Record a successful attempt and clear failed attempts
   * @param identifier Unique identifier
   * @param action Action type
   * @returns Promise<void>
   */
  async recordSuccessfulAttempt(identifier: string, action: string = 'default'): Promise<void> {
    try {
      const key = this.getKey(identifier, action);
      const blockKey = this.getBlockKey(identifier, action);
      
      // Clear attempt count and block
      await this.redis.del(key);
      await this.redis.del(blockKey);

      // Log the successful attempt
      await this.logAttempt(identifier, action, 'success', 0);

    } catch (error) {
      console.error('[BruteForceProtection] Error recording successful attempt:', error);
    }
  }

  /**
   * Manually block an identifier
   * @param identifier Unique identifier
   * @param action Action type
   * @param durationMs Block duration in milliseconds
   * @returns Promise<void>
   */
  async blockIdentifier(identifier: string, action: string = 'default', durationMs?: number): Promise<void> {
    try {
      const blockKey = this.getBlockKey(identifier, action);
      const duration = durationMs || this.config.blockDurationMs;
      
      await this.redis.setex(blockKey, Math.ceil(duration / 1000), Date.now().toString());
      
      console.log(`[BruteForceProtection] Blocked ${identifier} for ${action} until ${new Date(Date.now() + duration)}`);

    } catch (error) {
      console.error('[BruteForceProtection] Error blocking identifier:', error);
    }
  }

  /**
   * Unblock an identifier
   * @param identifier Unique identifier
   * @param action Action type
   * @returns Promise<void>
   */
  async unblockIdentifier(identifier: string, action: string = 'default'): Promise<void> {
    try {
      const blockKey = this.getBlockKey(identifier, action);
      const attemptKey = this.getKey(identifier, action);
      
      await this.redis.del(blockKey);
      await this.redis.del(attemptKey);
      
      console.log(`[BruteForceProtection] Unblocked ${identifier} for ${action}`);

    } catch (error) {
      console.error('[BruteForceProtection] Error unblocking identifier:', error);
    }
  }

  /**
   * Get attempt statistics for an identifier
   * @param identifier Unique identifier
   * @param action Action type
   * @returns Promise<{ attempts: number; blocked: boolean; blockExpiry?: Date }>
   */
  async getAttemptStats(identifier: string, action: string = 'default'): Promise<{
    attempts: number;
    blocked: boolean;
    blockExpiry?: Date;
  }> {
    try {
      const key = this.getKey(identifier, action);
      const blockKey = this.getBlockKey(identifier, action);
      
      const attempts = await this.redis.get(key);
      const blockExpiry = await this.redis.get(blockKey);
      
      return {
        attempts: attempts ? parseInt(attempts) : 0,
        blocked: !!blockExpiry,
        blockExpiry: blockExpiry ? new Date(parseInt(blockExpiry)) : undefined
      };

    } catch (error) {
      console.error('[BruteForceProtection] Error getting attempt stats:', error);
      return {
        attempts: 0,
        blocked: false
      };
    }
  }

  /**
   * Clean up expired entries (should be called periodically)
   * @returns Promise<number> Number of entries cleaned up
   */
  async cleanupExpiredEntries(): Promise<number> {
    try {
      // Redis automatically expires keys, but we can clean up manually if needed
      const pattern = 'brute_force:*';
      const keys = await this.redis.keys(pattern);
      
      let cleaned = 0;
      for (const key of keys) {
        const ttl = await this.redis.ttl(key);
        if (ttl === -1) {
          // Key exists but has no expiration, clean it up
          await this.redis.del(key);
          cleaned++;
        }
      }
      
      return cleaned;

    } catch (error) {
      console.error('[BruteForceProtection] Error cleaning up expired entries:', error);
      return 0;
    }
  }

  /**
   * Initialize Redis connection
   * @param redisUrl Redis connection URL
   */
  private async initializeRedis(redisUrl: string): Promise<void> {
    try {
      const RedisModule = await import('ioredis');
      const Redis = RedisModule.default || RedisModule;
      this.redis = new Redis(redisUrl, {
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        connectTimeout: 5000,
        commandTimeout: 5000,
      });
      
      // Handle Redis connection errors gracefully - never crash
      this.redis.on('error', (error: Error) => {
        const errorMessage = error.message?.toLowerCase() || '';
        if (errorMessage.includes('econnrefused') || errorMessage.includes('connect')) {
          console.warn('[BruteForceProtection] Redis connection error (non-fatal):', errorMessage);
        } else if (errorMessage.includes('timeout') || errorMessage.includes('etimedout')) {
          // Suppress timeout errors - they're common with cloud Redis
          // Don't log these as they're expected
        } else {
          console.warn('[BruteForceProtection] Redis error (non-fatal):', errorMessage);
        }
        // Never throw or exit - just log and continue in no-op mode
      });
      
      // Attempt to connect, but don't fail if it doesn't work
      try {
        await this.redis.connect();
      } catch (connectErr: any) {
        console.warn('[BruteForceProtection] Redis connection failed (non-fatal), using no-op mode:', connectErr.message);
        this.redis = null;
      }
    } catch (error: any) {
      console.warn('[BruteForceProtection] Redis not available, using no-op mode:', error.message);
      this.redis = null;
    }
  }

  /**
   * Get Redis key for attempts
   * @param identifier Unique identifier
   * @param action Action type
   * @returns string Redis key
   */
  private getKey(identifier: string, action: string): string {
    return `brute_force:attempts:${action}:${identifier}`;
  }

  /**
   * Get Redis key for blocks
   * @param identifier Unique identifier
   * @param action Action type
   * @returns string Redis key
   */
  private getBlockKey(identifier: string, action: string): string {
    return `brute_force:block:${action}:${identifier}`;
  }

  /**
   * Log attempt for audit purposes
   * @param identifier Unique identifier
   * @param action Action type
   * @param result Attempt result
   * @param attemptCount Current attempt count
   */
  private async logAttempt(identifier: string, action: string, result: string, attemptCount: number): Promise<void> {
    try {
      // This would integrate with existing audit logging system
      console.log(`[BruteForceProtection] ${result} attempt for ${identifier} (${action}) - count: ${attemptCount}`);
    } catch (error) {
      console.error('[BruteForceProtection] Error logging attempt:', error);
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    try {
      await this.redis.quit();
    } catch (error) {
      console.error('[BruteForceProtection] Error closing Redis connection:', error);
    }
  }
}

/**
 * Middleware factory for Express.js
 * Creates middleware that can be used with existing auth routes
 */
export function createBruteForceMiddleware(config?: Partial<BruteForceConfig>) {
  const protection = new BruteForceProtection(config);

  return (action: string = 'default') => {
    return async (req: any, res: any, next: any) => {
      try {
        // Get identifier (IP address or user ID)
        const identifier = req.ip || req.user?.id || 'unknown';
        
        // Check if attempt is allowed
        const result = await protection.checkAttempt(identifier, action);
        
        if (!result.allowed) {
          return res.status(429).json({
            ok: false,
            error: 'Too many attempts',
            message: 'Too many failed attempts. Please try again later.',
            retryAfter: result.blockExpiry ? Math.ceil((result.blockExpiry.getTime() - Date.now()) / 1000) : undefined
          });
        }

        // Add attempt info to request
        req.bruteForce = {
          remainingAttempts: result.remainingAttempts,
          resetTime: result.resetTime
        };

        // Add methods to record attempts
        req.recordFailedAttempt = () => protection.recordFailedAttempt(identifier, action);
        req.recordSuccessfulAttempt = () => protection.recordSuccessfulAttempt(identifier, action);

        next();

      } catch (error) {
        console.error('[BruteForceMiddleware] Error:', error);
        // Fail open - allow the request if protection fails
        next();
      }
    };
  };
}
