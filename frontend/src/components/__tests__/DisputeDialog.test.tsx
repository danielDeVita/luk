import {
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useMutation } from '@apollo/client/react';
import { toast } from 'sonner';
import { DisputeDialog } from '../disputes/dispute-dialog';

describe('DisputeDialog', () => {
  const mockMutate = vi.fn();
  const mockOnDisputeOpened = vi.fn();
  const mockUseMutation = vi.mocked(useMutation);
  const mockToast = vi.mocked(toast);

  const defaultProps = {
    raffleId: 'raffle-123',
    raffleTitle: 'iPhone 15 Pro Max',
    onDisputeOpened: mockOnDisputeOpened,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseMutation.mockReturnValue([
      mockMutate,
      { data: undefined, loading: false, error: undefined },
    ] as unknown as ReturnType<typeof useMutation>);
  });

  it('should render trigger button with default text', () => {
    render(<DisputeDialog {...defaultProps} />);

    expect(
      screen.getByRole('button', { name: /Reportar Problema/i }),
    ).toBeInTheDocument();
  });

  it('should open dialog when trigger button is clicked', async () => {
    render(<DisputeDialog {...defaultProps} />);

    const trigger = screen.getByRole('button', {
      name: /Reportar Problema/i,
    });
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(
        screen.getByText(/Inicia una disputa/i),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: /Reportar Problema/i }),
      ).toBeInTheDocument();
    });
  });

  it('should display form fields in dialog', async () => {
    render(<DisputeDialog {...defaultProps} />);

    const trigger = screen.getByRole('button', {
      name: /Reportar Problema/i,
    });
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(
        screen.getByText(/Tipo de Problema/i),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByLabelText(/Título del Reclamo/i),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Descripción Detallada/i),
    ).toBeInTheDocument();
  });

  it('should validate form and submit dispute', async () => {
    render(<DisputeDialog {...defaultProps} />);

    fireEvent.click(
      screen.getByRole('button', { name: /Reportar Problema/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByLabelText(/Título del Reclamo/i),
      ).toBeInTheDocument();
    });

    // Fill form
    const titleInput = screen.getByLabelText(/Título del Reclamo/i);
    const descriptionInput = screen.getByLabelText(
      /Descripción Detallada/i,
    );

    fireEvent.change(titleInput, {
      target: { value: 'El producto llegó roto' },
    });
    fireEvent.change(descriptionInput, {
      target: {
        value:
          'El iPhone llegó con la pantalla completamente rota y la caja estaba dañada',
      },
    });

    // Submit form
    const submitButton = screen.getByRole('button', {
      name: /Abrir Disputa/i,
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith({
        variables: {
          input: {
            raffleId: 'raffle-123',
            tipo: 'NO_LLEGO',
            titulo: 'El producto llegó roto',
            descripcion:
              'El iPhone llegó con la pantalla completamente rota y la caja estaba dañada',
            evidencias: [],
          },
        },
      });
    });
  });

  it('should show success toast and close dialog on successful submission', async () => {
    mockUseMutation.mockImplementation((mutation, options) => {
      const mutate = vi.fn().mockImplementation(() => {
        if (options?.onCompleted) {
          options.onCompleted({});
        }
      });
      return [
        mutate,
        { data: undefined, loading: false, error: undefined },
      ] as unknown as ReturnType<typeof useMutation>;
    });

    render(<DisputeDialog {...defaultProps} />);

    fireEvent.click(
      screen.getByRole('button', { name: /Reportar Problema/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByLabelText(/Título del Reclamo/i),
      ).toBeInTheDocument();
    });

    const titleInput = screen.getByLabelText(/Título del Reclamo/i);
    const descriptionInput = screen.getByLabelText(
      /Descripción Detallada/i,
    );

    fireEvent.change(titleInput, {
      target: { value: 'Producto dañado durante el envío' },
    });
    fireEvent.change(descriptionInput, {
      target: {
        value:
          'El producto llegó con daños en la caja y el contenido estaba dañado también',
      },
    });

    const submitButton = screen.getByRole('button', {
      name: /Abrir Disputa/i,
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith(
        expect.stringContaining('Disputa abierta correctamente'),
      );
      expect(mockOnDisputeOpened).toHaveBeenCalled();
    });
  });
});
