/**
 * Referral Service
 * Manages referral tracking, rewards, and abuse prevention
 */

import { storage } from '../storage.js';
import { logger } from './logger.js';
import { enhancementService } from './enhancementService.js';
import { v4 as uuidv4 } from 'uuid';

const REFERRER_REWARD = 20; // Enhancements for referrer
const REFEREE_REWARD = 10; // Optional enhancements for referee (configurable)
const MAX_REFERRAL_REWARDS = 200; // Maximum enhancements from referrals

// Feature flag for referee rewards (can be toggled)
const REFEREE_REWARDS_ENABLED = process.env.REFEREE_REWARDS_ENABLED === 'true';

/**
 * Generate or retrieve referral code for a user
 */
export async function getOrCreateReferralCode(userId: string): Promise<string> {
  try {
    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // If user already has a referral code, return it
    if (user.referralCode) {
      return user.referralCode;
    }

    // Generate a unique referral code (using user ID as base for uniqueness)
    // Format: First 8 chars of UUID + last 4 chars of user ID
    const codePrefix = uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase();
    const userIdSuffix = userId.replace(/-/g, '').substring(0, 4).toUpperCase();
    const referralCode = `${codePrefix}${userIdSuffix}`;

    // Ensure uniqueness by checking if code exists
    // In a real implementation, you might want to check for collisions
    // For now, we'll use a simple approach: code + user ID check

    // Update user with referral code
    await storage.updateUser(userId, {
      referralCode,
    });

    logger.info({
      msg: 'Referral code generated',
      userId,
      referralCode,
    });

    return referralCode;
  } catch (error) {
    logger.error({
      msg: 'Failed to generate referral code',
      err: error,
      userId,
    });
    throw error;
  }
}

/**
 * Record a referral when a new user signs up
 * Returns the referral record if successful
 */
export async function recordReferral(
  referrerCode: string,
  refereeUserId: string
): Promise<{ success: boolean; referralId?: string; message: string }> {
  try {
    // Find referrer by code
    const referrer = await storage.getUserByReferralCode(referrerCode);
    if (!referrer) {
      return {
        success: false,
        message: 'Invalid referral code',
      };
    }

    const referrerUserId = referrer.id;

    // Abuse prevention: Check for self-referral
    if (referrerUserId === refereeUserId) {
      logger.warn({
        msg: 'Self-referral attempt blocked',
        userId: referrerUserId,
      });
      return {
        success: false,
        message: 'Cannot refer yourself',
      };
    }

    // Check if referee already has a referral (prevent duplicates)
    const existingReferral = await storage.getReferralByReferee(refereeUserId);
    if (existingReferral) {
      logger.warn({
        msg: 'Duplicate referral attempt blocked',
        refereeUserId,
        existingReferralId: existingReferral.id,
      });
      return {
        success: false,
        message: 'User already has a referral',
      };
    }

    // Check if referrer has reached their reward limit
    const referrerUser = await storage.getUser(referrerUserId);
    if (!referrerUser) {
      return {
        success: false,
        message: 'Referrer not found',
      };
    }

    const rewardsEarned = referrerUser.referralRewardsEarned || 0;
    const rewardsLimit = referrerUser.referralRewardsLimit || MAX_REFERRAL_REWARDS;

    if (rewardsEarned >= rewardsLimit) {
      logger.info({
        msg: 'Referrer has reached reward limit',
        referrerUserId,
        rewardsEarned,
        rewardsLimit,
      });
      // Still record the referral, but won't award rewards
    }

    // Create referral record
    const referral = await storage.createReferral({
      referrerUserId,
      refereeUserId,
      status: 'pending',
      referrerRewarded: false,
      refereeRewarded: false,
    });

    logger.info({
      msg: 'Referral recorded',
      referralId: referral.id,
      referrerUserId,
      refereeUserId,
    });

    return {
      success: true,
      referralId: referral.id,
      message: 'Referral recorded successfully',
    };
  } catch (error) {
    logger.error({
      msg: 'Failed to record referral',
      err: error,
      referrerCode,
      refereeUserId,
    });
    throw error;
  }
}

/**
 * Complete referral and award rewards after onboarding
 * Called when referee completes onboarding
 */
export async function completeReferral(
  refereeUserId: string
): Promise<{ success: boolean; referrerRewarded: boolean; refereeRewarded: boolean; message: string }> {
  try {
    // Find referral by referee
    const referral = await storage.getReferralByReferee(refereeUserId);
    if (!referral) {
      return {
        success: false,
        referrerRewarded: false,
        refereeRewarded: false,
        message: 'No referral found for this user',
      };
    }

    // Check if already completed
    if (referral.status === 'rewarded') {
      return {
        success: true,
        referrerRewarded: referral.referrerRewarded || false,
        refereeRewarded: referral.refereeRewarded || false,
        message: 'Referral already completed',
      };
    }

    // Update referral status to completed
    await storage.updateReferral(referral.id, {
      status: 'completed',
    });

    // Award referrer reward (20 enhancements)
    let referrerRewarded = false;
    if (!referral.referrerRewarded) {
      const referrer = await storage.getUser(referral.referrerUserId);
      if (referrer) {
        const rewardsEarned = referrer.referralRewardsEarned || 0;
        const rewardsLimit = referrer.referralRewardsLimit || MAX_REFERRAL_REWARDS;

        if (rewardsEarned < rewardsLimit) {
          // Calculate how much we can award (respecting the limit)
          const remainingCapacity = rewardsLimit - rewardsEarned;
          const rewardAmount = Math.min(REFERRER_REWARD, remainingCapacity);

          if (rewardAmount > 0) {
            // Add enhancements to referrer's balance
            await enhancementService.addEnhancements(
              referral.referrerUserId,
              rewardAmount,
              'referral',
              `Referral reward for ${referrer.username || 'user'}`
            );

            // Update referral rewards earned
            await storage.updateUser(referral.referrerUserId, {
              referralRewardsEarned: rewardsEarned + rewardAmount,
            });

            // Mark referrer as rewarded
            await storage.updateReferral(referral.id, {
              referrerRewarded: true,
            });

            referrerRewarded = true;

            logger.info({
              msg: 'Referrer reward awarded',
              referrerUserId: referral.referrerUserId,
              refereeUserId,
              rewardAmount,
            });
          }
        }
      }
    }

    // Award referee reward (10 enhancements) if enabled
    let refereeRewarded = false;
    if (REFEREE_REWARDS_ENABLED && !referral.refereeRewarded) {
      await enhancementService.addEnhancements(
        refereeUserId,
        REFEREE_REWARD,
        'referral',
        'Welcome referral bonus'
      );

      await storage.updateReferral(referral.id, {
        refereeRewarded: true,
      });

      refereeRewarded = true;

      logger.info({
        msg: 'Referee reward awarded',
        refereeUserId,
        rewardAmount: REFEREE_REWARD,
      });
    }

    // Mark referral as rewarded
    await storage.updateReferral(referral.id, {
      status: 'rewarded',
    });

    return {
      success: true,
      referrerRewarded,
      refereeRewarded,
      message: 'Referral completed and rewards awarded',
    };
  } catch (error) {
    logger.error({
      msg: 'Failed to complete referral',
      err: error,
      refereeUserId,
    });
    throw error;
  }
}

/**
 * Get referral statistics for a user
 */
export async function getReferralStats(userId: string): Promise<{
  referralCode: string;
  referralLink: string;
  totalReferrals: number;
  completedReferrals: number;
  rewardsEarned: number;
  rewardsLimit: number;
  referrals: Array<{
    id: string;
    refereeUserId: string;
    status: string;
    createdAt: Date;
    referrerRewarded: boolean;
  }>;
}> {
  try {
    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Get or create referral code
    const referralCode = await getOrCreateReferralCode(userId);

    // Build referral link
    const baseUrl = process.env.FRONTEND_URL || 'https://easyflowstudio.vercel.app';
    const referralLink = `${baseUrl}/signup?ref=${referralCode}`;

    // Get all referrals for this user
    const referrals = await storage.getReferralsByReferrer(userId);

    const totalReferrals = referrals.length;
    const completedReferrals = referrals.filter((r) => r.status === 'rewarded').length;
    const rewardsEarned = user.referralRewardsEarned || 0;
    const rewardsLimit = user.referralRewardsLimit || MAX_REFERRAL_REWARDS;

    return {
      referralCode,
      referralLink,
      totalReferrals,
      completedReferrals,
      rewardsEarned,
      rewardsLimit,
      referrals: referrals.map((r) => ({
        id: r.id,
        refereeUserId: r.refereeUserId,
        status: r.status,
        createdAt: r.createdAt,
        referrerRewarded: r.referrerRewarded || false,
      })),
    };
  } catch (error) {
    logger.error({
      msg: 'Failed to get referral stats',
      err: error,
      userId,
    });
    throw error;
  }
}

export const referralService = {
  getOrCreateReferralCode,
  recordReferral,
  completeReferral,
  getReferralStats,
  REFERRER_REWARD,
  REFEREE_REWARD,
  MAX_REFERRAL_REWARDS,
  REFEREE_REWARDS_ENABLED,
};

