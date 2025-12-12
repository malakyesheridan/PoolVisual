/**
 * Trades Onboarding Hints Hook
 * 
 * Manages per-user onboarding hints for Trades users.
 * Uses localStorage to persist hint visibility state.
 */

import { useState, useEffect } from 'react';

const STORAGE_KEY_PREFIX = 'trades_onboarding_hint_';

export type TradesOnboardingHint = 
  | 'jobs'
  | 'canvas'
  | 'quotes';

const HINT_KEYS: Record<TradesOnboardingHint, string> = {
  jobs: 'hasSeenTradesJobsHint',
  canvas: 'hasSeenTradesCanvasHint',
  quotes: 'hasSeenTradesQuotesHint',
};

/**
 * Check if a hint has been seen
 */
function hasSeenHint(hint: TradesOnboardingHint): boolean {
  if (typeof window === 'undefined') return false;
  const key = STORAGE_KEY_PREFIX + HINT_KEYS[hint];
  return localStorage.getItem(key) === 'true';
}

/**
 * Mark a hint as seen
 */
function markHintAsSeen(hint: TradesOnboardingHint): void {
  if (typeof window === 'undefined') return;
  const key = STORAGE_KEY_PREFIX + HINT_KEYS[hint];
  localStorage.setItem(key, 'true');
}

/**
 * Hook to manage a single onboarding hint
 */
export function useTradesOnboardingHint(hint: TradesOnboardingHint) {
  const [hasSeen, setHasSeen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const seen = hasSeenHint(hint);
    setHasSeen(seen);
    setIsVisible(!seen);
  }, [hint]);

  const dismiss = () => {
    markHintAsSeen(hint);
    setHasSeen(true);
    setIsVisible(false);
  };

  return {
    hasSeen,
    isVisible,
    dismiss,
  };
}

