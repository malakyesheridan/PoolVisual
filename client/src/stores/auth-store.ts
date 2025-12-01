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
  creditsBalance?: number | string | null;
  trialCreditsGranted?: boolean;
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
    }),
    {
      name: 'auth-storage',
    }
  )
);
