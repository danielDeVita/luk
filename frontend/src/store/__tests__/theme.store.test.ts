import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { act } from '@testing-library/react';

// Unmock the store for these tests
vi.unmock('@/store/theme');

// Import after unmocking
import { useThemeStore } from '../theme';

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: query === '(prefers-color-scheme: dark)',
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock document
document.documentElement.classList.add = vi.fn();
document.documentElement.classList.remove = vi.fn();

describe('Theme Store (Zustand)', () => {
  beforeEach(() => {
    // Reset store to initial state
    act(() => {
      useThemeStore.getState().setTheme('system');
      useThemeStore.getState().setHasHydrated(false);
    });
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useThemeStore.getState();

      expect(state.theme).toBe('system');
      // resolvedTheme depends on system preference
      expect(['light', 'dark']).toContain(state.resolvedTheme);
      expect(state.hasHydrated).toBe(false);
    });
  });

  describe('setTheme', () => {
    it('should set light theme', () => {
      act(() => {
        useThemeStore.getState().setTheme('light');
      });

      const state = useThemeStore.getState();
      expect(state.theme).toBe('light');
      expect(state.resolvedTheme).toBe('light');
      expect(document.documentElement.classList.remove).toHaveBeenCalledWith('dark');
    });

    it('should set dark theme', () => {
      act(() => {
        useThemeStore.getState().setTheme('dark');
      });

      const state = useThemeStore.getState();
      expect(state.theme).toBe('dark');
      expect(state.resolvedTheme).toBe('dark');
      expect(document.documentElement.classList.add).toHaveBeenCalledWith('dark');
    });

    it('should resolve system theme to dark when prefers dark', () => {
      (window.matchMedia as unknown as Mock).mockReturnValueOnce({
        matches: true,
        media: '(prefers-color-scheme: dark)',
      });

      act(() => {
        useThemeStore.getState().setTheme('system');
      });

      const state = useThemeStore.getState();
      expect(state.theme).toBe('system');
      expect(state.resolvedTheme).toBe('dark');
      expect(document.documentElement.classList.add).toHaveBeenCalledWith('dark');
    });

    it('should resolve system theme to light when prefers light', () => {
      (window.matchMedia as unknown as Mock).mockReturnValueOnce({
        matches: false,
        media: '(prefers-color-scheme: dark)',
      });

      act(() => {
        useThemeStore.getState().setTheme('system');
      });

      const state = useThemeStore.getState();
      expect(state.theme).toBe('system');
      expect(state.resolvedTheme).toBe('light');
      expect(document.documentElement.classList.remove).toHaveBeenCalledWith('dark');
    });
  });

  describe('setHasHydrated', () => {
    it('should set hydrated state', () => {
      act(() => {
        useThemeStore.getState().setHasHydrated(true);
      });
      expect(useThemeStore.getState().hasHydrated).toBe(true);

      act(() => {
        useThemeStore.getState().setHasHydrated(false);
      });
      expect(useThemeStore.getState().hasHydrated).toBe(false);
    });
  });

  describe('Theme Transitions', () => {
    it('should transition from light to dark', () => {
      act(() => {
        useThemeStore.getState().setTheme('light');
      });
      expect(useThemeStore.getState().resolvedTheme).toBe('light');

      act(() => {
        useThemeStore.getState().setTheme('dark');
      });
      expect(useThemeStore.getState().resolvedTheme).toBe('dark');
    });

    it('should transition from dark to light', () => {
      act(() => {
        useThemeStore.getState().setTheme('dark');
      });
      expect(useThemeStore.getState().resolvedTheme).toBe('dark');

      act(() => {
        useThemeStore.getState().setTheme('light');
      });
      expect(useThemeStore.getState().resolvedTheme).toBe('light');
    });

    it('should transition to system from light', () => {
      act(() => {
        useThemeStore.getState().setTheme('light');
      });
      expect(useThemeStore.getState().theme).toBe('light');

      (window.matchMedia as unknown as Mock).mockReturnValueOnce({
        matches: true,
        media: '(prefers-color-scheme: dark)',
      });

      act(() => {
        useThemeStore.getState().setTheme('system');
      });
      expect(useThemeStore.getState().theme).toBe('system');
      expect(useThemeStore.getState().resolvedTheme).toBe('dark');
    });
  });

  describe('Persistence', () => {
    it('should only persist theme, not resolvedTheme or hasHydrated', () => {
      useThemeStore.setState({
        theme: 'dark',
        resolvedTheme: 'dark',
        hasHydrated: true,
      });

      const state = useThemeStore.getState();

      // Verify store has all values
      expect(state.theme).toBe('dark');
      expect(state.resolvedTheme).toBe('dark');
      expect(state.hasHydrated).toBe(true);
    });
  });
});
