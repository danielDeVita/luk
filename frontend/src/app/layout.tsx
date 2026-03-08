import type { Metadata } from "next";
import type { Viewport } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import "./globals.css";
import { ApolloWrapper } from "@/lib/apollo-provider";
import { Navbar } from "@/components/navbar";
import { Toaster } from 'sonner';
import { GoogleAnalytics } from "@/components/analytics/google-analytics";
import { ConfirmDialogProvider } from "@/hooks/use-confirm-dialog";
import {
  BRAND_NAME,
  BRAND_SHORT_DESCRIPTION,
} from '@/lib/brand';

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: `${BRAND_NAME} | Plataforma de Rifas Digitales`,
  description: BRAND_SHORT_DESCRIPTION,
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: `${BRAND_NAME} | Plataforma de Rifas Digitales`,
    description: BRAND_SHORT_DESCRIPTION,
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('theme-storage');
                  var theme = stored ? JSON.parse(stored).state?.theme : 'system';
                  var resolved = theme === 'system' || !theme
                    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
                    : theme;
                  if (resolved === 'dark') document.documentElement.classList.add('dark');
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className={`${dmSans.variable} ${fraunces.variable} font-sans antialiased`}>
        <GoogleAnalytics />
        <ApolloWrapper>
          <ConfirmDialogProvider>
            <div className="min-h-screen flex flex-col">
              <Navbar />
              <main className="flex-1">
                {children}
              </main>
              <footer className="border-t py-8">
                <div className="container mx-auto px-4">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-sm text-muted-foreground">
                      © {new Date().getFullYear()} <span className="font-display text-primary">{BRAND_NAME}</span>. Todos los derechos reservados.
                    </p>
                    <nav className="flex gap-4 text-sm">
                      <a href="/legal/terminos" className="text-muted-foreground hover:text-primary transition-colors">
                        Términos y condiciones
                      </a>
                      <a href="/legal/privacidad" className="text-muted-foreground hover:text-primary transition-colors">
                        Política de privacidad
                      </a>
                    </nav>
                  </div>
                  <p className="text-xs text-muted-foreground/70 text-center mt-4">
                    La participación en rifas está reservada a mayores de 18 años. El juego compulsivo es perjudicial para la salud.
                  </p>
                </div>
              </footer>
            </div>
            <Toaster 
              position="bottom-right"
              richColors
              closeButton
              theme="system"
              toastOptions={{
                className: 'rounded-xl border shadow-lg font-sans',
                style: {
                  background: 'var(--card)',
                  color: 'var(--foreground)',
                  borderColor: 'var(--border)',
                }
              }}
            />
          </ConfirmDialogProvider>

        </ApolloWrapper>

      </body>
    </html>
  );
}
