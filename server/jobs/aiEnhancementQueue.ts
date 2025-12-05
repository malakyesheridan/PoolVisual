/**
 * Enhancement Queue - BullMQ setup
 */

import { Queue, Job } from 'bullmq';
import IORedis from 'ioredis';

let connection: IORedis | null = null;
let enhancementQueue: Queue | null = null;
const SAFE_MODE = process.env.SAFE_MODE === '1';

// Mock processing function for SAFE_MODE
async function mockProcessEnhance(data: any) {
  const { getProvider } = await import('./enhancementProviders.js');
  const { SSEManager } = await import('../lib/sseManager.js');
  const { executeQuery } = await import('../lib/dbHelpers.js');
  const jobId = data.jobId;

  try {
    await executeQuery(`UPDATE ai_enhancement_jobs SET status='rendering', progress_stage='rendering', updated_at=NOW() WHERE id=$1`, [jobId]);
    SSEManager.emit(jobId, { 
      id: `event-${jobId}-${Date.now()}-${Math.random()}`,
      status: 'rendering', 
      progress: 40,
      timestamp: new Date().toISOString()
    });

    const prov = getProvider(process.env.TEST_PROVIDER || 'mock:inpaint');
    const result = await prov.submit(data, {
      onProgress: (p) => SSEManager.emit(jobId, { 
        id: `event-${jobId}-${Date.now()}-${Math.random()}`,
        status: 'rendering', 
        progress: Math.max(40, Math.min(95, p)),
        timestamp: new Date().toISOString()
      })
    });

    await executeQuery(
      `UPDATE ai_enhancement_jobs SET status='completed', progress_percent=100, cost_micros=$2, completed_at=NOW(), updated_at=NOW() WHERE id=$1`,
      [jobId, result.costMicros || 0]
    );
    SSEManager.emit(jobId, { 
      id: `event-${jobId}-${Date.now()}-${Math.random()}`,
      status: 'completed', 
      progress: 100,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    await executeQuery(`UPDATE ai_enhancement_jobs SET status='failed', error_message=$2, updated_at=NOW() WHERE id=$1`, [jobId, err?.message || 'mock_failed']);
    SSEManager.emit(jobId, { 
      id: `event-${jobId}-${Date.now()}-${Math.random()}`,
      status: 'failed', 
      error: err?.message,
      timestamp: new Date().toISOString()
    });
  }
}

if (SAFE_MODE) {
  // In-memory mock queue
  enhancementQueue = {
    add: async (_name: string, data: any) => {
      process.nextTick(() => mockProcessEnhance(data));
      return { id: data.jobId } as any;
    },
    getJob: async () => null,
    close: async () => {}
  } as any;
  console.log('[Queue] Using mock queue (SAFE_MODE)');
} else {
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
    
    connection = new IORedis(redisUrl, connectionOptions);
    connection.on('error', (err: Error) => {
      // Handle all Redis errors gracefully - log as warning, don't crash
      const errorMessage = err.message?.toLowerCase() || '';
      if (errorMessage.includes('econnrefused') || errorMessage.includes('connect')) {
        console.warn('[Redis] Connection error (non-fatal):', errorMessage);
      } else if (errorMessage.includes('timeout') || errorMessage.includes('etimedout')) {
        // Suppress timeout errors - they're common with cloud Redis
        // Don't log these as they're expected
      } else {
        console.warn('[Redis] Error (non-fatal):', errorMessage);
      }
      // Never throw or exit - just log and continue
    });
    
    // Attempt to connect, but don't fail if it doesn't work
    try {
      await connection.connect();
      enhancementQueue = new Queue('enhancement', { connection });
      console.log('[Redis] Connected to queue');
    } catch (connectErr: any) {
      console.warn('[Redis] Connection failed (non-fatal), queue disabled:', connectErr.message);
      connection = null;
      enhancementQueue = null;
    }
  } catch (err: any) {
    console.warn('[Redis] Could not initialize queue (non-fatal), queue disabled:', err.message);
    connection = null;
    enhancementQueue = null;
  }
}

export { enhancementQueue };

export interface EnhancementJobData {
  jobId: string;
  tenantId: string;
  userId: string;
  photoId: string;
  imageUrl: string;
  inputHash: string;
  masks: any[];
  options: Record<string, any>;
  calibration?: number;
  provider: string;
  model: string;
}

