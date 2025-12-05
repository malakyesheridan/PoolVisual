/**
 * Enhancement Service
 * Manages enhancement allocation, deduction, and refunds for users
 * All enhancements cost 1 enhancement (simplified from credit system)
 */

import { storage } from '../storage.js';
import { logger } from './logger.js';
import { transaction } from './dbHelpers.js';

export interface EnhancementBalance {
  total: number;
  subscriptionEnhancements: number;
  topUpEnhancements: number;
  usedThisMonth: number;
}

/**
 * Calculate enhancements required for an enhancement job
 * All enhancements now cost 1 (simplified system)
 */
export function calculateEnhancements(enhancementType: string, hasMask: boolean): number {
  // All enhancements cost 1 enhancement
  return 1;
}

/**
 * Get user's enhancement balance breakdown
 */
export async function getEnhancementBalance(userId: string): Promise<EnhancementBalance> {
  try {
    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const totalEnhancements = Number(user.enhancementsBalance || 0);
    
    // For now, we don't track subscription vs top-up separately in the database
    // This is a simplified implementation - future enhancement would track separately
    // For now, assume all enhancements are available (subscription + top-up combined)
    const subscriptionEnhancements = 0; // TODO: Track monthly subscription enhancements separately
    const topUpEnhancements = totalEnhancements; // TODO: Track top-up enhancements separately
    const usedThisMonth = 0; // TODO: Track usage this month

    return {
      total: totalEnhancements,
      subscriptionEnhancements,
      topUpEnhancements,
      usedThisMonth,
    };
  } catch (error) {
    logger.error({ msg: 'Failed to get enhancement balance', err: error, userId });
    throw error;
  }
}

/**
 * Check if user has enough enhancements
 */
export async function hasEnoughEnhancements(userId: string, requiredEnhancements: number): Promise<boolean> {
  try {
    const balance = await getEnhancementBalance(userId);
    return balance.total >= requiredEnhancements;
  } catch (error) {
    logger.error({ msg: 'Failed to check enhancements', err: error, userId, requiredEnhancements });
    return false;
  }
}

/**
 * Deduct enhancements atomically
 * Checks trial enhancements first, then paid enhancements
 */
export async function deductEnhancements(
  userId: string,
  enhancementType: string,
  hasMask: boolean,
  enhancementId?: string
): Promise<{ success: boolean; newBalance: number; enhancementsDeducted: number; fromTrial: boolean }> {
  // All enhancements cost 1
  const enhancementsToDeduct = 1;

  try {
    // Use transaction to ensure atomicity
    const result = await transaction(async (tx) => {
      // Lock user row for update - get both trial and paid enhancements
      const userRows = await tx.execute(
        `SELECT 
          enhancements_balance, 
          is_trial, 
          trial_enhancements,
          trial_start_date
        FROM users WHERE id = $1 FOR UPDATE`,
        [userId]
      );

      if (!userRows || userRows.length === 0) {
        throw new Error('User not found');
      }

      const user = userRows[0];
      const isTrial = user.is_trial === true;
      const trialEnhancements = Number(user.trial_enhancements || 0);
      const paidBalance = Number(user.enhancements_balance || 0);
      
      // Check if trial has expired
      const { trialService } = await import('./trialService.js');
      let actualIsTrial = isTrial;
      if (isTrial && trialService.isTrialExpired(user.trial_start_date)) {
        // Trial expired - expire it and use paid balance
        await tx.execute(
          `UPDATE users SET is_trial = FALSE, trial_enhancements = 0 WHERE id = $1`,
          [userId]
        );
        actualIsTrial = false;
      }

      // Try to deduct from trial first if in trial
      if (actualIsTrial && trialEnhancements >= enhancementsToDeduct) {
        const newTrialEnhancements = trialEnhancements - enhancementsToDeduct;
        
        await tx.execute(
          `UPDATE users SET trial_enhancements = $1 WHERE id = $2`,
          [newTrialEnhancements, userId]
        );

        return {
          success: true,
          newBalance: paidBalance, // Paid balance unchanged
          enhancementsDeducted: enhancementsToDeduct,
          fromTrial: true,
        };
      }

      // If not in trial or trial enhancements exhausted, use paid balance
      if (paidBalance < enhancementsToDeduct) {
        return {
          success: false,
          newBalance: paidBalance,
          enhancementsDeducted: 0,
          fromTrial: false,
        };
      }

      const newBalance = paidBalance - enhancementsToDeduct;

      // Update user paid enhancements
      await tx.execute(
        `UPDATE users SET enhancements_balance = $1 WHERE id = $2`,
        [newBalance.toString(), userId]
      );

      return {
        success: true,
        newBalance,
        enhancementsDeducted: enhancementsToDeduct,
        fromTrial: false,
      };
    });

    logger.info({
      msg: 'Enhancements deducted',
      userId,
      enhancementType,
      hasMask,
      enhancementsDeducted: result.enhancementsDeducted,
      newBalance: result.newBalance,
      enhancementId,
    });

    return result;
  } catch (error) {
    logger.error({
      msg: 'Failed to deduct enhancements',
      err: error,
      userId,
      enhancementType,
      enhancementsToDeduct,
    });
    throw error;
  }
}

/**
 * Add enhancements to user account
 */
export async function addEnhancements(
  userId: string,
  enhancements: number,
  type: 'subscription' | 'topup',
  description: string,
  stripePaymentIntentId?: string
): Promise<number> {
  try {
    // Use transaction to ensure atomicity
    const result = await transaction(async (tx) => {
      // Lock user row for update
      const userRows = await tx.execute(
        `SELECT enhancements_balance FROM users WHERE id = $1 FOR UPDATE`,
        [userId]
      );

      if (!userRows || userRows.length === 0) {
        throw new Error('User not found');
      }

      const currentBalance = Number(userRows[0].enhancements_balance || 0);
      const newBalance = currentBalance + enhancements;

      // Update user enhancements
      await tx.execute(
        `UPDATE users SET enhancements_balance = $1 WHERE id = $2`,
        [newBalance.toString(), userId]
      );

      return newBalance;
    });

    logger.info({
      msg: 'Enhancements added',
      userId,
      enhancements,
      type,
      description,
      stripePaymentIntentId,
      newBalance: result,
    });

    return result;
  } catch (error) {
    logger.error({
      msg: 'Failed to add enhancements',
      err: error,
      userId,
      enhancements,
      type,
    });
    throw error;
  }
}

/**
 * Refund enhancements on failed enhancement
 */
export async function refundEnhancements(
  userId: string,
  enhancements: number,
  enhancementId: string,
  reason: string
): Promise<number> {
  try {
    // Use transaction to ensure atomicity
    const result = await transaction(async (tx) => {
      // Lock user row for update
      const userRows = await tx.execute(
        `SELECT enhancements_balance FROM users WHERE id = $1 FOR UPDATE`,
        [userId]
      );

      if (!userRows || userRows.length === 0) {
        throw new Error('User not found');
      }

      const currentBalance = Number(userRows[0].enhancements_balance || 0);
      const newBalance = currentBalance + enhancements;

      // Update user enhancements
      await tx.execute(
        `UPDATE users SET enhancements_balance = $1 WHERE id = $2`,
        [newBalance.toString(), userId]
      );

      return newBalance;
    });

    logger.info({
      msg: 'Enhancements refunded',
      userId,
      enhancements,
      enhancementId,
      reason,
      newBalance: result,
    });

    return result;
  } catch (error) {
    logger.error({
      msg: 'Failed to refund enhancements',
      err: error,
      userId,
      enhancements,
      enhancementId,
    });
    throw error;
  }
}

/**
 * Reset monthly subscription enhancements
 */
export async function resetMonthlyEnhancements(userId: string, monthlyEnhancements: number): Promise<void> {
  try {
    // For now, we add the monthly enhancements to the total balance
    // Future enhancement: track subscription enhancements separately
    await addEnhancements(
      userId,
      monthlyEnhancements,
      'subscription',
      `Monthly subscription enhancements reset - ${monthlyEnhancements} enhancements`
    );

    logger.info({
      msg: 'Monthly enhancements reset',
      userId,
      monthlyEnhancements,
    });
  } catch (error) {
    logger.error({
      msg: 'Failed to reset monthly enhancements',
      err: error,
      userId,
      monthlyEnhancements,
    });
    throw error;
  }
}

/**
 * Get enhancement amount from Stripe Price ID (for top-ups)
 */
export function getEnhancementsFromPriceId(priceId: string): number | null {
  const topUpMap: Record<string, number> = {
    'price_1SZRjuEdvdAX5C3kF5PzjpMb': 350,  // 350 enhancements - $199 AUD (Pro Pack)
    'price_1SZRjYEdvdAX5C3kmNRNfHPi': 100,  // 100 enhancements - $75 AUD (Standard)
    'price_1SZRjEEdvdAX5C3kdERuir64': 30,   // 30 enhancements - $25 AUD (Basic)
  };

  return topUpMap[priceId] || null;
}

/**
 * Get subscription plan details from Stripe Price ID
 * Updated with new enhancement quotas: Solo=50, Pro=150, Business=500
 */
export function getPlanFromPriceId(priceId: string): { planKey: string; monthlyEnhancements: number; productId: string } | null {
  const planMap: Record<string, { planKey: string; monthlyEnhancements: number; productId: string }> = {
    // Business plan - Monthly: $995 AUD/month - 500 enhancements
    'price_1SZRiaEdvdAX5C3kEekpnwAR': {
      planKey: 'easyflow_business',
      monthlyEnhancements: 500,
      productId: 'prod_TWUhmEZK3biO3P',
    },
    // Business plan - Yearly: $9995 AUD/year - 500 enhancements/month
    'price_1SZTl8EdvdAX5C3kPun5h2kj': {
      planKey: 'easyflow_business',
      monthlyEnhancements: 500,
      productId: 'prod_TWWoG67txbpdNL',
    },
    // Pro plan - Monthly: $299 AUD/month - 150 enhancements
    'price_1SZRiGEdvdAX5C3ketcnQIeO': {
      planKey: 'easyflow_pro',
      monthlyEnhancements: 150,
      productId: 'prod_TWUhgM8JYrdA9y',
    },
    // Pro plan - Yearly: $2999 AUD/year - 150 enhancements/month
    'price_1SZTk7EdvdAX5C3kzS23TQES': {
      planKey: 'easyflow_pro',
      monthlyEnhancements: 150,
      productId: 'prod_TWWnUH3BQx71YL',
    },
    // Solo plan - Monthly: $149 AUD/month - 50 enhancements
    'price_1SZRhzEdvdAX5C3kg43xSFBd': {
      planKey: 'easyflow_solo',
      monthlyEnhancements: 50,
      productId: 'prod_TWUha7Rt7ef4Br',
    },
    // Solo plan - Yearly: $1490 AUD/year - 50 enhancements/month
    'price_1SZTjjEdvdAX5C3k1pZ1sEuz': {
      planKey: 'easyflow_solo',
      monthlyEnhancements: 50,
      productId: 'prod_TWWnwF0MnDHgyS',
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
    'price_1SZRjuEdvdAX5C3kF5PzjpMb': 'prod_TWUj0L0LbCseYc',  // 350 enhancements - $199 AUD
    'price_1SZRjYEdvdAX5C3kmNRNfHPi': 'prod_TWUjIWUJ5I1uCY',  // 100 enhancements - $75 AUD
    'price_1SZRjEEdvdAX5C3kdERuir64': 'prod_TWUiiGAGwSb03w',  // 30 enhancements - $25 AUD
  };

  // Also check yearly subscription products
  const yearlyProductMap: Record<string, string> = {
    'price_1SZTl8EdvdAX5C3kPun5h2kj': 'prod_TWWoG67txbpdNL',  // Business yearly
    'price_1SZTk7EdvdAX5C3kzS23TQES': 'prod_TWWnUH3BQx71YL',  // Pro yearly
    'price_1SZTjjEdvdAX5C3k1pZ1sEuz': 'prod_TWWnwF0MnDHgyS',  // Solo yearly
  };

  return topUpProductMap[priceId] || yearlyProductMap[priceId] || null;
}

// Export service instance
export const enhancementService = {
  calculateEnhancements,
  getEnhancementBalance,
  hasEnoughEnhancements,
  deductEnhancements,
  addEnhancements,
  refundEnhancements,
  resetMonthlyEnhancements,
  getEnhancementsFromPriceId,
  getPlanFromPriceId,
  getProductIdFromPriceId,
};

