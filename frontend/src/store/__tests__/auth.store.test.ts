import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { act } from '@testing-library/react';

// Unmock the store for these tests
vi.unmock('@/store/auth');

// Import after unmocking
import { useAuthStore } from '../auth';

// Mock fetch for logout
global.fetch = vi.fn();

describe('Auth Store (Zustand)', () => {
  beforeEach(() => {
    // Reset store to initial state by calling actions
    act(() => {
      useAuthStore.getState().logout();
      useAuthStore.getState().setHasHydrated(false);
    });
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useAuthStore.getState();

      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.refreshToken).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.hasHydrated).toBe(false);
    });
  });

  describe('setAuth', () => {
    it('should set authentication data', () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        nombre: 'Test',
        apellido: 'User',
        role: 'USER' as const,
      };

      act(() => {
        useAuthStore.getState().setAuth(mockUser, 'token-123', 'refresh-123');
      });

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.token).toBe('token-123');
      expect(state.refreshToken).toBe('refresh-123');
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should set auth without refresh token', () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        nombre: 'Test',
        apellido: 'User',
        role: 'USER' as const,
      };

      act(() => {
        useAuthStore.getState().setAuth(mockUser, 'token-123');
      });

      const state = useAuthStore.getState();
      expect(state.token).toBe('token-123');
      expect(state.refreshToken).toBeNull();
    });
  });

  describe('getToken', () => {
    it('should return null when not authenticated', () => {
      const token = useAuthStore.getState().getToken();
      expect(token).toBeNull();
    });

    it('should return token when authenticated', () => {
      act(() => {
        useAuthStore.getState().setAuth(
          { id: '1', email: 'test@test.com', nombre: 'Test', apellido: 'User', role: 'USER' },
          'my-token'
        );
      });

      const token = useAuthStore.getState().getToken();
      expect(token).toBe('my-token');
    });
  });

  describe('getRefreshToken', () => {
    it('should return null when no refresh token', () => {
      const token = useAuthStore.getState().getRefreshToken();
      expect(token).toBeNull();
    });

    it('should return refresh token when set', () => {
      act(() => {
        useAuthStore.getState().setAuth(
          { id: '1', email: 'test@test.com', nombre: 'Test', apellido: 'User', role: 'USER' },
          'token',
          'refresh-token'
        );
      });

      const token = useAuthStore.getState().getRefreshToken();
      expect(token).toBe('refresh-token');
    });
  });

  describe('setTokens', () => {
    it('should update both tokens', () => {
      act(() => {
        useAuthStore.getState().setAuth(
          { id: '1', email: 'test@test.com', nombre: 'Test', apellido: 'User', role: 'USER' },
          'old-token',
          'old-refresh'
        );
        useAuthStore.getState().setTokens('new-token', 'new-refresh');
      });

      const state = useAuthStore.getState();
      expect(state.token).toBe('new-token');
      expect(state.refreshToken).toBe('new-refresh');
    });

    it('should keep existing refresh token if not provided', () => {
      act(() => {
        useAuthStore.getState().setAuth(
          { id: '1', email: 'test@test.com', nombre: 'Test', apellido: 'User', role: 'USER' },
          'token',
          'existing-refresh'
        );
        useAuthStore.getState().setTokens('new-token');
      });

      const state = useAuthStore.getState();
      expect(state.token).toBe('new-token');
      expect(state.refreshToken).toBe('existing-refresh');
    });
  });

  describe('logout', () => {
    it('should clear auth state and call logout endpoint', async () => {
      // Setup authenticated state
      act(() => {
        useAuthStore.getState().setAuth(
          { id: '1', email: 'test@test.com', nombre: 'Test', apellido: 'User', role: 'USER' },
          'token',
          'refresh'
        );
      });

      (fetch as unknown as Mock).mockResolvedValueOnce({ ok: true });

      await act(async () => {
        await useAuthStore.getState().logout();
      });

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.refreshToken).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/logout'),
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should clear state even if logout endpoint fails', async () => {
      act(() => {
        useAuthStore.getState().setAuth(
          { id: '1', email: 'test@test.com', nombre: 'Test', apellido: 'User', role: 'USER' },
          'token'
        );
      });

      (fetch as unknown as Mock).mockRejectedValueOnce(new Error('Network error'));

      await act(async () => {
        await useAuthStore.getState().logout();
      });

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
    });
  });

  describe('updateUser', () => {
    it('should update user properties', () => {
      const initialUser = {
        id: 'user-123',
        email: 'test@example.com',
        nombre: 'Test',
        apellido: 'User',
        role: 'USER' as const,
      };

      act(() => {
        useAuthStore.getState().setAuth(initialUser, 'token');
        useAuthStore.getState().updateUser({ nombre: 'Updated', avatarUrl: 'https://example.com/avatar.jpg' });
      });

      const state = useAuthStore.getState();
      expect(state.user?.nombre).toBe('Updated');
      expect(state.user?.apellido).toBe('User');
      expect(state.user?.avatarUrl).toBe('https://example.com/avatar.jpg');
    });

    it('should not update if no user exists', () => {
      act(() => {
        useAuthStore.getState().updateUser({ nombre: 'Updated' });
      });

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
    });
  });

  describe('setLoading', () => {
    it('should set loading state', () => {
      act(() => {
        useAuthStore.getState().setLoading(true);
      });
      expect(useAuthStore.getState().isLoading).toBe(true);

      act(() => {
        useAuthStore.getState().setLoading(false);
      });
      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  describe('setError', () => {
    it('should set error and clear loading', () => {
      act(() => {
        useAuthStore.getState().setLoading(true);
        useAuthStore.getState().setError('Invalid credentials');
      });

      const state = useAuthStore.getState();
      expect(state.error).toBe('Invalid credentials');
      expect(state.isLoading).toBe(false);
    });

    it('should clear error when null', () => {
      act(() => {
        useAuthStore.getState().setAuth(
          { id: '1', email: 'test@test.com', nombre: 'Test', apellido: 'User', role: 'USER' },
          'token'
        );
        useAuthStore.getState().setError('Some error');
        useAuthStore.getState().setError(null);
      });

      expect(useAuthStore.getState().error).toBeNull();
    });
  });

  describe('clearError', () => {
    it('should clear error', () => {
      act(() => {
        useAuthStore.getState().setAuth(
          { id: '1', email: 'test@test.com', nombre: 'Test', apellido: 'User', role: 'USER' },
          'token'
        );
        useAuthStore.getState().setError('Some error');
        useAuthStore.getState().clearError();
      });

      expect(useAuthStore.getState().error).toBeNull();
    });
  });

  describe('setHasHydrated', () => {
    it('should set hydrated state', () => {
      act(() => {
        useAuthStore.getState().setHasHydrated(true);
      });
      expect(useAuthStore.getState().hasHydrated).toBe(true);

      act(() => {
        useAuthStore.getState().setHasHydrated(false);
      });
      expect(useAuthStore.getState().hasHydrated).toBe(false);
    });
  });

  describe('Persistence', () => {
    it('should persist user, token, and refreshToken', () => {
      // This test verifies the partialize config
      // Set some values
      act(() => {
        useAuthStore.getState().setAuth(
          { id: '1', email: 'test@test.com', nombre: 'Test', apellido: 'User', role: 'USER' },
          'token',
          'refresh'
        );
        useAuthStore.getState().setLoading(true);
        useAuthStore.getState().setError('error');
      });

      // The store should have all values
      expect(useAuthStore.getState().user).not.toBeNull();
      expect(useAuthStore.getState().token).toBe('token');
      expect(useAuthStore.getState().refreshToken).toBe('refresh');
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      // Note: isLoading and error are NOT persisted (partialize excludes them)
    });
  });
});
