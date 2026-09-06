import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getRuntimeConfigSnapshot } from '@/lib/runtime-config';

function getBackendUrl(): string {
  return getRuntimeConfigSnapshot().backendUrl;
}

interface User {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  role: 'USER' | 'ADMIN' | 'BANNED';
  avatarUrl?: string;
}

interface AuthState {
  user: User | null;
  // Access token lives only in memory (never persisted to localStorage).
  // Long-lived sessions survive reloads through the httpOnly refresh cookie
  // via restoreSession(). This limits the impact of an XSS injection:
  // an attacker reading localStorage no longer finds a usable token.
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  setAuth: (user: User, token: string) => void;
  getToken: () => string | null;
  setToken: (token: string) => void;
  logout: () => Promise<void>;
  restoreSession: () => Promise<boolean>;
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
      isAuthenticated: false,
      isLoading: false,
      error: null,
      hasHydrated: false,

      setAuth: (user, token) => {
        set({
          user,
          token,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
      },

      getToken: () => {
        return get().token;
      },

      setToken: (token) => {
        set({ token });
      },

      logout: async () => {
        try {
          // Call backend to revoke the refresh token and clear cookies
          await fetch(`${getBackendUrl()}/auth/logout`, {
            method: 'GET',
            credentials: 'include',
          });
        } catch {
          // Ignore errors - just clear local state
        }
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          error: null,
        });
      },

      restoreSession: async () => {
        const { user, token } = get();
        // Nothing to restore without a persisted user, or token already live
        if (!user || token) {
          return !!token;
        }
        set({ isLoading: true });
        try {
          const response = await fetch(`${getBackendUrl()}/auth/refresh`, {
            method: 'GET',
            credentials: 'include',
          });
          if (!response.ok) {
            throw new Error(`refresh failed: ${response.status}`);
          }
          const data = await response.json();
          if (!data?.token) {
            throw new Error('refresh response without token');
          }
          set({
            token: data.token,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
          return true;
        } catch {
          // Refresh cookie missing/expired: drop the stale persisted user
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
          });
          return false;
        }
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
        // Persist identity only. The access token stays in memory and is
        // re-issued via restoreSession() using the httpOnly refresh cookie.
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
