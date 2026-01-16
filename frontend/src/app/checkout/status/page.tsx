'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, XCircle, Clock, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

interface SyncResult {
  status: string;
  statusDetail?: string;
  externalReference?: string;
  syncResult?: {
    status: string;
    alreadyProcessed: boolean;
    ticketsUpdated: number;
  };
  error?: string;
}

function StatusContent() {
  const searchParams = useSearchParams();

  // Mercado Pago redirect params
  const urlStatus = searchParams.get('status') || searchParams.get('collection_status');
  const paymentId = searchParams.get('payment_id') || searchParams.get('collection_id');
  const merchantOrderId = searchParams.get('merchant_order_id');

  const [syncData, setSyncData] = useState<SyncResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

  const syncPayment = useCallback(async () => {
    if (!paymentId) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const response = await fetch(`${backendUrl}/mp/payment-status?payment_id=${paymentId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al sincronizar el pago');
      }

      setSyncData(data);

      // Show toast if tickets were just updated
      if (data.syncResult?.ticketsUpdated > 0 && !data.syncResult?.alreadyProcessed) {
        toast.success(`${data.syncResult.ticketsUpdated} ticket(s) confirmado(s)`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
      setRetrying(false);
    }
  }, [paymentId, backendUrl]);

  // Sync on mount
  useEffect(() => {
    syncPayment();
  }, [syncPayment]);

  const handleRetry = () => {
    setRetrying(true);
    setLoading(true);
    syncPayment();
  };

  // Determine status (use URL status first, fallback to backend data)
  const backendStatus = syncData?.status || syncData?.syncResult?.status;
  const finalStatus = urlStatus || backendStatus;
  const isApproved = finalStatus === 'approved';
  const isPending = finalStatus === 'pending' || finalStatus === 'in_process';
  const isRejected = finalStatus === 'rejected' || finalStatus === 'null' || finalStatus === null;

  if (loading && !finalStatus) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-lg">
        <Card className="text-center p-8">
          <Clock className="h-12 w-12 mx-auto text-muted-foreground animate-pulse" />
          <p className="mt-4 text-muted-foreground">Verificando estado del pago...</p>
        </Card>
      </div>
    );
  }

  if (error && !finalStatus) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-lg">
        <Card className="text-center p-8">
          <AlertTriangle className="h-12 w-12 mx-auto text-red-500 mb-4" />
          <p className="mt-4 text-red-600">Error al verificar el pago</p>
          <p className="text-sm text-muted-foreground mt-2">{error}</p>
          <div className="flex flex-col gap-2 mt-4">
            <Button onClick={handleRetry} disabled={retrying}>
              {retrying ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Reintentando...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Reintentar
                </>
              )}
            </Button>
            <Link href="/">
              <Button variant="outline" className="w-full">Volver al inicio</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 py-16 max-w-lg">
      <Card className="text-center">
        <CardHeader>
          {isApproved && (
            <>
              <CheckCircle className="h-20 w-20 mx-auto text-green-500 mb-4" />
              <CardTitle className="text-2xl text-green-600">¡Pago Exitoso!</CardTitle>
            </>
          )}
          {isPending && (
            <>
              <Clock className="h-20 w-20 mx-auto text-yellow-500 mb-4" />
              <CardTitle className="text-2xl text-yellow-600">Pago Pendiente</CardTitle>
            </>
          )}
          {isRejected && (
            <>
              <XCircle className="h-20 w-20 mx-auto text-red-500 mb-4" />
              <CardTitle className="text-2xl text-red-600">Pago Rechazado</CardTitle>
            </>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {isApproved && (
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Tu compra ha sido procesada correctamente. Ya tenés tus tickets registrados.
              </p>
              <div className="p-4 bg-muted/50 rounded-lg text-left space-y-2">
                {paymentId && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">ID de Pago:</span>{' '}
                    <span className="font-mono">{paymentId}</span>
                  </p>
                )}
                {merchantOrderId && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Orden:</span>{' '}
                    <span className="font-mono">{merchantOrderId}</span>
                  </p>
                )}
                {backendStatus && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Estado:</span>{' '}
                    <span className="font-mono">{backendStatus}</span>
                  </p>
                )}
                {syncData?.statusDetail && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Detalle:</span>{' '}
                    <span className="font-mono">{syncData.statusDetail}</span>
                  </p>
                )}
                {syncData?.syncResult && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Tickets:</span>{' '}
                    <span className="font-mono">
                      {syncData.syncResult.alreadyProcessed
                        ? 'Ya procesados'
                        : `${syncData.syncResult.ticketsUpdated} confirmado(s)`}
                    </span>
                  </p>
                )}
              </div>
            </div>
          )}

          {isPending && (
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Tu pago está siendo procesado. Esto puede tomar unos minutos.
              </p>
              <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    Tus tickets se confirmarán automáticamente cuando se apruebe el pago.
                    Revisá tu email para actualizaciones.
                  </p>
                </div>
              </div>
              <Button onClick={handleRetry} variant="outline" disabled={retrying}>
                {retrying ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Verificar estado
                  </>
                )}
              </Button>
            </div>
          )}

          {isRejected && (
            <div className="space-y-4">
              <p className="text-muted-foreground">
                No pudimos procesar tu pago. Por favor intenta nuevamente con otro método de pago.
              </p>
              <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/20">
                <p className="text-sm text-red-700 dark:text-red-300">
                  Si el problema persiste, contacta a soporte o intenta con otra tarjeta.
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Link href="/dashboard/tickets" className="flex-1">
              <Button className="w-full" variant={isApproved ? 'default' : 'outline'}>
                Ver Mis Tickets
              </Button>
            </Link>
            <Link href="/search" className="flex-1">
              <Button className="w-full" variant="outline">
                Explorar Rifas
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function CheckoutStatusPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-16 max-w-lg">
        <Card className="text-center p-8">
          <Clock className="h-12 w-12 mx-auto text-muted-foreground animate-pulse" />
          <p className="mt-4 text-muted-foreground">Cargando estado del pago...</p>
        </Card>
      </div>
    }>
      <StatusContent />
    </Suspense>
  );
}
