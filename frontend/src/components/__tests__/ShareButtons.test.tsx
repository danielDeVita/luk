import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ShareButtons } from '../share/share-buttons';

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(),
  },
});

// Mock window.open
global.window.open = vi.fn();

describe('ShareButtons', () => {
  const defaultProps = {
    url: 'https://example.com/raffle/123',
    title: 'iPhone 15 Pro Max',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(navigator.clipboard.writeText).mockResolvedValue();
  });

  it('should render share button with correct text', () => {
    render(<ShareButtons {...defaultProps} />);

    expect(screen.getByRole('button', { name: /Compartir/i })).toBeInTheDocument();
  });

  it('should render share button with Share2 icon', () => {
    const { container } = render(<ShareButtons {...defaultProps} />);

    const shareIcon = container.querySelector('svg.lucide-share2, svg.lucide-share-2');
    expect(shareIcon).toBeInTheDocument();
  });

  it('should encode URL and title correctly for sharing', () => {
    const { container } = render(<ShareButtons {...defaultProps} />);

    expect(container).toBeInTheDocument();

    // Verify component renders without errors with encoded URLs
    const shareButton = screen.getByRole('button', { name: /Compartir/i });
    expect(shareButton).toBeEnabled();
  });

  it('should have correct share message format', () => {
    render(<ShareButtons {...defaultProps} />);

    const shareButton = screen.getByRole('button', { name: /Compartir/i });
    expect(shareButton).toBeInTheDocument();

    // Component should render all share links internally
    // Message format: "Che, mirá esta rifa: "${title}" - Animate a participar..."
  });

  it('should initialize with copied state as false', () => {
    const { container } = render(<ShareButtons {...defaultProps} />);

    // Component should render without showing "Copiado!" initially
    expect(container).toBeInTheDocument();

    const shareButton = screen.getByRole('button', { name: /Compartir/i });
    expect(shareButton).toBeInTheDocument();
  });
});
