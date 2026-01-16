import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

interface User {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  role: 'USER' | 'ADMIN' | 'BANNED';
  avatarUrl?: string;
  stripeConnectStatus?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  setAuth: (user: User) => void;
  logout: () => Promise<void>;
  updateUser: (user: Partial<User>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      hasHydrated: false,

      setAuth: (user) => {
        // Token is now in httpOnly cookie, only store user info
        set({ user, isAuthenticated: true, isLoading: false, error: null });
      },

      logout: async () => {
        try {
          // Call backend to clear httpOnly cookies
          await fetch(`${BACKEND_URL}/auth/logout`, {
            method: 'GET',
            credentials: 'include',
          });
        } catch {
          // Ignore errors - just clear local state
        }
        set({ user: null, isAuthenticated: false, error: null });
      },

      updateUser: (updates) => {
        const currentUser = get().user;
        if (currentUser) {
          set({ user: { ...currentUser, ...updates } });
        }
      },

      setLoading: (loading) => {
        set({ isLoading: loading });
      },

      setError: (error) => {
        set({ error, isLoading: false });
      },

      clearError: () => {
        set({ error: null });
      },

      setHasHydrated: (state) => {
        set({ hasHydrated: state });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        // Only persist user info, not token (token is in httpOnly cookie)
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
