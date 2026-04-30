import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMutation } from '@apollo/client/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import RegisterPage from '../page';

const { mockGetPublicBackendUrl, mockTurnstileEnabled } = vi.hoisted(() => ({
  mockGetPublicBackendUrl: vi.fn(() => 'http://localhost:3001'),
  mockTurnstileEnabled: vi.fn(() => false),
}));

vi.mock('@apollo/client/react', () => ({
  useMutation: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}));

vi.mock('@/store/auth', () => ({
  useAuthStore: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/public-env', () => ({
  getPublicBackendUrl: mockGetPublicBackendUrl,
  isTurnstileEnabled: mockTurnstileEnabled,
}));

vi.mock('@/lib/social-promotions', () => ({
  getStoredSocialPromotionToken: vi.fn(() => null),
  persistSocialPromotionToken: vi.fn(),
}));

vi.mock('@/components/auth/turnstile-field', () => ({
  TurnstileField: ({
    enabled,
    onTokenChange,
    resetSignal,
  }: {
    enabled: boolean;
    onTokenChange: (token: string | null) => void;
    resetSignal: number;
  }) =>
    enabled ? (
      <div>
        <button
          type="button"
          onClick={() => {
            onTokenChange('captcha-token');
          }}
        >
          Resolver captcha
        </button>
        <span data-testid="turnstile-reset-signal">{resetSignal}</span>
      </div>
    ) : null,
}));

describe('RegisterPage', () => {
  const mockUseMutation = vi.mocked(useMutation);
  const mockUseRouter = vi.mocked(useRouter);
  const mockUseSearchParams = vi.mocked(useSearchParams);
  const mockUseAuthStore = vi.mocked(useAuthStore);
  const mockPush = vi.fn();
  const mockSetAuth = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockTurnstileEnabled.mockReturnValue(false);
    mockGetPublicBackendUrl.mockReturnValue('http://localhost:3001');

    mockUseRouter.mockReturnValue({
      push: mockPush,
      replace: vi.fn(),
      refresh: vi.fn(),
      prefetch: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
    });

    mockUseSearchParams.mockReturnValue(
      new URLSearchParams() as unknown as ReturnType<typeof useSearchParams>,
    );

    const storeState = {
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      hasHydrated: true,
      setAuth: mockSetAuth,
      getToken: vi.fn(),
      setToken: vi.fn(),
      logout: vi.fn(),
      updateUser: vi.fn(),
      setLoading: vi.fn(),
      setError: vi.fn(),
      clearError: vi.fn(),
      setHasHydrated: vi.fn(),
    };

    mockUseAuthStore.mockImplementation((selector) => {
      if (typeof selector === 'function') {
        return selector(storeState);
      }

      return storeState;
    });
  });

  function setupMutations() {
    const registerMutate = vi.fn();
    const verifyMutate = vi.fn();
    const resendMutate = vi.fn();

    mockUseMutation.mockImplementation((document) => {
      const operationName =
        (
          document as unknown as {
            definitions?: ReadonlyArray<{
              kind?: string;
              name?: { value?: string };
            }>;
          }
        )?.definitions?.find((definition) => definition.kind === 'OperationDefinition')
          ?.name?.value ?? 'unknown';

      if (operationName === 'Register') {
        return [
          registerMutate,
          { data: undefined, loading: false, error: undefined },
        ] as unknown as ReturnType<typeof useMutation>;
      }

      if (operationName === 'VerifyEmail') {
        return [
          verifyMutate,
          { data: undefined, loading: false, error: undefined },
        ] as unknown as ReturnType<typeof useMutation>;
      }

      if (operationName === 'ResendVerificationCode') {
        return [
          resendMutate,
          { data: undefined, loading: false, error: undefined },
        ] as unknown as ReturnType<typeof useMutation>;
      }

      return [
        vi.fn(),
        { data: undefined, loading: false, error: undefined },
      ] as unknown as ReturnType<typeof useMutation>;
    });

    return { registerMutate };
  }

  function fillRegisterForm() {
    fireEvent.change(screen.getByLabelText(/nombre/i), {
      target: { value: 'Nuevo' },
    });
    fireEvent.change(screen.getByLabelText(/apellido/i), {
      target: { value: 'Usuario' },
    });
    fireEvent.change(screen.getByLabelText(/fecha de nacimiento/i), {
      target: { value: '1990-01-01' },
    });
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: 'nuevo@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^contraseña$/i), {
      target: { value: 'Password123' },
    });
    fireEvent.change(screen.getByLabelText(/confirmar contraseña/i), {
      target: { value: 'Password123' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
  }

  it('blocks registration submit until captcha is completed when turnstile is enabled', async () => {
    mockTurnstileEnabled.mockReturnValue(true);
    const { registerMutate } = setupMutations();

    render(<RegisterPage />);

    fillRegisterForm();

    const submitButton = screen.getByRole('button', { name: /crear cuenta/i });
    expect(submitButton).toBeDisabled();

    fireEvent.click(submitButton);

    expect(registerMutate).not.toHaveBeenCalled();
  });

  it('sends captcha token when turnstile is enabled', async () => {
    mockTurnstileEnabled.mockReturnValue(true);
    const { registerMutate } = setupMutations();

    registerMutate.mockResolvedValue({
      data: {
        register: {
          user: {
            id: 'user-1',
            email: 'nuevo@example.com',
            nombre: 'Nuevo',
          },
          requiresVerification: true,
          message: 'Verificá tu email con el código que te enviamos',
        },
      },
    });

    render(<RegisterPage />);

    fillRegisterForm();
    fireEvent.click(screen.getByRole('button', { name: /resolver captcha/i }));
    fireEvent.click(screen.getByRole('button', { name: /crear cuenta/i }));

    await waitFor(() => {
      expect(registerMutate).toHaveBeenCalledWith({
        variables: {
          nombre: 'Nuevo',
          apellido: 'Usuario',
          fechaNacimiento: '1990-01-01',
          email: 'nuevo@example.com',
          password: 'Password123',
          acceptTerms: true,
          captchaToken: 'captcha-token',
        },
      });
    });
  });

  it('resets captcha widget after a registration error when turnstile is enabled', async () => {
    mockTurnstileEnabled.mockReturnValue(true);
    const { registerMutate } = setupMutations();

    registerMutate.mockRejectedValue(
      new Error('No pudimos validar que sos humano. Intentá nuevamente.'),
    );

    render(<RegisterPage />);

    fillRegisterForm();
    fireEvent.click(screen.getByRole('button', { name: /resolver captcha/i }));
    fireEvent.click(screen.getByRole('button', { name: /crear cuenta/i }));

    await waitFor(() => {
      expect(screen.getByTestId('turnstile-reset-signal')).toHaveTextContent(
        '1',
      );
      expect(
        screen.getByText(/no pudimos validar que sos humano/i),
      ).toBeInTheDocument();
    });
  });
});
