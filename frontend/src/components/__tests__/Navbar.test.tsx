import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '@/store/auth';
import { Navbar } from '../navbar';

// Mock NotificationsBell
vi.mock('../notifications-bell', () => ({
  NotificationsBell: () => <div data-testid="notifications-bell">NotificationsBell</div>,
}));

// Mock ThemeToggle
vi.mock('../ui/theme-toggle', () => ({
  ThemeToggle: () => <div data-testid="theme-toggle">ThemeToggle</div>,
}));

describe('Navbar', () => {
  const mockUseAuthStore = vi.mocked(useAuthStore);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render logo link to homepage', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: false,
      user: null,
      hasHydrated: true,
      login: vi.fn(),
      logout: vi.fn(),
      setUser: vi.fn(),
    });

    const { container } = render(<Navbar />);

    const logoLink = container.querySelector('a[href="/"]');
    expect(logoLink).toBeInTheDocument();
  });

  it('should display login button for unauthenticated users', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: false,
      user: null,
      hasHydrated: true,
      login: vi.fn(),
      logout: vi.fn(),
      setUser: vi.fn(),
    });

    const { container } = render(<Navbar />);

    const loginLinks = container.querySelectorAll('a[href="/auth/login"]');
    expect(loginLinks.length).toBeGreaterThan(0);
  });

  it('should display register button for unauthenticated users', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: false,
      user: null,
      hasHydrated: true,
      login: vi.fn(),
      logout: vi.fn(),
      setUser: vi.fn(),
    });

    const { container } = render(<Navbar />);

    const registerLinks = container.querySelectorAll('a[href="/auth/register"]');
    expect(registerLinks.length).toBeGreaterThan(0);
  });

  it('should render notifications bell component', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      user: { id: 'user-1', email: 'test@example.com' },
      hasHydrated: true,
      login: vi.fn(),
      logout: vi.fn(),
      setUser: vi.fn(),
    });

    render(<Navbar />);

    const notificationsBells = screen.getAllByTestId('notifications-bell');
    expect(notificationsBells.length).toBeGreaterThan(0);
  });

  it('should render theme toggle component', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: false,
      user: null,
      hasHydrated: true,
      login: vi.fn(),
      logout: vi.fn(),
      setUser: vi.fn(),
    });

    render(<Navbar />);

    const themeToggles = screen.getAllByTestId('theme-toggle');
    expect(themeToggles.length).toBeGreaterThan(0);
  });

  it('should display navigation links', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: false,
      user: null,
      hasHydrated: true,
      login: vi.fn(),
      logout: vi.fn(),
      setUser: vi.fn(),
    });

    const { container } = render(<Navbar />);

    // Should have links for navigation (Inicio, Explorar, etc.)
    const homeLink = container.querySelector('a[href="/"]');
    expect(homeLink).toBeInTheDocument();
  });

  it('should render header element', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: false,
      user: null,
      hasHydrated: true,
      login: vi.fn(),
      logout: vi.fn(),
      setUser: vi.fn(),
    });

    const { container } = render(<Navbar />);

    const header = container.querySelector('header');
    expect(header).toBeInTheDocument();
  });

  it('should have navigation elements for authenticated users', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      user: { id: 'user-1', email: 'test@example.com' },
      hasHydrated: true,
      login: vi.fn(),
      logout: vi.fn(),
      setUser: vi.fn(),
    });

    const { container } = render(<Navbar />);

    // Should have navigation elements
    const nav = container.querySelector('nav');
    expect(nav).toBeInTheDocument();
  });
});
