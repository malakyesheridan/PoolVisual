/**
 * Enhancement Routes
 * Handles enhancement balance, top-ups, and calculations
 */

import { Router } from 'express';
import { authenticateSession } from '../lib/authHelper.js';
import { enhancementService } from '../lib/enhancementService.js';
import { logger } from '../lib/logger.js';
import Stripe from 'stripe';

const router = Router();

/**
 * GET /api/enhancements/balance
 * Get user's enhancement balance
 */
router.get('/balance', authenticateSession, async (req, res) => {
  try {
    const user = (req as any).session.user;
    if (!user?.id) {
      return res.status(401).json({ ok: false, error: 'Authentication required' });
    }

    const balance = await enhancementService.getEnhancementBalance(user.id);
    res.json({ ok: true, balance });
  } catch (error: any) {
    logger.error({ msg: 'Failed to get enhancement balance', err: error });
    res.status(500).json({ ok: false, error: 'Failed to get enhancement balance' });
  }
});

/**
 * POST /api/enhancements/topup/checkout
 * Create Stripe checkout session for enhancement top-up
 */
router.post('/topup/checkout', authenticateSession, async (req, res) => {
  try {
    const user = (req as any).session.user;
    if (!user?.id) {
      return res.status(401).json({ ok: false, error: 'Authentication required' });
    }

    const { priceId } = req.body;
    if (!priceId) {
      return res.status(400).json({ ok: false, error: 'priceId is required' });
    }

    // Get enhancement amount from price ID
    const enhancements = enhancementService.getEnhancementsFromPriceId(priceId);
    if (!enhancements) {
      return res.status(400).json({ ok: false, error: 'Invalid price ID' });
    }

    // Initialize Stripe
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      logger.error({ msg: 'Stripe not configured - STRIPE_SECRET_KEY missing' });
      return res.status(500).json({ 
        ok: false, 
        error: 'Stripe payment processing is not configured. Please contact support.' 
      });
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-12-18.acacia' });

    // Get or create Stripe customer
    const { storage } = await import('../storage.js');
    const userRecord = await storage.getUser(user.id);
    if (!userRecord) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }

    let customerId = userRecord.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userRecord.email,
        name: userRecord.username,
        metadata: {
          userId: user.id,
        },
      });
      customerId = customer.id;
      await storage.updateUser(user.id, { stripeCustomerId: customerId });
    } else {
      // Verify customer exists in Stripe, create new one if it doesn't
      try {
        await stripe.customers.retrieve(customerId);
      } catch (error: any) {
        // Customer doesn't exist (e.g., was created in test mode, deleted, or wrong account)
        logger.warn({
          msg: 'Stripe customer not found, creating new one',
          userId: user.id,
          oldCustomerId: customerId,
          error: error.message,
        });
        const customer = await stripe.customers.create({
          email: userRecord.email,
          name: userRecord.username,
          metadata: {
            userId: user.id,
          },
        });
        customerId = customer.id;
        await storage.updateUser(user.id, { stripeCustomerId: customerId });
      }
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.APP_URL || 'http://localhost:5001'}/enhancements/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL || 'http://localhost:5001'}/enhancements?canceled=true`,
      metadata: {
        userId: user.id,
        type: 'topup',
        enhancements: enhancements.toString(),
      },
    });

    res.json({
      ok: true,
      url: session.url,
      sessionId: session.id,
      enhancements,
    });
  } catch (error: any) {
    logger.error({ msg: 'Failed to create top-up checkout', err: error });
    res.status(500).json({ ok: false, error: error.message || 'Failed to create checkout session' });
  }
});

/**
 * POST /api/enhancements/topup/webhook
 * Handle Stripe webhook for top-up completion
 * NOTE: This endpoint must use express.raw() middleware for signature verification
 */
router.post('/topup/webhook', async (req, res) => {
  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    // Use separate webhook secret for top-ups
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET_TOPUP || process.env.STRIPE_WEBHOOK_SECRET;

    if (!stripeSecretKey || !webhookSecret) {
      logger.error({ msg: 'Stripe not configured - missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET_TOPUP' });
      return res.status(500).json({ error: 'Stripe payment processing is not configured. Please contact support.' });
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-12-18.acacia' });
    const sig = req.headers['stripe-signature'];

    if (!sig) {
      return res.status(400).json({ error: 'Missing stripe-signature header' });
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

    // Handle checkout.session.completed for top-ups
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      
      // Check if this is a top-up (not a subscription)
      if (session.mode === 'payment' && session.metadata?.type === 'topup') {
        const userId = session.metadata.userId;
        const enhancements = parseInt(session.metadata.enhancements || '0');

        if (userId && enhancements > 0) {
          // Add enhancements to user account
          await enhancementService.addEnhancements(
            userId,
            enhancements,
            'topup',
            `Enhancement top-up purchase - ${enhancements} enhancements`,
            session.payment_intent as string
          );

          logger.info({
            msg: 'Top-up enhancements added',
            userId,
            enhancements,
            sessionId: session.id,
          });
        }
      }
    }

    res.json({ received: true });
  } catch (error: any) {
    logger.error({ msg: 'Top-up webhook error', err: error });
    res.status(500).json({ error: 'Webhook handler error' });
  }
});

/**
 * GET /api/enhancements/calculate
 * Calculate enhancement cost for an enhancement job
 * Always returns 1 (all enhancements cost 1)
 */
router.get('/calculate', authenticateSession, async (req, res) => {
  try {
    const { enhancementType, hasMask } = req.query;

    if (!enhancementType || typeof enhancementType !== 'string') {
      return res.status(400).json({ ok: false, error: 'enhancementType is required' });
    }

    const hasMaskBool = hasMask === 'true' || hasMask === true;
    const enhancements = enhancementService.calculateEnhancements(enhancementType, hasMaskBool);

    res.json({
      ok: true,
      enhancementType,
      hasMask: hasMaskBool,
      enhancements,
    });
  } catch (error: any) {
    logger.error({ msg: 'Failed to calculate enhancements', err: error });
    res.status(500).json({ ok: false, error: 'Failed to calculate enhancements' });
  }
});

export { router as enhancementRoutes };

