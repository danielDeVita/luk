"use client";

import { useEffect, useState } from "react";
import { gql } from "@apollo/client/core";
import { useMutation, useQuery } from "@apollo/client/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
  Minus,
  Plus,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/store/auth";

const MY_WALLET = gql`
  query MyWallet {
    myWallet {
      id
      creditBalance
      sellerPayableBalance
    }
  }
`;

const WALLET_LEDGER = gql`
  query WalletLedger($take: Int) {
    walletLedger(take: $take) {
      id
      type
      amount
      creditTopUpSessionId
      topUpReceiptAvailable
      creditBalanceAfter
      sellerPayableBalanceAfter
      createdAt
    }
  }
`;

const CREATE_CREDIT_TOP_UP = gql`
  mutation CreateCreditTopUp($input: CreateCreditTopUpInput!) {
    createCreditTopUp(input: $input) {
      id
      amount
      redirectUrl
      status
    }
  }
`;

interface WalletQueryResult {
  myWallet: {
    id: string;
    creditBalance: number;
    sellerPayableBalance: number;
  };
}

interface LedgerEntry {
  id: string;
  type: string;
  amount: number;
  creditTopUpSessionId?: string | null;
  topUpReceiptAvailable?: boolean | null;
  creditBalanceAfter?: number | null;
  sellerPayableBalanceAfter?: number | null;
  createdAt: string;
}

interface LedgerQueryResult {
  walletLedger: LedgerEntry[];
}

interface CreateCreditTopUpResult {
  createCreditTopUp: {
    id: string;
    amount: number;
    redirectUrl: string;
    status: string;
  };
}

const moneyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
});

function formatLedgerType(type: string): string {
  const labels: Record<string, string> = {
    CREDIT_TOP_UP: "Carga de Saldo LUK",
    CREDIT_TOP_UP_REFUND: "Reintegro de carga",
    TICKET_PURCHASE_DEBIT: "Compra de tickets",
    TICKET_PURCHASE_REFUND: "Reembolso de tickets",
    SELLER_PAYABLE_CREDIT: "Venta a liquidar",
    SELLER_PAYABLE_DEBIT: "Liquidación registrada",
    PLATFORM_SUBSIDY: "Subsidio LUK",
    ADJUSTMENT: "Ajuste",
  };

  return labels[type] ?? type;
}

export default function WalletPage() {
  const router = useRouter();
  const { isAuthenticated, hasHydrated } = useAuthStore();
  const [amount, setAmount] = useState("3000");
  const { data: walletData, loading: walletLoading } =
    useQuery<WalletQueryResult>(MY_WALLET, {
      skip: !hasHydrated || !isAuthenticated,
    });
  const { data: ledgerData, loading: ledgerLoading } =
    useQuery<LedgerQueryResult>(WALLET_LEDGER, {
      variables: { take: 30 },
      skip: !hasHydrated || !isAuthenticated,
    });
  const [createCreditTopUp, { loading: creatingTopUp }] =
    useMutation<CreateCreditTopUpResult>(CREATE_CREDIT_TOP_UP, {
      onCompleted: ({ createCreditTopUp: topUp }) => {
        window.location.href = topUp.redirectUrl;
      },
      onError: (mutationError) => {
        toast.error(mutationError.message);
      },
    });

  useEffect(() => {
    if (hasHydrated && !isAuthenticated) {
      router.push("/auth/login");
    }
  }, [hasHydrated, isAuthenticated, router]);

  if (!hasHydrated || !isAuthenticated) {
    return null;
  }

  const parsedAmount = Number(amount);
  const canCreateTopUp =
    Number.isFinite(parsedAmount) && parsedAmount >= 100 && !creatingTopUp;
  const creditBalance = walletData?.myWallet.creditBalance ?? 0;
  const ledger = ledgerData?.walletLedger ?? [];

  const handleCreateTopUp = () => {
    if (!canCreateTopUp) {
      toast.error("Ingresá un monto de al menos $100");
      return;
    }

    void createCreditTopUp({
      variables: {
        input: { amount: parsedAmount },
      },
    });
  };

  const adjustAmount = (delta: number) => {
    const currentAmount = Number(amount);
    const safeAmount = Number.isFinite(currentAmount) ? currentAmount : 0;
    setAmount(String(Math.max(100, safeAmount + delta)));
  };

  return (
    <main className="container mx-auto px-4 py-10">
      <div className="mb-8">
        <p className="editorial-kicker text-primary">Dashboard / Saldo LUK</p>
        <h1 className="mt-4 font-display text-4xl leading-none sm:text-5xl">
          Saldo LUK
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Cargás saldo con Mercado Pago y usás ese saldo dentro de LUK para
          comprar tickets. Las compras de rifas no abren Mercado Pago
          directamente.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                Saldo disponible
              </CardTitle>
            </CardHeader>
            <CardContent>
              {walletLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando saldo...
                </div>
              ) : (
                <>
                  <p className="font-display text-5xl leading-none text-primary">
                    {moneyFormatter.format(creditBalance)}
                  </p>
                  <p className="mt-3 text-sm text-muted-foreground">
                    1 Saldo LUK equivale a $1 ARS. No expira, no se transfiere
                    entre usuarios y los reembolsos de tickets vuelven acá.
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Historial de movimientos</CardTitle>
            </CardHeader>
            <CardContent>
              {ledgerLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando movimientos...
                </div>
              ) : ledger.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Todavía no tenés movimientos de Saldo LUK.
                </p>
              ) : (
                <div className="divide-y divide-border/80">
                  {ledger.map((entry) => {
                    const isCredit = entry.amount >= 0;
                    const balanceAfter =
                      entry.creditBalanceAfter ??
                      entry.sellerPayableBalanceAfter ??
                      0;
                    return (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between gap-4 py-4"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                            {isCredit ? (
                              <ArrowDownLeft className="h-4 w-4 text-success" />
                            ) : (
                              <ArrowUpRight className="h-4 w-4 text-destructive" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">
                              {formatLedgerType(entry.type)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(entry.createdAt).toLocaleString(
                                "es-AR",
                              )}
                            </p>
                            {entry.type === "CREDIT_TOP_UP" &&
                            entry.creditTopUpSessionId &&
                            entry.topUpReceiptAvailable ? (
                              <Link
                                href={`/dashboard/wallet/receipts/${entry.creditTopUpSessionId}`}
                                className="mt-1 inline-flex text-xs font-medium text-primary hover:underline"
                              >
                                Ver comprobante
                              </Link>
                            ) : null}
                          </div>
                        </div>
                        <div className="text-right">
                          <p
                            className={
                              isCredit
                                ? "font-semibold text-success"
                                : "font-semibold text-destructive"
                            }
                          >
                            {isCredit ? "+" : ""}
                            {moneyFormatter.format(entry.amount)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Saldo {moneyFormatter.format(balanceAfter)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Cargar saldo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="top-up-amount">Monto</Label>
                <div className="relative">
                  <Input
                    id="top-up-amount"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={amount}
                    onChange={(event) =>
                      setAmount(event.target.value.replace(/\D/g, ""))
                    }
                    className="min-h-16 rounded-[1.6rem] border-primary/35 bg-background/80 pr-28 text-2xl tracking-[-0.03em] shadow-panel ring-1 ring-primary/15 focus-visible:ring-primary/30"
                  />
                  <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-full border border-primary/20 bg-card/90 p-1 shadow-panel backdrop-blur">
                    <button
                      type="button"
                      aria-label="Disminuir monto"
                      className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-40"
                      onClick={() => adjustAmount(-100)}
                      disabled={parsedAmount <= 100 || creatingTopUp}
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Aumentar monto"
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lift transition-transform hover:-translate-y-0.5 hover:bg-primary/92 disabled:opacity-40"
                      onClick={() => adjustAmount(100)}
                      disabled={creatingTopUp}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
              <Button
                className="w-full"
                onClick={handleCreateTopUp}
                disabled={!canCreateTopUp}
              >
                {creatingTopUp ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creando carga...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Cargar con Mercado Pago
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                Mercado Pago procesa la carga de saldo. No recibe datos de
                rifas, tickets, premios, números elegidos ni vendedores.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cómo funciona</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                Primero cargás saldo. Después comprás tickets con saldo interno.
              </p>
              <p>
                Si una compra se reembolsa por cancelación o disputa, el dinero
                vuelve a tu Saldo LUK.
              </p>
              <p>
                El saldo no usado puede reintegrarse sobre la carga original
                cuando corresponda.
              </p>
              <Link href="/search">
                <Button variant="outline" className="mt-2 w-full">
                  Explorar rifas
                </Button>
              </Link>
            </CardContent>
          </Card>
        </aside>
      </div>
    </main>
  );
}
