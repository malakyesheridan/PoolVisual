/**
 * Trades Onboarding Hint Component
 * 
 * A dismissible info banner for Trades users showing onboarding hints.
 */

import { X, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TradesOnboardingHintProps {
  message: string;
  onDismiss: () => void;
  className?: string;
}

export function TradesOnboardingHint({ 
  message, 
  onDismiss,
  className = '' 
}: TradesOnboardingHintProps) {
  return (
    <div className={`bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 ${className}`}>
      <div className="flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm text-blue-900">{message}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="h-8 px-3 text-blue-700 hover:text-blue-900 hover:bg-blue-100"
          >
            Got it
          </Button>
          <button
            onClick={onDismiss}
            className="p-1 text-blue-600 hover:text-blue-900 hover:bg-blue-100 rounded transition-colors"
            aria-label="Close hint"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

