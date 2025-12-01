/**
 * Subscription Service
 * Manages subscription plans, assignments, and feature access
 */

import { storage } from '../storage.js';
import { logger } from './logger.js';
import Stripe from 'stripe';
import { creditService } from './creditService.js';

export interface SubscriptionPlan {
  id: string;
  planKey: string;
  name: string;
  industry: 'trades' | 'real_estate';
  tier: 't1' | 't2' | 't3';
  priceMonthly: number | null;
  priceYearly: number | null;
  stripePriceIdMonthly: string | null;
  stripePriceIdYearly: string | null;
  features: {
    materials?: boolean;
    quotes?: boolean;
    enhancements?: string[];
    bulkOperations?: boolean;
    apiAccess?: boolean;
    [key: string]: any;
  };
  isActive: boolean;
  displayOrder: number;
}

export interface SubscriptionHistoryEntry {
  id: string;
  orgId: string | null; // Deprecated, kept for backward compatibility
  userId: string | null; // User who owns this subscription history
  planId: string | null;
  eventType: 'created' | 'activated' | 'updated' | 'canceled' | 'expired' | 
             'payment_succeeded' | 'payment_failed' | 'trial_started' | 'trial_ended';
  fromStatus: string | null;
  toStatus: string | null;
  fromTier: string | null;
  toTier: string | null;
  stripeEventId: string | null;
  stripeSubscriptionId: string | null;
  metadata: Record<string, any>;
  createdAt: Date;
}

export class SubscriptionService {
  private stripe: Stripe | null;

  constructor() {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    this.stripe = secretKey 
      ? new Stripe(secretKey, { apiVersion: '2024-12-18.acacia' })
      : null;
  }

  /**
   * Get all active plans for an industry
   */
  async getPlansByIndustry(industry: 'trades' | 'real_estate'): Promise<SubscriptionPlan[]> {
    try {
      const plans = await storage.getSubscriptionPlans(industry);
      // Convert numeric strings to numbers (PostgreSQL numeric type returns as string)
      const normalizedPlans = plans.map(plan => {
        const normalizePrice = (price: any): number | null => {
          if (price === null || price === undefined) return null;
          if (typeof price === 'number') return isNaN(price) ? null : price;
          if (typeof price === 'string') {
            const parsed = parseFloat(price);
            return isNaN(parsed) ? null : parsed;
          }
          return null;
        };
        return {
          ...plan,
          priceMonthly: normalizePrice(plan.priceMonthly),
          priceYearly: normalizePrice(plan.priceYearly),
        };
      });
      return normalizedPlans.filter(p => p.isActive).sort((a, b) => a.displayOrder - b.displayOrder);
    } catch (error) {
      logger.error({ msg: 'Failed to get plans', err: error, industry });
      throw error;
    }
  }

  /**
   * Get plan by key
   */
  async getPlanByKey(planKey: string): Promise<SubscriptionPlan | null> {
    try {
      return await storage.getSubscriptionPlanByKey(planKey);
    } catch (error) {
      logger.error({ msg: 'Failed to get plan', err: error, planKey });
      return null;
    }
  }

  /**
   * Assign plan to user (replaces assignPlanToOrg)
   */
  async assignPlanToUser(
    userId: string,
    planKey: string,
    stripeCustomerId?: string,
    stripeSubscriptionId?: string
  ): Promise<void> {
    try {
      const plan = await this.getPlanByKey(planKey);
      if (!plan) {
        throw new Error(`Plan not found: ${planKey}`);
      }

      const user = await storage.getUser(userId);
      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      const previousStatus = user.subscriptionStatus || 'trial';
      const previousTier = user.subscriptionTier || 't1';

      // Get monthly credits for this plan
      const monthlyCredits = this.getMonthlyCreditsForPlan(planKey);

      // Update user
      await storage.updateUser(userId, {
        subscriptionPlanId: plan.id,
        subscriptionTier: plan.tier,
        subscriptionStatus: 'active',
        industryType: plan.industry,
        stripeCustomerId: stripeCustomerId || user.stripeCustomerId,
        stripeSubscriptionId: stripeSubscriptionId || user.stripeSubscriptionId,
        subscriptionStartedAt: new Date(),
        subscriptionExpiresAt: this.calculateExpirationDate('yearly'), // Default to yearly
      });

      // Allocate initial monthly credits
      if (monthlyCredits > 0) {
        await creditService.resetMonthlyCredits(userId, monthlyCredits);
      }

      // Record history
      await this.recordHistory({
        userId,
        planId: plan.id,
        eventType: 'activated',
        fromStatus: previousStatus,
        toStatus: 'active',
        fromTier: previousTier,
        toTier: plan.tier,
        stripeSubscriptionId: stripeSubscriptionId || undefined,
        metadata: { planKey, monthlyCredits },
      });

      logger.info({
        msg: 'Plan assigned to user',
        userId,
        planKey,
        tier: plan.tier,
        industry: plan.industry,
        monthlyCredits,
      });
    } catch (error) {
      logger.error({
        msg: 'Failed to assign plan',
        err: error,
        userId,
        planKey,
      });
      throw error;
    }
  }

  /**
   * Get monthly credits for a plan
   */
  private getMonthlyCreditsForPlan(planKey: string): number {
    const planCredits: Record<string, number> = {
      'easyflow_solo': 250,
      'easyflow_pro': 500,
      'easyflow_business': 2500,
    };
    return planCredits[planKey] || 0;
  }

  /**
   * Get user subscription status
   */
  async getUserSubscription(userId: string): Promise<{
    plan: SubscriptionPlan | null;
    status: string;
    tier: string;
    expiresAt: Date | null;
  }> {
    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const plan = user.subscriptionPlanId
      ? await storage.getSubscriptionPlan(user.subscriptionPlanId)
      : null;

    return {
      plan,
      status: user.subscriptionStatus || 'trial',
      tier: user.subscriptionTier || 't1',
      expiresAt: user.subscriptionExpiresAt || null,
    };
  }

  /**
   * Record subscription history
   */
  private async recordHistory(data: {
    userId?: string;
    orgId?: string; // Deprecated, kept for backward compatibility
    planId: string | null;
    eventType: SubscriptionHistoryEntry['eventType'];
    fromStatus?: string | null;
    toStatus?: string | null;
    fromTier?: string | null;
    toTier?: string | null;
    stripeEventId?: string;
    stripeSubscriptionId?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      await storage.createSubscriptionHistory({
        userId: data.userId || null,
        orgId: data.orgId || null, // Deprecated
        planId: data.planId,
        eventType: data.eventType,
        fromStatus: data.fromStatus || null,
        toStatus: data.toStatus || null,
        fromTier: data.fromTier || null,
        toTier: data.toTier || null,
        stripeEventId: data.stripeEventId || null,
        stripeSubscriptionId: data.stripeSubscriptionId || null,
        metadata: data.metadata || {},
      });
    } catch (error) {
      logger.error({
        msg: 'Failed to record subscription history',
        err: error,
        data,
      });
      // Don't throw - history is non-critical
    }
  }

  /**
   * Calculate expiration date
   */
  private calculateExpirationDate(period: 'monthly' | 'yearly'): Date {
    const date = new Date();
    if (period === 'yearly') {
      date.setFullYear(date.getFullYear() + 1);
    } else {
      date.setMonth(date.getMonth() + 1);
    }
    return date;
  }

  /**
   * Check if a plan is a placeholder (test plan without real Stripe integration)
   */
  private isPlaceholderPlan(plan: SubscriptionPlan, billingPeriod: 'monthly' | 'yearly'): boolean {
    const priceId = billingPeriod === 'monthly'
      ? plan.stripePriceIdMonthly
      : plan.stripePriceIdYearly;
    
    return priceId?.startsWith('placeholder_') || false;
  }

  /**
   * Create Stripe checkout session (or skip for placeholder plans)
   */
  async createCheckoutSession(
    userId: string,
    planKey: string,
    billingPeriod: 'monthly' | 'yearly'
  ): Promise<{ url: string; sessionId: string; isPlaceholder?: boolean }> {
    const plan = await this.getPlanByKey(planKey);
    if (!plan) {
      throw new Error('Plan not found');
    }

    // Use creditService to get plan details from price ID
    const priceId = billingPeriod === 'monthly'
      ? plan.stripePriceIdMonthly
      : plan.stripePriceIdYearly;

    if (priceId) {
      const planDetails = creditService.getPlanFromPriceId(priceId);
      if (planDetails) {
        // Update planKey if it differs
        if (planDetails.planKey !== planKey) {
          logger.warn({
            msg: 'Plan key mismatch',
            provided: planKey,
            fromPriceId: planDetails.planKey,
          });
        }
      }
    }

    // Check if this is a placeholder plan
    if (this.isPlaceholderPlan(plan, billingPeriod)) {
      // For placeholder plans, directly assign the plan without Stripe
      logger.info({
        msg: 'Placeholder plan selected - skipping Stripe checkout',
        userId,
        planKey,
        billingPeriod,
      });

      // Assign plan directly
      await this.assignPlanToUser(userId, planKey);

      // Set expiration date for placeholder plans (1 year for yearly, 1 month for monthly)
      const expirationDate = this.calculateExpirationDate(billingPeriod);
      await storage.updateUser(userId, {
        subscriptionExpiresAt: expirationDate,
        subscriptionStartedAt: new Date(),
      });

      // Record activation
      await this.recordHistory({
        userId,
        planId: plan.id,
        eventType: 'activated',
        fromStatus: 'trial',
        toStatus: 'active',
        fromTier: null,
        toTier: plan.tier,
        metadata: {
          billingPeriod,
          isPlaceholder: true,
          note: 'Placeholder plan - no payment required',
        },
      });

      // Return a success URL that the frontend can handle
      return {
        url: `/subscribe/success?session_id=placeholder_${Date.now()}&plan_key=${planKey}`,
        sessionId: `placeholder_${Date.now()}`,
        isPlaceholder: true,
      };
    }

    // Real Stripe checkout for non-placeholder plans
    if (!this.stripe) {
      logger.error({ msg: 'Stripe not configured - STRIPE_SECRET_KEY missing' });
      throw new Error('Stripe payment processing is not configured. Please contact support.');
    }

    if (!priceId) {
      throw new Error(`Price ID not found for ${billingPeriod} billing`);
    }

    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Create or get Stripe customer - validate customer exists
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await this.stripe.customers.create({
        email: user.email,
        name: user.username,
        metadata: {
          userId: user.id,
        },
      });
      customerId = customer.id;
      await storage.updateUser(userId, { stripeCustomerId: customerId });
    } else {
      // Verify customer exists in Stripe, create new one if it doesn't
      try {
        await this.stripe.customers.retrieve(customerId);
      } catch (error: any) {
        // Customer doesn't exist (e.g., was created in test mode, deleted, or wrong account)
        logger.warn({
          msg: 'Stripe customer not found, creating new one',
          userId,
          oldCustomerId: customerId,
          error: error.message,
        });
        const customer = await this.stripe.customers.create({
          email: user.email,
          name: user.username,
          metadata: {
            userId: user.id,
          },
        });
        customerId = customer.id;
        await storage.updateUser(userId, { stripeCustomerId: customerId });
      }
    }

    // Create checkout session
    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.APP_URL || 'http://localhost:5001'}/subscribe/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL || 'http://localhost:5001'}/subscribe?canceled=true`,
      metadata: {
        userId: user.id,
        planKey: planKey,
        billingPeriod: billingPeriod,
      },
      subscription_data: {
        metadata: {
          userId: user.id,
          planKey: planKey,
        },
      },
    });

    return {
      url: session.url!,
      sessionId: session.id,
    };
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.payment_succeeded':
        await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        logger.info({ msg: 'Unhandled webhook event', type: event.type });
    }
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const userId = session.metadata?.userId;
    const planKey = session.metadata?.planKey;

    if (!userId || !planKey) {
      logger.error({ msg: 'Missing metadata in checkout session', sessionId: session.id });
      return;
    }

    await this.assignPlanToUser(
      userId,
      planKey,
      session.customer as string,
      session.subscription as string
    );
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    const userId = subscription.metadata?.userId;
    if (!userId) return;

    const user = await storage.getUser(userId);
    if (!user) return;

    const status = subscription.status;
    const mappedStatus = this.mapStripeStatus(status);

    await storage.updateUser(userId, {
      subscriptionStatus: mappedStatus,
      stripeSubscriptionId: subscription.id,
    });

    await this.recordHistory({
      userId,
      planId: user.subscriptionPlanId || null,
      eventType: 'updated',
      toStatus: mappedStatus,
      stripeEventId: subscription.id,
      stripeSubscriptionId: subscription.id,
      metadata: { stripeStatus: status },
    });
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const userId = subscription.metadata?.userId;
    if (!userId) return;

    await storage.updateUser(userId, {
      subscriptionStatus: 'canceled',
    });

    await this.recordHistory({
      userId,
      planId: null,
      eventType: 'canceled',
      toStatus: 'canceled',
      stripeEventId: subscription.id,
      stripeSubscriptionId: subscription.id,
    });
  }

  private async handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    const subscriptionId = invoice.subscription as string;
    if (!subscriptionId) return;

    // Find user by subscription ID
    const user = await this.getUserByStripeSubscription(subscriptionId);
    if (!user) return;

    // Get plan to determine monthly credits
    const plan = user.subscriptionPlanId
      ? await storage.getSubscriptionPlan(user.subscriptionPlanId)
      : null;

    if (plan) {
      // Reset monthly credits on payment succeeded
      const monthlyCredits = this.getMonthlyCreditsForPlan(plan.planKey);
      if (monthlyCredits > 0) {
        await creditService.resetMonthlyCredits(user.id, monthlyCredits);
      }
    }

    await this.recordHistory({
      userId: user.id,
      planId: user.subscriptionPlanId || null,
      eventType: 'payment_succeeded',
      stripeEventId: invoice.id,
      stripeSubscriptionId: subscriptionId,
      metadata: { amount: invoice.amount_paid },
    });
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const subscriptionId = invoice.subscription as string;
    if (!subscriptionId) return;

    const user = await this.getUserByStripeSubscription(subscriptionId);
    if (!user) return;

    await storage.updateUser(user.id, {
      subscriptionStatus: 'past_due',
    });

    await this.recordHistory({
      userId: user.id,
      planId: user.subscriptionPlanId || null,
      eventType: 'payment_failed',
      toStatus: 'past_due',
      stripeEventId: invoice.id,
      stripeSubscriptionId: subscriptionId,
    });
  }

  /**
   * Get user by Stripe subscription ID
   */
  private async getUserByStripeSubscription(subscriptionId: string) {
    try {
      const user = await storage.getUserByStripeSubscription(subscriptionId);
      return user || null;
    } catch (error) {
      logger.error({ msg: 'Failed to get user by subscription ID', err: error, subscriptionId });
      return null;
    }
  }

  private mapStripeStatus(status: string): 'trial' | 'active' | 'past_due' | 'canceled' | 'expired' {
    const mapping: Record<string, 'trial' | 'active' | 'past_due' | 'canceled' | 'expired'> = {
      'trialing': 'trial',
      'active': 'active',
      'past_due': 'past_due',
      'canceled': 'canceled',
      'unpaid': 'expired',
      'incomplete': 'trial',
      'incomplete_expired': 'expired',
    };
    return mapping[status] || 'trial';
  }
}

export const subscriptionService = new SubscriptionService();
