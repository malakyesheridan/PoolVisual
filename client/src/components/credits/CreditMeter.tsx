/**
 * Credit Meter Component
 * Displays user's credit balance with breakdown
 */

import React from 'react';
import { Coins, AlertTriangle } from 'lucide-react';
import { apiClient } from '../../lib/api-client';

interface CreditBalance {
  total: number;
  subscriptionCredits: number;
  topUpCredits: number;
  usedThisMonth: number;
}

interface CreditMeterProps {
  balance?: CreditBalance;
  onUpgrade?: () => void;
  showLowCreditWarning?: boolean;
  lowCreditThreshold?: number;
}

export function CreditMeter({ 
  balance, 
  onUpgrade,
  showLowCreditWarning = true,
  lowCreditThreshold = 10
}: CreditMeterProps) {
  const [currentBalance, setCurrentBalance] = React.useState<CreditBalance | null>(balance || null);
  const [loading, setLoading] = React.useState(!balance);

  React.useEffect(() => {
    if (!balance) {
      loadBalance();
    }
  }, []);

  const loadBalance = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getCreditBalance();
      setCurrentBalance(response.balance);
    } catch (error) {
      console.error('Failed to load credit balance:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
        <Coins className="w-4 h-4 text-gray-400 animate-pulse" />
        <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  if (!currentBalance) {
    return null;
  }

  const isLow = currentBalance.total < lowCreditThreshold;
  const percentage = currentBalance.total > 0 
    ? Math.min((currentBalance.total / 100) * 100, 100) 
    : 0;

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg shadow-sm">
        <Coins className={`w-4 h-4 ${isLow ? 'text-amber-500' : 'text-primary'}`} />
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">
              {currentBalance.total.toLocaleString()}
            </span>
            <span className="text-xs text-gray-500">credits</span>
          </div>
          {currentBalance.subscriptionCredits > 0 && (
            <div className="text-xs text-gray-500">
              {currentBalance.subscriptionCredits} monthly + {currentBalance.topUpCredits} top-up
            </div>
          )}
        </div>
      </div>

      {isLow && showLowCreditWarning && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <div className="flex flex-col">
            <span className="text-xs font-medium text-amber-900">Low Credits</span>
            <button
              onClick={onUpgrade}
              className="text-xs text-amber-700 hover:text-amber-900 underline"
            >
              Top up now
            </button>
          </div>
        </div>
      )}

      {onUpgrade && !isLow && (
        <button
          onClick={onUpgrade}
          className="px-3 py-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
        >
          Top Up
        </button>
      )}
    </div>
  );
}
