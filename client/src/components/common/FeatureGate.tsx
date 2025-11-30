/**
 * FeatureGate Component
 * 
 * Conditionally renders children based on feature flag
 */

import React from 'react';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';

interface FeatureGateProps {
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showIfDisabled?: boolean; // Show children but with disabled state
}

/**
 * Component that conditionally renders children based on feature flag
 * 
 * @example
 * ```tsx
 * <FeatureGate feature="aiEnhancement">
 *   <AIEnhancementButton />
 * </FeatureGate>
 * 
 * <FeatureGate feature="bulkOperations" fallback={<UpgradePrompt />}>
 *   <BulkOperationsPanel />
 * </FeatureGate>
 * ```
 */
export function FeatureGate({ 
  feature, 
  children, 
  fallback = null,
  showIfDisabled = false,
}: FeatureGateProps) {
  const { isEnabled } = useFeatureFlag(feature);
  
  if (showIfDisabled) {
    // Show children but with disabled styling
    return (
      <div className={isEnabled ? '' : 'opacity-50 pointer-events-none'}>
        {children}
      </div>
    );
  }
  
  if (isEnabled) {
    return <>{children}</>;
  }
  
  return <>{fallback}</>;
}

/**
 * Higher-order component version
 */
export function withFeatureGate<P extends object>(
  Component: React.ComponentType<P>,
  feature: string,
  FallbackComponent?: React.ComponentType<P>
) {
  return function FeatureGatedComponent(props: P) {
    const { isEnabled } = useFeatureFlag(feature);
    
    if (isEnabled) {
      return <Component {...props} />;
    }
    
    if (FallbackComponent) {
      return <FallbackComponent {...props} />;
    }
    
    return null;
  };
}

