/**
 * Billing & Credits Page
 * Manage subscription and purchase credits
 */

import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Coins, Sparkles, ArrowRight } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { apiClient } from '../lib/api-client';
import { useAuthStore } from '../stores/auth-store';
import { toast } from '../lib/toast';

interface CreditBalance {
  total: number;
  subscriptionCredits: number;
  topUpCredits: number;
  usedThisMonth: number;
}

interface SubscriptionStatus {
  plan: {
    name: string;
    planKey: string;
    tier: string;
  } | null;
  status: string;
  tier: string;
  creditBalance: number;
}

interface TopUpPack {
  priceId: string;
  credits: number;
  price: number;
  popular?: boolean;
}

const TOP_UP_PACKS: TopUpPack[] = [
  { priceId: 'price_1SZEy4ldjngDSU32bqsKASsp', credits: 25, price: 9.99 },
  { priceId: 'price_1SZEyZIdjngDSU32vRaAQVnr', credits: 100, price: 29.99, popular: true },
  { priceId: 'price_1SZEzDIdjngDSU327RDMd5zR', credits: 300, price: 79.99 },
];

export default function Billing() {
  const [, setLocation] = useLocation();
  const { user } = useAuthStore();
  const [creditBalance, setCreditBalance] = useState<CreditBalance | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [balanceRes, subscriptionRes] = await Promise.all([
        apiClient.getCreditBalance(),
        apiClient.getSubscriptionStatus().catch(() => ({ ok: false, subscription: null })),
      ]);

      if (balanceRes.ok) {
        setCreditBalance(balanceRes.balance);
      }

      if (subscriptionRes.ok && subscriptionRes.subscription) {
        setSubscription(subscriptionRes.subscription);
      }
    } catch (error) {
      console.error('Failed to load billing data:', error);
      toast.error('Failed to load billing information');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchaseCredits = async (priceId: string) => {
    try {
      setProcessing(priceId);
      const response = await apiClient.createTopUpCheckout(priceId);
      if (response.url) {
        window.location.href = response.url;
      } else {
        toast.error('Failed to start checkout');
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast.error(error.message || 'Failed to start checkout');
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Billing & Credits</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage your subscription and purchase credits for AI enhancements
          </p>
        </div>

        {/* Credit Balance & Subscription Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Credit Balance Card */}
          {creditBalance && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Remaining Credits</h2>
                <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-lg">
                  <Coins className="w-4 h-4 text-primary" />
                  <span className="text-xs font-medium text-primary">Active</span>
                </div>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-5xl font-bold text-gray-900">
                  {creditBalance.total.toLocaleString()}
                </span>
                <span className="text-xl text-gray-500">credits</span>
              </div>
              {creditBalance.subscriptionCredits > 0 && (
                <div className="text-sm text-gray-600 mt-3 pt-3 border-t border-gray-100">
                  <div className="flex justify-between">
                    <span>Monthly allocation:</span>
                    <span className="font-medium">{creditBalance.subscriptionCredits}</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span>Top-up credits:</span>
                    <span className="font-medium">{creditBalance.topUpCredits}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Subscription Info Card */}
          {subscription && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Subscription</h2>
                <Badge 
                  variant={subscription.status === 'active' ? 'default' : 'secondary'}
                  className="capitalize"
                >
                  {subscription.status}
                </Badge>
              </div>
              {subscription.plan ? (
                <>
                  <div className="mb-3">
                    <p className="text-2xl font-bold text-gray-900">{subscription.plan.name}</p>
                    <p className="text-sm text-gray-600 mt-1 capitalize">
                      {subscription.tier === 't1' ? 'Solo' : subscription.tier === 't2' ? 'Pro' : 'Business'} Plan
                    </p>
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div className="flex justify-between">
                      <span>Monthly credits:</span>
                      <span className="font-medium">
                        {subscription.creditBalance > 0 ? subscription.creditBalance : 'N/A'}
                      </span>
                    </div>
                    {subscription.plan.tier && (
                      <div className="flex justify-between">
                        <span>Tier:</span>
                        <span className="font-medium capitalize">
                          {subscription.plan.tier === 't1' ? 'Solo' : subscription.plan.tier === 't2' ? 'Pro' : 'Business'}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <button
                      onClick={() => setLocation('/subscribe')}
                      className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                      Manage Subscription →
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-600 mb-3">No active subscription</p>
                  <button
                    onClick={() => setLocation('/subscribe')}
                    className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                  >
                    View Plans →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Purchase Credits Section */}
        <div className="mb-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Purchase Credit Packs</h2>
            <p className="text-sm text-gray-600">
              Buy credits to use for AI enhancements. Credits never expire and can be used anytime.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TOP_UP_PACKS.map((pack) => (
              <div
                key={pack.priceId}
                className={`relative bg-white rounded-xl border-2 p-6 transition-all hover:shadow-lg ${
                  pack.popular
                    ? 'border-primary shadow-md ring-2 ring-primary/20'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {pack.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-primary text-white text-xs font-semibold px-3 py-1 rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <Coins className="w-6 h-6 text-primary" />
                    <span className="text-3xl font-bold text-gray-900">{pack.credits}</span>
                  </div>
                  <div className="text-sm text-gray-600 mb-4">credits</div>
                  <div className="text-3xl font-bold text-gray-900 mb-1">
                    ${pack.price.toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-500 mb-6">
                    ${(pack.price / pack.credits).toFixed(2)} per credit
                  </div>

                  <button
                    onClick={() => handlePurchaseCredits(pack.priceId)}
                    disabled={processing === pack.priceId}
                    className="w-full px-4 py-3 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    {processing === pack.priceId ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                        Processing...
                      </>
                    ) : (
                      <>
                        Purchase
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Subscription Management Section */}
        {subscription && subscription.plan && (
          <div className="border-t border-gray-200 pt-8">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-blue-900 mb-1">
                    Subscription Management
                  </h3>
                  <p className="text-sm text-blue-700 mb-3">
                    Manage your subscription plan, billing information, and payment methods.
                  </p>
                  <button
                    onClick={() => setLocation('/subscribe')}
                    className="text-sm font-medium text-blue-700 hover:text-blue-900 underline"
                  >
                    Manage Subscription →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
