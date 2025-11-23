/**
 * Usage Service
 * Checks usage limits for organizations before allowing operations
 */

import { executeQuery } from './dbHelpers.js';

export interface UsageCheckResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  used: number;
  currentPlan?: string;
  upgradeRequired?: boolean;
}

/**
 * Check if organization can create an enhancement
 * Currently checks credits_balance, will be extended for subscription limits
 */
export async function checkEnhancementLimit(orgId: string): Promise<UsageCheckResult> {
  try {
    // Get organization with credits balance (handle missing columns gracefully)
    const orgRows = await executeQuery(
      `SELECT 
        COALESCE(credits_balance, 0) as credits_balance,
        plan_id
       FROM orgs 
       WHERE id = $1`,
      [orgId]
    );
    
    if (orgRows.length === 0) {
      throw new Error('Organization not found');
    }
    
    // Handle case where credits_balance column might not exist yet
    const creditsBalance = Number(orgRows[0]?.credits_balance || 0);
    const planId = orgRows[0]?.plan_id || null;
    
    // For now, use credits system
    // TODO: Replace with subscription-based limits when subscription system is implemented
    const minCreditsRequired = 50000; // $0.05 minimum (cost of one enhancement)
    
    const allowed = creditsBalance >= minCreditsRequired;
    const remaining = Math.floor(creditsBalance / minCreditsRequired);
    const limit = remaining; // For now, limit is based on credits
    
    return {
      allowed,
      remaining,
      limit,
      used: 0, // TODO: Track actual usage from subscription period
      currentPlan: planId || 'free',
      upgradeRequired: !allowed
    };
  } catch (error) {
    console.error('[UsageService] Error checking enhancement limit:', error);
    // Fail open for now (allow operation) - better UX than blocking due to system error
    return {
      allowed: true,
      remaining: 999,
      limit: 999,
      used: 0
    };
  }
}

/**
 * Get usage statistics for an organization
 */
export async function getUsageStats(orgId: string, period: 'current' | 'last_month' = 'current'): Promise<{
  enhancements: number;
  properties?: number; // For real estate
  periodStart: Date;
  periodEnd: Date;
}> {
  try {
    // TODO: Implement actual usage tracking from ai_enhancement_jobs table
    // For now, return placeholder
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    // Count enhancements in current period
    const enhancementRows = await executeQuery(
      `SELECT COUNT(*) as count 
       FROM ai_enhancement_jobs 
       WHERE tenant_id = $1 
         AND created_at >= $2 
         AND created_at <= $3
         AND status = 'completed'`,
      [orgId, periodStart, periodEnd]
    );
    
    const enhancements = Number(enhancementRows[0]?.count || 0);
    
    return {
      enhancements,
      periodStart,
      periodEnd
    };
  } catch (error) {
    console.error('[UsageService] Error getting usage stats:', error);
    return {
      enhancements: 0,
      periodStart: new Date(),
      periodEnd: new Date()
    };
  }
}

