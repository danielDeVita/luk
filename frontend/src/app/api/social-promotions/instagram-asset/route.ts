import { ImageResponse } from 'next/og';
import { createElement } from 'react';
import { getOptimizedImageUrl } from '@/lib/cloudinary';

export const runtime = 'nodejs';

const WIDTH = 1080;
const HEIGHT = 1350;
const NETWORK_CTA_LABELS: Record<string, string> = {
  FACEBOOK: 'Compartila en Facebook',
  INSTAGRAM: 'Publicala en Instagram',
  X: 'Compartila en X',
  THREADS: 'Compartila en Threads',
};

function formatPrice(price: number) {
  return `$${new Intl.NumberFormat('es-AR', {
    maximumFractionDigits: 0,
  }).format(price)}`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get('title')?.trim();
  const imageUrl = searchParams.get('imageUrl')?.trim();
  const priceValue = searchParams.get('price');
  const network = searchParams.get('network')?.trim().toUpperCase() || 'INSTAGRAM';
  const brand = searchParams.get('brand')?.trim() || 'LUK';
  const price = priceValue ? Number(priceValue) : Number.NaN;
  const networkCtaLabel = NETWORK_CTA_LABELS[network] || 'Compartila con Luk';

  if (!title || !imageUrl || !Number.isFinite(price) || price <= 0) {
    return new Response('Missing required parameters', { status: 400 });
  }

  const optimizedImageUrl = getOptimizedImageUrl(imageUrl, {
    width: WIDTH,
    height: HEIGHT,
    crop: 'fill',
    gravity: 'auto',
    quality: 'auto',
    format: 'auto',
  });

  return new ImageResponse(
    createElement(
      'div',
      {
        style: {
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          background: '#f4efe6',
          color: '#0f172a',
          fontFamily: 'system-ui, sans-serif',
        },
      },
      createElement('img', {
        src: optimizedImageUrl,
        alt: title,
        style: {
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        },
      }),
      createElement('div', {
        style: {
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(15,23,42,0.1) 0%, rgba(15,23,42,0.7) 72%, rgba(15,23,42,0.92) 100%)',
        },
      }),
      createElement(
        'div',
        {
          style: {
            position: 'relative',
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '56px',
          },
        },
        createElement(
          'div',
          {
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            },
          },
          createElement(
            'div',
            {
              style: {
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '14px 18px',
                borderRadius: '999px',
                background: 'rgba(255,255,255,0.92)',
                color: '#065f46',
                fontSize: '28px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              },
            },
            brand,
          ),
          createElement(
            'div',
            {
              style: {
                display: 'flex',
                padding: '16px 22px',
                borderRadius: '999px',
                background: 'rgba(255,255,255,0.92)',
                color: '#111827',
                fontSize: '32px',
                fontWeight: 700,
              },
            },
            `${formatPrice(price)} / ticket`,
          ),
        ),
        createElement(
          'div',
          {
            style: {
              display: 'flex',
              flexDirection: 'column',
              gap: '22px',
            },
          },
          createElement(
            'div',
            {
              style: {
                display: 'flex',
                maxWidth: '82%',
                fontSize: '72px',
                lineHeight: 1.05,
                fontWeight: 800,
                color: '#ffffff',
                textShadow: '0 10px 40px rgba(0,0,0,0.32)',
              },
            },
            title,
          ),
          createElement(
            'div',
            {
              style: {
                display: 'flex',
                alignItems: 'center',
                gap: '18px',
              },
            },
            createElement(
              'div',
              {
                style: {
                  display: 'flex',
                  padding: '18px 24px',
                  borderRadius: '999px',
                  background: '#0f766e',
                  color: '#ffffff',
                  fontSize: '34px',
                  fontWeight: 700,
                },
              },
              networkCtaLabel,
            ),
            createElement(
              'div',
              {
                style: {
                  display: 'flex',
                  padding: '18px 24px',
                  borderRadius: '999px',
                  background: 'rgba(255,255,255,0.18)',
                  border: '2px solid rgba(255,255,255,0.28)',
                  color: '#ffffff',
                  fontSize: '28px',
                  fontWeight: 500,
                },
              },
              'Compartí el caption de Luk',
            ),
          ),
        ),
      ),
    ),
    {
      width: WIDTH,
      height: HEIGHT,
    },
  );
}
