/**
 * Onboarding Store
 * 
 * CORRECTED: Proper date handling, versioning, and migration support
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { 
  OnboardingData, 
  NormalizedOnboardingData, 
  Industry, 
  UserRole, 
  UseCase, 
  ExperienceLevel 
} from '@/types/onboarding';

const DEFAULT_INDUSTRY: Industry = 'pool';
const DEFAULT_ROLE: UserRole = 'other';
const DEFAULT_USE_CASE: UseCase = 'all';
const DEFAULT_EXPERIENCE: ExperienceLevel = 'beginner';

interface OnboardingState {
  // Raw onboarding data
  onboarding: OnboardingData | null;
  
  // Normalized/computed data
  normalized: NormalizedOnboardingData | null;
  
  // Loading state
  isLoading: boolean;
  lastFetched: number | null;
  
  // Actions
  setOnboarding: (data: OnboardingData | null) => void;
  clearOnboarding: () => void;
  
  // Computed getters
  getIndustry: () => Industry;
  getRole: () => UserRole;
  getUseCase: () => UseCase;
  getExperience: () => ExperienceLevel;
  isCompleted: () => boolean;
  isNewUser: () => boolean;
}

/**
 * CORRECTED: Proper date handling for serialization
 */
function normalizeOnboardingData(data: OnboardingData | null): NormalizedOnboardingData | null {
  if (!data) return null;
  
  const responses = data.responses || {};
  
  // CORRECTED: Handle both Date objects and ISO strings
  const completedAt = data.completedAt 
    ? (data.completedAt instanceof Date 
        ? data.completedAt 
        : new Date(data.completedAt))
    : null;
  
  const isNewUser = completedAt 
    ? (Date.now() - completedAt.getTime()) < (7 * 24 * 60 * 60 * 1000)
    : false;
  
  return {
    industry: (responses.industry as Industry) || DEFAULT_INDUSTRY,
    role: (responses.role as UserRole) || DEFAULT_ROLE,
    useCase: (responses.useCase as UseCase) || DEFAULT_USE_CASE,
    experience: (responses.experience as ExperienceLevel) || DEFAULT_EXPERIENCE,
    completed: data.completed || false,
    isNewUser,
  };
}

/**
 * CORRECTED: Store with versioning and migration support
 */
export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      onboarding: null,
      normalized: null,
      isLoading: false,
      lastFetched: null,
      
      setOnboarding: (data) => {
        const normalized = normalizeOnboardingData(data);
        set({ 
          onboarding: data, 
          normalized,
          lastFetched: Date.now(),
        });
      },
      
      clearOnboarding: () => {
        set({ 
          onboarding: null, 
          normalized: null,
          lastFetched: null,
        });
      },
      
      // Computed getters with fallbacks
      getIndustry: () => {
        const { normalized } = get();
        return normalized?.industry || DEFAULT_INDUSTRY;
      },
      
      getRole: () => {
        const { normalized } = get();
        return normalized?.role || DEFAULT_ROLE;
      },
      
      getUseCase: () => {
        const { normalized } = get();
        return normalized?.useCase || DEFAULT_USE_CASE;
      },
      
      getExperience: () => {
        const { normalized } = get();
        return normalized?.experience || DEFAULT_EXPERIENCE;
      },
      
      isCompleted: () => {
        const { normalized } = get();
        return normalized?.completed || false;
      },
      
      isNewUser: () => {
        const { normalized } = get();
        return normalized?.isNewUser || false;
      },
    }),
    {
      name: 'onboarding-storage',
      version: 1, // CORRECTED: Add versioning for migrations
      storage: createJSONStorage(() => localStorage),
      migrate: (persistedState: any, version: number) => {
        // CORRECTED: Migration logic for future schema changes
        if (version < 1) {
          // If migrating from unversioned state, ensure structure is correct
          return {
            ...persistedState,
            normalized: persistedState.normalized || null,
            lastFetched: persistedState.lastFetched || null,
          };
        }
        return persistedState;
      },
      partialize: (state) => ({
        // CORRECTED: Only persist normalized data (dates are already handled)
        normalized: state.normalized,
        lastFetched: state.lastFetched,
      }),
    }
  )
);

