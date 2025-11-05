/**
 * SSE Bus - Cross-process Redis Pub/Sub for SSE
 */

import Redis from 'ioredis';
import { SSEManager } from './sseManager';

let sub: Redis | null = null;
const SAFE_MODE = process.env.SAFE_MODE === '1';

export function initSSEBus() {
  if (SAFE_MODE) return null;
  if (sub) return sub;
  
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
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
      // Suppress timeout errors - they're common with cloud Redis
      const errorMessage = (e as Error).message?.toLowerCase() || '';
      if (!errorMessage.includes('timeout') && !errorMessage.includes('etimedout')) {
        console.warn('[SSEBus] Redis error:', e);
      }
    });
    
    console.log('[SSEBus] Redis Pub/Sub initialized');
    return sub;
  } catch (err: any) {
    console.warn('[SSEBus] Could not connect to Redis, Pub/Sub disabled:', err.message);
    return null;
  }
}

export function shutdownSSEBus() {
  if (sub) {
    sub.quit();
    sub = null;
  }
}

