/**
 * SSE Bus - Cross-process Redis Pub/Sub for SSE
 */

import { SSEManager } from './sseManager.js';

let sub: any = null;
const SAFE_MODE = process.env.SAFE_MODE === '1';

export async function initSSEBus() {
  if (SAFE_MODE) return null;
  if (sub) return sub;
  
  // Check if Redis is configured - if not, disable SSE Bus gracefully
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.warn('[SSEBus] REDIS_URL not configured, SSE Bus disabled (Pub/Sub features will be unavailable)');
    return null;
  }
  
  try {
    // Lazy import to avoid Redis connection on module load
    const RedisModule = await import('ioredis');
    const Redis = RedisModule.default || RedisModule;
    const isTLS = redisUrl.startsWith('rediss://');
    
    // Connection options optimized for Upstash Redis
    const connectionOptions: any = {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      connectTimeout: 10000,
      commandTimeout: 5000,
      keepAlive: 30000,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 5000);
        return delay;
      },
      reconnectOnError: (err: Error) => {
        const errorMessage = err.message.toLowerCase();
        if (errorMessage.includes('timeout') || 
            errorMessage.includes('etimedout') ||
            errorMessage.includes('econnrefused') ||
            errorMessage.includes('enotfound')) {
          return true;
        }
        return false;
      }
    };
    
    if (isTLS) {
      connectionOptions.tls = {};
    }
    
    sub = new Redis(redisUrl, connectionOptions);
    
    sub.psubscribe('enhancement:*');
    
    sub.on('pmessage', (_pat, channel, message) => {
      const jobId = channel.split(':')[1];
      if (!jobId) return;
      
      try {
        SSEManager.emit(jobId, JSON.parse(message));
      } catch (error) {
        // Ignore parse errors
      }
    });
    
    sub.on('error', (e) => {
      // Handle all Redis errors gracefully - log as warning, don't crash
      const errorMessage = (e as Error).message?.toLowerCase() || '';
      if (errorMessage.includes('econnrefused') || errorMessage.includes('connect')) {
        console.warn('[SSEBus] Redis connection error (non-fatal):', errorMessage);
      } else if (errorMessage.includes('timeout') || errorMessage.includes('etimedout')) {
        // Suppress timeout errors - they're common with cloud Redis
        // Don't log these as they're expected
      } else {
        console.warn('[SSEBus] Redis error (non-fatal):', errorMessage);
      }
      // Never throw or exit - just log and continue
    });
    
    sub.on('connect', () => {
      console.log('[SSEBus] Redis Pub/Sub connected');
    });
    
    // Attempt to connect, but don't fail if it doesn't work
    try {
      await sub.connect();
      sub.psubscribe('enhancement:*');
      console.log('[SSEBus] Redis Pub/Sub initialized');
    } catch (connectErr: any) {
      console.warn('[SSEBus] Redis connection failed (non-fatal), Pub/Sub disabled:', connectErr.message);
      // Don't throw - just return null to indicate SSE Bus is unavailable
      sub = null;
      return null;
    }
    
    return sub;
  } catch (err: any) {
    console.warn('[SSEBus] Could not initialize Redis, Pub/Sub disabled (non-fatal):', err.message);
    sub = null;
    return null;
  }
}

export function shutdownSSEBus() {
  if (sub) {
    sub.quit();
    sub = null;
  }
}

