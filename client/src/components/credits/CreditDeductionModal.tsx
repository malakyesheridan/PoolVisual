/**
 * Credit Deduction Modal Component
 * Confirmation modal before enhancement showing credit cost
 */

import React from 'react';
import { Coins, AlertCircle, X } from 'lucide-react';
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

  if (!open) return null;

  const hasEnough = credits !== null && currentBalance >= credits;
  const newBalance = credits !== null ? currentBalance - credits : currentBalance;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-gray-900">Confirm Enhancement</h2>
          </div>
          <button
            onClick={() => {
              onOpenChange(false);
              onCancel();
            }}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {loading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
            </div>
          ) : credits === null ? (
            <div className="text-center py-4 text-red-600">
              <AlertCircle className="w-8 h-8 mx-auto mb-2" />
              <p>Failed to calculate credit cost</p>
            </div>
          ) : !hasEnough ? (
            <div className="text-center py-4">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-amber-500" />
              <p className="text-sm font-medium text-gray-900 mb-1">Insufficient Credits</p>
              <p className="text-sm text-gray-600 mb-4">
                You need {credits} credits but only have {currentBalance}
              </p>
              <button
                onClick={() => {
                  onOpenChange(false);
                  // Trigger upgrade modal
                  window.dispatchEvent(new CustomEvent('openUpgradeModal', { detail: { mode: 'topup' } }));
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors"
              >
                Purchase Credits
              </button>
            </div>
          ) : (
            <>
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Enhancement Type</span>
                  <span className="text-sm font-medium text-gray-900">{enhancementType}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Credit Cost</span>
                  <span className="text-sm font-semibold text-primary">{credits} credits</span>
                </div>
                <div className="border-t border-gray-200 pt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Current Balance</span>
                    <span className="text-sm font-medium text-gray-900">{currentBalance} credits</span>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-sm font-medium text-gray-900">New Balance</span>
                    <span className="text-sm font-semibold text-gray-900">{newBalance} credits</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    onOpenChange(false);
                    onCancel();
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onOpenChange(false);
                    onConfirm();
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Confirm & Enhance
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
