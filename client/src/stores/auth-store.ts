import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useOnboardingStore } from './onboardingStore'; // CORRECTED: Import for logout cleanup

interface User {
  id: string;
  email: string;
  username: string;
  emailVerified?: boolean;
  isAdmin?: boolean;
  adminPermissions?: string[];
  // User-centric fields (from migration 028)
  industryType?: string | null;
  enhancementsBalance?: number | string | null;
  trialEnhancementsGranted?: boolean;
  // Free trial system fields
  isTrial?: boolean;
  trialStartDate?: string | Date | null;
  trialEnhancements?: number;
  hasUsedTrial?: boolean;
  subscriptionStatus?: string;
  subscriptionPlanId?: string | null;
  // Settings fields (user-level)
  currencyCode?: string;
  taxRate?: number | string;
  depositDefaultPct?: number | string;
  validityDays?: number;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (user: User) => void;
  logout: () => void;
  setUser: (user: User) => void;
  updateEnhancements: (delta: number) => void; // Optimistically update enhancements
  // Legacy method for backward compatibility
  updateCredits: (delta: number) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      login: (user) => {
        set({ user, isAuthenticated: true });
      },
      logout: () => {
        // CORRECTED: Clear onboarding store on logout
        useOnboardingStore.getState().clearOnboarding();
        set({ user: null, isAuthenticated: false });
      },
      setUser: (user) => {
        set({ user, isAuthenticated: !!user });
      },
      updateEnhancements: (delta) => {
        set((state) => {
          if (!state.user) return state;
          const currentBalance = Number(state.user.enhancementsBalance || 0);
          const newBalance = Math.max(0, currentBalance + delta); // Prevent negative
          return {
            ...state,
            user: {
              ...state.user,
              enhancementsBalance: newBalance,
            },
          };
        });
      },
      // Legacy method for backward compatibility
      updateCredits: (delta) => {
        set((state) => {
          if (!state.user) return state;
          const currentBalance = Number(state.user.enhancementsBalance || state.user.creditsBalance || 0);
          const newBalance = Math.max(0, currentBalance + delta); // Prevent negative
          return {
            ...state,
            user: {
              ...state.user,
              enhancementsBalance: newBalance,
              creditsBalance: newBalance, // Keep for backward compatibility
            },
          };
        });
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
