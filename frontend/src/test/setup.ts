import '@testing-library/jest-dom';
import { createElement } from 'react';
import { vi } from 'vitest';

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock Next/Image as a plain img so tests can assert previews and src values.
vi.mock('next/image', () => ({
  __esModule: true,
  default: ({
    src,
    alt,
    ...props
  }: {
    src?: string | { src?: string };
    alt?: string;
  }) =>
    createElement('img', {
      ...props,
      src: typeof src === 'string' ? src : src?.src ?? '',
      alt: alt ?? '',
    }),
}));

// Mock Zustand stores
vi.mock('@/store/auth', () => ({
  useAuthStore: vi.fn(() => ({
    isAuthenticated: false,
    user: null,
    hasHydrated: true,
    login: vi.fn(),
    logout: vi.fn(),
    setUser: vi.fn(),
  })),
}));

vi.mock('@/store/theme', () => ({
  useThemeStore: vi.fn(() => ({
    theme: 'light',
    setTheme: vi.fn(),
  })),
}));

// Mock Apollo Client
vi.mock('@apollo/client/react', () => ({
  useQuery: vi.fn(() => ({
    data: undefined,
    loading: false,
    error: undefined,
    refetch: vi.fn(),
  })),
  useMutation: vi.fn(() => [
    vi.fn(),
    {
      data: undefined,
      loading: false,
      error: undefined,
    },
  ]),
  useSubscription: vi.fn(() => ({
    data: undefined,
    loading: false,
    error: undefined,
  })),
  useApolloClient: vi.fn(() => ({
    query: vi.fn(),
    mutate: vi.fn(),
  })),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));
