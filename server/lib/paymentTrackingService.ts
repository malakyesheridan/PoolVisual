/**
 * Enhanced Payment Tracking Service
 * 
 * Builds upon existing Stripe integration to provide comprehensive payment tracking
 * Integrates with existing payment system without modifying existing code
 */

import { logger } from './logger';
import { monitoringService } from './monitoringService';

export interface PaymentTrackingData {
  paymentIntentId: string;
  customerId?: string;
  amount: number;
  currency: string;
  status: string;
  metadata?: Record<string, string>;
  quoteId?: string;
  orgId?: string;
  userId?: string;
  timestamp: Date;
}

export interface PaymentEvent {
  id: string;
  type: string;
  data: PaymentTrackingData;
  processedAt: Date;
  source: 'webhook' | 'api' | 'manual';
}

export interface PaymentAnalytics {
  totalPayments: number;
  totalAmount: number;
  averageAmount: number;
  successRate: number;
  failureRate: number;
  refundRate: number;
  timeRange: {
    start: Date;
    end: Date;
  };
}

export interface PaymentSummary {
  pending: number;
  succeeded: number;
  failed: number;
  refunded: number;
  totalAmount: number;
  recentPayments: PaymentTrackingData[];
}

export class PaymentTrackingService {
  private payments: Map<string, PaymentTrackingData> = new Map();
  private events: PaymentEvent[] = [];
  private isInitialized = false;

  constructor() {
    this.initializeTracking();
  }

  /**
   * Initialize payment tracking
   */
  private initializeTracking(): void {
    if (this.isInitialized) {
      return;
    }

    // Set up periodic cleanup
    setInterval(() => {
      this.cleanupOldData();
    }, 24 * 60 * 60 * 1000); // Daily cleanup

    this.isInitialized = true;
    logger.info({
      msg: 'Payment tracking service initialized'
    });
  }

  /**
   * Track a payment
   * @param paymentData Payment data to track
   * @param source Source of the payment data
   * @returns Promise<void>
   */
  async trackPayment(paymentData: PaymentTrackingData, source: 'webhook' | 'api' | 'manual' = 'api'): Promise<void> {
    try {
      // Store payment data
      this.payments.set(paymentData.paymentIntentId, paymentData);

      // Create payment event
      const event: PaymentEvent = {
        id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'payment.tracked',
        data: paymentData,
        processedAt: new Date(),
        source
      };

      this.events.push(event);

      // Log payment tracking
      logger.info({
        msg: 'Payment tracked',
        meta: {
          paymentIntentId: paymentData.paymentIntentId,
          amount: paymentData.amount,
          currency: paymentData.currency,
          status: paymentData.status,
          source,
          quoteId: paymentData.quoteId,
          orgId: paymentData.orgId
        }
      });

      // Send to monitoring service
      monitoringService.captureEvent({
        message: 'Payment tracked',
        level: 'info',
        tags: {
          payment_status: paymentData.status,
          currency: paymentData.currency,
          source
        },
        extra: {
          paymentIntentId: paymentData.paymentIntentId,
          amount: paymentData.amount,
          quoteId: paymentData.quoteId,
          orgId: paymentData.orgId
        }
      });

      // Record performance metric
      monitoringService.recordMetric('payment.tracked', 1, 'count', {
        status: paymentData.status,
        currency: paymentData.currency
      });

    } catch (error) {
      logger.error({
        msg: 'Failed to track payment',
        err: error,
        meta: { paymentData, source }
      });
      throw new Error(`Failed to track payment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update payment status
   * @param paymentIntentId Payment intent ID
   * @param status New status
   * @param metadata Additional metadata
   * @returns Promise<void>
   */
  async updatePaymentStatus(
    paymentIntentId: string, 
    status: string, 
    metadata?: Record<string, string>
  ): Promise<void> {
    try {
      const payment = this.payments.get(paymentIntentId);
      if (!payment) {
        throw new Error(`Payment not found: ${paymentIntentId}`);
      }

      const previousStatus = payment.status;
      payment.status = status;
      
      if (metadata) {
        payment.metadata = { ...payment.metadata, ...metadata };
      }

      // Create status update event
      const event: PaymentEvent = {
        id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'payment.status_updated',
        data: payment,
        processedAt: new Date(),
        source: 'api'
      };

      this.events.push(event);

      logger.info({
        msg: 'Payment status updated',
        meta: {
          paymentIntentId,
          previousStatus,
          newStatus: status,
          amount: payment.amount,
          currency: payment.currency
        }
      });

      // Send to monitoring service
      monitoringService.captureEvent({
        message: 'Payment status updated',
        level: 'info',
        tags: {
          previous_status: previousStatus,
          new_status: status,
          currency: payment.currency
        },
        extra: {
          paymentIntentId,
          amount: payment.amount,
          quoteId: payment.quoteId,
          orgId: payment.orgId
        }
      });

    } catch (error) {
      logger.error({
        msg: 'Failed to update payment status',
        err: error,
        meta: { paymentIntentId, status, metadata }
      });
      throw new Error(`Failed to update payment status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get payment by ID
   * @param paymentIntentId Payment intent ID
   * @returns Promise<PaymentTrackingData | null>
   */
  async getPayment(paymentIntentId: string): Promise<PaymentTrackingData | null> {
    try {
      return this.payments.get(paymentIntentId) || null;
    } catch (error) {
      logger.error({
        msg: 'Failed to get payment',
        err: error,
        meta: { paymentIntentId }
      });
      return null;
    }
  }

  /**
   * Get payments for an organization
   * @param orgId Organization ID
   * @param limit Maximum number of payments to return
   * @returns Promise<PaymentTrackingData[]>
   */
  async getPaymentsForOrg(orgId: string, limit: number = 100): Promise<PaymentTrackingData[]> {
    try {
      const orgPayments = Array.from(this.payments.values())
        .filter(payment => payment.orgId === orgId)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, limit);

      return orgPayments;
    } catch (error) {
      logger.error({
        msg: 'Failed to get payments for organization',
        err: error,
        meta: { orgId, limit }
      });
      return [];
    }
  }

  /**
   * Get payments for a quote
   * @param quoteId Quote ID
   * @returns Promise<PaymentTrackingData[]>
   */
  async getPaymentsForQuote(quoteId: string): Promise<PaymentTrackingData[]> {
    try {
      const quotePayments = Array.from(this.payments.values())
        .filter(payment => payment.quoteId === quoteId)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      return quotePayments;
    } catch (error) {
      logger.error({
        msg: 'Failed to get payments for quote',
        err: error,
        meta: { quoteId }
      });
      return [];
    }
  }

  /**
   * Get payment summary for an organization
   * @param orgId Organization ID
   * @param timeRange Time range in days
   * @returns Promise<PaymentSummary>
   */
  async getPaymentSummary(orgId: string, timeRange: number = 30): Promise<PaymentSummary> {
    try {
      const cutoffDate = new Date(Date.now() - timeRange * 24 * 60 * 60 * 1000);
      
      const orgPayments = Array.from(this.payments.values())
        .filter(payment => 
          payment.orgId === orgId && 
          payment.timestamp >= cutoffDate
        );

      const summary: PaymentSummary = {
        pending: 0,
        succeeded: 0,
        failed: 0,
        refunded: 0,
        totalAmount: 0,
        recentPayments: orgPayments.slice(0, 10)
      };

      orgPayments.forEach(payment => {
        switch (payment.status) {
          case 'requires_payment_method':
          case 'requires_confirmation':
          case 'requires_action':
            summary.pending++;
            break;
          case 'succeeded':
            summary.succeeded++;
            summary.totalAmount += payment.amount;
            break;
          case 'canceled':
          case 'payment_failed':
            summary.failed++;
            break;
          case 'refunded':
            summary.refunded++;
            break;
        }
      });

      return summary;

    } catch (error) {
      logger.error({
        msg: 'Failed to get payment summary',
        err: error,
        meta: { orgId, timeRange }
      });
      return {
        pending: 0,
        succeeded: 0,
        failed: 0,
        refunded: 0,
        totalAmount: 0,
        recentPayments: []
      };
    }
  }

  /**
   * Get payment analytics
   * @param orgId Organization ID
   * @param timeRange Time range in days
   * @returns Promise<PaymentAnalytics>
   */
  async getPaymentAnalytics(orgId: string, timeRange: number = 30): Promise<PaymentAnalytics> {
    try {
      const cutoffDate = new Date(Date.now() - timeRange * 24 * 60 * 60 * 1000);
      
      const orgPayments = Array.from(this.payments.values())
        .filter(payment => 
          payment.orgId === orgId && 
          payment.timestamp >= cutoffDate
        );

      const succeededPayments = orgPayments.filter(p => p.status === 'succeeded');
      const failedPayments = orgPayments.filter(p => ['canceled', 'payment_failed'].includes(p.status));
      const refundedPayments = orgPayments.filter(p => p.status === 'refunded');

      const totalAmount = succeededPayments.reduce((sum, p) => sum + p.amount, 0);
      const averageAmount = succeededPayments.length > 0 ? totalAmount / succeededPayments.length : 0;
      const successRate = orgPayments.length > 0 ? (succeededPayments.length / orgPayments.length) * 100 : 0;
      const failureRate = orgPayments.length > 0 ? (failedPayments.length / orgPayments.length) * 100 : 0;
      const refundRate = succeededPayments.length > 0 ? (refundedPayments.length / succeededPayments.length) * 100 : 0;

      return {
        totalPayments: orgPayments.length,
        totalAmount,
        averageAmount,
        successRate,
        failureRate,
        refundRate,
        timeRange: {
          start: cutoffDate,
          end: new Date()
        }
      };

    } catch (error) {
      logger.error({
        msg: 'Failed to get payment analytics',
        err: error,
        meta: { orgId, timeRange }
      });
      return {
        totalPayments: 0,
        totalAmount: 0,
        averageAmount: 0,
        successRate: 0,
        failureRate: 0,
        refundRate: 0,
        timeRange: {
          start: new Date(),
          end: new Date()
        }
      };
    }
  }

  /**
   * Process Stripe webhook event
   * @param event Stripe webhook event
   * @returns Promise<void>
   */
  async processWebhookEvent(event: any): Promise<void> {
    try {
      const eventType = event.type;
      const eventData = event.data.object;

      logger.info({
        msg: 'Processing Stripe webhook event',
        meta: {
          eventType,
          eventId: event.id,
          paymentIntentId: eventData.id
        }
      });

      switch (eventType) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSucceeded(eventData);
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailed(eventData);
          break;
        case 'payment_intent.canceled':
          await this.handlePaymentCanceled(eventData);
          break;
        case 'charge.dispute.created':
          await this.handleDisputeCreated(eventData);
          break;
        default:
          logger.info({
            msg: 'Unhandled webhook event type',
            meta: { eventType, eventId: event.id }
          });
      }

    } catch (error) {
      logger.error({
        msg: 'Failed to process webhook event',
        err: error,
        meta: { event }
      });
      throw new Error(`Failed to process webhook event: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handle payment succeeded event
   * @param paymentIntent Payment intent data
   */
  private async handlePaymentSucceeded(paymentIntent: any): Promise<void> {
    const paymentData: PaymentTrackingData = {
      paymentIntentId: paymentIntent.id,
      customerId: paymentIntent.customer,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: 'succeeded',
      metadata: paymentIntent.metadata,
      quoteId: paymentIntent.metadata?.quote_id,
      orgId: paymentIntent.metadata?.org_id,
      userId: paymentIntent.metadata?.user_id,
      timestamp: new Date()
    };

    await this.trackPayment(paymentData, 'webhook');
  }

  /**
   * Handle payment failed event
   * @param paymentIntent Payment intent data
   */
  private async handlePaymentFailed(paymentIntent: any): Promise<void> {
    const paymentData: PaymentTrackingData = {
      paymentIntentId: paymentIntent.id,
      customerId: paymentIntent.customer,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: 'payment_failed',
      metadata: paymentIntent.metadata,
      quoteId: paymentIntent.metadata?.quote_id,
      orgId: paymentIntent.metadata?.org_id,
      userId: paymentIntent.metadata?.user_id,
      timestamp: new Date()
    };

    await this.trackPayment(paymentData, 'webhook');
  }

  /**
   * Handle payment canceled event
   * @param paymentIntent Payment intent data
   */
  private async handlePaymentCanceled(paymentIntent: any): Promise<void> {
    const paymentData: PaymentTrackingData = {
      paymentIntentId: paymentIntent.id,
      customerId: paymentIntent.customer,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: 'canceled',
      metadata: paymentIntent.metadata,
      quoteId: paymentIntent.metadata?.quote_id,
      orgId: paymentIntent.metadata?.org_id,
      userId: paymentIntent.metadata?.user_id,
      timestamp: new Date()
    };

    await this.trackPayment(paymentData, 'webhook');
  }

  /**
   * Handle dispute created event
   * @param charge Charge data
   */
  private async handleDisputeCreated(charge: any): Promise<void> {
    logger.warn({
      msg: 'Payment dispute created',
      meta: {
        chargeId: charge.id,
        disputeId: charge.dispute?.id,
        amount: charge.amount,
        currency: charge.currency
      }
    });

    // Record dispute metric
    monitoringService.recordMetric('payment.dispute', 1, 'count', {
      currency: charge.currency
    });
  }

  /**
   * Clean up old data
   */
  private cleanupOldData(): void {
    try {
      const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days
      
      // Clean up old payments
      for (const [id, payment] of Array.from(this.payments.entries())) {
        if (payment.timestamp < cutoffDate) {
          this.payments.delete(id);
        }
      }

      // Clean up old events
      this.events = this.events.filter(event => event.processedAt > cutoffDate);

      logger.info({
        msg: 'Payment tracking data cleaned up',
        meta: {
          paymentsRemaining: this.payments.size,
          eventsRemaining: this.events.length
        }
      });

    } catch (error) {
      logger.error({
        msg: 'Failed to cleanup old payment data',
        err: error
      });
    }
  }

  /**
   * Get all payment events
   * @param limit Maximum number of events to return
   * @returns PaymentEvent[]
   */
  getPaymentEvents(limit: number = 100): PaymentEvent[] {
    return this.events
      .sort((a, b) => b.processedAt.getTime() - a.processedAt.getTime())
      .slice(0, limit);
  }
}

// Export singleton instance
export const paymentTrackingService = new PaymentTrackingService();
