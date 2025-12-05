/**
 * Trial Banner Component
 * Displays trial status, remaining days, and enhancement count
 */

import React from 'react';
import { useLocation } from 'wouter';
import { Sparkles, Clock, AlertCircle, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

interface TrialBannerProps {
  isTrial: boolean;
  trialDaysRemaining: number;
  trialEnhancements: number;
  onDismiss?: () => void;
  showOnPages?: string[]; // Pages where banner should be shown
}

export function TrialBanner({
  isTrial,
  trialDaysRemaining,
  trialEnhancements,
  onDismiss,
  showOnPages,
}: TrialBannerProps) {
  const [, setLocation] = useLocation();
  const [dismissed, setDismissed] = React.useState(false);

  // Don't show if not in trial or dismissed
  if (!isTrial || dismissed) {
    return null;
  }

  // Check if we should show on current page
  if (showOnPages && showOnPages.length > 0) {
    const currentPath = window.location.pathname;
    if (!showOnPages.some(page => currentPath.startsWith(page))) {
      return null;
    }
  }

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  const handleUpgrade = () => {
    setLocation('/subscribe');
  };

  // Warning colors if trial is ending soon
  const isEndingSoon = trialDaysRemaining <= 2;
  const bgColor = isEndingSoon ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200';
  const textColor = isEndingSoon ? 'text-amber-900' : 'text-blue-900';
  const iconColor = isEndingSoon ? 'text-amber-600' : 'text-blue-600';

  return (
    <div className={`${bgColor} border-b ${textColor} px-4 py-3`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className={`p-2 rounded-lg ${isEndingSoon ? 'bg-amber-100' : 'bg-blue-100'}`}>
            {isEndingSoon ? (
              <AlertCircle className={`w-5 h-5 ${iconColor}`} />
            ) : (
              <Sparkles className={`w-5 h-5 ${iconColor}`} />
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold">
                You're on a 7-day free trial
              </span>
              <Badge variant="outline" className={`${isEndingSoon ? 'border-amber-300 text-amber-700' : 'border-blue-300 text-blue-700'}`}>
                <Clock className="w-3 h-3 mr-1" />
                {trialDaysRemaining} {trialDaysRemaining === 1 ? 'day' : 'days'} left
              </Badge>
              <Badge variant="outline" className={`${isEndingSoon ? 'border-amber-300 text-amber-700' : 'border-blue-300 text-blue-700'}`}>
                <Sparkles className="w-3 h-3 mr-1" />
                {trialEnhancements} {trialEnhancements === 1 ? 'enhancement' : 'enhancements'} remaining
              </Badge>
            </div>
            {isEndingSoon && (
              <p className="text-sm mt-1 opacity-90">
                Your trial ends soon. Upgrade to continue using all features.
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleUpgrade}
            className={isEndingSoon ? 'border-amber-300 text-amber-700 hover:bg-amber-100' : 'border-blue-300 text-blue-700 hover:bg-blue-100'}
          >
            Upgrade Now
          </Button>
          {onDismiss && (
            <button
              onClick={handleDismiss}
              className={`p-1 rounded hover:bg-black/10 transition-colors ${textColor}`}
              aria-label="Dismiss banner"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

