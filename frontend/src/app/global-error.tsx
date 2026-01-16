'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import * as Sentry from '@sentry/nextjs';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Report critical error to Sentry
    Sentry.captureException(error);
  }, [error]);

  console.error(error);

  return (
    <html lang="es">
      <body>
        <div className="container mx-auto px-4 py-16 max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle>Ocurrió un error inesperado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Algo falló a nivel global. Podés reintentar o volver al inicio.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={reset}>Reintentar</Button>
                <Link href="/">
                  <Button variant="outline">Ir al inicio</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </body>
    </html>
  );
}
