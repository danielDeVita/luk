'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { getTurnstileSiteKey } from '@/lib/public-env';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          theme?: 'auto' | 'light' | 'dark';
          callback: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
        },
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

interface TurnstileFieldProps {
  enabled: boolean;
  onTokenChange: (token: string | null) => void;
  resetSignal: number;
}

const TURNSTILE_SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

export function TurnstileField({
  enabled,
  onTokenChange,
  resetSignal,
}: TurnstileFieldProps) {
  const widgetContainerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [widgetError, setWidgetError] = useState<string | null>(null);
  const siteKey = enabled ? getTurnstileSiteKey() : null;

  const resetToken = useCallback(() => {
    onTokenChange(null);
  }, [onTokenChange]);

  const renderWidget = useCallback(() => {
    if (!enabled || !siteKey || !widgetContainerRef.current || !window.turnstile) {
      return;
    }

    if (widgetIdRef.current) {
      return;
    }

    try {
      setWidgetError(null);
      widgetIdRef.current = window.turnstile.render(widgetContainerRef.current, {
        sitekey: siteKey,
        theme: 'auto',
        callback: (token: string) => {
          setWidgetError(null);
          onTokenChange(token);
        },
        'expired-callback': () => {
          resetToken();
        },
        'error-callback': () => {
          setWidgetError(
            'No pudimos cargar la verificación humana. Intentá nuevamente.',
          );
          resetToken();
        },
      });
    } catch {
      setWidgetError(
        'No pudimos cargar la verificación humana. Intentá nuevamente.',
      );
      resetToken();
    }
  }, [enabled, onTokenChange, resetToken, siteKey]);

  useEffect(() => {
    if (!enabled) {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
      onTokenChange(null);
    }
  }, [enabled, onTokenChange]);

  useEffect(() => {
    if (!enabled || !window.turnstile) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      renderWidget();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [enabled, renderWidget]);

  useEffect(() => {
    if (!enabled || !widgetIdRef.current || !window.turnstile) {
      return;
    }

    window.turnstile.reset(widgetIdRef.current);
    resetToken();
  }, [enabled, resetSignal, resetToken]);

  useEffect(() => {
    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
    };
  }, []);

  if (!enabled) {
    return null;
  }

  if (!siteKey) {
    return (
      <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
        Falta configurar Turnstile para este entorno.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Script
        src={TURNSTILE_SCRIPT_SRC}
        strategy="afterInteractive"
        onReady={() => {
          window.setTimeout(() => {
            renderWidget();
          }, 0);
        }}
        onError={() => {
          setWidgetError(
            'No pudimos cargar la verificación humana. Intentá nuevamente.',
          );
          resetToken();
        }}
      />
      <div
        ref={widgetContainerRef}
        className="min-h-[66px] rounded-md border border-input bg-background px-2 py-3"
      />
      {widgetError && <p className="text-sm text-destructive">{widgetError}</p>}
    </div>
  );
}
