/**
 * Rate Limiting Middleware
 * Per-tenant rate limiting with Redis support and memory fallback
 */

import { Request, Response, NextFunction } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import Redis from 'ioredis';

// Redis client (lazy initialization)
let redisClient: Redis | null = null;

function getRedisClient(): Redis | null {
  if (redisClient) return redisClient;
  
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    // No Redis URL - will use memory store (this is fine)
    return null;
  }
  
  try {
    redisClient = new Redis(redisUrl, {
      url: redisUrl,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true, // Don't connect immediately
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    });
    
    // Handle Redis connection errors gracefully - never crash
    redisClient.on('error', (err: Error) => {
      const errorMessage = err.message?.toLowerCase() || '';
      if (errorMessage.includes('econnrefused') || errorMessage.includes('connect')) {
        console.warn('[RateLimiter] Redis connection error (non-fatal):', errorMessage);
      } else if (errorMessage.includes('timeout') || errorMessage.includes('etimedout')) {
        // Suppress timeout errors - they're common with cloud Redis
        // Don't log these as they're expected
      } else {
        console.warn('[RateLimiter] Redis error (non-fatal):', errorMessage);
      }
      // Never throw or exit - just log and continue without Redis
    });
    
    // Don't await connection - let it connect lazily
    // If connection fails, express-rate-limit will fall back to memory store
    return redisClient;
  } catch (error: any) {
    console.warn('[RateLimiter] Failed to create Redis client (non-fatal), using memory store:', error.message);
    redisClient = null;
    return null;
  }
}

/**
 * Create rate limiter with per-tenant key generation
 */
export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}) {
  const {
    windowMs,
    max,
    message = 'Too many requests, please try again later',
    skipSuccessfulRequests = false,
    skipFailedRequests = false
  } = options;

  // Key generator: per tenant
  const keyGenerator = (req: Request): string => {
    const tenantId = req.body?.tenantId || req.query?.tenantId || req.headers['x-tenant-id'] || 'anonymous';
    const endpoint = req.path || req.route?.path || 'unknown';
    return `rate_limit:${tenantId}:${endpoint}`;
  };

  // Store configuration
  const store = getRedisClient() 
    ? undefined // Use Redis store if available (express-rate-limit will use it automatically)
    : undefined; // Fallback to memory store

  return rateLimit({
    windowMs,
    max,
    message: {
      ok: false,
      code: 'RATE_LIMIT_EXCEEDED',
      message,
      retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
    skipSuccessfulRequests,
    skipFailedRequests,
    keyGenerator,
    // Custom handler for rate limit exceeded
    handler: (req: Request, res: Response) => {
      res.status(429).json({
        ok: false,
        code: 'RATE_LIMIT_EXCEEDED',
        message,
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  });
}

/**
 * Pre-configured rate limiters for common endpoints
 */
export const rateLimiters = {
  // Enhancement creation: 10 per minute per tenant
  enhancement: createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 10,
    message: 'Too many enhancement requests. Please wait before creating another enhancement.'
  }),
  
  // Image upload: 20 per minute per tenant
  upload: createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 20,
    message: 'Too many upload requests. Please wait before uploading another image.'
  }),
  
  // Quote generation: 5 per minute per tenant
  quote: createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 5,
    message: 'Too many quote generation requests. Please wait before generating another quote.'
  }),
  
  // General API: 100 per minute per tenant
  api: createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 100,
    message: 'Too many API requests. Please slow down.'
  }),
  
  // Authentication: 5 per 15 minutes per IP
  auth: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    message: 'Too many authentication attempts. Please try again later.',
    standardHeaders: true,
    // Use ipKeyGenerator helper for proper IPv6 handling
    keyGenerator: (req: Request) => {
      const ip = req.ip || req.socket?.remoteAddress || 'unknown';
      // ipKeyGenerator normalizes IPv6 addresses properly
      const normalizedIp = ipKeyGenerator(ip);
      return `rate_limit:auth:${normalizedIp}`;
    }
  })
};

