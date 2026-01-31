import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useQuery, useMutation, useSubscription } from '@apollo/client/react';
import { useAuthStore } from '@/store/auth';
import { NotificationsBell } from '../notifications-bell';

// Mock apollo-provider hook
vi.mock('@/lib/apollo-provider', () => ({
  useConnectionStatus: () => ({
    status: 'connected',
    retryConnection: vi.fn(),
  }),
}));

describe('NotificationsBell', () => {
  const mockRefetch = vi.fn();
  const mockMarkRead = vi.fn();
  const _mockMarkAllRead = vi.fn();
  const mockUseQuery = vi.mocked(useQuery);
  const mockUseMutation = vi.mocked(useMutation);
  const mockUseSubscription = vi.mocked(useSubscription);
  const mockUseAuthStore = vi.mocked(useAuthStore);

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      user: { id: 'user-1', email: 'test@example.com' },
      hasHydrated: true,
      login: vi.fn(),
      logout: vi.fn(),
      setUser: vi.fn(),
    });

    mockUseQuery.mockReturnValue({
      data: { myNotifications: [] },
      loading: false,
      error: undefined,
      refetch: mockRefetch,
    } as ReturnType<typeof useQuery>);

    mockUseMutation.mockReturnValue([
      mockMarkRead,
      { data: undefined, loading: false, error: undefined },
    ] as ReturnType<typeof useMutation>);

    mockUseSubscription.mockReturnValue({
      data: undefined,
      loading: false,
      error: undefined,
    } as ReturnType<typeof useSubscription>);
  });

  it('should render bell icon button', () => {
    const { container } = render(<NotificationsBell />);

    const bellIcon = container.querySelector('svg.lucide-bell');
    expect(bellIcon).toBeInTheDocument();
  });

  it('should not show badge when there are no unread notifications', () => {
    render(<NotificationsBell />);

    const badge = screen.queryByText(/\d+/);
    expect(badge).not.toBeInTheDocument();
  });

  it('should show unread count badge when there are unread notifications', () => {
    const mockNotifications = [
      { id: '1', type: 'info', title: 'Notification 1', message: 'Message 1', read: false, createdAt: new Date().toISOString() },
      { id: '2', type: 'info', title: 'Notification 2', message: 'Message 2', read: false, createdAt: new Date().toISOString() },
      { id: '3', type: 'info', title: 'Notification 3', message: 'Message 3', read: true, createdAt: new Date().toISOString() },
    ];

    mockUseQuery.mockReturnValue({
      data: { myNotifications: mockNotifications },
      loading: false,
      error: undefined,
      refetch: mockRefetch,
    } as ReturnType<typeof useQuery>);

    render(<NotificationsBell />);

    // Should show 2 unread (badge with "2")
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('should skip query when user is not authenticated', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: false,
      user: null,
      hasHydrated: true,
      login: vi.fn(),
      logout: vi.fn(),
      setUser: vi.fn(),
    });

    render(<NotificationsBell />);

    // Query should be called with skip: true
    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ skip: true })
    );
  });

  it('should skip query when store has not hydrated', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      user: { id: 'user-1', email: 'test@example.com' },
      hasHydrated: false,
      login: vi.fn(),
      logout: vi.fn(),
      setUser: vi.fn(),
    });

    render(<NotificationsBell />);

    // Query should be called with skip: true
    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ skip: true })
    );
  });

  it('should use network-only fetch policy', () => {
    render(<NotificationsBell />);

    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ fetchPolicy: 'network-only' })
    );
  });

  it('should set appropriate poll interval when connected', () => {
    render(<NotificationsBell />);

    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ pollInterval: 60000 })
    );
  });

  it('should render bell button even when not authenticated', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: false,
      user: null,
      hasHydrated: true,
      login: vi.fn(),
      logout: vi.fn(),
      setUser: vi.fn(),
    });

    const { container } = render(<NotificationsBell />);

    const bellIcon = container.querySelector('svg.lucide-bell');
    expect(bellIcon).toBeInTheDocument();
  });
});
