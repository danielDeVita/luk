import type { Metadata } from 'next';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: true,
  },
};

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="relative">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72"
        style={{
          background:
            'radial-gradient(circle at top left, oklch(from var(--primary) l c h / 0.15), transparent 38%), radial-gradient(circle at top right, oklch(from var(--secondary) l c h / 0.14), transparent 34%)',
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}
