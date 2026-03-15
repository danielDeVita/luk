'use client';

import { gql } from '@apollo/client/core';
import { useQuery } from '@apollo/client/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, RotateCcw } from 'lucide-react';

const PROMOTION_GRANT_REVERSAL_LOGS = gql`
  query PromotionGrantReversalLogs($limit: Int, $offset: Int) {
    promotionGrantReversalLogs(limit: $limit, offset: $offset) {
      total
      transactions {
        id
        tipo
        monto
        grossAmount
        promotionDiscountAmount
        cashChargedAmount
        estado
        mpPaymentId
        createdAt
        metadata
        user {
          id
          email
          nombre
          apellido
        }
        raffle {
          id
          titulo
        }
      }
    }
  }
`;

interface ReversalMetadata {
  promotionBonusGrantId?: string;
  promotionBonusRedemptionId?: string;
  refundAmount?: number;
  refundType?: string;
  reason?: string;
}

interface ReversalTransaction {
  id: string;
  monto: number;
  grossAmount?: number | null;
  promotionDiscountAmount?: number | null;
  cashChargedAmount?: number | null;
  estado?: string | null;
  mpPaymentId?: string | null;
  createdAt: string;
  metadata?: ReversalMetadata | null;
  user?: {
    id: string;
    email: string;
    nombre: string;
    apellido?: string | null;
  } | null;
  raffle?: {
    id: string;
    titulo: string;
  } | null;
}

interface PromotionGrantReversalLogsData {
  promotionGrantReversalLogs: {
    total: number;
    transactions: ReversalTransaction[];
  };
}

function formatCurrency(amount?: number | null): string {
  if (amount == null) return '-';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatBuyer(transaction: ReversalTransaction): string {
  if (!transaction.user) return 'Usuario desconocido';
  const fullName = [transaction.user.nombre, transaction.user.apellido]
    .filter(Boolean)
    .join(' ')
    .trim();
  return fullName ? `${fullName} · ${transaction.user.email}` : transaction.user.email;
}

export function PromotionGrantReversalLog() {
  const { data, loading, refetch, networkStatus } = useQuery<PromotionGrantReversalLogsData>(
    PROMOTION_GRANT_REVERSAL_LOGS,
    {
      variables: { limit: 25, offset: 0 },
      notifyOnNetworkStatusChange: true,
    },
  );

  const transactions = data?.promotionGrantReversalLogs.transactions ?? [];
  const total = data?.promotionGrantReversalLogs.total ?? 0;
  const refreshing = networkStatus === 4;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Reversiones de grants
          </CardTitle>
          <CardDescription>
            Log explícito de bonificaciones promocionales devueltas luego de refunds completos.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={refreshing}>
          {refreshing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Actualizar
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando reversiones...
          </div>
        ) : transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay reversiones de grants registradas todavía.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Mostrando {transactions.length} de {total} reversiones registradas.
            </p>
            {transactions.map((transaction) => {
              const metadata = transaction.metadata ?? {};
              return (
                <div key={transaction.id} className="space-y-3 rounded-lg border p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">
                          {transaction.raffle?.titulo ?? 'Rifa desconocida'}
                        </p>
                        <Badge variant="outline">{transaction.estado ?? 'SIN ESTADO'}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{formatBuyer(transaction)}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(transaction.createdAt).toLocaleString('es-AR')}
                      </p>
                    </div>
                    <div className="grid gap-2 text-sm sm:grid-cols-2 lg:min-w-[320px]">
                      <div>
                        <p className="text-xs text-muted-foreground">Grant devuelto</p>
                        <p className="font-medium">
                          {formatCurrency(
                            transaction.promotionDiscountAmount ?? transaction.monto,
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Refund procesado</p>
                        <p className="font-medium">
                          {formatCurrency(
                            typeof metadata.refundAmount === 'number'
                              ? metadata.refundAmount
                              : transaction.cashChargedAmount,
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <span className="font-medium text-foreground">MP Payment:</span>{' '}
                      {transaction.mpPaymentId ?? '-'}
                    </div>
                    <div>
                      <span className="font-medium text-foreground">Tipo de refund:</span>{' '}
                      {metadata.refundType ?? '-'}
                    </div>
                    <div>
                      <span className="font-medium text-foreground">Grant ID:</span>{' '}
                      {metadata.promotionBonusGrantId ?? '-'}
                    </div>
                    <div>
                      <span className="font-medium text-foreground">Redemption ID:</span>{' '}
                      {metadata.promotionBonusRedemptionId ?? '-'}
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </CardContent>
    </Card>
  );
}
