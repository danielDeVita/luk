'use client';

import Script from 'next/script';

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

/**
 * Google Analytics 4 component for Next.js App Router.
 * Loads gtag.js and configures tracking.
 * 
 * Set NEXT_PUBLIC_GA_MEASUREMENT_ID env variable to enable.
 * 
 * @example
 * // In layout.tsx
 * import { GoogleAnalytics } from '@/components/analytics/google-analytics';
 * 
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         <GoogleAnalytics />
 *         {children}
 *       </body>
 *     </html>
 *   );
 * }
 */
export function GoogleAnalytics() {
  // Don't render anything if GA ID is not configured
  if (!GA_MEASUREMENT_ID) {
    return null;
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}', {
            page_title: document.title,
            page_location: window.location.href,
          });
        `}
      </Script>
    </>
  );
}

/**
 * Track custom events in Google Analytics.
 * 
 * @param eventName - The event name (e.g., 'purchase', 'sign_up')
 * @param parameters - Optional event parameters
 * 
 * @example
 * // Track a raffle view
 * trackEvent('view_item', {
 *   item_id: raffleId,
 *   item_name: raffleTitle,
 *   price: ticketPrice,
 *   currency: 'ARS'
 * });
 * 
 * // Track a ticket purchase
 * trackEvent('purchase', {
 *   transaction_id: paymentId,
 *   value: totalAmount,
 *   currency: 'ARS',
 *   items: [{ item_id: raffleId, quantity: ticketCount }]
 * });
 */
export function trackEvent(
  eventName: string,
  parameters?: Record<string, string | number | boolean>
) {
  if (typeof window !== 'undefined' && window.gtag && GA_MEASUREMENT_ID) {
    window.gtag('event', eventName, parameters);
  }
}

/**
 * Track page views manually (useful for SPA navigation).
 * Note: GA4 automatically tracks page views for standard navigation.
 * 
 * @param url - The page URL
 * @param title - Optional page title
 */
export function trackPageView(url: string, title?: string) {
  if (typeof window !== 'undefined' && window.gtag && GA_MEASUREMENT_ID) {
    window.gtag('config', GA_MEASUREMENT_ID, {
      page_path: url,
      page_title: title || document.title,
    });
  }
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    gtag?: (
      command: 'config' | 'event' | 'js',
      targetId: string | Date,
      config?: Record<string, unknown>
    ) => void;
    dataLayer?: unknown[];
  }
}
