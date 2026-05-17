"use client";

import { useEffect, useMemo } from "react";
import { gql } from "@apollo/client/core";
import { useQuery } from "@apollo/client/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  CreditCard,
  MapPin,
  Search,
  Sparkles,
  User,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAuthStore } from "@/store/auth";
import {
  getBuyerOnboardingProgress,
  getFirstPendingStep,
  getSellerOnboardingProgress,
  type OnboardingProgress,
  type OnboardingStep,
} from "@/lib/onboarding";

const DASHBOARD_ME = gql`
  query DashboardMe {
    me {
      id
      nombre
      apellido
      phone
      sellerPaymentAccountStatus
      kycStatus
      street
      city
      province
      postalCode
      cuitCuil
    }
  }
`;

const DASHBOARD_WALLET = gql`
  query DashboardWallet {
    myWallet {
      id
      creditBalance
      sellerPayableBalance
    }
  }
`;

const DASHBOARD_LEDGER = gql`
  query DashboardWalletLedger($take: Int) {
    walletLedger(take: $take) {
      id
      type
    }
  }
`;

const DASHBOARD_SHIPPING = gql`
  query DashboardShippingAddresses {
    myShippingAddresses {
      id
    }
  }
`;

const DASHBOARD_TICKETS = gql`
  query DashboardTickets {
    myTickets {
      id
    }
  }
`;

const DASHBOARD_RECEIPTS = gql`
  query DashboardTicketPurchaseReceipts($take: Int, $pendingOnly: Boolean) {
    myTicketPurchaseReceipts(take: $take, pendingOnly: $pendingOnly) {
      id
    }
  }
`;

const DASHBOARD_RAFFLES = gql`
  query DashboardSellerRaffles {
    myRafflesAsSeller {
      id
    }
  }
`;

const DASHBOARD_BUYER_STATS = gql`
  query DashboardBuyerStats {
    buyerStats {
      favoritesCount
    }
  }
`;

interface DashboardMeResult {
  me: {
    id: string;
    nombre?: string | null;
    apellido?: string | null;
    phone?: string | null;
    sellerPaymentAccountStatus?: string | null;
    kycStatus?: string | null;
    street?: string | null;
    city?: string | null;
    province?: string | null;
    postalCode?: string | null;
    cuitCuil?: string | null;
  };
}

interface DashboardWalletResult {
  myWallet: {
    id: string;
    creditBalance: number;
    sellerPayableBalance: number;
  };
}

interface DashboardLedgerResult {
  walletLedger: Array<{
    id: string;
    type: string;
  }>;
}

interface DashboardShippingResult {
  myShippingAddresses: Array<{ id: string }>;
}

interface DashboardTicketsResult {
  myTickets: Array<{ id: string }>;
}

interface DashboardReceiptsResult {
  myTicketPurchaseReceipts: Array<{ id: string }>;
}

interface DashboardRafflesResult {
  myRafflesAsSeller: Array<{ id: string }>;
}

interface DashboardBuyerStatsResult {
  buyerStats: {
    favoritesCount: number;
  };
}

function PathCard({
  title,
  subtitle,
  icon,
  progress,
  tone,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  progress: OnboardingProgress;
  tone: "buyer" | "seller";
}) {
  const firstPendingStep = getFirstPendingStep(progress);
  const accentClass =
    tone === "buyer"
      ? "from-primary/12 via-primary/4"
      : "from-secondary/16 via-secondary/4";

  return (
    <Card className={`overflow-hidden bg-gradient-to-br ${accentClass} to-transparent`}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="editorial-kicker text-primary">
              {progress.completedCount}/{progress.totalCount} completados
            </p>
            <CardTitle className="mt-3 flex items-center gap-3 text-2xl">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-background/80 text-primary shadow-sm">
                {icon}
              </span>
              {title}
            </CardTitle>
            <p className="mt-3 text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <span className="font-display text-4xl text-primary">
            {progress.progress}%
          </span>
        </div>
        <Progress value={progress.progress} className="mt-4 h-2" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {progress.steps.map((step) => (
            <StepRow key={step.id} step={step} />
          ))}
        </div>

        <Link href={firstPendingStep?.href ?? "/search"}>
          <Button className="w-full gap-2">
            {firstPendingStep?.cta ?? "Explorar LUK"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

function StepRow({ step }: { step: OnboardingStep }) {
  return (
    <Link
      href={step.href}
      className="group flex items-center gap-3 rounded-[1.15rem] border border-border/70 bg-background/62 p-3 transition-colors hover:border-primary/45 hover:bg-background"
    >
      {step.completed ? (
        <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
      ) : (
        <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{step.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {step.description}
        </p>
      </div>
      {!step.completed && (
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      )}
    </Link>
  );
}

export default function DashboardHomePage() {
  const router = useRouter();
  const { isAuthenticated, hasHydrated, user } = useAuthStore();
  const shouldSkipQueries = !hasHydrated || !isAuthenticated;

  const { data: meData, loading: meLoading, error: meError } =
    useQuery<DashboardMeResult>(DASHBOARD_ME, {
      skip: shouldSkipQueries,
    });
  const { data: walletData, loading: walletLoading, error: walletError } =
    useQuery<DashboardWalletResult>(DASHBOARD_WALLET, {
      skip: shouldSkipQueries,
    });
  const { data: ledgerData, loading: ledgerLoading, error: ledgerError } =
    useQuery<DashboardLedgerResult>(DASHBOARD_LEDGER, {
      skip: shouldSkipQueries,
      variables: { take: 30 },
    });
  const { data: shippingData, loading: shippingLoading, error: shippingError } =
    useQuery<DashboardShippingResult>(DASHBOARD_SHIPPING, {
      skip: shouldSkipQueries,
    });
  const { data: ticketsData, loading: ticketsLoading, error: ticketsError } =
    useQuery<DashboardTicketsResult>(DASHBOARD_TICKETS, {
      skip: shouldSkipQueries,
    });
  const { data: receiptsData, loading: receiptsLoading, error: receiptsError } =
    useQuery<DashboardReceiptsResult>(DASHBOARD_RECEIPTS, {
      skip: shouldSkipQueries,
      variables: { take: 1, pendingOnly: false },
    });
  const { data: rafflesData, loading: rafflesLoading, error: rafflesError } =
    useQuery<DashboardRafflesResult>(DASHBOARD_RAFFLES, {
      skip: shouldSkipQueries,
    });
  const {
    data: buyerStatsData,
    loading: buyerStatsLoading,
    error: buyerStatsError,
  } = useQuery<DashboardBuyerStatsResult>(DASHBOARD_BUYER_STATS, {
    skip: shouldSkipQueries,
  });

  useEffect(() => {
    if (hasHydrated && !isAuthenticated) {
      router.push("/auth/login");
    }
  }, [hasHydrated, isAuthenticated, router]);

  const isLoading =
    meLoading ||
    walletLoading ||
    ledgerLoading ||
    shippingLoading ||
    ticketsLoading ||
    receiptsLoading ||
    rafflesLoading ||
    buyerStatsLoading;
  const firstError =
    meError ||
    walletError ||
    ledgerError ||
    shippingError ||
    ticketsError ||
    receiptsError ||
    rafflesError ||
    buyerStatsError;

  const buyerProgress = useMemo(
    () =>
      getBuyerOnboardingProgress({
        shippingAddressesCount:
          shippingData?.myShippingAddresses.length ?? 0,
        creditBalance: walletData?.myWallet.creditBalance ?? 0,
        walletLedgerTypes:
          (ledgerData?.walletLedger ?? []).map((entry) => entry.type),
        ticketsCount: ticketsData?.myTickets.length ?? 0,
        ticketReceiptsCount:
          receiptsData?.myTicketPurchaseReceipts.length ?? 0,
        favoritesCount: buyerStatsData?.buyerStats.favoritesCount ?? 0,
      }),
    [
      buyerStatsData,
      ledgerData,
      receiptsData,
      shippingData,
      ticketsData,
      walletData,
    ],
  );

  const sellerProgress = useMemo(
    () =>
      getSellerOnboardingProgress({
        user: meData?.me,
        sellerRafflesCount: rafflesData?.myRafflesAsSeller.length ?? 0,
        sellerPayableBalance: walletData?.myWallet.sellerPayableBalance ?? 0,
      }),
    [meData, rafflesData, walletData],
  );

  if (!hasHydrated || !isAuthenticated) return null;

  return (
    <main className="container mx-auto px-4 py-10">
      <section className="mb-8 overflow-hidden rounded-[2.4rem] border border-border/80 bg-mesh px-6 py-8 shadow-panel sm:px-8">
        <p className="editorial-kicker text-primary">Dashboard / Mi panel</p>
        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
          <div>
            <h1 className="font-display text-4xl leading-none sm:text-6xl">
              Primeros pasos en LUK
            </h1>
            <p className="mt-4 max-w-2xl text-muted-foreground">
              Usá esta guía como mapa rápido. No bloquea nada: te muestra qué
              falta para comprar, vender y operar sin fricción.
            </p>
          </div>
          <div className="rounded-[1.6rem] border border-primary/20 bg-background/62 p-4">
            <p className="text-sm text-muted-foreground">Sesión activa</p>
            <p className="mt-1 font-semibold">
              {meData?.me?.nombre || user?.nombre || "Tu cuenta"}{" "}
              {meData?.me?.apellido || user?.apellido || ""}
            </p>
          </div>
        </div>
      </section>

      {firstError && (
        <section className="mb-6 rounded-[1.4rem] border border-destructive/25 bg-destructive/8 p-4 text-sm text-destructive">
          No pudimos cargar todos los datos del onboarding. Podés seguir usando
          el dashboard y volver a intentar más tarde.
        </section>
      )}

      {isLoading ? (
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="h-[34rem] animate-pulse rounded-[2rem] bg-muted/50" />
          <div className="h-[34rem] animate-pulse rounded-[2rem] bg-muted/50" />
        </section>
      ) : (
        <section className="grid gap-6 lg:grid-cols-2">
          <PathCard
            title="Quiero comprar"
            subtitle="Prepará tu cuenta para participar, cargar saldo y seguir tus tickets."
            icon={<Wallet className="h-5 w-5" />}
            progress={buyerProgress}
            tone="buyer"
          />
          <PathCard
            title="Quiero vender"
            subtitle="Completá los requisitos para publicar rifas y cobrar liquidaciones."
            icon={<Sparkles className="h-5 w-5" />}
            progress={sellerProgress}
            tone="seller"
          />
        </section>
      )}

      <section className="mt-8 grid gap-4 md:grid-cols-4">
        <QuickLink
          href="/dashboard/settings"
          icon={<User className="h-5 w-5" />}
          title="Cuenta"
          description="Perfil, KYC, seguridad y Mercado Pago."
        />
        <QuickLink
          href="/dashboard/shipping"
          icon={<MapPin className="h-5 w-5" />}
          title="Direcciones"
          description="Datos para recibir premios."
        />
        <QuickLink
          href="/dashboard/wallet"
          icon={<CreditCard className="h-5 w-5" />}
          title="Saldo LUK"
          description="Cargas e historial."
        />
        <QuickLink
          href="/search"
          icon={<Search className="h-5 w-5" />}
          title="Explorar"
          description="Rifas activas disponibles."
        />
      </section>
    </main>
  );
}

function QuickLink({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-[1.5rem] border border-border/80 bg-card/70 p-4 shadow-sm transition-colors hover:border-primary/35 hover:bg-card"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
        {icon}
      </div>
      <p className="mt-4 font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
        Ir
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
