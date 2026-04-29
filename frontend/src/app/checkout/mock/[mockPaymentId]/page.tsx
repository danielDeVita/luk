"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const LAST_MOCK_CHECKOUT_KEY = "luk:last-mock-checkout";

interface MockTopUpSummary {
  id: string;
  publicToken: string;
  userId: string;
  userEmail: string;
  amount: number;
  creditedAmount: number;
  refundedAmount: number;
  status: string;
  statusDetail: string;
  providerOrderId: string;
  createdAt: string;
  approvedAt?: string | null;
  refundedAt?: string | null;
}

interface MockTopUpActionResult {
  topUpSessionId: string;
  status: string;
  providerOrderId: string;
  redirectUrl: string;
  mockToken: string;
}

export default function MockCheckoutPage() {
  const params = useParams<{ mockPaymentId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
  const mockPaymentId = String(params.mockPaymentId || "");
  const publicToken = searchParams.get("token") || "";

  const [payment, setPayment] = useState<MockTopUpSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [partialRefundAmount, setPartialRefundAmount] = useState("");

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
        throw new Error(data.error || "No se pudo cargar la carga mock");
      }

      setPayment(data);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo cargar la carga mock",
      );
    } finally {
      setLoading(false);
    }
  }, [backendUrl, mockPaymentId, publicToken]);

  useEffect(() => {
    loadPayment();
  }, [loadPayment]);

  useEffect(() => {
    if (typeof window === "undefined" || !mockPaymentId || !publicToken) {
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
        toast.error("Token mock inválido");
        return;
      }

      setActing(action);
      try {
        const response = await fetch(
          `${backendUrl}/payments/mock/${mockPaymentId}/action`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              publicToken,
              action,
              amount,
            }),
          },
        );
        const data = (await response.json()) as MockTopUpActionResult & {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error || "No se pudo procesar la acción mock");
        }

        router.push(data.redirectUrl);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "No se pudo procesar la acción mock",
        );
      } finally {
        setActing(null);
      }
    },
    [backendUrl, mockPaymentId, publicToken, router],
  );

  const statusTone = useMemo(() => {
    switch (payment?.status) {
      case "approved":
        return {
          icon: CheckCircle2,
          color: "text-green-600",
          label: "Aprobado",
        };
      case "pending":
        return {
          icon: Clock,
          color: "text-yellow-600",
          label: "Pendiente",
        };
      case "rejected":
        return {
          icon: XCircle,
          color: "text-red-600",
          label: "Rechazado",
        };
      case "expired":
        return {
          icon: XCircle,
          color: "text-indigo-500",
          label: "Expirado",
        };
      case "refunded":
      case "partially_refunded":
        return {
          icon: ShieldCheck,
          color: "text-blue-600",
          label:
            payment.status === "refunded"
              ? "Reintegrado total"
              : "Reintegrado parcial",
        };
      default:
        return {
          icon: AlertTriangle,
          color: "text-muted-foreground",
          label: "Iniciado",
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
          <p className="mt-4 font-medium">No se pudo cargar la carga mock</p>
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
  const canRefund = payment.status === "approved";

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm uppercase tracking-[0.24em] text-muted-foreground">
            Checkout QA
          </p>
          <h1 className="text-3xl font-semibold">Carga mock de Saldo LUK</h1>
        </div>
        <div className="max-w-full break-all rounded-2xl border bg-muted/50 px-4 py-2 text-sm text-muted-foreground sm:max-w-[18rem] sm:rounded-full sm:text-right">
          {payment.id}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.25fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Detalle de la carga</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-2xl border bg-muted/30 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">
                    Carga de saldo
                  </p>
                  <p className="text-lg font-medium break-words">
                    {payment.amount.toFixed(2)} Saldo LUK
                  </p>
                  <p className="mt-1 break-all text-sm text-muted-foreground">
                    Usuario: {payment.userEmail}
                  </p>
                </div>
                <div
                  className={`flex shrink-0 items-center gap-2 ${statusTone.color}`}
                >
                  <StatusIcon className="h-5 w-5" />
                  <span className="font-medium">{statusTone.label}</span>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border p-4">
                <p className="text-sm text-muted-foreground">
                  Monto solicitado
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  ${payment.amount.toFixed(2)}
                </p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-sm text-muted-foreground">
                  Orden del proveedor
                </p>
                <p className="mt-2 break-all font-mono text-sm leading-snug">
                  {payment.providerOrderId}
                </p>
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border p-5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Saldo acreditado</span>
                <span>${payment.creditedAmount.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Saldo reintegrado</span>
                <span>${payment.refundedAmount.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between border-t pt-3 text-base font-medium">
                <span>Saldo neto cargado</span>
                <span>
                  $
                  {(payment.creditedAmount - payment.refundedAmount).toFixed(2)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Acciones mock</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              className="w-full border-emerald-700/35 bg-emerald-600/80 text-emerald-950 shadow-[0_18px_42px_-26px_rgb(16_185_129_/_0.65)] hover:bg-emerald-500/85"
              onClick={() => executeAction("APPROVE")}
              disabled={acting !== null || payment.status === "approved"}
            >
              {acting === "APPROVE" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Aprobando...
                </>
              ) : (
                "Aprobar"
              )}
            </Button>

            <Button
              className="w-full border-amber-700/35 bg-[#c89a51] text-black shadow-[0_18px_42px_-26px_rgb(200_154_81_/_0.62)] hover:bg-[#d5aa63]"
              onClick={() => executeAction("PEND")}
              disabled={acting !== null || payment.status === "pending"}
            >
              {acting === "PEND" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Marcando pendiente...
                </>
              ) : (
                "Pendiente"
              )}
            </Button>

            <Button
              className="w-full border-red-900/35 bg-[#a44845] text-white shadow-[0_18px_42px_-26px_rgb(164_72_69_/_0.6)] hover:bg-[#b85a56]"
              onClick={() => executeAction("REJECT")}
              disabled={
                acting !== null ||
                payment.status === "rejected" ||
                payment.status === "expired"
              }
            >
              {acting === "REJECT" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Rechazando...
                </>
              ) : (
                "Rechazar"
              )}
            </Button>

            <Button
              className="w-full border-slate-600/45 bg-[#5d6681] text-white shadow-[0_18px_42px_-26px_rgb(93_102_129_/_0.58)] hover:bg-[#6d7795]"
              onClick={() => executeAction("EXPIRE")}
              disabled={
                acting !== null ||
                payment.status === "expired" ||
                payment.status === "rejected"
              }
            >
              {acting === "EXPIRE" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Expirando...
                </>
              ) : (
                "Expirar"
              )}
            </Button>

            {canRefund && (
              <div className="space-y-3 rounded-2xl border p-4">
                <p className="text-sm font-medium">Reintegros QA</p>
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => executeAction("REFUND_FULL")}
                  disabled={acting !== null}
                >
                  {acting === "REFUND_FULL" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Reintegrando...
                    </>
                  ) : (
                    "Reintegro total"
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
                    onChange={(event) =>
                      setPartialRefundAmount(event.target.value)
                    }
                    placeholder="Ej: 5000"
                  />
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={acting !== null || Number(partialRefundAmount) <= 0}
                  onClick={() =>
                    executeAction("REFUND_PARTIAL", Number(partialRefundAmount))
                  }
                >
                  {acting === "REFUND_PARTIAL" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Reintegrando...
                    </>
                  ) : (
                    "Reintegro parcial"
                  )}
                </Button>
              </div>
            )}

            <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              Esta pantalla existe solo para QA/local. No replica la UI de
              Mercado Pago; replica el ciclo de estados y sus efectos sobre
              Saldo LUK.
              <span className="mt-3 block">
                Expirar simula una carga abandonada o vencida: el usuario inició
                el pago, no lo completó a tiempo y LUK no acredita saldo.
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
