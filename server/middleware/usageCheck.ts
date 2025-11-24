/**
 * Usage Check Middleware
 * Validates usage limits before allowing operations
 */

import { Request, Response, NextFunction } from 'express';
import { checkEnhancementLimit } from '../lib/usageService.js';

/**
 * Middleware to check enhancement usage limits
 * Can be disabled by setting DISABLE_USAGE_CHECK=1 environment variable
 */
export async function checkEnhancementUsage(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Check if usage checking is disabled
  if (process.env.DISABLE_USAGE_CHECK === '1' || process.env.DISABLE_USAGE_CHECK === 'true') {
    console.log('[UsageCheck] ⚠️ Usage checking is disabled (DISABLE_USAGE_CHECK=1)');
    return next();
  }
  
  try {
    const tenantId = req.body?.tenantId || req.query?.tenantId;
    
    if (!tenantId) {
      // If no tenantId, skip check (might be public endpoint or different auth flow)
      return next();
    }
    
    const usageCheck = await checkEnhancementLimit(tenantId);
    
    if (!usageCheck.allowed) {
      res.status(402).json({
        ok: false,
        code: 'USAGE_LIMIT_EXCEEDED',
        message: 'Enhancement limit exceeded',
        details: {
          used: usageCheck.used,
          limit: usageCheck.limit,
          remaining: usageCheck.remaining,
          currentPlan: usageCheck.currentPlan,
          upgradeRequired: usageCheck.upgradeRequired
        }
      });
      return;
    }
    
    // Attach usage info to request for logging/monitoring
    (req as any).usageInfo = usageCheck;
    
    next();
  } catch (error) {
    console.error('[UsageCheck] Error checking usage:', error);
    // Fail open - allow operation if check fails
    next();
  }
}

