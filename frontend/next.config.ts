import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

function getAllowedConnectOrigins(): string[] {
  const allowedOrigins = new Set<string>(["'self'"]);

  const addOrigin = (value?: string) => {
    if (!value) return;

    try {
      const url = new URL(value);
      allowedOrigins.add(url.origin);
    } catch {
      // Ignore invalid URLs so a bad env var does not break the build.
    }
  };

  addOrigin(process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001');
  addOrigin(
    process.env.NEXT_PUBLIC_GRAPHQL_URL ||
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      'http://localhost:3001/graphql',
  );
  addOrigin(
    process.env.NEXT_PUBLIC_GRAPHQL_WS_URL || 'ws://localhost:3001/graphql',
  );

  return Array.from(allowedOrigins);
}

const nextConfig: NextConfig = {
  output: 'standalone',
  reactCompiler: true,
  // Note: turbopack.root: '..' causes module resolution issues with frontend deps
  // The lockfile warning is harmless - ignore it
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: '*.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
    ],
  },
  // Security headers (production only via source condition)
  async headers() {
    // Skip in development
    if (process.env.NODE_ENV !== 'production') {
      return [];
    }

    const connectOrigins = getAllowedConnectOrigins();

    const cspDirectives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://res.cloudinary.com https://*.cloudinary.com",
      "font-src 'self' data:",
      `connect-src ${connectOrigins.join(' ')} https://api.cloudinary.com https://api.mercadopago.com https://*.mercadopago.com wss://*.mercadopago.com https://*.sentry.io https://*.ingest.sentry.io`,
      "frame-ancestors 'none'",
      "form-action 'self'",
      "base-uri 'self'",
    ].join('; ');

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: cspDirectives },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(self)' },
        ],
      },
    ];
  },
};

// Wrap with Sentry only if DSN is configured
const sentryWebpackPluginOptions = {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // Upload source maps during production builds
  widenClientFileUpload: true,

  // Hide source maps from browser devtools
  hideSourceMaps: true,

  // Disable for dev to avoid build slowdown
  disableLogger: true,

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  automaticVercelMonitors: true,

  // v1 keeps runtime capture only; source map upload stays for a later phase.
  sourcemaps: {
    disable: true,
  },
};

// Only wrap with Sentry if the DSN is configured
export default process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, sentryWebpackPluginOptions)
  : nextConfig;
