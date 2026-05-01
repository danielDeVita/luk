import type { Metadata } from "next";
import type { Viewport } from "next";
import { Bricolage_Grotesque, Manrope } from "next/font/google";
import "./globals.css";
import { ApolloWrapper } from "@/lib/apollo-provider";
import { Navbar } from "@/components/navbar";
import { Toaster } from "sonner";
import { GoogleAnalytics } from "@/components/analytics/google-analytics";
import { ConfirmDialogProvider } from "@/hooks/use-confirm-dialog";
import { TabTitleController } from "@/components/tab-title-controller";
import {
  BRAND_DESCRIPTION,
  BRAND_NAME,
  BRAND_SHORT_DESCRIPTION,
  BRAND_TAGLINE,
} from "@/lib/brand";
import {
  buildOrganizationJsonLd,
  buildWebsiteJsonLd,
  getSiteOrigin,
} from "@/lib/seo";

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
    canonical: "/",
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: `${BRAND_NAME} | ${BRAND_TAGLINE}`,
    description: BRAND_SHORT_DESCRIPTION,
    type: "website",
    locale: "es_AR",
    url: "/",
    siteName: BRAND_NAME,
  },
  twitter: {
    card: "summary",
    title: `${BRAND_NAME} | ${BRAND_TAGLINE}`,
    description: BRAND_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#1b7666",
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
            key={entry["@id"]}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(entry) }}
          />
        ))}
      </head>
      <body
        className={`${manrope.variable} ${bricolageGrotesque.variable} font-sans antialiased`}
      >
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
                  <div className="rounded-[2rem] border border-border/80 bg-card/90 px-6 py-7 shadow-panel backdrop-blur-xl sm:px-8">
                    <div className="mx-auto max-w-5xl text-center">
                      <p className="text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
                        +18. La participación en rifas puede estar sujeta a
                        restricciones legales según tu jurisdicción. Aplican
                        términos y condiciones.{" "}
                        <span className="font-semibold text-foreground">
                          © {new Date().getFullYear()} {BRAND_NAME}.
                        </span>
                      </p>
                    </div>
                    <div className="mt-6 border-t border-border/70 pt-5">
                      <nav className="mx-auto flex max-w-3xl flex-col items-center justify-center gap-4 text-sm sm:flex-row sm:flex-wrap">
                        <a
                          href="/legal/terminos"
                          className="inline-flex min-h-11 items-center justify-center rounded-full border border-border/80 bg-background/70 px-5 py-2.5 text-center text-muted-foreground transition-colors hover:text-foreground"
                        >
                          Términos y condiciones
                        </a>
                        <a
                          href="/legal/privacidad"
                          className="inline-flex min-h-11 items-center justify-center rounded-full border border-border/80 bg-background/70 px-5 py-2.5 text-center text-muted-foreground transition-colors hover:text-foreground"
                        >
                          Política de privacidad
                        </a>
                      </nav>
                    </div>
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
                className: "rounded-[1.75rem] border shadow-panel font-sans",
                style: {
                  background: "var(--card)",
                  color: "var(--foreground)",
                  borderColor: "var(--border)",
                },
              }}
            />
          </ConfirmDialogProvider>
        </ApolloWrapper>
      </body>
    </html>
  );
}
