/**
 * Trial Expiration Job
 * Scheduled job to expire trials that have passed 7 days
 * Should be run daily via cron or scheduled task
 */

import { trialService } from '../lib/trialService.js';
import { logger } from '../lib/logger.js';

/**
 * Process trial expirations
 * Call this from a cron job or scheduled task
 */
export async function runTrialExpirationJob(): Promise<void> {
  try {
    logger.info({
      msg: 'Starting trial expiration job',
      timestamp: new Date().toISOString(),
    });

    const expiredCount = await trialService.processTrialExpirations();

    logger.info({
      msg: 'Trial expiration job completed',
      expiredCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({
      msg: 'Trial expiration job failed',
      err: error,
      timestamp: new Date().toISOString(),
    });
    throw error;
  }
}

// If run directly (for testing or manual execution)
if (require.main === module) {
  runTrialExpirationJob()
    .then(() => {
      console.log('Trial expiration job completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Trial expiration job failed:', error);
      process.exit(1);
    });
}

