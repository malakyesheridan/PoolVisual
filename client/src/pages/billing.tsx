/**
 * Billing & Enhancements Page
 * Manage subscription and purchase enhancements
 */

import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Coins, Sparkles, ArrowRight, Clock, Gift, AlertCircle } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { apiClient } from '../lib/api-client';
import { useAuthStore } from '../stores/auth-store';
import { toast } from '../lib/toast';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Button } from '../components/ui/button';

interface EnhancementBalance {
  total: number;
  subscriptionEnhancements: number;
  topUpEnhancements: number;
  usedThisMonth: number;
  trialEnhancements?: number;
  isTrial?: boolean;
  trialDaysRemaining?: number;
}

interface SubscriptionStatus {
  plan: {
    name: string;
    planKey: string;
    tier: string;
  } | null;
  status: string;
  tier: string;
  enhancementBalance: number;
}

interface TopUpPack {
  priceId: string;
  enhancements: number;
  price: number;
  popular?: boolean;
}

const TOP_UP_PACKS: TopUpPack[] = [
  { priceId: 'price_1SZRjEEdvdAX5C3kdERuir64', enhancements: 30, price: 25.00, name: 'Basic' },
  { priceId: 'price_1SZRjYEdvdAX5C3kmNRNfHPi', enhancements: 100, price: 75.00, popular: true, name: 'Standard' },
  { priceId: 'price_1SZRjuEdvdAX5C3kF5PzjpMb', enhancements: 350, price: 199.00, name: 'Pro Pack' },
];

export default function Billing() {
  const [, setLocation] = useLocation();
  const { user } = useAuthStore();
  const [enhancementBalance, setEnhancementBalance] = useState<EnhancementBalance | null>(null);
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
        apiClient.getEnhancementBalance(),
        apiClient.getSubscriptionStatus().catch(() => ({ ok: false, subscription: null })),
      ]);

      if (balanceRes.ok) {
        setEnhancementBalance(balanceRes.balance);
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
          <h1 className="text-3xl font-bold text-gray-900">Billing & Enhancements</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage your subscription and purchase enhancements for AI image processing
          </p>
        </div>

        {/* Trial Status Banner */}
        {enhancementBalance?.isTrial && enhancementBalance.trialDaysRemaining !== undefined && (
          <Alert className="mb-8 border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
            <Gift className="h-4 w-4 text-primary" />
            <AlertDescription className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-gray-900">
                  You're currently on a free trial
                </span>
                <Badge variant="outline" className="border-primary/30 text-primary">
                  <Clock className="w-3 h-3 mr-1" />
                  {enhancementBalance.trialDaysRemaining} {enhancementBalance.trialDaysRemaining === 1 ? 'day' : 'days'} left
                </Badge>
                <Badge variant="outline" className="border-primary/30 text-primary">
                  <Sparkles className="w-3 h-3 mr-1" />
                  {enhancementBalance.trialEnhancements || 0} enhancements remaining
                </Badge>
              </div>
              <Button
                size="sm"
                onClick={() => setLocation('/subscribe')}
                className="bg-primary hover:bg-primary/90"
              >
                Upgrade Now
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Post-Trial Upgrade Prompt */}
        {user && !user.isTrial && !user.subscriptionPlanId && user.hasUsedTrial && (
          <Alert className="mb-8 border-amber-200 bg-amber-50">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <span className="font-semibold text-amber-900 block mb-1">
                  Your free trial has ended
                </span>
                <span className="text-sm text-amber-700">
                  Upgrade to a paid plan to continue using EasyFlow Studio
                </span>
              </div>
              <Button
                size="sm"
                onClick={() => setLocation('/subscribe')}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                View Plans
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Enhancement Balance & Subscription Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Enhancement Balance Card */}
          {enhancementBalance && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Remaining Enhancements</h2>
                <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-lg">
                  <Coins className="w-4 h-4 text-primary" />
                  <span className="text-xs font-medium text-primary">Active</span>
                </div>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-5xl font-bold text-gray-900">
                  {enhancementBalance.total.toLocaleString()}
                </span>
                <span className="text-xl text-gray-500">enhancements</span>
              </div>
              {enhancementBalance.subscriptionEnhancements > 0 && (
                <div className="text-sm text-gray-600 mt-3 pt-3 border-t border-gray-100">
                  <div className="flex justify-between">
                    <span>Monthly allocation:</span>
                    <span className="font-medium">{enhancementBalance.subscriptionEnhancements}</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span>Top-up enhancements:</span>
                    <span className="font-medium">{enhancementBalance.topUpEnhancements}</span>
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
                      <span>Monthly enhancements:</span>
                      <span className="font-medium">
                        {subscription.enhancementBalance > 0 ? subscription.enhancementBalance : 'N/A'}
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

        {/* Purchase Enhancements Section */}
        <div className="mb-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Purchase Enhancement Packs</h2>
            <p className="text-sm text-gray-600">
              Buy enhancements to use for AI image processing. Enhancements never expire and can be used anytime.
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
                  {pack.name && (
                    <div className="text-sm font-semibold text-gray-700 mb-2">{pack.name}</div>
                  )}
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <Coins className="w-6 h-6 text-primary" />
                    <span className="text-3xl font-bold text-gray-900">{pack.enhancements}</span>
                  </div>
                  <div className="text-sm text-gray-600 mb-4">enhancements</div>
                  <div className="text-3xl font-bold text-gray-900 mb-1">
                    ${pack.price.toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-500 mb-6">
                    ${(pack.price / pack.enhancements).toFixed(2)} per enhancement
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
