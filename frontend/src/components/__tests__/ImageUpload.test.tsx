import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ImageUpload } from '../ImageUpload';

// Mock global fetch
global.fetch = vi.fn();

describe('ImageUpload', () => {
  const mockOnImagesChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock successful signature request
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        signature: 'mock-signature',
        timestamp: 1234567890,
        cloudName: 'test-cloud',
        apiKey: 'test-key',
        folder: 'raffles',
      }),
    });
  });

  it('should render upload button with correct text', () => {
    const { container } = render(<ImageUpload images={[]} onImagesChange={mockOnImagesChange} />);

    expect(screen.getByText(/Subir/i)).toBeInTheDocument();
    expect(screen.getByText(/Máximo 5 imágenes/i)).toBeInTheDocument();
    expect(container.querySelector('input[type="file"]')).toBeInTheDocument();
  });

  it('should display existing images with remove buttons', () => {
    const existingImages = [
      'https://example.com/image1.jpg',
      'https://example.com/image2.jpg',
    ];

    const { container } = render(
      <ImageUpload images={existingImages} onImagesChange={mockOnImagesChange} />
    );

    // Check for image containers
    const imageContainers = container.querySelectorAll('.relative.w-24.h-24');
    expect(imageContainers).toHaveLength(2);

    // Check for position labels
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('should show error for invalid file type', async () => {
    const { container } = render(<ImageUpload images={[]} onImagesChange={mockOnImagesChange} />);

    const file = new File(['dummy content'], 'test.pdf', { type: 'application/pdf' });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false,
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText(/Solo se permiten imágenes/i)).toBeInTheDocument();
    });
  });

  it('should show error for oversized file', async () => {
    const { container } = render(<ImageUpload images={[]} onImagesChange={mockOnImagesChange} />);

    // Create a file larger than 5MB
    const largeFile = new File(['x'.repeat(6 * 1024 * 1024)], 'large.jpg', {
      type: 'image/jpeg',
    });

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    Object.defineProperty(input, 'files', {
      value: [largeFile],
      writable: false,
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText(/menores a 5MB/i)).toBeInTheDocument();
    });
  });

  it('should enforce max images limit', () => {
    const maxImages = 3;
    const existingImages = ['img1.jpg', 'img2.jpg', 'img3.jpg'];

    render(
      <ImageUpload
        images={existingImages}
        onImagesChange={mockOnImagesChange}
        maxImages={maxImages}
      />
    );

    // Upload button should not be visible when max is reached
    expect(screen.queryByText(/Subir/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Máximo 3 imágenes/i)).toBeInTheDocument();
  });
});
