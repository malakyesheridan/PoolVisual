/**
 * useOnboarding Hook
 * 
 * CORRECTED: Single source of truth for onboarding data
 * Replaces duplicate query in App.tsx
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { apiClient } from '@/lib/api-client';
import { OnboardingData } from '@/types/onboarding';
import { useEffect } from 'react';

/**
 * CORRECTED: Single source of truth for onboarding data
 * This hook replaces the duplicate query in App.tsx
 * 
 * @example
 * ```tsx
 * const { onboarding, industry, role, useCase, experience, isLoading } = useOnboarding();
 * 
 * if (industry === 'real_estate') {
 *   // Show real estate specific features
 * }
 * ```
 */
export function useOnboarding() {
  const { user, isAuthenticated } = useAuthStore();
  const { 
    onboarding: cachedOnboarding, 
    setOnboarding, 
    clearOnboarding,
    normalized,
    getIndustry,
    getRole,
    getUseCase,
    getExperience,
    isCompleted,
    isNewUser,
  } = useOnboardingStore();
  const queryClient = useQueryClient();
  
  /**
   * CORRECTED: Match API contract - API always returns object, never null
   * CORRECTED: Proper date handling
   * CORRECTED: Align stale time with global config (2 minutes)
   */
  const { 
    data: onboardingData, 
    isLoading, 
    error,
    refetch,
  } = useQuery<OnboardingData>({
    queryKey: ['/api/onboarding/status'],
    queryFn: async () => {
      if (!isAuthenticated || !user) {
        // Return default for unauthenticated users
        return {
          userId: '',
          step: 'welcome',
          completed: false,
          responses: {},
          firstJobId: null,
          firstPhotoId: null,
          completedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as OnboardingData;
      }
      
      try {
        const data = await apiClient.getOnboardingStatus();
        
        // CORRECTED: API always returns object, ensure proper date conversion
        return {
          ...data,
          userId: data.userId || user.id,
          createdAt: data.createdAt 
            ? (data.createdAt instanceof Date ? data.createdAt : new Date(data.createdAt))
            : new Date(),
          updatedAt: data.updatedAt 
            ? (data.updatedAt instanceof Date ? data.updatedAt : new Date(data.updatedAt))
            : new Date(),
          completedAt: data.completedAt 
            ? (data.completedAt instanceof Date ? data.completedAt : new Date(data.completedAt))
            : null,
        } as OnboardingData;
      } catch (error) {
        console.warn('[useOnboarding] Failed to fetch onboarding:', error);
        
        // CORRECTED: Return default object instead of null (matches API contract)
        return {
          userId: user.id,
          step: 'welcome',
          completed: false,
          responses: {},
          firstJobId: null,
          firstPhotoId: null,
          completedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as OnboardingData;
      }
    },
    enabled: isAuthenticated && !!user,
    staleTime: 2 * 60 * 1000, // CORRECTED: Match global config (2 minutes)
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: false, // Don't retry - if it fails, return default
  });
  
  /**
   * CORRECTED: Sync API data to store with proper date handling
   */
  useEffect(() => {
    if (onboardingData !== undefined) {
      setOnboarding(onboardingData);
    }
  }, [onboardingData, setOnboarding]);
  
  /**
   * CORRECTED: Clear store on logout
   */
  useEffect(() => {
    if (!isAuthenticated) {
      clearOnboarding();
      // CORRECTED: Clear React Query cache on logout
      queryClient.removeQueries({ queryKey: ['/api/onboarding/status'] });
    }
  }, [isAuthenticated, clearOnboarding, queryClient]);
  
  /**
   * CORRECTED: Update onboarding mutation with proper error handling
   */
  const updateMutation = useMutation({
    mutationFn: async (updates: { step: string; responses?: any }) => {
      return await apiClient.updateOnboarding(updates);
    },
    onSuccess: (data) => {
      // CORRECTED: Convert dates properly
      const onboardingData: OnboardingData = {
        ...data,
        createdAt: data.createdAt instanceof Date ? data.createdAt : new Date(data.createdAt),
        updatedAt: data.updatedAt instanceof Date ? data.updatedAt : new Date(data.updatedAt),
        completedAt: data.completedAt 
          ? (data.completedAt instanceof Date ? data.completedAt : new Date(data.completedAt))
          : null,
      };
      
      setOnboarding(onboardingData);
      queryClient.setQueryData(['/api/onboarding/status'], onboardingData);
      
      // CORRECTED: Invalidate related queries that depend on onboarding
      queryClient.invalidateQueries({ queryKey: ['/api/me/orgs'] });
    },
    onError: (error) => {
      console.error('[useOnboarding] Failed to update onboarding:', error);
      // Error is already handled by global mutation error handler
    },
  });
  
  /**
   * CORRECTED: Complete onboarding mutation
   */
  const completeMutation = useMutation({
    mutationFn: async () => {
      return await apiClient.completeOnboarding();
    },
    onSuccess: async () => {
      // CORRECTED: Refetch to get updated data with proper dates
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['/api/onboarding/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/me/orgs'] });
    },
    onError: (error) => {
      console.error('[useOnboarding] Failed to complete onboarding:', error);
    },
  });
  
  return {
    // Raw data
    onboarding: onboardingData || cachedOnboarding,
    
    // Normalized data (with fallbacks)
    normalized,
    industry: getIndustry(),
    role: getRole(),
    useCase: getUseCase(),
    experience: getExperience(),
    completed: isCompleted(),
    isNewUser: isNewUser(),
    
    // Loading/error state
    isLoading,
    error,
    
    // Actions
    updateOnboarding: updateMutation.mutate,
    updateOnboardingAsync: updateMutation.mutateAsync,
    completeOnboarding: completeMutation.mutate,
    completeOnboardingAsync: completeMutation.mutateAsync,
    refetch,
    
    // Mutation states
    isUpdating: updateMutation.isPending,
    isCompleting: completeMutation.isPending,
  };
}

