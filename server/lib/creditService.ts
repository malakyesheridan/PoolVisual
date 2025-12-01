/**
 * Credit Service
 * Manages credit allocation, deduction, and refunds for users
 */

import { storage } from '../storage.js';
import { logger } from './logger.js';
import { executeQuery, transaction } from './dbHelpers.js';

export interface CreditBalance {
  total: number;
  subscriptionCredits: number;
  topUpCredits: number;
  usedThisMonth: number;
}

/**
 * Calculate credits required for an enhancement
 */
export function calculateCredits(enhancementType: string, hasMask: boolean): number {
  // Normalize enhancement type (handle variations)
  const normalizedType = enhancementType?.toLowerCase() || 'basic';
  
  // Special handling for modes that depend on mask presence
  if (normalizedType === 'add_pool' || normalizedType === 'custom') {
    return hasMask ? 10 : 2; // custom with mask = 10, without = 2
  }
  
  // Map enhancement modes to credit types and costs
  const creditMap: Record<string, number> = {
    // Real Estate modes
    'image_enhancement': 2,  // basic
    'day_to_dusk': 6,        // sky
    'stage_room': 6,          // staging
    'item_removal': 10,       // brush
    
    // Trades modes (add_pool handled above)
    'add_decoration': 6,                // decorate
    'blend_materials': 5,                // material
    
    // Generic modes
    'declutter': 2,           // basic
    'brighten': 2,             // basic
    'cleanup': 2,              // basic
    
    // Legacy/alternative names
    'basic': 2,
    'sky': 6,
    'staging': 6,
    'brush': 10,
    'decorate': 6,
    'material': 5,
  };

  // Check direct mapping
  if (creditMap[normalizedType] !== undefined) {
    return creditMap[normalizedType];
  }

  // Fallback: if it's a custom mode, check mask
  if (normalizedType.includes('custom')) {
    return hasMask ? 10 : 2;
  }

  // Default to 2 credits for unknown types
  logger.warn({ msg: 'Unknown enhancement type, defaulting to 2 credits', enhancementType });
  return 2;
}

/**
 * Get user's credit balance breakdown
 */
export async function getCreditBalance(userId: string): Promise<CreditBalance> {
  try {
    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const totalCredits = Number(user.creditsBalance || 0);
    
    // For now, we don't track subscription vs top-up separately in the database
    // This is a simplified implementation - future enhancement would track separately
    // For now, assume all credits are available (subscription + top-up combined)
    const subscriptionCredits = 0; // TODO: Track monthly subscription credits separately
    const topUpCredits = totalCredits; // TODO: Track top-up credits separately
    const usedThisMonth = 0; // TODO: Track usage this month

    return {
      total: totalCredits,
      subscriptionCredits,
      topUpCredits,
      usedThisMonth,
    };
  } catch (error) {
    logger.error({ msg: 'Failed to get credit balance', err: error, userId });
    throw error;
  }
}

/**
 * Check if user has enough credits
 */
export async function hasEnoughCredits(userId: string, requiredCredits: number): Promise<boolean> {
  try {
    const balance = await getCreditBalance(userId);
    return balance.total >= requiredCredits;
  } catch (error) {
    logger.error({ msg: 'Failed to check credits', err: error, userId, requiredCredits });
    return false;
  }
}

/**
 * Deduct credits atomically
 */
export async function deductCredits(
  userId: string,
  enhancementType: string,
  hasMask: boolean,
  enhancementId?: string
): Promise<{ success: boolean; newBalance: number; creditsDeducted: number }> {
  const creditsToDeduct = calculateCredits(enhancementType, hasMask);

  try {
    // Use transaction to ensure atomicity
    const result = await transaction(async (tx) => {
      // Lock user row for update
      const userRows = await tx.execute(
        `SELECT credits_balance FROM users WHERE id = $1 FOR UPDATE`,
        [userId]
      );

      if (!userRows || userRows.length === 0) {
        throw new Error('User not found');
      }

      const currentBalance = Number(userRows[0].credits_balance || 0);

      if (currentBalance < creditsToDeduct) {
        return {
          success: false,
          newBalance: currentBalance,
          creditsDeducted: 0,
        };
      }

      const newBalance = currentBalance - creditsToDeduct;

      // Update user credits
      await tx.execute(
        `UPDATE users SET credits_balance = $1 WHERE id = $2`,
        [newBalance.toString(), userId]
      );

      return {
        success: true,
        newBalance,
        creditsDeducted: creditsToDeduct,
      };
    });

    logger.info({
      msg: 'Credits deducted',
      userId,
      enhancementType,
      hasMask,
      creditsDeducted: result.creditsDeducted,
      newBalance: result.newBalance,
      enhancementId,
    });

    return result;
  } catch (error) {
    logger.error({
      msg: 'Failed to deduct credits',
      err: error,
      userId,
      enhancementType,
      creditsToDeduct,
    });
    throw error;
  }
}

/**
 * Add credits to user account
 */
export async function addCredits(
  userId: string,
  credits: number,
  type: 'subscription' | 'topup',
  description: string,
  stripePaymentIntentId?: string
): Promise<number> {
  try {
    // Use transaction to ensure atomicity
    const result = await transaction(async (tx) => {
      // Lock user row for update
      const userRows = await tx.execute(
        `SELECT credits_balance FROM users WHERE id = $1 FOR UPDATE`,
        [userId]
      );

      if (!userRows || userRows.length === 0) {
        throw new Error('User not found');
      }

      const currentBalance = Number(userRows[0].credits_balance || 0);
      const newBalance = currentBalance + credits;

      // Update user credits
      await tx.execute(
        `UPDATE users SET credits_balance = $1 WHERE id = $2`,
        [newBalance.toString(), userId]
      );

      return newBalance;
    });

    logger.info({
      msg: 'Credits added',
      userId,
      credits,
      type,
      description,
      stripePaymentIntentId,
      newBalance: result,
    });

    return result;
  } catch (error) {
    logger.error({
      msg: 'Failed to add credits',
      err: error,
      userId,
      credits,
      type,
    });
    throw error;
  }
}

/**
 * Refund credits on failed enhancement
 */
export async function refundCredits(
  userId: string,
  credits: number,
  enhancementId: string,
  reason: string
): Promise<number> {
  try {
    // Use transaction to ensure atomicity
    const result = await transaction(async (tx) => {
      // Lock user row for update
      const userRows = await tx.execute(
        `SELECT credits_balance FROM users WHERE id = $1 FOR UPDATE`,
        [userId]
      );

      if (!userRows || userRows.length === 0) {
        throw new Error('User not found');
      }

      const currentBalance = Number(userRows[0].credits_balance || 0);
      const newBalance = currentBalance + credits;

      // Update user credits
      await tx.execute(
        `UPDATE users SET credits_balance = $1 WHERE id = $2`,
        [newBalance.toString(), userId]
      );

      return newBalance;
    });

    logger.info({
      msg: 'Credits refunded',
      userId,
      credits,
      enhancementId,
      reason,
      newBalance: result,
    });

    return result;
  } catch (error) {
    logger.error({
      msg: 'Failed to refund credits',
      err: error,
      userId,
      credits,
      enhancementId,
    });
    throw error;
  }
}

/**
 * Reset monthly subscription credits
 */
export async function resetMonthlyCredits(userId: string, monthlyCredits: number): Promise<void> {
  try {
    // For now, we add the monthly credits to the total balance
    // Future enhancement: track subscription credits separately
    await addCredits(
      userId,
      monthlyCredits,
      'subscription',
      `Monthly subscription credits reset - ${monthlyCredits} credits`
    );

    logger.info({
      msg: 'Monthly credits reset',
      userId,
      monthlyCredits,
    });
  } catch (error) {
    logger.error({
      msg: 'Failed to reset monthly credits',
      err: error,
      userId,
      monthlyCredits,
    });
    throw error;
  }
}

/**
 * Get credit amount from Stripe Price ID (for top-ups)
 */
export function getCreditsFromPriceId(priceId: string): number | null {
  const topUpMap: Record<string, number> = {
    'price_1SZRjuEdvdAX5C3kF5PzjpMb': 300,  // 300 credits - $199 AUD
    'price_1SZRjYEdvdAX5C3kmNRNfHPi': 100,  // 100 credits - $75 AUD
    'price_1SZRjEEdvdAX5C3kdERuir64': 25,   // 25 credits - $25 AUD
  };

  return topUpMap[priceId] || null;
}

/**
 * Get subscription plan details from Stripe Price ID
 */
export function getPlanFromPriceId(priceId: string): { planKey: string; monthlyCredits: number; productId: string } | null {
  const planMap: Record<string, { planKey: string; monthlyCredits: number; productId: string }> = {
    // Business plan - $995 AUD/month
    'price_1SZRiaEdvdAX5C3kEekpnwAR': {
      planKey: 'easyflow_business',
      monthlyCredits: 1700,
      productId: 'prod_TWUhmEZK3biO3P',
    },
    // Pro plan - $299 AUD/month
    'price_1SZRIGEdvdAX5C3ketcnQIeO': {
      planKey: 'easyflow_pro',
      monthlyCredits: 500,
      productId: 'prod_TWUhgM8JYrdA9y',
    },
    // Solo plan - $149 AUD/month
    'price_1SZRhzEdvdAX5C3kg43xSFBd': {
      planKey: 'easyflow_solo',
      monthlyCredits: 250,
      productId: 'prod_TWUha7Rt7ef4Br',
    },
  };

  return planMap[priceId] || null;
}

/**
 * Get Product ID from Stripe Price ID
 */
export function getProductIdFromPriceId(priceId: string): string | null {
  const plan = getPlanFromPriceId(priceId);
  if (plan) {
    return plan.productId;
  }

  // Check top-up products
  const topUpProductMap: Record<string, string> = {
    'price_1SZRjuEdvdAX5C3kF5PzjpMb': 'prod_TWUj0L0LbCseYc',  // 300 credits - $199 AUD
    'price_1SZRjYEdvdAX5C3kmNRNfHPi': 'prod_TWUjIWUJ5I1uCY',  // 100 credits - $75 AUD
    'price_1SZRjEEdvdAX5C3kdERuir64': 'prod_TWUiiGAGwSb03w',  // 25 credits - $25 AUD
  };

  return topUpProductMap[priceId] || null;
}

// Export service instance
export const creditService = {
  calculateCredits,
  getCreditBalance,
  hasEnoughCredits,
  deductCredits,
  addCredits,
  refundCredits,
  resetMonthlyCredits,
  getCreditsFromPriceId,
  getPlanFromPriceId,
  getProductIdFromPriceId,
};
