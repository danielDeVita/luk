import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Rifas - Plataforma de Sorteos',
    short_name: 'Rifas',
    description: 'Participa en rifas y gana increíbles premios',
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
