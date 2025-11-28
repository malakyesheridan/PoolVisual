import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
        set({ user: null, isAuthenticated: false });
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
