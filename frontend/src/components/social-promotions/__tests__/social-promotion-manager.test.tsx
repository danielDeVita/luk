import type { ReactElement, ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMutation } from '@apollo/client/react';
import { SocialPromotionManager } from '../social-promotion-manager';

function createMutationTuple(handler: ReturnType<typeof vi.fn>) {
  return [
    handler,
    {
      called: false,
      loading: false,
      data: undefined,
      error: undefined,
      client: {} as never,
      reset: vi.fn(),
    },
  ] as ReturnType<typeof useMutation>;
}

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <div>{children}</div> : <div />,
  DialogContent: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  DialogHeader: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, children }: { value: string; onValueChange: (value: string) => void; children: ReactNode }) => {
    const options: Array<{ value: string; label: string; disabled?: boolean }> = [];
    const visit = (node: ReactNode): void => {
      if (!node) return;
      if (Array.isArray(node)) {
        node.forEach(visit);
        return;
      }
      if (typeof node !== 'object') return;
      const element = node as ReactElement<{ value?: string; disabled?: boolean; children?: ReactNode }>;
      if (element.props?.value) {
        const child = element.props.children;
        const label = typeof child === 'string' ? child : String(child);
        options.push({ value: element.props.value, label, disabled: element.props.disabled });
        return;
      }
      visit(element.props?.children);
    };
    visit(children);

    return (
      <select aria-label="Red social" value={value} onChange={(event) => onValueChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    );
  },
  SelectTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <>{placeholder ?? null}</>,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const mockWriteText = vi.fn();
Object.assign(navigator, {
  clipboard: {
    writeText: mockWriteText,
  },
});

describe('SocialPromotionManager', () => {
  const mockUseMutation = vi.mocked(useMutation);
  const startDraft = vi.fn();
  const submitPost = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMutation.mockImplementation((document) => {
      const operationName =
        typeof document === 'object' &&
        document &&
        'definitions' in document &&
        Array.isArray(document.definitions)
          ? document.definitions[0]?.kind === 'OperationDefinition'
            ? document.definitions[0]?.name?.value
            : undefined
          : undefined;

      if (operationName === 'StartSocialPromotionDraft') {
        return createMutationTuple(startDraft);
      }

      return createMutationTuple(submitPost);
    });

    startDraft.mockImplementation(async ({ variables }) => ({
      data: {
        startSocialPromotionDraft: {
          id: 'draft-1',
          trackingUrl: 'http://localhost:3000/raffle/raffle-1?promo=promo-123',
          promotionToken: 'promo-123',
          suggestedCopy: 'Copiá este texto con el link y el token.',
          expiresAt: '2026-03-13T00:00:00.000Z',
          network: variables.network,
        },
      },
    }));
    submitPost.mockResolvedValue({
      data: {
        submitSocialPromotionPost: {
          id: 'post-1',
          status: 'PENDING_VALIDATION',
          canonicalPermalink: 'https://www.instagram.com/p/abc123/',
        },
      },
    });
  });

  it('shows an Instagram image selector when the raffle has multiple images', async () => {
    const user = userEvent.setup();
    render(
      <SocialPromotionManager
        raffleId="raffle-1"
        raffleTitle="MacBook Pro"
        raffleImages={[
          'https://res.cloudinary.com/demo/image/upload/v1/macbook-front.jpg',
          'https://res.cloudinary.com/demo/image/upload/v1/macbook-back.jpg',
        ]}
        ticketPrice={2500}
        posts={[]}
        onChanged={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Promocionar y medir/i }));
    fireEvent.change(screen.getByLabelText('Red social'), {
      target: { value: 'INSTAGRAM' },
    });

    expect(screen.getByText('Elegí la foto del producto')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Usar foto/i })).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Usar foto 2' }));
    await user.click(screen.getByRole('button', { name: /Generar borrador/i }));

    await waitFor(() => {
      expect(startDraft).toHaveBeenCalledWith({
        variables: {
          raffleId: 'raffle-1',
          network: 'INSTAGRAM',
        },
      });
    });

    const preview = screen.getByAltText('Preview de pieza promocional') as HTMLImageElement;
    expect(preview).toBeInTheDocument();
    expect(preview.src).toContain('/api/social-promotions/instagram-asset?');
    expect(decodeURIComponent(preview.src)).toContain('imageUrl=https://res.cloudinary.com/demo/image/upload/v1/macbook-back.jpg');
    expect(screen.getByRole('link', { name: /Descargar imagen/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Abrir imagen/i })).toBeInTheDocument();
    expect(screen.getByText('Caption sugerido')).toBeInTheDocument();
  });

  it('shows a single fixed Instagram option when the raffle only has one image', async () => {
    const user = userEvent.setup();
    render(
      <SocialPromotionManager
        raffleId="raffle-1"
        raffleTitle="MacBook Pro"
        raffleImages={['https://res.cloudinary.com/demo/image/upload/v1/macbook-front.jpg']}
        ticketPrice={2500}
        posts={[]}
        onChanged={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Promocionar y medir/i }));
    fireEvent.change(screen.getByLabelText('Red social'), {
      target: { value: 'INSTAGRAM' },
    });

    expect(screen.getByText('Usaremos esta foto para armar la pieza descargable.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Usar foto/i })).toHaveLength(1);
  });

  it('reuses the image + copy flow for X when the raffle has images', async () => {
    const user = userEvent.setup();
    render(
      <SocialPromotionManager
        raffleId="raffle-1"
        raffleTitle="MacBook Pro"
        raffleImages={['https://res.cloudinary.com/demo/image/upload/v1/macbook-front.jpg']}
        ticketPrice={2500}
        posts={[]}
        onChanged={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Promocionar y medir/i }));
    fireEvent.change(screen.getByLabelText('Red social'), {
      target: { value: 'X' },
    });
    await user.click(screen.getByRole('button', { name: /Generar borrador/i }));

    await waitFor(() => {
      expect(startDraft).toHaveBeenCalledWith({
        variables: {
          raffleId: 'raffle-1',
          network: 'X',
        },
      });
    });

    const preview = screen.getByAltText('Preview de pieza promocional') as HTMLImageElement;
    expect(preview).toBeInTheDocument();
    expect(decodeURIComponent(preview.src)).toContain('network=X');
    expect(screen.getByText('Copy sugerido')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Copiar copy/i })).toBeInTheDocument();
  });

  it('disables Instagram when the raffle has no images and hides the Instagram-only flow again when switching back', async () => {
    const user = userEvent.setup();
    render(
      <SocialPromotionManager
        raffleId="raffle-1"
        raffleTitle="MacBook Pro"
        raffleImages={[]}
        ticketPrice={2500}
        posts={[]}
        onChanged={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Promocionar y medir/i }));

    const networkSelect = screen.getByLabelText('Red social') as HTMLSelectElement;
    expect(networkSelect.querySelector('option[value="INSTAGRAM"]')).toBeDisabled();
    expect(screen.getByText('Instagram requiere al menos una foto cargada en la rifa.')).toBeInTheDocument();

    fireEvent.change(networkSelect, { target: { value: 'X' } });
    expect(screen.queryByText('Elegí la foto del producto')).not.toBeInTheDocument();
  });
});
