'use client';

import { useQuery } from '@apollo/client/react';
import { useAuthStore } from '@/store/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Loader2, Clock, CheckCircle, AlertCircle, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { GET_MY_PAYOUTS } from '@/lib/graphql/queries';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Payout {
  id: string;
  raffleId: string;
  grossAmount: number;
  platformFee: number;
  processingFee: number;
  netAmount: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  scheduledFor?: string;
  processedAt?: string;
  createdAt: string;
  raffleTitulo: string;
}

interface MyPayoutsResult {
  myPayouts: Payout[];
}

const statusConfig = {
  PENDING: {
    label: 'Pendiente',
    icon: Clock,
    variant: 'secondary' as const,
    color: 'text-yellow-600',
  },
  PROCESSING: {
    label: 'Procesando',
    icon: TrendingUp,
    variant: 'outline' as const,
    color: 'text-blue-600',
  },
  COMPLETED: {
    label: 'Completado',
    icon: CheckCircle,
    variant: 'default' as const,
    color: 'text-green-600',
  },
  FAILED: {
    label: 'Fallido',
    icon: AlertCircle,
    variant: 'destructive' as const,
    color: 'text-red-600',
  },
};

export default function PayoutsPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  const { data, loading } = useQuery<MyPayoutsResult>(GET_MY_PAYOUTS, {
    skip: !isAuthenticated,
  });

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login');
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  const payouts = data?.myPayouts || [];

  // Calculate totals
  const totals = payouts.reduce(
    (acc, payout) => {
      if (payout.status === 'COMPLETED') {
        acc.completed += payout.netAmount;
      } else if (payout.status === 'PENDING' || payout.status === 'PROCESSING') {
        acc.pending += payout.netAmount;
      }
      return acc;
    },
    { completed: 0, pending: 0 }
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <DollarSign className="h-8 w-8 text-green-600" />
        <h1 className="text-3xl font-bold">Mis Pagos</h1>
      </div>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Recibido</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${totals.completed.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Pagos completados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendiente</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              ${totals.pending.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Por procesar</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Rifas</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{payouts.length}</div>
            <p className="text-xs text-muted-foreground">Rifas con pagos</p>
          </CardContent>
        </Card>
      </div>

      {/* Payouts List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : payouts.length === 0 ? (
        <Card>
          <CardContent className="text-center py-20">
            <DollarSign className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">No tenés pagos</h2>
            <p className="text-muted-foreground mb-4">
              Los pagos aparecerán aquí cuando tus rifas finalicen exitosamente
            </p>
            <Link href="/dashboard/create">
              <span className="text-primary hover:underline">Crear una rifa</span>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Historial de Pagos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {payouts.map((payout) => {
                const config = statusConfig[payout.status];
                const StatusIcon = config.icon;

                return (
                  <div
                    key={payout.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-full bg-muted ${config.color}`}>
                        <StatusIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <Link
                          href={`/raffle/${payout.raffleId}`}
                          className="font-medium hover:text-primary"
                        >
                          {payout.raffleTitulo}
                        </Link>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(payout.createdAt), "d 'de' MMMM, yyyy", {
                            locale: es,
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right hidden md:block">
                        <div className="text-sm text-muted-foreground">Bruto</div>
                        <div className="font-medium">${payout.grossAmount.toFixed(2)}</div>
                      </div>
                      <div className="text-right hidden md:block">
                        <div className="text-sm text-muted-foreground">Comisiones</div>
                        <div className="font-medium text-destructive">
                          -${(payout.platformFee + payout.processingFee).toFixed(2)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">Neto</div>
                        <div className="font-bold text-lg text-green-600">
                          ${payout.netAmount.toFixed(2)}
                        </div>
                      </div>
                      <Badge variant={config.variant}>{config.label}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fee explanation */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">Sobre las comisiones</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            <strong>Comisión de plataforma:</strong> 10% del monto bruto recaudado
          </p>
          <p>
            <strong>Comisión de procesamiento:</strong> ~3% (varía según Mercado Pago)
          </p>
          <p>
            <strong>Pago neto:</strong> Lo que recibís después de comisiones
          </p>
          <p className="pt-2">
            Los pagos se liberan automáticamente 7 días después de que el ganador confirme la
            recepción del producto, o 7 días después del envío si no hay confirmación.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
