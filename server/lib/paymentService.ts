/**
 * Payment Service
 * 
 * Stripe integration for quote deposits and payments
 * Handles payment intents, webhooks, and payment processing
 */

import Stripe from 'stripe';
import { storage } from '../storage.js';
import { emailService } from './emailService.js';
import { Quote } from '../../shared/schema.js';

export interface PaymentIntentData {
  clientSecret: string;
  paymentIntentId: string;
  amount: number;
  currency: string;
}

export interface PaymentResult {
  success: boolean;
  paymentIntentId?: string;
  error?: string;
}

export class PaymentService {
  private stripe: Stripe;
  private webhookSecret: string;

  constructor() {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      console.warn('[PaymentService] STRIPE_SECRET_KEY not found, payment functionality will be disabled');
      this.stripe = null as any;
    } else {
      this.stripe = new Stripe(secretKey, {
        apiVersion: '2024-12-18.acacia',
      });
    }
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
  }

  async createPaymentIntent(quoteId: string, clientEmail?: string): Promise<PaymentIntentData> {
    if (!this.stripe) {
      throw new Error('Payment service not configured - STRIPE_SECRET_KEY is missing');
    }

    try {
      const quote = await storage.getQuote(quoteId);
      if (!quote) {
        throw new Error('Quote not found');
      }

      const job = await storage.getJob(quote.jobId);
      if (!job) {
        throw new Error('Job not found');
      }

      const organization = await storage.getOrg(job.orgId);
      if (!organization) {
        throw new Error('Organization not found');
      }

      const settings = await storage.getOrgSettings(job.orgId);
      if (!settings) {
        throw new Error('Organization settings not found');
      }

      // Calculate deposit amount
      const total = parseFloat(quote.total);
      const depositAmount = total * parseFloat(quote.depositPct);
      const amountInCents = Math.round(depositAmount * 100);

      // Create payment intent
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: amountInCents,
        currency: settings.currencyCode.toLowerCase(),
        metadata: {
          quoteId,
          jobId: quote.jobId,
          orgId: job.orgId,
          type: 'deposit'
        },
        description: `Deposit for Quote #${quoteId.substring(0, 8)} - ${organization.name}`,
        receipt_email: clientEmail,
        automatic_payment_methods: {
          enabled: true,
        },
      });

      // Update quote with payment intent ID
      await storage.updateQuote(quoteId, {
        stripePaymentIntentId: paymentIntent.id
      });

      return {
        clientSecret: paymentIntent.client_secret!,
        paymentIntentId: paymentIntent.id,
        amount: depositAmount,
        currency: settings.currencyCode
      };

    } catch (error) {
      console.error('[PaymentService] Error creating payment intent:', error);
      throw new Error(`Failed to create payment intent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async handlePaymentSuccess(paymentIntentId: string): Promise<void> {
    try {
      // Retrieve payment intent from Stripe
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      
      if (paymentIntent.status !== 'succeeded') {
        throw new Error('Payment not succeeded');
      }

      const quoteId = paymentIntent.metadata.quoteId;
      if (!quoteId) {
        throw new Error('Quote ID not found in payment metadata');
      }

      // Update quote status to accepted
      await storage.updateQuote(quoteId, {
        status: 'accepted'
      });

      // Send acceptance notification email
      const quote = await storage.getQuote(quoteId);
      if (quote) {
        const job = await storage.getJob(quote.jobId);
        if (job) {
          const organization = await storage.getOrg(job.orgId);
          if (organization?.email) {
            await emailService.sendQuoteAcceptedNotification(quoteId, organization.email);
          }
        }
      }

      console.log(`[PaymentService] Payment succeeded for quote ${quoteId}`);

    } catch (error) {
      console.error('[PaymentService] Error handling payment success:', error);
      throw error;
    }
  }

  async handlePaymentFailure(paymentIntentId: string): Promise<void> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      const quoteId = paymentIntent.metadata.quoteId;
      
      if (quoteId) {
        // Update quote status to declined
        await storage.updateQuote(quoteId, {
          status: 'declined'
        });
        
        console.log(`[PaymentService] Payment failed for quote ${quoteId}`);
      }

    } catch (error) {
      console.error('[PaymentService] Error handling payment failure:', error);
      throw error;
    }
  }

  async processWebhook(body: string, signature: string): Promise<void> {
    try {
      const event = this.stripe.webhooks.constructEvent(body, signature, this.webhookSecret);

      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSuccess(event.data.object.id);
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailure(event.data.object.id);
          break;
        default:
          console.log(`[PaymentService] Unhandled event type: ${event.type}`);
      }

    } catch (error) {
      console.error('[PaymentService] Webhook error:', error);
      throw error;
    }
  }

  async refundPayment(paymentIntentId: string, amount?: number): Promise<void> {
    try {
      const refundData: any = {
        payment_intent: paymentIntentId,
      };

      if (amount) {
        refundData.amount = Math.round(amount * 100); // Convert to cents
      }

      await this.stripe.refunds.create(refundData);
      console.log(`[PaymentService] Refund processed for payment intent ${paymentIntentId}`);

    } catch (error) {
      console.error('[PaymentService] Error processing refund:', error);
      throw new Error(`Failed to process refund: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getPaymentStatus(paymentIntentId: string): Promise<string> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      return paymentIntent.status;
    } catch (error) {
      console.error('[PaymentService] Error retrieving payment status:', error);
      throw new Error(`Failed to retrieve payment status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createCustomer(email: string, name?: string): Promise<string> {
    try {
      const customer = await this.stripe.customers.create({
        email,
        name,
      });
      return customer.id;
    } catch (error) {
      console.error('[PaymentService] Error creating customer:', error);
      throw new Error(`Failed to create customer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getCustomer(customerId: string): Promise<Stripe.Customer> {
    try {
      return await this.stripe.customers.retrieve(customerId) as Stripe.Customer;
    } catch (error) {
      console.error('[PaymentService] Error retrieving customer:', error);
      throw new Error(`Failed to retrieve customer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const paymentService = new PaymentService();
