/**
 * Trial Ended Modal Component
 * Shown when trial has expired and user has no paid plan
 */

import React from 'react';
import { useLocation } from 'wouter';
import { AlertCircle, Sparkles, ArrowRight, X } from 'lucide-react';
import { Button } from '../ui/button';

interface TrialEndedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TrialEndedModal({ open, onOpenChange }: TrialEndedModalProps) {
  const [, setLocation] = useLocation();

  if (!open) return null;

  const handleUpgrade = () => {
    onOpenChange(false);
    setLocation('/subscribe');
  };

  const handleDismiss = () => {
    onOpenChange(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 px-6 py-4 border-b border-amber-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <AlertCircle className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Trial Ended</h2>
                <p className="text-xs text-gray-600 mt-0.5">Your free trial has expired</p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-amber-100 to-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Sparkles className="w-10 h-10 text-amber-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Your Free Trial Has Ended
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Thank you for trying EasyFlow Studio! To continue enhancing your images, please choose a subscription plan.
            </p>
          </div>

          {/* Features reminder */}
          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <p className="text-sm font-medium text-gray-900 mb-2">What you'll get:</p>
            <ul className="text-sm text-gray-600 space-y-1">
              <li className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Monthly enhancement allocations
              </li>
              <li className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                All AI enhancement features
              </li>
              <li className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Priority support
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={handleDismiss}
              variant="outline"
              className="flex-1"
            >
              Maybe Later
            </Button>
            <Button
              onClick={handleUpgrade}
              className="flex-1 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80"
            >
              View Plans
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

