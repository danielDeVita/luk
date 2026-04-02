import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMutation } from '@apollo/client/react';
import { toast } from 'sonner';
import { TwoFactorSettingsCard } from '../two-factor-settings-card';

vi.mock('@apollo/client/react', () => ({
  useMutation: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('TwoFactorSettingsCard', () => {
  const mockUseMutation = vi.mocked(useMutation);
  const mockToast = vi.mocked(toast);
  const onStatusChanged = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupMutations() {
    const mutationOptions = new Map<string, Record<string, unknown> | undefined>();
    const beginSetupMutate = vi.fn();
    const enableTwoFactorMutate = vi.fn();
    const disableTwoFactorMutate = vi.fn();

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

      if (operationName === 'BeginTwoFactorSetup') {
        return [
          beginSetupMutate,
          { data: undefined, loading: false, error: undefined },
        ] as unknown as ReturnType<typeof useMutation>;
      }

      if (operationName === 'EnableTwoFactor') {
        return [
          enableTwoFactorMutate,
          { data: undefined, loading: false, error: undefined },
        ] as unknown as ReturnType<typeof useMutation>;
      }

      if (operationName === 'DisableTwoFactor') {
        return [
          disableTwoFactorMutate,
          { data: undefined, loading: false, error: undefined },
        ] as unknown as ReturnType<typeof useMutation>;
      }

      return [
        vi.fn(),
        { data: undefined, loading: false, error: undefined },
      ] as unknown as ReturnType<typeof useMutation>;
    });

    return {
      mutationOptions,
      beginSetupMutate,
      enableTwoFactorMutate,
      disableTwoFactorMutate,
    };
  }

  it('starts setup and activates 2FA showing recovery codes', async () => {
    const { mutationOptions, beginSetupMutate, enableTwoFactorMutate } =
      setupMutations();

    render(
      <TwoFactorSettingsCard
        twoFactorEnabled={false}
        twoFactorEnabledAt={null}
        onStatusChanged={onStatusChanged}
      />,
    );

    beginSetupMutate.mockImplementation(async (variables) => {
      const onCompleted = mutationOptions.get('BeginTwoFactorSetup')?.onCompleted as
        | ((payload: unknown) => void)
        | undefined;
      onCompleted?.({
        beginTwoFactorSetup: {
          setupToken: 'setup-token',
          manualEntryKey: 'SECRET123',
          otpauthUrl: 'otpauth://totp/LUK:test@example.com',
          qrCodeDataUrl: 'data:image/png;base64,qr',
        },
      });

      return { data: variables };
    });

    enableTwoFactorMutate.mockResolvedValue({
      data: {
        enableTwoFactor: {
          recoveryCodes: ['ABCD-1234', 'EFGH-5678'],
          user: {
            id: 'user-1',
            twoFactorEnabled: true,
            twoFactorEnabledAt: '2026-04-01T12:00:00.000Z',
          },
        },
      },
    });

    fireEvent.change(screen.getByLabelText(/contraseña actual/i), {
      target: { value: 'Password123!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /configurar 2fa/i }));

    expect(await screen.findByAltText(/código qr para configurar 2fa/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('SECRET123')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/código de autenticación/i), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: /activar 2fa/i }));

    await waitFor(() => {
      expect(enableTwoFactorMutate).toHaveBeenCalledWith({
        variables: {
          setupToken: 'setup-token',
          code: '123456',
        },
      });
      expect(onStatusChanged).toHaveBeenCalled();
      expect(screen.getByText('ABCD-1234')).toBeInTheDocument();
      expect(screen.getByText('EFGH-5678')).toBeInTheDocument();
      expect(mockToast.success).toHaveBeenCalledWith('2FA activado correctamente.');
    });
  });

  it('disables 2FA with password and TOTP code', async () => {
    const { disableTwoFactorMutate } = setupMutations();

    disableTwoFactorMutate.mockResolvedValue({
      data: { disableTwoFactor: true },
    });

    render(
      <TwoFactorSettingsCard
        twoFactorEnabled={true}
        twoFactorEnabledAt="2026-04-01T12:00:00.000Z"
        onStatusChanged={onStatusChanged}
      />,
    );

    fireEvent.change(screen.getByLabelText(/contraseña actual/i), {
      target: { value: 'Password123!' },
    });
    fireEvent.change(screen.getByLabelText(/código de autenticación/i), {
      target: { value: '654321' },
    });
    fireEvent.click(screen.getByRole('button', { name: /desactivar 2fa/i }));

    await waitFor(() => {
      expect(disableTwoFactorMutate).toHaveBeenCalledWith({
        variables: {
          currentPassword: 'Password123!',
          code: '654321',
          recoveryCode: null,
        },
      });
      expect(onStatusChanged).toHaveBeenCalled();
      expect(mockToast.success).toHaveBeenCalledWith(
        '2FA desactivado correctamente.',
      );
    });
  });
});
