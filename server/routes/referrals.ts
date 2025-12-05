/**
 * Referral Routes
 * Handles referral management and statistics
 */

import { Router } from 'express';
import { authenticateSession } from '../lib/authHelper.js';
import { referralService } from '../lib/referralService.js';
import { logger } from '../lib/logger.js';

const router = Router();

/**
 * GET /api/referrals/info
 * Get user's referral information and statistics
 */
router.get('/info', authenticateSession, async (req, res) => {
  try {
    const user = (req as any).session.user;
    if (!user?.id) {
      return res.status(401).json({ ok: false, error: 'Authentication required' });
    }

    const stats = await referralService.getReferralStats(user.id);

    res.json({
      ok: true,
      stats,
    });
  } catch (error: any) {
    logger.error({ msg: 'Failed to get referral info', err: error });
    res.status(500).json({ ok: false, error: error.message || 'Failed to get referral info' });
  }
});

/**
 * POST /api/referrals/record
 * Record a referral when a new user signs up
 * This is called during registration if a referral code is provided
 */
router.post('/record', async (req, res) => {
  try {
    const { referralCode, refereeUserId } = req.body;

    if (!referralCode || !refereeUserId) {
      return res.status(400).json({
        ok: false,
        error: 'referralCode and refereeUserId are required',
      });
    }

    const result = await referralService.recordReferral(referralCode, refereeUserId);

    if (!result.success) {
      return res.status(400).json({
        ok: false,
        error: result.message,
      });
    }

    res.json({
      ok: true,
      message: result.message,
      referralId: result.referralId,
    });
  } catch (error: any) {
    logger.error({ msg: 'Failed to record referral', err: error });
    res.status(500).json({ ok: false, error: error.message || 'Failed to record referral' });
  }
});

/**
 * POST /api/referrals/complete
 * Complete referral and award rewards after onboarding
 * This is called when a user completes onboarding
 */
router.post('/complete', authenticateSession, async (req, res) => {
  try {
    const user = (req as any).session.user;
    if (!user?.id) {
      return res.status(401).json({ ok: false, error: 'Authentication required' });
    }

    const result = await referralService.completeReferral(user.id);

    if (!result.success) {
      return res.status(400).json({
        ok: false,
        error: result.message,
      });
    }

    res.json({
      ok: true,
      message: result.message,
      referrerRewarded: result.referrerRewarded,
      refereeRewarded: result.refereeRewarded,
    });
  } catch (error: any) {
    logger.error({ msg: 'Failed to complete referral', err: error });
    res.status(500).json({ ok: false, error: error.message || 'Failed to complete referral' });
  }
});

export { router as referralRoutes };

