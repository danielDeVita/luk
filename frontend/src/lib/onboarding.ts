export type OnboardingStepId =
  | "buyer-shipping"
  | "buyer-wallet"
  | "buyer-explore"
  | "buyer-first-ticket"
  | "buyer-receipts"
  | "seller-profile"
  | "seller-kyc"
  | "seller-tax-address"
  | "seller-payments"
  | "seller-first-raffle"
  | "seller-sales";

export type OnboardingNudgeId =
  | "wallet-first-top-up"
  | "settings-complete-profile"
  | "settings-complete-kyc"
  | "settings-complete-tax-address"
  | "settings-connect-payments"
  | "sales-seller-checklist"
  | "tickets-buyer-empty";

export interface OnboardingStep {
  id: OnboardingStepId;
  title: string;
  description: string;
  href: string;
  cta: string;
  completed: boolean;
}

export interface OnboardingProgress {
  steps: OnboardingStep[];
  completedCount: number;
  totalCount: number;
  progress: number;
  allComplete: boolean;
}

export interface OnboardingUserSummary {
  nombre?: string | null;
  apellido?: string | null;
  phone?: string | null;
  kycStatus?: string | null;
  sellerPaymentAccountStatus?: string | null;
  street?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  cuitCuil?: string | null;
}

export interface BuyerOnboardingInput {
  shippingAddressesCount: number;
  creditBalance: number;
  walletLedgerTypes: string[];
  ticketsCount: number;
  ticketReceiptsCount: number;
  favoritesCount: number;
}

export interface SellerOnboardingInput {
  user?: OnboardingUserSummary | null;
  sellerRafflesCount: number;
  sellerPayableBalance: number;
}

export interface OnboardingDismissalStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

export const ONBOARDING_DISMISSAL_STORAGE_PREFIX =
  "luk:onboarding:dismissals";

export function getOnboardingDismissalStorageKey(userId: string): string {
  return `${ONBOARDING_DISMISSAL_STORAGE_PREFIX}:${userId}`;
}

export function hasProfileBasics(
  user?: OnboardingUserSummary | null,
): boolean {
  return Boolean(user?.nombre && user?.apellido && user?.phone);
}

export function hasKycAddress(user?: OnboardingUserSummary | null): boolean {
  return Boolean(user?.street && user?.city && user?.province && user?.postalCode);
}

export function hasSellerTaxAddress(
  user?: OnboardingUserSummary | null,
): boolean {
  return hasKycAddress(user) && Boolean(user?.cuitCuil);
}

export function createOnboardingProgress(
  steps: OnboardingStep[],
): OnboardingProgress {
  const completedCount = steps.filter((step) => step.completed).length;
  const totalCount = steps.length;

  return {
    steps,
    completedCount,
    totalCount,
    progress: totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100),
    allComplete: completedCount === totalCount,
  };
}

export function getBuyerOnboardingProgress(
  input: BuyerOnboardingInput,
): OnboardingProgress {
  const hasTopUp =
    input.creditBalance > 0 ||
    input.walletLedgerTypes.some((type) => type === "CREDIT_TOP_UP");
  const hasExplored = input.favoritesCount > 0 || input.ticketsCount > 0;

  return createOnboardingProgress([
    {
      id: "buyer-shipping",
      title: "Cargá tu dirección",
      description: "La usamos para coordinar premios si ganás.",
      href: "/dashboard/shipping",
      cta: "Agregar dirección",
      completed: input.shippingAddressesCount > 0,
    },
    {
      id: "buyer-wallet",
      title: "Cargá Saldo LUK",
      description: "Después comprás tickets sin abrir Mercado Pago por rifa.",
      href: "/dashboard/wallet",
      cta: "Cargar saldo",
      completed: hasTopUp,
    },
    {
      id: "buyer-explore",
      title: "Explorá rifas",
      description: "Guardá favoritas o elegí una rifa activa.",
      href: "/search",
      cta: "Explorar",
      completed: hasExplored,
    },
    {
      id: "buyer-first-ticket",
      title: "Comprá tu primer ticket",
      description: "Podés comprar aleatorio o elegir números disponibles.",
      href: "/search",
      cta: "Buscar rifa",
      completed: input.ticketsCount > 0,
    },
    {
      id: "buyer-receipts",
      title: "Revisá tus comprobantes",
      description: "Tus tickets y comprobantes quedan guardados en el panel.",
      href: "/dashboard/tickets",
      cta: "Ver tickets",
      completed: input.ticketReceiptsCount > 0,
    },
  ]);
}

export function getSellerOnboardingProgress(
  input: SellerOnboardingInput,
): OnboardingProgress {
  const user = input.user;
  const hasCreatedRaffle = input.sellerRafflesCount > 0;
  const hasSellerActivity = hasCreatedRaffle || input.sellerPayableBalance > 0;

  return createOnboardingProgress([
    {
      id: "seller-profile",
      title: "Completá tu perfil",
      description: "Nombre, apellido y teléfono visibles para operar.",
      href: "/dashboard/settings",
      cta: "Editar perfil",
      completed: hasProfileBasics(user),
    },
    {
      id: "seller-kyc",
      title: "Verificá tu identidad",
      description: "KYC aprobado es obligatorio para publicar.",
      href: "/dashboard/settings?tab=kyc",
      cta: "Completar KYC",
      completed: user?.kycStatus === "VERIFIED",
    },
    {
      id: "seller-tax-address",
      title: "Cargá domicilio y CUIT/CUIL",
      description: "Necesario para cumplimiento y liquidaciones.",
      href: "/dashboard/settings?tab=kyc",
      cta: "Completar datos",
      completed: hasSellerTaxAddress(user),
    },
    {
      id: "seller-payments",
      title: "Conectá Mercado Pago",
      description: "LUK liquida tus ventas a esa billetera.",
      href: "/dashboard/settings?tab=payments",
      cta: "Conectar MP",
      completed: user?.sellerPaymentAccountStatus === "CONNECTED",
    },
    {
      id: "seller-first-raffle",
      title: "Creá tu primera rifa",
      description: "Publicá producto, precio, cantidad y fecha límite.",
      href: "/dashboard/create",
      cta: "Crear rifa",
      completed: hasCreatedRaffle,
    },
    {
      id: "seller-sales",
      title: "Seguimiento de ventas",
      description: "Respondé preguntas, gestioná entregas y liquidaciones.",
      href: "/dashboard/sales",
      cta: "Ver ventas",
      completed: hasSellerActivity,
    },
  ]);
}

export function getFirstPendingStep(
  progress: OnboardingProgress,
): OnboardingStep | null {
  return progress.steps.find((step) => !step.completed) ?? null;
}

export function readOnboardingDismissals(
  userId: string,
  storage: OnboardingDismissalStorage,
): OnboardingNudgeId[] {
  const rawDismissals = storage.getItem(getOnboardingDismissalStorageKey(userId));
  if (!rawDismissals) return [];

  try {
    const parsedDismissals = JSON.parse(rawDismissals) as string[];
    if (!Array.isArray(parsedDismissals)) return [];

    return parsedDismissals.filter(
      (dismissal): dismissal is OnboardingNudgeId =>
        typeof dismissal === "string",
    );
  } catch {
    return [];
  }
}

export function writeOnboardingDismissals(
  userId: string,
  dismissals: OnboardingNudgeId[],
  storage: OnboardingDismissalStorage,
): void {
  storage.setItem(
    getOnboardingDismissalStorageKey(userId),
    JSON.stringify(Array.from(new Set(dismissals))),
  );
}

export function addOnboardingDismissal(
  userId: string,
  nudgeId: OnboardingNudgeId,
  storage: OnboardingDismissalStorage,
): OnboardingNudgeId[] {
  const nextDismissals = [
    ...readOnboardingDismissals(userId, storage),
    nudgeId,
  ];
  writeOnboardingDismissals(userId, nextDismissals, storage);
  return Array.from(new Set(nextDismissals));
}
