"use client";

import { useEffect } from "react";
import { gql } from "@apollo/client/core";
import { useQuery } from "@apollo/client/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  ReceiptText,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuthStore } from "@/store/auth";

const CREDIT_TOP_UP_RECEIPT = gql`
  query CreditTopUpReceipt($topUpSessionId: String!) {
    creditTopUpReceipt(topUpSessionId: $topUpSessionId) {
      topUpSessionId
      provider
      amount
      creditedAmount
      status
      statusDetail
      providerPaymentId
      providerOrderId
      receiptVersion
      createdAt
      approvedAt
      receiptIssuedAt
      creditBalanceAfter
    }
  }
`;

interface CreditTopUpReceiptQuery {
  creditTopUpReceipt: {
    topUpSessionId: string;
    provider: string;
    amount: number;
    creditedAmount: number;
    status: string;
    statusDetail?: string | null;
    providerPaymentId?: string | null;
    providerOrderId?: string | null;
    receiptVersion: number;
    createdAt: string;
    approvedAt?: string | null;
    receiptIssuedAt?: string | null;
    creditBalanceAfter?: number | null;
  };
}

interface WalletReceiptPageClientProps {
  topUpSessionId: string;
}

const moneyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
});

function formatDateTime(value?: string | null): string {
  if (!value) {
    return "No disponible";
  }

  return new Date(value).toLocaleString("es-AR");
}

function formatProvider(provider: string): string {
  return provider === "MERCADO_PAGO"
    ? "Mercado Pago"
    : provider === "MOCK"
      ? "Proveedor mock"
      : provider;
}

export function WalletReceiptPageClient({
  topUpSessionId,
}: WalletReceiptPageClientProps) {
  const router = useRouter();
  const { isAuthenticated, hasHydrated } = useAuthStore();
  const { data, loading, error } = useQuery<CreditTopUpReceiptQuery>(
    CREDIT_TOP_UP_RECEIPT,
    {
      variables: { topUpSessionId },
      skip: !hasHydrated || !isAuthenticated,
    },
  );

  useEffect(() => {
    if (hasHydrated && !isAuthenticated) {
      router.push("/auth/login");
    }
  }, [hasHydrated, isAuthenticated, router]);

  if (!hasHydrated || !isAuthenticated) {
    return null;
  }

  if (loading) {
    return (
      <main className="container mx-auto px-4 py-10">
        <Card>
          <CardContent className="flex items-center gap-3 py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Cargando comprobante...
          </CardContent>
        </Card>
      </main>
    );
  }

  if (error || !data?.creditTopUpReceipt) {
    return (
      <main className="container mx-auto px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>No encontramos este comprobante</CardTitle>
            <CardDescription>
              Verificá que la carga exista y que pertenezca a tu cuenta.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/wallet">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver a la wallet
              </Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  const receipt = data.creditTopUpReceipt;

  return (
    <main className="container mx-auto px-4 py-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="editorial-kicker text-primary">
            Dashboard / Wallet / Comprobante
          </p>
          <h1 className="mt-3 font-display text-4xl leading-none sm:text-5xl">
            Comprobante de carga
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Este comprobante documenta la acreditación de saldo en tu wallet.
          </p>
        </div>
        <Link href="/dashboard/wallet">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a la wallet
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ReceiptText className="h-5 w-5 text-primary" />
              Datos de la carga
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border p-4">
                <p className="text-sm text-muted-foreground">Monto cobrado</p>
                <p className="mt-2 text-2xl font-semibold">
                  {moneyFormatter.format(receipt.amount)}
                </p>
              </div>
              <div className="rounded-2xl border p-4">
                <p className="text-sm text-muted-foreground">
                  Saldo acreditado
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  {moneyFormatter.format(receipt.creditedAmount)}
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border p-4">
                <p className="text-sm text-muted-foreground">Estado</p>
                <p className="mt-2 font-medium uppercase tracking-[0.16em] text-primary">
                  {receipt.status}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {receipt.statusDetail || "Sin detalle adicional"}
                </p>
              </div>
              <div className="rounded-2xl border p-4">
                <p className="text-sm text-muted-foreground">Proveedor</p>
                <p className="mt-2 font-medium">
                  {formatProvider(receipt.provider)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Versión de comprobante #{receipt.receiptVersion}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">
                    ID interno de carga
                  </p>
                  <p className="mt-1 font-mono text-sm">{receipt.topUpSessionId}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Saldo luego de acreditar
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {receipt.creditBalanceAfter === null ||
                    receipt.creditBalanceAfter === undefined
                      ? "No disponible"
                      : moneyFormatter.format(receipt.creditBalanceAfter)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Creado el
                  </p>
                  <p className="mt-1 text-sm">{formatDateTime(receipt.createdAt)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Aprobado el
                  </p>
                  <p className="mt-1 text-sm">
                    {formatDateTime(receipt.approvedAt)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Emitido el
                  </p>
                  <p className="mt-1 text-sm">
                    {formatDateTime(receipt.receiptIssuedAt)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Payment ID
                  </p>
                  <p className="mt-1 font-mono text-sm">
                    {receipt.providerPaymentId || "No disponible"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Order ID</p>
                  <p className="mt-1 font-mono text-sm">
                    {receipt.providerOrderId || "No disponible"}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success" />
                Comprobante emitido
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                Este comprobante queda asociado a tu carga aprobada y sólo está
                disponible para operaciones nuevas.
              </p>
              <p>
                Mercado Pago procesa la carga; la compra de tickets ocurre más
                tarde dentro de LUK con tu saldo disponible.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                Próximo paso
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Link href="/search">
                <Button className="w-full">Explorar rifas</Button>
              </Link>
            </CardContent>
          </Card>
        </aside>
      </div>
    </main>
  );
}
