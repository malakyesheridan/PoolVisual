/**
 * Feature Access Routes
 * Handles feature access checking based on subscription tier
 */

import { Router } from 'express';
import { authenticateSession } from '../lib/authHelper.js';
import { checkFeatureAccess, getFeatureAccess } from '../lib/featureAccessService.js';
import { logger } from '../lib/logger.js';
import { storage } from '../storage.js';

const router = Router();

/**
 * GET /api/features/access
 * Get all feature access for current user
 */
router.get('/access', authenticateSession, async (req, res) => {
  try {
    const user = (req as any).session.user;
    if (!user?.id) {
      return res.status(401).json({ ok: false, error: 'Authentication required' });
    }

    const userRecord = await storage.getUser(user.id);
    if (!userRecord) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }

    const featureAccess = getFeatureAccess(userRecord);
    res.json({ ok: true, features: featureAccess });
  } catch (error: any) {
    logger.error({ msg: 'Failed to get feature access', err: error });
    res.status(500).json({ ok: false, error: 'Failed to get feature access' });
  }
});

/**
 * GET /api/features/:feature
 * Check access to specific feature
 */
router.get('/:feature', authenticateSession, async (req, res) => {
  try {
    const user = (req as any).session.user;
    if (!user?.id) {
      return res.status(401).json({ ok: false, error: 'Authentication required' });
    }

    const { feature } = req.params;
    const userRecord = await storage.getUser(user.id);
    
    if (!userRecord) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }

    const hasAccess = checkFeatureAccess(userRecord, feature);
    res.json({ ok: true, hasAccess, feature });
  } catch (error: any) {
    logger.error({ msg: 'Failed to check feature access', err: error });
    res.status(500).json({ ok: false, error: 'Failed to check feature access' });
  }
});

export { router as featureRoutes };
