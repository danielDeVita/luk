'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const LAST_MOCK_CHECKOUT_KEY = 'luk:last-mock-checkout';

interface MockPaymentSummary {
  id: string;
  publicToken: string;
  raffleId: string;
  raffleTitle: string;
  buyerId: string;
  buyerEmail: string;
  quantity: number;
  baseQuantity?: number;
  bonusQuantity?: number;
  grantedQuantity?: number;
  packApplied?: boolean;
  grossSubtotal: number;
  discountApplied: number;
  promotionDiscountApplied?: number;
  packDiscountApplied?: number;
  cashChargedAmount: number;
  status: string;
  statusDetail: string;
  merchantOrderId: string;
  promotionBonusGrantId?: string | null;
  promotionBonusRedemptionId?: string | null;
  createdAt: string;
  approvedAt?: string | null;
  refundedAt?: string | null;
}

interface MockPaymentActionResult {
  paymentId: string;
  status: string;
  merchantOrderId: string;
  redirectUrl: string;
  mockToken: string;
}

export default function MockCheckoutPage() {
  const params = useParams<{ mockPaymentId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
  const mockPaymentId = String(params.mockPaymentId || '');
  const publicToken = searchParams.get('token') || '';

  const [payment, setPayment] = useState<MockPaymentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [partialRefundAmount, setPartialRefundAmount] = useState('');

  const loadPayment = useCallback(async () => {
    if (!mockPaymentId || !publicToken) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `${backendUrl}/payments/mock/${mockPaymentId}?token=${encodeURIComponent(publicToken)}`,
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'No se pudo cargar el pago mock');
      }

      setPayment(data);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'No se pudo cargar el pago mock',
      );
    } finally {
      setLoading(false);
    }
  }, [backendUrl, mockPaymentId, publicToken]);

  useEffect(() => {
    loadPayment();
  }, [loadPayment]);

  useEffect(() => {
    if (typeof window === 'undefined' || !mockPaymentId || !publicToken) {
      return;
    }

    window.localStorage.setItem(
      LAST_MOCK_CHECKOUT_KEY,
      JSON.stringify({
        paymentId: mockPaymentId,
        token: publicToken,
      }),
    );
  }, [mockPaymentId, publicToken]);

  const executeAction = useCallback(
    async (action: string, amount?: number) => {
      if (!publicToken) {
        toast.error('Token mock inválido');
        return;
      }

      setActing(action);
      try {
        const response = await fetch(
          `${backendUrl}/payments/mock/${mockPaymentId}/action`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              publicToken,
              action,
              amount,
            }),
          },
        );
        const data = (await response.json()) as MockPaymentActionResult & {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error || 'No se pudo procesar la acción mock');
        }

        router.push(data.redirectUrl);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'No se pudo procesar la acción mock',
        );
      } finally {
        setActing(null);
      }
    },
    [backendUrl, mockPaymentId, publicToken, router],
  );

  const statusTone = useMemo(() => {
    switch (payment?.status) {
      case 'approved':
        return {
          icon: CheckCircle2,
          color: 'text-green-600',
          label: 'Aprobado',
        };
      case 'pending':
        return {
          icon: Clock,
          color: 'text-yellow-600',
          label: 'Pendiente',
        };
      case 'rejected':
      case 'expired':
        return {
          icon: XCircle,
          color: 'text-red-600',
          label: payment.status === 'expired' ? 'Expirado' : 'Rechazado',
        };
      case 'refunded':
      case 'partially_refunded':
        return {
          icon: ShieldCheck,
          color: 'text-blue-600',
          label:
            payment.status === 'refunded'
              ? 'Reintegrado total'
              : 'Reintegrado parcial',
        };
      default:
        return {
          icon: AlertTriangle,
          color: 'text-muted-foreground',
          label: 'Iniciado',
        };
    }
  }, [payment?.status]);

  if (loading) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-12">
        <Card className="p-8 text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">
            Cargando checkout mock...
          </p>
        </Card>
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-12">
        <Card className="p-8 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
          <p className="mt-4 font-medium">No se pudo cargar el pago mock</p>
          <div className="mt-6">
            <Link href="/">
              <Button variant="outline">Volver al inicio</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const StatusIcon = statusTone.icon;
  const canRefund = payment.status === 'approved';

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm uppercase tracking-[0.24em] text-muted-foreground">
            Checkout QA
          </p>
          <h1 className="text-3xl font-semibold">Pago mock</h1>
        </div>
        <div className="max-w-full break-all rounded-2xl border bg-muted/50 px-4 py-2 text-sm text-muted-foreground sm:max-w-[18rem] sm:rounded-full sm:text-right">
          {payment.id}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.25fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Detalle del pago</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-2xl border bg-muted/30 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Rifa</p>
                  <p className="text-lg font-medium break-words">{payment.raffleTitle}</p>
                  <p className="mt-1 break-all text-sm text-muted-foreground">
                    Comprador: {payment.buyerEmail}
                  </p>
                </div>
                <div className={`flex shrink-0 items-center gap-2 ${statusTone.color}`}>
                  <StatusIcon className="h-5 w-5" />
                  <span className="font-medium">{statusTone.label}</span>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border p-4">
                <p className="text-sm text-muted-foreground">Cantidad</p>
                <p className="mt-2 text-2xl font-semibold">{payment.quantity}</p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-sm text-muted-foreground">Merchant order</p>
                <p className="mt-2 break-all font-mono text-sm leading-snug">
                  {payment.merchantOrderId}
                </p>
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border p-5">
              {payment.packApplied ? (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Tickets pagados</span>
                    <span>{payment.baseQuantity ?? payment.quantity}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Tickets bonus</span>
                    <span>+{payment.bonusQuantity ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Tickets totales</span>
                    <span>{payment.grantedQuantity ?? payment.quantity}</span>
                  </div>
                </>
              ) : null}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal bruto</span>
                <span>${payment.grossSubtotal.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subsidio LUK</span>
                <span>
                  {payment.discountApplied > 0
                    ? `- $${payment.discountApplied.toFixed(2)}`
                    : '$0.00'}
                </span>
              </div>
              <div className="flex items-center justify-between border-t pt-3 text-base font-medium">
                <span>Total a cobrar</span>
                <span>${payment.cashChargedAmount.toFixed(2)}</span>
              </div>
            </div>

            {payment.promotionBonusGrantId && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-sm font-medium text-primary">
                  Bonificación promocional aplicada
                </p>
                <p className="mt-1 break-all text-sm text-muted-foreground">
                  Grant: <span className="font-mono">{payment.promotionBonusGrantId}</span>
                </p>
                {payment.promotionBonusRedemptionId && (
                  <p className="mt-1 break-all text-sm text-muted-foreground">
                    Redemption:{' '}
                    <span className="font-mono">{payment.promotionBonusRedemptionId}</span>
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Acciones mock</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              className="w-full"
              onClick={() => executeAction('APPROVE')}
              disabled={acting !== null || payment.status === 'approved'}
            >
              {acting === 'APPROVE' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Aprobando...
                </>
              ) : (
                'Aprobar'
              )}
            </Button>

            <Button
              variant="secondary"
              className="w-full"
              onClick={() => executeAction('PEND')}
              disabled={acting !== null || payment.status === 'pending'}
            >
              {acting === 'PEND' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Marcando pendiente...
                </>
              ) : (
                'Pendiente'
              )}
            </Button>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => executeAction('REJECT')}
              disabled={
                acting !== null ||
                payment.status === 'rejected' ||
                payment.status === 'expired'
              }
            >
              {acting === 'REJECT' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Rechazando...
                </>
              ) : (
                'Rechazar'
              )}
            </Button>

            <Button
              variant="ghost"
              className="w-full"
              onClick={() => executeAction('EXPIRE')}
              disabled={
                acting !== null ||
                payment.status === 'expired' ||
                payment.status === 'rejected'
              }
            >
              {acting === 'EXPIRE' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Expirando...
                </>
              ) : (
                'Expirar'
              )}
            </Button>

            {canRefund && (
              <div className="space-y-3 rounded-2xl border p-4">
                <p className="text-sm font-medium">Reintegros QA</p>
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => executeAction('REFUND_FULL')}
                  disabled={acting !== null}
                >
                  {acting === 'REFUND_FULL' ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Reintegrando...
                    </>
                  ) : (
                    'Reintegro total'
                  )}
                </Button>

                <div className="space-y-2">
                  <Label htmlFor="partial-refund-amount">
                    Monto para reintegro parcial
                  </Label>
                  <Input
                    id="partial-refund-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={partialRefundAmount}
                    onChange={(event) => setPartialRefundAmount(event.target.value)}
                    placeholder="Ej: 5000"
                  />
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={acting !== null || Number(partialRefundAmount) <= 0}
                  onClick={() =>
                    executeAction('REFUND_PARTIAL', Number(partialRefundAmount))
                  }
                >
                  {acting === 'REFUND_PARTIAL' ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Reintegrando...
                    </>
                  ) : (
                    'Reintegro parcial'
                  )}
                </Button>
              </div>
            )}

            <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              Esta pantalla existe solo para QA/local. No replica la UI de Mercado
              Pago; replica el ciclo de estados y sus efectos sobre tickets,
              reservas y bonificaciones.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
