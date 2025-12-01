import { Router } from 'express';
import { authenticateSession } from '../lib/authHelper.js';
import { subscriptionService } from '../lib/subscriptionService.js';
import { storage } from '../storage.js';
import { logger } from '../lib/logger.js';
import Stripe from 'stripe';

const router = Router();

/**
 * GET /api/subscription/plans/:industry
 * Get all active plans for an industry
 */
router.get('/plans/:industry', authenticateSession, async (req, res) => {
  try {
    const { industry } = req.params;
    
    if (industry !== 'trades' && industry !== 'real_estate') {
      return res.status(400).json({ 
        ok: false,
        error: 'Invalid industry. Must be "trades" or "real_estate"' 
      });
    }

    const plans = await subscriptionService.getPlansByIndustry(industry);
    res.json({ ok: true, plans });
  } catch (error: any) {
    logger.error({ msg: 'Failed to fetch plans', err: error });
    res.status(500).json({ ok: false, error: 'Failed to fetch plans' });
  }
});

/**
 * GET /api/subscription/status
 * Get current user subscription status
 */
router.get('/status', authenticateSession, async (req, res) => {
  try {
    const user = (req as any).session.user;
    if (!user?.id) {
      return res.status(401).json({ ok: false, error: 'Authentication required' });
    }

    const subscription = await subscriptionService.getUserSubscription(user.id);
    
    // Get credit balance
    const { creditService } = await import('../lib/creditService.js');
    const creditBalance = await creditService.getCreditBalance(user.id);
    
    res.json({ 
      ok: true, 
      subscription: {
        ...subscription,
        creditBalance: creditBalance.total,
      }
    });
  } catch (error: any) {
    logger.error({ msg: 'Failed to get subscription status', err: error });
    res.status(500).json({ ok: false, error: 'Failed to get subscription status' });
  }
});

/**
 * POST /api/subscription/checkout
 * Create Stripe checkout session
 */
router.post('/checkout', authenticateSession, async (req, res) => {
  try {
    const user = (req as any).session.user;
    if (!user?.id) {
      return res.status(401).json({ ok: false, error: 'Authentication required' });
    }

    const { planKey, billingPeriod } = req.body;

    if (!planKey || !billingPeriod) {
      return res.status(400).json({ 
        ok: false,
        error: 'planKey and billingPeriod are required' 
      });
    }

    if (billingPeriod !== 'monthly' && billingPeriod !== 'yearly') {
      return res.status(400).json({ 
        ok: false,
        error: 'billingPeriod must be "monthly" or "yearly"' 
      });
    }

    const session = await subscriptionService.createCheckoutSession(
      user.id,
      planKey,
      billingPeriod
    );

    res.json({ 
      ok: true, 
      url: session.url, 
      sessionId: session.sessionId,
      isPlaceholder: session.isPlaceholder || false
    });
  } catch (error: any) {
    logger.error({ msg: 'Failed to create checkout session', err: error });
    res.status(500).json({ 
      ok: false, 
      error: error.message || 'Failed to create checkout session' 
    });
  }
});

/**
 * GET /api/subscription/features/:feature
 * Check if user has access to a feature (deprecated - use /api/features/:feature)
 */
router.get('/features/:feature', authenticateSession, async (req, res) => {
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

    const { checkFeatureAccess } = await import('../lib/featureAccessService.js');
    const hasAccess = checkFeatureAccess(userRecord, feature);
    res.json({ ok: true, hasAccess });
  } catch (error: any) {
    logger.error({ msg: 'Failed to check feature access', err: error });
    res.status(500).json({ ok: false, error: 'Failed to check feature access' });
  }
});

/**
 * POST /api/subscription/webhook
 * Stripe webhook handler
 * NOTE: This endpoint must use express.raw() middleware for signature verification
 */
router.post('/webhook', async (req, res) => {
  try {
    const stripe = (subscriptionService as any).stripe; // Access private property
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !webhookSecret) {
      return res.status(400).json({ error: 'Missing signature or webhook secret' });
    }

    let event: Stripe.Event;
    try {
      // Note: req.body must be raw buffer for signature verification
      // This should be handled by express.raw() middleware in index.ts
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
      logger.error({ msg: 'Webhook signature verification failed', err });
      return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }

    // Handle event asynchronously
    subscriptionService.handleWebhookEvent(event).catch((error) => {
      logger.error({ msg: 'Error handling webhook event', err: error, type: event.type });
    });

    // Respond immediately
    res.json({ received: true });
  } catch (error: any) {
    logger.error({ msg: 'Webhook handler error', err: error });
    res.status(500).json({ error: 'Webhook handler error' });
  }
});

export { router as subscriptionRoutes };
