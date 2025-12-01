/**
 * Credit Deduction Modal Component
 * Confirmation modal before enhancement showing credit cost
 * Modern UI inspired by top-tier AI apps (Midjourney, Runway, etc.)
 */

import React from 'react';
import { useLocation } from 'wouter';
import { Coins, AlertTriangle, X, Sparkles, Zap, ArrowRight } from 'lucide-react';
import { apiClient } from '../../lib/api-client';

interface CreditDeductionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enhancementType: string;
  hasMask: boolean;
  currentBalance: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CreditDeductionModal({
  open,
  onOpenChange,
  enhancementType,
  hasMask,
  currentBalance,
  onConfirm,
  onCancel,
}: CreditDeductionModalProps) {
  const [, setLocation] = useLocation();
  const [credits, setCredits] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (open) {
      calculateCredits();
    }
  }, [open, enhancementType, hasMask]);

  const calculateCredits = async () => {
    try {
      setLoading(true);
      const response = await apiClient.calculateCredits(enhancementType, hasMask);
      setCredits(response.credits);
    } catch (error) {
      console.error('Failed to calculate credits:', error);
      setCredits(null);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchaseCredits = () => {
    onOpenChange(false);
    setLocation('/billing');
  };

  if (!open) return null;

  const hasEnough = credits !== null && currentBalance >= credits;
  const newBalance = credits !== null ? currentBalance - credits : currentBalance;
  const shortfall = credits !== null && !hasEnough ? credits - currentBalance : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 px-6 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Confirm Enhancement</h2>
                <p className="text-xs text-gray-500 mt-0.5">Review credit cost before proceeding</p>
              </div>
            </div>
            <button
              onClick={() => {
                onOpenChange(false);
                onCancel();
              }}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-3 border-primary border-t-transparent mx-auto mb-4" />
              <p className="text-sm text-gray-600">Calculating credit cost...</p>
            </div>
          ) : credits === null ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <p className="text-sm font-medium text-gray-900 mb-1">Unable to Calculate Cost</p>
              <p className="text-xs text-gray-500">Please try again or contact support</p>
            </div>
          ) : !hasEnough ? (
            <div className="space-y-6">
              {/* Insufficient Credits - Modern Design */}
              <div className="text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-amber-100 to-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <Coins className="w-10 h-10 text-amber-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Insufficient Credits</h3>
                <p className="text-sm text-gray-600 mb-6">
                  You need <span className="font-semibold text-gray-900">{credits} credits</span> for this enhancement
                  <br />
                  but only have <span className="font-semibold text-gray-900">{currentBalance} credits</span>
                </p>
              </div>

              {/* Credit Breakdown */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-5 border border-gray-200">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Required</span>
                    <span className="text-lg font-bold text-gray-900">{credits} credits</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Your Balance</span>
                    <span className="text-lg font-semibold text-gray-600">{currentBalance} credits</span>
                  </div>
                  <div className="border-t border-gray-300 pt-3 flex items-center justify-between">
                    <span className="text-sm font-semibold text-amber-700">Shortfall</span>
                    <span className="text-xl font-bold text-amber-600">{shortfall} credits</span>
                  </div>
                </div>
              </div>

              {/* CTA Button */}
              <button
                onClick={handlePurchaseCredits}
                className="w-full px-6 py-4 bg-gradient-to-r from-primary to-primary/90 text-white font-semibold rounded-xl hover:from-primary/90 hover:to-primary/80 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 group"
              >
                <Coins className="w-5 h-5" />
                <span>Purchase Credits</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>

              <p className="text-xs text-center text-gray-500">
                Credits never expire • Secure payment via Stripe
              </p>
            </div>
          ) : (
            <>
              {/* Sufficient Credits - Confirmation View */}
              <div className="space-y-5">
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Zap className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">Ready to Enhance</h3>
                  <p className="text-sm text-gray-600">You have sufficient credits to proceed</p>
                </div>

                {/* Credit Breakdown Card */}
                <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-5 border border-gray-200 shadow-sm">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium text-gray-700">Enhancement Type</span>
                      </div>
                      <span className="text-sm font-semibold text-gray-900 capitalize">
                        {enhancementType.replace(/_/g, ' ')}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Credit Cost</span>
                      <span className="text-lg font-bold text-primary">{credits} credits</span>
                    </div>
                    
                    <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                      <span className="text-sm text-gray-600">Current Balance</span>
                      <span className="text-base font-semibold text-gray-900">{currentBalance} credits</span>
                    </div>
                    
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-sm font-medium text-gray-900">Remaining After</span>
                      <span className="text-lg font-bold text-green-600">{newBalance} credits</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => {
                      onOpenChange(false);
                      onCancel();
                    }}
                    className="flex-1 px-4 py-3 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      onOpenChange(false);
                      onConfirm();
                    }}
                    className="flex-1 px-4 py-3 text-sm font-semibold text-white bg-gradient-to-r from-primary to-primary/90 rounded-xl hover:from-primary/90 hover:to-primary/80 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                  >
                    <Zap className="w-4 h-4" />
                    Confirm & Enhance
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
