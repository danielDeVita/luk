import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Explorar rifas',
  description: 'Buscá rifas activas y aplicá filtros para encontrar oportunidades disponibles en LUK.',
  robots: {
    index: false,
    follow: true,
  },
};

export default function SearchLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
