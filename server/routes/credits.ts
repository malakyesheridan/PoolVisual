/**
 * Credit Routes
 * Handles credit balance, top-ups, and calculations
 */

import { Router } from 'express';
import { authenticateSession } from '../lib/authHelper.js';
import { creditService } from '../lib/creditService.js';
import { logger } from '../lib/logger.js';
import Stripe from 'stripe';

const router = Router();

/**
 * GET /api/credits/balance
 * Get user's credit balance
 */
router.get('/balance', authenticateSession, async (req, res) => {
  try {
    const user = (req as any).session.user;
    if (!user?.id) {
      return res.status(401).json({ ok: false, error: 'Authentication required' });
    }

    const balance = await creditService.getCreditBalance(user.id);
    res.json({ ok: true, balance });
  } catch (error: any) {
    logger.error({ msg: 'Failed to get credit balance', err: error });
    res.status(500).json({ ok: false, error: 'Failed to get credit balance' });
  }
});

/**
 * POST /api/credits/topup/checkout
 * Create Stripe checkout session for credit top-up
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

    // Get credit amount from price ID
    const credits = creditService.getCreditsFromPriceId(priceId);
    if (!credits) {
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
      success_url: `${process.env.APP_URL || 'http://localhost:5001'}/credits/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL || 'http://localhost:5001'}/credits?canceled=true`,
      metadata: {
        userId: user.id,
        type: 'topup',
        credits: credits.toString(),
      },
    });

    res.json({
      ok: true,
      url: session.url,
      sessionId: session.id,
      credits,
    });
  } catch (error: any) {
    logger.error({ msg: 'Failed to create top-up checkout', err: error });
    res.status(500).json({ ok: false, error: error.message || 'Failed to create checkout session' });
  }
});

/**
 * POST /api/credits/topup/webhook
 * Handle Stripe webhook for top-up completion
 * NOTE: This endpoint must use express.raw() middleware for signature verification
 */
router.post('/topup/webhook', async (req, res) => {
  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!stripeSecretKey || !webhookSecret) {
      logger.error({ msg: 'Stripe not configured - missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET' });
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
        const credits = parseInt(session.metadata.credits || '0');

        if (userId && credits > 0) {
          // Add credits to user account
          await creditService.addCredits(
            userId,
            credits,
            'topup',
            `Credit top-up purchase - ${credits} credits`,
            session.payment_intent as string
          );

          logger.info({
            msg: 'Top-up credits added',
            userId,
            credits,
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
 * GET /api/credits/calculate
 * Calculate credit cost for an enhancement
 */
router.get('/calculate', authenticateSession, async (req, res) => {
  try {
    const { enhancementType, hasMask } = req.query;

    if (!enhancementType || typeof enhancementType !== 'string') {
      return res.status(400).json({ ok: false, error: 'enhancementType is required' });
    }

    const hasMaskBool = hasMask === 'true' || hasMask === true;
    const credits = creditService.calculateCredits(enhancementType, hasMaskBool);

    res.json({
      ok: true,
      enhancementType,
      hasMask: hasMaskBool,
      credits,
    });
  } catch (error: any) {
    logger.error({ msg: 'Failed to calculate credits', err: error });
    res.status(500).json({ ok: false, error: 'Failed to calculate credits' });
  }
});

export { router as creditRoutes };
