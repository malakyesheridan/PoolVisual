/**
 * Enhancement Worker - Processes enhancement jobs from queue
 * Rock-solid for Upstash Redis with TLS
 */

import '../bootstrapEnv.js';
import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { enhancementQueue, EnhancementJobData } from './aiEnhancementQueue.js';
import { executeQuery } from '../lib/dbHelpers';
import { SSEManager } from '../lib/sseManager';
import { getProvider } from './enhancementProviders.js';
import Redis from 'ioredis';

const SAFE_MODE = process.env.SAFE_MODE === '1';

let connection: IORedis | null = null;
let redis: Redis | null = null;
let enhancementWorker: Worker<EnhancementJobData> | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;

// Crash handlers for worker
process.on('uncaughtException', (e) => {
  console.error('[Worker fatal] uncaughtException:', e);
});
process.on('unhandledRejection', (e) => {
  console.error('[Worker fatal] unhandledRejection:', e);
});

async function startWorker() {
  if (SAFE_MODE) {
    console.log('[Worker] SAFE_MODE enabled, worker not started');
    return null;
  }

  if (!process.env.REDIS_URL) {
    console.error('[Worker] REDIS_URL not set, worker cannot start');
    return null;
  }

  try {
    console.log('[Worker] Starting...');
    
    // Parse Redis URL for TLS configuration
    const redisUrl = process.env.REDIS_URL;
    const isTLS = redisUrl.startsWith('rediss://');
    
    // Connection options optimized for Upstash Redis
    const connectionOptions: any = {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      connectTimeout: 10000, // 10 second connection timeout
      commandTimeout: 5000,  // 5 second command timeout
      keepAlive: 30000,      // Keep connection alive
      lazyConnect: false,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 5000);
        if (times > 10) {
          console.warn('[Worker] Redis retry limit reached, will continue trying');
        }
        return delay;
      },
      reconnectOnError: (err: Error) => {
        // Only reconnect on certain errors
        const errorMessage = err.message.toLowerCase();
        if (errorMessage.includes('econnrefused') || 
            errorMessage.includes('enotfound') ||
            errorMessage.includes('timeout') ||
            errorMessage.includes('etimedout')) {
          return true; // Reconnect
        }
        return false; // Don't reconnect for other errors
      }
    };

    // Add TLS if using rediss://
    if (isTLS) {
      connectionOptions.tls = {};
    }

    connection = new IORedis(redisUrl, connectionOptions);
    connection.on('connect', () => {
      console.log('[Worker] Redis connected');
    });
    connection.on('error', (err: Error) => {
      // Suppress timeout errors - they're common with cloud Redis
      const errorMessage = err.message.toLowerCase();
      if (errorMessage.includes('timeout') || errorMessage.includes('etimedout')) {
        // Timeout errors are expected with cloud Redis, log as debug only
        return;
      }
      console.warn('[Worker] Redis connection error:', err.message);
    });

    redis = new Redis(redisUrl, connectionOptions);
    redis.on('connect', () => {
      console.log('[Worker] Redis pub/sub connected');
    });
    redis.on('error', (err: Error) => {
      // Suppress timeout errors - they're common with cloud Redis
      const errorMessage = err.message.toLowerCase();
      if (errorMessage.includes('timeout') || errorMessage.includes('etimedout')) {
        // Timeout errors are expected with cloud Redis, log as debug only
        return;
      }
      console.warn('[Worker] Redis pub/sub error:', err.message);
    });

    enhancementWorker = new Worker<EnhancementJobData>(
      'enhancement',
      async (job: Job<EnhancementJobData>) => {
        const {
          jobId,
          tenantId,
          userId,
          photoId,
          imageUrl,
          inputHash,
          masks,
          options,
          calibration,
          provider,
          model
        } = job.data;

        console.log(`[Worker] Job received ${jobId}`);

        try {
          // Mark downloading
          await executeQuery(
            `UPDATE ai_enhancement_jobs SET status = 'downloading', progress_stage = 'downloading', updated_at = NOW() WHERE id = $1`,
            [jobId]
          );
          SSEManager.emit(jobId, { status: 'downloading', stage: 'downloading', progress: 5 });
          
          // Publish to Redis
          if (redis) redis.publish(`enhancement:${jobId}`, JSON.stringify({ status: 'downloading', stage: 'downloading', progress: 5 }));

          await executeQuery(
            `UPDATE ai_enhancement_jobs SET status = 'preprocessing', progress_stage = 'preprocessing', updated_at = NOW() WHERE id = $1`,
            [jobId]
          );
          SSEManager.emit(jobId, { status: 'preprocessing', stage: 'preprocessing', progress: 15 });
          if (redis) redis.publish(`enhancement:${jobId}`, JSON.stringify({ status: 'preprocessing', stage: 'preprocessing', progress: 15 }));

          // Build provider payload
          const payload = { imageUrl, masks, options, calibration, model };
          const prov = getProvider(provider || 'mock:inpaint');

          await executeQuery(
            `UPDATE ai_enhancement_jobs SET status = 'rendering', progress_stage = 'rendering', updated_at = NOW() WHERE id = $1`,
            [jobId]
          );
          SSEManager.emit(jobId, { status: 'rendering', stage: 'rendering', progress: 40 });
          if (redis) redis.publish(`enhancement:${jobId}`, JSON.stringify({ status: 'rendering', stage: 'rendering', progress: 40 }));

          // Submit to provider
          const result = await prov.submit(payload, {
            onProgress: (percent) => {
              const p = Math.max(40, Math.min(95, Math.round(40 + (percent * 0.6))));
              SSEManager.emit(jobId, { status: 'rendering', stage: 'rendering', progress: p });
              if (redis) redis.publish(`enhancement:${jobId}`, JSON.stringify({ status: 'rendering', stage: 'rendering', progress: p }));
            },
            timeout: 60000
          });

          // Persist provider job ref
          if (result.providerJobId) {
            await executeQuery(
              `UPDATE ai_enhancement_jobs SET job_ref = $1 WHERE id = $2 AND job_ref IS NULL`,
              [result.providerJobId, jobId]
            );
          }

          await executeQuery(
            `UPDATE ai_enhancement_jobs SET status = 'postprocessing', progress_stage = 'postprocessing', updated_at = NOW() WHERE id = $1`,
            [jobId]
          );
          SSEManager.emit(jobId, { status: 'postprocessing', stage: 'postprocessing', progress: 96 });
          if (redis) redis.publish(`enhancement:${jobId}`, JSON.stringify({ status: 'postprocessing', stage: 'postprocessing', progress: 96 }));

          // Persist variants
          if (Array.isArray(result.variants) && result.variants.length) {
            for (const v of result.variants) {
              await executeQuery(
                `INSERT INTO ai_enhancement_variants (job_id, output_url, rank) VALUES ($1, $2, $3)`,
                [jobId, v.url, 0]
              );
            }
          }

          // Mark uploading (required transition state)
          try {
            await executeQuery(
              `UPDATE ai_enhancement_jobs SET status = 'uploading', progress_stage = 'uploading', updated_at = NOW() WHERE id = $1`,
              [jobId]
            );
            SSEManager.emit(jobId, { status: 'uploading', stage: 'uploading', progress: 98 });
            if (redis) redis.publish(`enhancement:${jobId}`, JSON.stringify({ status: 'uploading', stage: 'uploading', progress: 98 }));

            // Small delay to ensure state machine processes the transition
            await new Promise(resolve => setTimeout(resolve, 100));

            // Mark completed
            await executeQuery(
              `UPDATE ai_enhancement_jobs 
               SET status = 'completed', progress_stage = 'completed', progress_percent = 100, cost_micros = $2, completed_at = NOW(), updated_at = NOW()
               WHERE id = $1`,
              [jobId, result.costMicros]
            );
            SSEManager.emit(jobId, { status: 'completed', stage: 'completed', progress: 100 });
            if (redis) redis.publish(`enhancement:${jobId}`, JSON.stringify({ status: 'completed', stage: 'completed', progress: 100 }));
          } catch (transitionErr: any) {
            // If state transition fails, log and mark as failed
            if (transitionErr.message?.includes('Invalid status transition') || transitionErr.message?.includes('enforce_enhancement_status_transition')) {
              console.error(`[Worker] State machine blocked transition for ${jobId}:`, transitionErr.message);
              await executeQuery(
                `UPDATE ai_enhancement_jobs SET status = 'failed', error_message = $2, updated_at = NOW() WHERE id = $1`,
                [jobId, `State transition error: ${transitionErr.message}`]
              );
              SSEManager.emit(jobId, { status: 'failed', error: transitionErr.message });
              throw transitionErr;
            }
            throw transitionErr;
          }

          console.log(`[Worker] Job completed ${jobId}`);
          return { ok: true };
        } catch (err: any) {
          console.error(`[Worker] Job error ${jobId}:`, err.message);
          throw err;
        }
      },
      { 
        connection, 
        concurrency: Number(process.env.JOB_CONCURRENCY || 4),
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 }
      }
    );

    enhancementWorker.on('failed', async (job, err) => {
      if (!job) return;
      console.error(`[Worker] Job failed ${job.data.jobId}`, err?.message);
      try {
        await executeQuery(
          `UPDATE ai_enhancement_jobs SET status = 'failed', progress_stage = 'failed', error_message = $2, updated_at = NOW() WHERE id = $1`,
          [job.data.jobId, err?.message || 'worker_failed']
        );
        SSEManager.emit(job.data.jobId, { status: 'failed', error: err?.message });
        if (redis) redis.publish(`enhancement:${job.data.jobId}`, JSON.stringify({ status: 'failed', error: err?.message }));
      } catch (error) {
        console.error('[Worker] Failed to update failed job:', error);
      }
    });

    enhancementWorker.on('active', (job) => {
      console.log(`[Worker] Job active ${job?.id}`);
    });

    enhancementWorker.on('completed', (job) => {
      console.log(`[Worker] Job completed event ${job?.id}`);
    });

    // Start heartbeat
    heartbeatInterval = setInterval(() => {
      console.log('[Worker] heartbeat');
    }, 30000);

    console.log('[Worker] Enhancement worker started successfully');
    return enhancementWorker;
  } catch (err: any) {
    console.error('[Worker] Failed to start worker:', err.message);
    console.error('[Worker] Stack:', err.stack);
    return null;
  }
}

// Auto-start if run directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.includes('worker.ts')) {
  startWorker().then(() => {
    console.log('[Worker] Running as standalone process');
  });
}

export { enhancementWorker, startWorker };
