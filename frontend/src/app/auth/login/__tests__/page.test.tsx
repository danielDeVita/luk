import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMutation } from '@apollo/client/react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth';
import LoginPage from '../page';

vi.mock('@apollo/client/react', () => ({
  useMutation: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
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

describe('LoginPage', () => {
  const mockUseMutation = vi.mocked(useMutation);
  const mockUseRouter = vi.mocked(useRouter);
  const mockUseAuthStore = vi.mocked(useAuthStore);
  const mockToast = vi.mocked(toast);
  const mockPush = vi.fn();
  const mockSetAuth = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseRouter.mockReturnValue({
      push: mockPush,
      replace: vi.fn(),
      refresh: vi.fn(),
      prefetch: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
    });

    const storeState = {
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      hasHydrated: true,
      setAuth: mockSetAuth,
      getToken: vi.fn(),
      getRefreshToken: vi.fn(),
      setTokens: vi.fn(),
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
    const mutationOptions = new Map<string, Record<string, unknown> | undefined>();
    const loginMutate = vi.fn();
    const verifyMutate = vi.fn();
    const resendMutate = vi.fn();

    mockUseMutation.mockImplementation((document, options) => {
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

      mutationOptions.set(
        operationName,
        options as Record<string, unknown> | undefined,
      );

      if (operationName === 'Login') {
        return [
          loginMutate,
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

    return { mutationOptions, loginMutate, verifyMutate, resendMutate };
  }

  function fillLoginForm() {
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/contrasena/i), {
      target: { value: 'Password123!' },
    });
  }

  it('stores auth and redirects on verified login', async () => {
    const { mutationOptions, loginMutate } = setupMutations();

    render(<LoginPage />);

    loginMutate.mockImplementation(async (variables) => {
      const onCompleted = mutationOptions.get('Login')?.onCompleted as
        | ((payload: unknown) => void)
        | undefined;
      onCompleted?.({
        login: {
          token: 'access-token',
          refreshToken: 'refresh-token',
          requiresVerification: false,
          user: {
            id: 'user-1',
            email: 'test@example.com',
            nombre: 'Test',
            apellido: 'User',
            role: 'USER',
          },
        },
      });

      return { data: variables };
    });

    fillLoginForm();
    fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    await waitFor(() => {
      expect(mockSetAuth).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'user-1' }),
        'access-token',
        'refresh-token',
      );
      expect(mockPush).toHaveBeenCalledWith('/');
    });
  });

  it('switches to inline verification when login requires email verification', async () => {
    const { mutationOptions, loginMutate } = setupMutations();

    render(<LoginPage />);

    loginMutate.mockImplementation(async () => {
      const onCompleted = mutationOptions.get('Login')?.onCompleted as
        | ((payload: unknown) => void)
        | undefined;
      onCompleted?.({
        login: {
          requiresVerification: true,
          message:
            'Tu email todavía no está verificado. Ingresá el código de 6 dígitos o reenviá uno nuevo.',
          user: {
            id: 'user-1',
            email: 'test@example.com',
            nombre: 'Test',
            apellido: 'User',
            role: 'USER',
          },
        },
      });

      return { data: undefined };
    });

    fillLoginForm();
    fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    expect(await screen.findByRole('heading', { name: /verificá tu email/i })).toBeInTheDocument();
    expect(
      screen.getByText(/tu email todavía no está verificado/i),
    ).toBeInTheDocument();
    expect(mockSetAuth).not.toHaveBeenCalled();
  });

  it('verifies email inline and completes login', async () => {
    const { mutationOptions, loginMutate, verifyMutate } = setupMutations();

    render(<LoginPage />);

    loginMutate.mockImplementation(async () => {
      const onCompleted = mutationOptions.get('Login')?.onCompleted as
        | ((payload: unknown) => void)
        | undefined;
      onCompleted?.({
        login: {
          requiresVerification: true,
          message: 'Tu email todavía no está verificado.',
          user: {
            id: 'user-1',
            email: 'test@example.com',
            nombre: 'Test',
            apellido: 'User',
            role: 'USER',
          },
        },
      });

      return { data: undefined };
    });

    verifyMutate.mockResolvedValue({
      data: {
        verifyEmail: {
          token: 'verified-access-token',
          refreshToken: 'verified-refresh-token',
          user: {
            id: 'user-1',
            email: 'test@example.com',
            nombre: 'Test',
            apellido: 'User',
            role: 'USER',
            emailVerified: true,
          },
        },
      },
    });

    fillLoginForm();
    fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    const codeInput = await screen.findByLabelText(/código de verificación/i);
    fireEvent.change(codeInput, { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /verificar email/i }));

    await waitFor(() => {
      expect(verifyMutate).toHaveBeenCalledWith({
        variables: {
          userId: 'user-1',
          code: '123456',
          promotionToken: null,
        },
      });
      expect(mockSetAuth).toHaveBeenCalledWith(
        expect.objectContaining({ emailVerified: true }),
        'verified-access-token',
        'verified-refresh-token',
      );
      expect(mockToast.success).toHaveBeenCalledWith(
        '¡Email verificado! Ya podés entrar',
      );
      expect(mockPush).toHaveBeenCalledWith('/');
    });
  });

  it('resends the verification code from the login flow', async () => {
    const { mutationOptions, loginMutate, resendMutate } = setupMutations();

    render(<LoginPage />);

    loginMutate.mockImplementation(async () => {
      const onCompleted = mutationOptions.get('Login')?.onCompleted as
        | ((payload: unknown) => void)
        | undefined;
      onCompleted?.({
        login: {
          requiresVerification: true,
          message: 'Tu email todavía no está verificado.',
          user: {
            id: 'user-1',
            email: 'test@example.com',
            nombre: 'Test',
            apellido: 'User',
            role: 'USER',
          },
        },
      });

      return { data: undefined };
    });

    resendMutate.mockResolvedValue({
      data: { resendVerificationCode: true },
    });

    fillLoginForm();
    fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    fireEvent.click(
      await screen.findByRole('button', { name: /reenviar código/i }),
    );

    await waitFor(() => {
      expect(resendMutate).toHaveBeenCalledWith({
        variables: { userId: 'user-1' },
      });
      expect(mockToast.success).toHaveBeenCalledWith(
        'Nuevo código enviado a tu email',
      );
    });
  });
});
