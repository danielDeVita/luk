import type { MetadataRoute } from 'next';
import {
  BRAND_NAME,
  BRAND_SHORT_DESCRIPTION,
} from '@/lib/brand';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND_NAME} | Plataforma de Rifas Digitales`,
    short_name: BRAND_NAME,
    description: BRAND_SHORT_DESCRIPTION,
    start_url: '/',
    display: 'standalone',
    background_color: '#0b0b0f',
    theme_color: '#4f46e5',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  };
}
