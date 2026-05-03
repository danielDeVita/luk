"use client";

import { useEffect } from "react";
import { gql } from "@apollo/client/core";
import { useMutation, useQuery } from "@apollo/client/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  ReceiptText,
  Ticket,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuthStore } from "@/store/auth";

const TICKET_PURCHASE_RECEIPT = gql`
  query TicketPurchaseReceipt($purchaseReference: String!) {
    ticketPurchaseReceipt(purchaseReference: $purchaseReference) {
      id
      purchaseReference
      raffleId
      raffleTitleSnapshot
      receiptVersion
      currencyCode
      ticketNumbers
      grossSubtotal
      packDiscountAmount
      promotionDiscountAmount
      selectionPremiumPercent
      selectionPremiumAmount
      chargedAmount
      baseQuantity
      bonusQuantity
      grantedQuantity
      packApplied
      purchaseMode
      buyerAcceptedAt
      acceptanceSource
      acceptancePending
      createdAt
      updatedAt
    }
  }
`;

const ACKNOWLEDGE_TICKET_PURCHASE_RECEIPT = gql`
  mutation AcknowledgeTicketPurchaseReceiptFromPage(
    $purchaseReference: String!
    $source: TicketReceiptAcceptanceSource!
  ) {
    acknowledgeTicketPurchaseReceipt(
      purchaseReference: $purchaseReference
      source: $source
    ) {
      purchaseReference
      buyerAcceptedAt
      acceptanceSource
      acceptancePending
      updatedAt
    }
  }
`;

interface TicketPurchaseReceiptQuery {
  ticketPurchaseReceipt: {
    id: string;
    purchaseReference: string;
    raffleId: string;
    raffleTitleSnapshot: string;
    receiptVersion: number;
    currencyCode: string;
    ticketNumbers: number[];
    grossSubtotal: number;
    packDiscountAmount: number;
    promotionDiscountAmount: number;
    selectionPremiumPercent: number;
    selectionPremiumAmount: number;
    chargedAmount: number;
    baseQuantity: number;
    bonusQuantity: number;
    grantedQuantity: number;
    packApplied: boolean;
    purchaseMode: "RANDOM" | "CHOOSE_NUMBERS";
    buyerAcceptedAt?: string | null;
    acceptanceSource?: string | null;
    acceptancePending: boolean;
    createdAt: string;
    updatedAt: string;
  };
}

interface AcknowledgeTicketPurchaseReceiptResult {
  acknowledgeTicketPurchaseReceipt: {
    purchaseReference: string;
    buyerAcceptedAt?: string | null;
    acceptanceSource?: string | null;
    acceptancePending: boolean;
    updatedAt: string;
  };
}

interface TicketReceiptPageClientProps {
  purchaseReference: string;
}

const moneyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
});

function formatDateTime(value?: string | null): string {
  if (!value) {
    return "Pendiente";
  }

  return new Date(value).toLocaleString("es-AR");
}

export function TicketReceiptPageClient({
  purchaseReference,
}: TicketReceiptPageClientProps) {
  const router = useRouter();
  const { isAuthenticated, hasHydrated } = useAuthStore();
  const { data, loading, error } = useQuery<TicketPurchaseReceiptQuery>(
    TICKET_PURCHASE_RECEIPT,
    {
      variables: { purchaseReference },
      skip: !hasHydrated || !isAuthenticated,
    },
  );
  const [acknowledgeTicketPurchaseReceipt, { loading: acknowledging }] =
    useMutation<AcknowledgeTicketPurchaseReceiptResult>(
      ACKNOWLEDGE_TICKET_PURCHASE_RECEIPT,
      {
        refetchQueries: [
          {
            query: TICKET_PURCHASE_RECEIPT,
            variables: { purchaseReference },
          },
        ],
        onCompleted: () => {
          toast.success("Confirmaste que ves tus números en tu cuenta.");
        },
        onError: (mutationError) => {
          toast.error(mutationError.message);
        },
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

  if (error || !data?.ticketPurchaseReceipt) {
    return (
      <main className="container mx-auto px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>No encontramos este comprobante</CardTitle>
            <CardDescription>
              Verificá que la compra exista y que pertenezca a tu cuenta.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/tickets">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver a mis tickets
              </Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  const receipt = data.ticketPurchaseReceipt;
  const discountTotal =
    receipt.packDiscountAmount + receipt.promotionDiscountAmount;

  return (
    <main className="container mx-auto px-4 py-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="editorial-kicker text-primary">
            Dashboard / Tickets / Comprobante
          </p>
          <h1 className="mt-3 font-display text-4xl leading-none sm:text-5xl">
            Comprobante de compra
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Este comprobante agrupa la compra completa y los números emitidos
            para tu cuenta.
          </p>
        </div>
        <Link href="/dashboard/tickets">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a mis tickets
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ReceiptText className="h-5 w-5 text-primary" />
                  {receipt.raffleTitleSnapshot}
                </CardTitle>
                <CardDescription className="mt-2">
                  Referencia{" "}
                  <span className="font-mono">{receipt.purchaseReference}</span>
                </CardDescription>
              </div>
              <Badge variant={receipt.acceptancePending ? "secondary" : "default"}>
                {receipt.acceptancePending ? "Pendiente de confirmación" : "Confirmado"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border p-4">
                <p className="text-sm text-muted-foreground">Total cobrado</p>
                <p className="mt-2 text-2xl font-semibold">
                  {moneyFormatter.format(receipt.chargedAmount)}
                </p>
              </div>
              <div className="rounded-2xl border p-4">
                <p className="text-sm text-muted-foreground">Tickets emitidos</p>
                <p className="mt-2 text-2xl font-semibold">
                  {receipt.grantedQuantity}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border p-4">
              <p className="text-sm font-medium">Números asignados</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {receipt.ticketNumbers.map((ticketNumber) => (
                  <span
                    key={ticketNumber}
                    className="rounded-full border bg-muted/40 px-3 py-1 text-sm font-medium"
                  >
                    #{ticketNumber}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border p-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Modo de compra</span>
                <span>
                  {receipt.purchaseMode === "CHOOSE_NUMBERS"
                    ? "Elegiste números"
                    : "Asignación aleatoria"}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Tickets pagados</span>
                <span>{receipt.baseQuantity}</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Subtotal bruto</span>
                <span>{moneyFormatter.format(receipt.grossSubtotal)}</span>
              </div>
              {receipt.bonusQuantity > 0 && (
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Bonus emitido</span>
                  <span>+{receipt.bonusQuantity}</span>
                </div>
              )}
              {discountTotal > 0 && (
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Descuentos</span>
                  <span>-{moneyFormatter.format(discountTotal)}</span>
                </div>
              )}
              {receipt.selectionPremiumAmount > 0 && (
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">
                    Premium por selección
                  </span>
                  <span>
                    +{moneyFormatter.format(receipt.selectionPremiumAmount)}
                  </span>
                </div>
              )}
            </div>

            <div className="rounded-2xl border p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Emitido el</p>
                  <p className="mt-1 text-sm">{formatDateTime(receipt.createdAt)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Confirmado el</p>
                  <p className="mt-1 text-sm">
                    {formatDateTime(receipt.buyerAcceptedAt)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Última actualización
                  </p>
                  <p className="mt-1 text-sm">{formatDateTime(receipt.updatedAt)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Versión</p>
                  <p className="mt-1 text-sm">#{receipt.receiptVersion}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ticket className="h-5 w-5 text-primary" />
                Estado del comprador
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {receipt.acceptancePending ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Confirmá que visualizás correctamente estos números dentro
                    de tu cuenta.
                  </p>
                  <Button
                    className="w-full"
                    onClick={() =>
                      acknowledgeTicketPurchaseReceipt({
                        variables: {
                          purchaseReference: receipt.purchaseReference,
                          source: "RECEIPT_PAGE",
                        },
                      })
                    }
                    disabled={acknowledging}
                  >
                    {acknowledging ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Confirmando...
                      </>
                    ) : (
                      "Confirmar que veo mis números"
                    )}
                  </Button>
                </>
              ) : (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700">
                  <div className="flex items-center gap-2 font-medium">
                    <CheckCircle2 className="h-4 w-4" />
                    Ya confirmaste este comprobante.
                  </div>
                  <p className="mt-2">
                    Fecha de confirmación: {formatDateTime(receipt.buyerAcceptedAt)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Acciones rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href={`/raffle/${receipt.raffleId}`}>
                <Button variant="outline" className="w-full">
                  Ver rifa
                </Button>
              </Link>
              <Link href="/dashboard/tickets">
                <Button className="w-full">Ir a mis tickets</Button>
              </Link>
            </CardContent>
          </Card>
        </aside>
      </div>
    </main>
  );
}
