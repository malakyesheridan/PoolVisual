/**
 * Upgrade Modal Component
 * Modal for upgrading plan or purchasing credit top-ups
 */

import React, { useState } from 'react';
import { X, Check, Coins, Sparkles } from 'lucide-react';
import { apiClient } from '../../lib/api-client';

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTier?: 't1' | 't2' | 't3';
  industry?: 'trades' | 'real_estate';
  mode?: 'subscription' | 'topup';
}

interface TopUpPack {
  priceId: string;
  credits: number;
  price: number;
  popular?: boolean;
}

const TOP_UP_PACKS: TopUpPack[] = [
  { priceId: 'price_1SZEy4ldjngDSU32bqsKASsp', credits: 25, price: 25.00 },
  { priceId: 'price_1SZEyZIdjngDSU32vRaAQVnr', credits: 100, price: 75.00, popular: true },
  { priceId: 'price_1SZEzDldjngDSU327RDMd5zR', credits: 300, price: 199.00 },
];

export function UpgradeModal({ 
  open, 
  onOpenChange, 
  currentTier = 't1',
  industry = 'trades',
  mode = 'subscription'
}: UpgradeModalProps) {
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [selectedTopUp, setSelectedTopUp] = useState<string | null>(null);

  const handleCheckout = async (planKey?: string, topUpPriceId?: string) => {
    try {
      setLoading(true);
      
      if (topUpPriceId) {
        // Top-up checkout
        const response = await apiClient.createTopUpCheckout(topUpPriceId);
        if (response.url) {
          window.location.href = response.url;
        }
      } else if (planKey) {
        // Subscription checkout
        const response = await apiClient.createCheckoutSession({
          planKey,
          billingPeriod: 'monthly'
        });
        if (response.url) {
          window.location.href = response.url;
        }
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      alert(error.message || 'Failed to start checkout');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold text-gray-900">
              {mode === 'subscription' ? 'Upgrade Plan' : 'Purchase Credits'}
            </h2>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {mode === 'subscription' ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 mb-6">
                Choose a plan that fits your needs. All plans include monthly credit allocations.
              </p>
              {/* Plan comparison would go here */}
              <div className="text-center text-gray-500">
                Plan selection UI to be implemented
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 mb-6">
                Purchase credit packs to continue using AI enhancements. Credits never expire.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {TOP_UP_PACKS.map((pack) => (
                  <div
                    key={pack.priceId}
                    className={`relative border-2 rounded-lg p-6 cursor-pointer transition-all ${
                      selectedTopUp === pack.priceId
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-200 hover:border-gray-300'
                    } ${pack.popular ? 'ring-2 ring-primary/20' : ''}`}
                    onClick={() => setSelectedTopUp(pack.priceId)}
                  >
                    {pack.popular && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <span className="bg-primary text-white text-xs font-medium px-3 py-1 rounded-full">
                          Most Popular
                        </span>
                      </div>
                    )}
                    
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <Coins className="w-5 h-5 text-primary" />
                        <span className="text-2xl font-bold text-gray-900">
                          {pack.credits}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 mb-4">credits</div>
                      <div className="text-2xl font-semibold text-gray-900 mb-1">
                        ${pack.price.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500 mb-4">
                        ${(pack.price / pack.credits).toFixed(2)} per credit
                      </div>
                      
                      {selectedTopUp === pack.priceId && (
                        <div className="flex items-center justify-center gap-1 text-primary text-sm font-medium">
                          <Check className="w-4 h-4" />
                          Selected
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => onOpenChange(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => selectedTopUp && handleCheckout(undefined, selectedTopUp)}
                  disabled={!selectedTopUp || loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Processing...' : 'Purchase Credits'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
