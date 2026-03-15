import { describe, expect, it, vi, beforeEach } from 'vitest';

const imageResponseMock = vi.fn(function ImageResponseMock(element, options) {
  return { element, options };
});

vi.mock('next/og', () => ({
  ImageResponse: imageResponseMock,
}));

describe('GET /api/social-promotions/instagram-asset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when title or imageUrl is missing', async () => {
    const { GET } = await import('../route');

    const response = await GET(new Request('http://localhost/api/social-promotions/instagram-asset?price=2500'));

    expect(response.status).toBe(400);
    expect(imageResponseMock).not.toHaveBeenCalled();
  });

  it('returns an image response with the expected dimensions', async () => {
    const { GET } = await import('../route');

    const response = await GET(
      new Request(
        'http://localhost/api/social-promotions/instagram-asset?title=MacBook%20Pro&price=2500&imageUrl=https%3A%2F%2Fres.cloudinary.com%2Fdemo%2Fimage%2Fupload%2Fv1%2Fmacbook-front.jpg',
      ),
    );

    expect(imageResponseMock).toHaveBeenCalledTimes(1);
    expect(response).toEqual({
      element: expect.anything(),
      options: expect.objectContaining({
        width: 1080,
        height: 1350,
      }),
    });
  });
});
