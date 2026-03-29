import type { ReactElement, ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useQuery } from '@apollo/client/react';
import { SocialPromotionAnalytics } from '../social-promotion-analytics';

vi.mock('@apollo/client/react', () => ({
  useQuery: vi.fn(),
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (value: string) => void;
    children: ReactNode;
  }) => {
    const options: Array<{
      value: string;
      label: string;
      disabled?: boolean;
    }> = [];

    const visit = (node: ReactNode): void => {
      if (!node) return;
      if (Array.isArray(node)) {
        node.forEach(visit);
        return;
      }
      if (typeof node !== 'object') return;

      const element = node as ReactElement<{
        value?: string;
        disabled?: boolean;
        children?: ReactNode;
      }>;

      if (element.props?.value) {
        const child = element.props.children;
        const label = typeof child === 'string' ? child : String(child);
        options.push({
          value: element.props.value,
          label,
          disabled: element.props.disabled,
        });
        return;
      }

      visit(element.props?.children);
    };

    visit(children);

    return (
      <select value={value} onChange={(event) => onValueChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    );
  },
  SelectTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <>{placeholder ?? null}</>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

describe('SocialPromotionAnalytics', () => {
  const mockUseQuery = vi.mocked(useQuery);

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseQuery.mockReturnValue({
      data: {
        socialPromotionAnalytics: [
          {
            postId: 'post-1',
            raffleId: 'raffle-1',
            raffleTitle: 'MacBook Air',
            sellerId: 'seller-1',
            sellerEmail: 'seller-1@example.com',
            network: 'INSTAGRAM',
            status: 'SETTLED',
            submittedPermalink: 'https://instagram.com/p/post-1',
            canonicalPermalink: 'https://instagram.com/p/post-1/',
            submittedAt: '2026-03-10T10:00:00.000Z',
            validatedAt: '2026-03-10T11:00:00.000Z',
            settledAt: '2026-03-11T10:00:00.000Z',
            likesCount: 120,
            commentsCount: 15,
            repostsOrSharesCount: 7,
            viewsCount: 2500,
            clicksAttributed: 10,
            registrationsAttributed: 2,
            ticketPurchasesAttributed: 4,
            engagementScore: 18.5,
            conversionScore: 11,
            totalScore: 29.5,
            grantIssued: true,
            grantStatus: 'AVAILABLE',
            grantDiscountPercent: 15,
            grantMaxDiscountAmount: 15000,
          },
          {
            postId: 'post-2',
            raffleId: 'raffle-2',
            raffleTitle: 'PlayStation 5',
            sellerId: 'seller-2',
            sellerEmail: 'seller-2@example.com',
            network: 'X',
            status: 'ACTIVE',
            submittedPermalink: 'https://x.com/test/status/2',
            canonicalPermalink: null,
            submittedAt: '2026-03-09T10:00:00.000Z',
            validatedAt: null,
            settledAt: null,
            likesCount: null,
            commentsCount: null,
            repostsOrSharesCount: null,
            viewsCount: null,
            clicksAttributed: 0,
            registrationsAttributed: 0,
            ticketPurchasesAttributed: 0,
            engagementScore: null,
            conversionScore: null,
            totalScore: null,
            grantIssued: false,
            grantStatus: null,
            grantDiscountPercent: null,
            grantMaxDiscountAmount: null,
          },
        ],
      },
      loading: false,
      error: undefined,
      refetch: vi.fn(),
      networkStatus: 7,
    } as unknown as ReturnType<typeof useQuery>);
  });

  it('renders analytics metrics, ratios, and fallback states', () => {
    render(<SocialPromotionAnalytics />);

    expect(screen.getByText(/analytics de promociones sociales/i)).toBeInTheDocument();
    expect(screen.getAllByText(/clicks atribuidos/i)).toHaveLength(2);
    expect(screen.getByText('MacBook Air')).toBeInTheDocument();
    expect(screen.getByText('seller-1@example.com')).toBeInTheDocument();
    expect(screen.getByText(/reg\/click:\s*20\.0%/i)).toBeInTheDocument();
    expect(screen.getByText(/tickets\/click:\s*40\.0%/i)).toBeInTheDocument();
    expect(screen.getByText(/tickets\/reg:\s*2\.00/i)).toBeInTheDocument();
    expect(screen.getByText('Sin settlement todavía')).toBeInTheDocument();
    expect(screen.getByText('Sin grant')).toBeInTheDocument();
    expect(screen.getByText('Views: —')).toBeInTheDocument();
    expect(screen.getByText('Likes: —')).toBeInTheDocument();
    expect(screen.getByText('Comentarios: —')).toBeInTheDocument();
    expect(screen.getByText('Shares: —')).toBeInTheDocument();
  });
});
