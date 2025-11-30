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
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (user: User) => void;
  logout: () => void;
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
    }),
    {
      name: 'auth-storage',
    }
  )
);
