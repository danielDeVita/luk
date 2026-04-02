import type { Metadata } from "next";
import type { Viewport } from "next";
import { Bricolage_Grotesque, Manrope } from "next/font/google";
import "./globals.css";
import { ApolloWrapper } from "@/lib/apollo-provider";
import { Navbar } from "@/components/navbar";
import { Toaster } from 'sonner';
import { GoogleAnalytics } from "@/components/analytics/google-analytics";
import { ConfirmDialogProvider } from "@/hooks/use-confirm-dialog";
import { TabTitleController } from '@/components/tab-title-controller';
import {
  BRAND_DESCRIPTION,
  BRAND_NAME,
  BRAND_SHORT_DESCRIPTION,
  BRAND_TAGLINE,
} from '@/lib/brand';
import {
  buildOrganizationJsonLd,
  buildWebsiteJsonLd,
  getSiteOrigin,
} from '@/lib/seo';

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const bricolageGrotesque = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const siteOrigin = getSiteOrigin();
const siteStructuredData = [buildOrganizationJsonLd(), buildWebsiteJsonLd()];

export const metadata: Metadata = {
  metadataBase: siteOrigin,
  title: {
    default: `${BRAND_NAME} | ${BRAND_TAGLINE}`,
    template: `%s | ${BRAND_NAME}`,
  },
  description: BRAND_SHORT_DESCRIPTION,
  alternates: {
    canonical: '/',
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: `${BRAND_NAME} | ${BRAND_TAGLINE}`,
    description: BRAND_SHORT_DESCRIPTION,
    type: "website",
    locale: 'es_AR',
    url: '/',
    siteName: BRAND_NAME,
  },
  twitter: {
    card: 'summary',
    title: `${BRAND_NAME} | ${BRAND_TAGLINE}`,
    description: BRAND_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#d14f2a",
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
        {siteStructuredData.map((entry) => (
          <script
            key={entry['@id']}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(entry) }}
          />
        ))}
      </head>
      <body className={`${manrope.variable} ${bricolageGrotesque.variable} font-sans antialiased`}>
        <TabTitleController />
        <GoogleAnalytics />
        <ApolloWrapper>
          <ConfirmDialogProvider>
            <div className="min-h-screen flex flex-col">
              <Navbar />
              <main className="relative flex-1 overflow-x-clip pb-10">
                {children}
              </main>
              <footer className="px-4 pb-4 pt-10">
                <div className="container mx-auto">
                  <div className="rounded-[2rem] border border-border/80 bg-card/90 px-6 py-8 shadow-panel backdrop-blur-xl">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                      <div className="max-w-xl space-y-3">
                        <p className="editorial-kicker text-primary">LUK / Plataforma</p>
                        <p className="font-display text-2xl leading-none text-foreground sm:text-3xl">
                          © {new Date().getFullYear()} {BRAND_NAME}
                        </p>
                        <p className="max-w-lg text-sm text-muted-foreground">
                          La participación en rifas está reservada a mayores de 18 años. El juego compulsivo es perjudicial para la salud.
                        </p>
                      </div>
                      <div className="space-y-4">
                        <p className="text-sm font-medium text-muted-foreground">
                          Todos los derechos reservados.
                        </p>
                        <nav className="flex flex-wrap gap-3 text-sm">
                          <a
                            href="/legal/terminos"
                            className="inline-flex items-center rounded-full border border-border/80 bg-background/70 px-4 py-2 text-muted-foreground transition-colors hover:text-foreground"
                          >
                            Términos y condiciones
                          </a>
                          <a
                            href="/legal/privacidad"
                            className="inline-flex items-center rounded-full border border-border/80 bg-background/70 px-4 py-2 text-muted-foreground transition-colors hover:text-foreground"
                          >
                            Política de privacidad
                          </a>
                        </nav>
                      </div>
                    </div>
                    <div className="mt-6 h-px bg-border/70" />
                    <p className="mt-5 text-xs uppercase tracking-[0.24em] text-muted-foreground/80">
                      Sorteos digitales seguros, pagos protegidos y reglas transparentes.
                    </p>
                  </div>
                </div>
              </footer>
            </div>
            <Toaster 
              position="bottom-right"
              richColors
              closeButton
              theme="system"
              toastOptions={{
                className: 'rounded-[1.75rem] border shadow-panel font-sans',
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
