/**
 * Trial Service
 * Manages free trial activation, expiration, and enhancement tracking
 */

import { storage } from '../storage.js';
import { logger } from './logger.js';

const TRIAL_DURATION_DAYS = 7;
const TRIAL_ENHANCEMENTS = 30;

/**
 * Activate free trial for a new user
 * Only activates if user hasn't used trial before
 */
export async function activateTrial(userId: string): Promise<{ success: boolean; message: string }> {
  try {
    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Check if user has already used trial
    if (user.hasUsedTrial) {
      return {
        success: false,
        message: 'Trial already used',
      };
    }

    // Check if user is already in a trial
    if (user.isTrial) {
      return {
        success: false,
        message: 'Trial already active',
      };
    }

    // Activate trial
    await storage.updateUser(userId, {
      isTrial: true,
      trialStartDate: new Date(),
      trialEnhancements: TRIAL_ENHANCEMENTS,
      hasUsedTrial: true,
    });

    logger.info({
      msg: 'Trial activated',
      userId,
      trialEnhancements: TRIAL_ENHANCEMENTS,
      trialStartDate: new Date(),
    });

    return {
      success: true,
      message: 'Trial activated successfully',
    };
  } catch (error) {
    logger.error({
      msg: 'Failed to activate trial',
      err: error,
      userId,
    });
    throw error;
  }
}

/**
 * Check if trial has expired
 */
export function isTrialExpired(trialStartDate: Date | null | undefined): boolean {
  if (!trialStartDate) {
    return true; // No trial start date means expired
  }

  const now = new Date();
  const trialEnd = new Date(trialStartDate);
  trialEnd.setDate(trialEnd.getDate() + TRIAL_DURATION_DAYS);

  return now > trialEnd;
}

/**
 * Get remaining trial days
 */
export function getRemainingTrialDays(trialStartDate: Date | null | undefined): number {
  if (!trialStartDate) {
    return 0;
  }

  const now = new Date();
  const trialEnd = new Date(trialStartDate);
  trialEnd.setDate(trialEnd.getDate() + TRIAL_DURATION_DAYS);

  if (now > trialEnd) {
    return 0;
  }

  const diffTime = trialEnd.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Expire trial for a user
 */
export async function expireTrial(userId: string): Promise<void> {
  try {
    await storage.updateUser(userId, {
      isTrial: false,
      trialEnhancements: 0,
    });

    logger.info({
      msg: 'Trial expired',
      userId,
    });
  } catch (error) {
    logger.error({
      msg: 'Failed to expire trial',
      err: error,
      userId,
    });
    throw error;
  }
}

/**
 * Process trial expiration for all expired trials
 * This should be called by a cron job
 */
export async function processTrialExpirations(): Promise<number> {
  try {
    // Get all users with active trials
    const expiredUsers = await storage.getExpiredTrials();

    let expiredCount = 0;
    for (const user of expiredUsers) {
      if (isTrialExpired(user.trialStartDate)) {
        await expireTrial(user.id);
        expiredCount++;
      }
    }

    logger.info({
      msg: 'Trial expiration processed',
      expiredCount,
      totalChecked: expiredUsers.length,
    });

    return expiredCount;
  } catch (error) {
    logger.error({
      msg: 'Failed to process trial expirations',
      err: error,
    });
    throw error;
  }
}

export const trialService = {
  activateTrial,
  isTrialExpired,
  getRemainingTrialDays,
  expireTrial,
  processTrialExpirations,
  TRIAL_DURATION_DAYS,
  TRIAL_ENHANCEMENTS,
};

