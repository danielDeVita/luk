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
  token: string | null; // Store token for Authorization header (third-party cookies blocked)
  refreshToken: string | null; // Store refresh token for cross-subdomain deployments
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  setAuth: (user: User, token: string, refreshToken?: string) => void;
  getToken: () => string | null;
  getRefreshToken: () => string | null;
  setTokens: (token: string, refreshToken?: string) => void;
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
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      hasHydrated: false,

      setAuth: (user, token, refreshToken) => {
        // Store tokens in localStorage for Authorization header
        // (httpOnly cookies don't work with third-party cookie blocking on different subdomains)
        set({ user, token, refreshToken: refreshToken || null, isAuthenticated: true, isLoading: false, error: null });
      },

      getToken: () => {
        return get().token;
      },

      getRefreshToken: () => {
        return get().refreshToken;
      },

      setTokens: (token, refreshToken) => {
        set({ token, refreshToken: refreshToken || get().refreshToken });
      },

      logout: async () => {
        try {
          // Call backend to clear any server-side session
          await fetch(`${BACKEND_URL}/auth/logout`, {
            method: 'GET',
            credentials: 'include',
          });
        } catch {
          // Ignore errors - just clear local state
        }
        set({ user: null, token: null, refreshToken: null, isAuthenticated: false, error: null });
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
        // Persist user info and tokens (cookies blocked on cross-subdomain deploys)
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
