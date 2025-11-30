/**
 * Subscription Service
 * Manages subscription plans, assignments, and feature access
 */

import { storage } from '../storage.js';
import { logger } from './logger.js';
import Stripe from 'stripe';

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
  orgId: string;
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
      return plans.filter(p => p.isActive).sort((a, b) => a.displayOrder - b.displayOrder);
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
   * Assign plan to organization
   */
  async assignPlanToOrg(
    orgId: string,
    planKey: string,
    stripeCustomerId?: string,
    stripeSubscriptionId?: string
  ): Promise<void> {
    try {
      const plan = await this.getPlanByKey(planKey);
      if (!plan) {
        throw new Error(`Plan not found: ${planKey}`);
      }

      const org = await storage.getOrg(orgId);
      if (!org) {
        throw new Error(`Organization not found: ${orgId}`);
      }

      const previousStatus = org.subscriptionStatus || 'trial';
      const previousTier = org.subscriptionTier || 't1';

      // Update org
      await storage.updateOrg(orgId, {
        subscriptionPlanId: plan.id,
        subscriptionTier: plan.tier,
        subscriptionStatus: 'active',
        industry: plan.industry,
        industryLocked: true, // Lock industry when plan is assigned
        stripeCustomerId: stripeCustomerId || org.stripeCustomerId,
        stripeSubscriptionId: stripeSubscriptionId || org.stripeSubscriptionId,
        subscriptionStartedAt: new Date(),
        subscriptionExpiresAt: this.calculateExpirationDate('yearly'), // Default to yearly
      });

      // Record history
      await this.recordHistory({
        orgId,
        planId: plan.id,
        eventType: 'activated',
        fromStatus: previousStatus,
        toStatus: 'active',
        fromTier: previousTier,
        toTier: plan.tier,
        stripeSubscriptionId: stripeSubscriptionId || undefined,
        metadata: { planKey },
      });

      logger.info({
        msg: 'Plan assigned to org',
        orgId,
        planKey,
        tier: plan.tier,
        industry: plan.industry,
      });
    } catch (error) {
      logger.error({
        msg: 'Failed to assign plan',
        err: error,
        orgId,
        planKey,
      });
      throw error;
    }
  }

  /**
   * Check if org has access to a feature
   */
  async canAccessFeature(orgId: string, feature: string): Promise<boolean> {
    try {
      const org = await storage.getOrg(orgId);
      if (!org?.subscriptionPlanId) {
        return false;
      }

      const plan = await storage.getSubscriptionPlan(org.subscriptionPlanId);
      if (!plan || !plan.isActive) {
        return false;
      }

      const features = plan.features as any;
      
      // Check direct feature flag
      if (features[feature] === true) {
        return true;
      }

      // Check if feature is in array (e.g., enhancements)
      if (Array.isArray(features[feature]) && features[feature].length > 0) {
        return true;
      }

      // Special case: materials for real estate T3
      if (feature === 'materials' && org.industry === 'real_estate' && org.subscriptionTier === 't3') {
        return true;
      }

      return false;
    } catch (error) {
      logger.error({
        msg: 'Failed to check feature access',
        err: error,
        orgId,
        feature,
      });
      return false;
    }
  }

  /**
   * Get org subscription status
   */
  async getOrgSubscription(orgId: string): Promise<{
    plan: SubscriptionPlan | null;
    status: string;
    tier: string;
    expiresAt: Date | null;
  }> {
    const org = await storage.getOrg(orgId);
    if (!org) {
      throw new Error('Organization not found');
    }

    const plan = org.subscriptionPlanId
      ? await storage.getSubscriptionPlan(org.subscriptionPlanId)
      : null;

    return {
      plan,
      status: org.subscriptionStatus || 'trial',
      tier: org.subscriptionTier || 't1',
      expiresAt: org.subscriptionExpiresAt || null,
    };
  }

  /**
   * Record subscription history
   */
  private async recordHistory(data: {
    orgId: string;
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
        orgId: data.orgId,
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
    orgId: string,
    planKey: string,
    billingPeriod: 'monthly' | 'yearly'
  ): Promise<{ url: string; sessionId: string; isPlaceholder?: boolean }> {
    const plan = await this.getPlanByKey(planKey);
    if (!plan) {
      throw new Error('Plan not found');
    }

    // Check if this is a placeholder plan
    if (this.isPlaceholderPlan(plan, billingPeriod)) {
      // For placeholder plans, directly assign the plan without Stripe
      logger.info({
        msg: 'Placeholder plan selected - skipping Stripe checkout',
        orgId,
        planKey,
        billingPeriod,
      });

      // Assign plan directly
      await this.assignPlanToOrg(orgId, planKey);

      // Set expiration date for placeholder plans (1 year for yearly, 1 month for monthly)
      const expirationDate = this.calculateExpirationDate(billingPeriod);
      await storage.updateOrg(orgId, {
        subscriptionExpiresAt: expirationDate,
        subscriptionStartedAt: new Date(),
      });

      // Record activation
      await this.recordHistory({
        orgId,
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
      throw new Error('Stripe not configured');
    }

    const priceId = billingPeriod === 'monthly'
      ? plan.stripePriceIdMonthly
      : plan.stripePriceIdYearly;

    if (!priceId) {
      throw new Error(`Price ID not found for ${billingPeriod} billing`);
    }

    const org = await storage.getOrg(orgId);
    if (!org) {
      throw new Error('Organization not found');
    }

    // Create or get Stripe customer
    let customerId = org.stripeCustomerId;
    if (!customerId) {
      const customer = await this.stripe.customers.create({
        email: org.contactEmail || undefined,
        name: org.name,
        metadata: {
          orgId: org.id,
        },
      });
      customerId = customer.id;
      await storage.updateOrg(orgId, { stripeCustomerId: customerId });
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
        orgId: org.id,
        planKey: planKey,
        billingPeriod: billingPeriod,
      },
      subscription_data: {
        metadata: {
          orgId: org.id,
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
    const orgId = session.metadata?.orgId;
    const planKey = session.metadata?.planKey;

    if (!orgId || !planKey) {
      logger.error({ msg: 'Missing metadata in checkout session', sessionId: session.id });
      return;
    }

    await this.assignPlanToOrg(
      orgId,
      planKey,
      session.customer as string,
      session.subscription as string
    );
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    const orgId = subscription.metadata?.orgId;
    if (!orgId) return;

    const org = await storage.getOrg(orgId);
    if (!org) return;

    const status = subscription.status;
    const mappedStatus = this.mapStripeStatus(status);

    await storage.updateOrg(orgId, {
      subscriptionStatus: mappedStatus,
      stripeSubscriptionId: subscription.id,
    });

    await this.recordHistory({
      orgId,
      planId: org.subscriptionPlanId || null,
      eventType: 'updated',
      toStatus: mappedStatus,
      stripeEventId: subscription.id,
      stripeSubscriptionId: subscription.id,
      metadata: { stripeStatus: status },
    });
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const orgId = subscription.metadata?.orgId;
    if (!orgId) return;

    await storage.updateOrg(orgId, {
      subscriptionStatus: 'canceled',
    });

    await this.recordHistory({
      orgId,
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

    // Find org by subscription ID
    const org = await storage.getOrgByStripeSubscription(subscriptionId);
    if (!org) return;

    await this.recordHistory({
      orgId: org.id,
      planId: org.subscriptionPlanId || null,
      eventType: 'payment_succeeded',
      stripeEventId: invoice.id,
      stripeSubscriptionId: subscriptionId,
      metadata: { amount: invoice.amount_paid },
    });
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const subscriptionId = invoice.subscription as string;
    if (!subscriptionId) return;

    const org = await storage.getOrgByStripeSubscription(subscriptionId);
    if (!org) return;

    await storage.updateOrg(org.id, {
      subscriptionStatus: 'past_due',
    });

    await this.recordHistory({
      orgId: org.id,
      planId: org.subscriptionPlanId || null,
      eventType: 'payment_failed',
      toStatus: 'past_due',
      stripeEventId: invoice.id,
      stripeSubscriptionId: subscriptionId,
    });
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
