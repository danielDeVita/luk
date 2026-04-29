"use client";

import { useState, useEffect, useMemo, useDeferredValue } from "react";
import { useQuery, useMutation } from "@apollo/client/react";
import { gql } from "@apollo/client/core";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Ticket,
  User,
  Clock,
  AlertTriangle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Heart,
  TrendingDown,
  History,
  Minus,
  Plus,
} from "lucide-react";
import { ShareButtons } from "@/components/share/share-buttons";
import { Countdown } from "@/components/ui/countdown";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { RaffleDetailSkeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IS_FAVORITE } from "@/lib/graphql/queries";
import { ADD_FAVORITE, REMOVE_FAVORITE } from "@/lib/graphql/mutations";
import { getOptimizedImageUrl, CLOUDINARY_PRESETS } from "@/lib/cloudinary";
import { formatProductCondition } from "@/lib/format-condition";
import { RaffleQA } from "./raffle-qa";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { ComplianceNotice } from "@/components/legal/compliance-notice";
import { PromotionBonusSelector } from "@/components/social-promotions/promotion-bonus-selector";
import { SocialPromotionManager } from "@/components/social-promotions/social-promotion-manager";
import {
  evaluateSimpleRandomPack,
  type PackIneligibilityReason,
} from "@/lib/tickets/pack-simple";
import {
  getStoredSocialPromotionToken,
  persistSocialPromotionToken,
} from "@/lib/social-promotions";

const GET_RAFFLE = gql`
  query GetRaffle($id: String!) {
    raffle(id: $id) {
      id
      titulo
      descripcion
      totalTickets
      precioPorTicket
      estado
      fechaLimiteSorteo
      winnerId
      winningTicketNumber
      product {
        nombre
        descripcionDetallada
        imagenes
        categoria
        condicion
      }
      seller {
        id
        nombre
        apellido
        email
      }
      tickets {
        id
        estado
      }
    }
  }
`;

const BUY_TICKETS = gql`
  mutation BuyTickets(
    $raffleId: String!
    $cantidad: Int!
    $bonusGrantId: String
    $promotionToken: String
  ) {
    buyTickets(
      raffleId: $raffleId
      cantidad: $cantidad
      bonusGrantId: $bonusGrantId
      promotionToken: $promotionToken
    ) {
      paidWithCredit
      creditDebited
      creditBalanceAfter
      totalAmount
      grossSubtotal
      discountApplied
      chargedAmount
      bonusGrantId
      cantidadComprada
      baseQuantity
      bonusQuantity
      grantedQuantity
      packApplied
      packIneligibilityReason
    }
  }
`;

const BUY_SELECTED_TICKETS = gql`
  mutation BuySelectedTickets(
    $raffleId: String!
    $selectedNumbers: [Int!]!
    $bonusGrantId: String
    $promotionToken: String
  ) {
    buySelectedTickets(
      raffleId: $raffleId
      selectedNumbers: $selectedNumbers
      bonusGrantId: $bonusGrantId
      promotionToken: $promotionToken
    ) {
      paidWithCredit
      creditDebited
      creditBalanceAfter
      totalAmount
      grossSubtotal
      discountApplied
      chargedAmount
      bonusGrantId
      cantidadComprada
      baseQuantity
      bonusQuantity
      grantedQuantity
      packApplied
      packIneligibilityReason
      purchaseMode
      selectionPremiumPercent
      selectionPremiumAmount
    }
  }
`;

const MY_WALLET = gql`
  query MyWallet {
    myWallet {
      id
      creditBalance
      sellerPayableBalance
    }
  }
`;

const TICKET_NUMBER_AVAILABILITY = gql`
  query TicketNumberAvailability(
    $raffleId: String!
    $page: Int!
    $pageSize: Int!
    $searchNumber: Int
  ) {
    ticketNumberAvailability(
      raffleId: $raffleId
      page: $page
      pageSize: $pageSize
      searchNumber: $searchNumber
    ) {
      items {
        number
        isAvailable
      }
      totalTickets
      page
      pageSize
      totalPages
      availableCount
      maxSelectable
      premiumPercent
    }
  }
`;

const INCREMENT_VIEWS = gql`
  mutation IncrementRaffleViews($raffleId: String!) {
    incrementRaffleViews(raffleId: $raffleId)
  }
`;

const GET_PRICE_HISTORY = gql`
  query GetPriceHistory($raffleId: String!) {
    priceHistory(raffleId: $raffleId) {
      id
      previousPrice
      newPrice
      changedAt
    }
  }
`;

const MY_TICKET_COUNT_IN_RAFFLE = gql`
  query MyTicketCountInRaffle($raffleId: String!) {
    myTicketCountInRaffle(raffleId: $raffleId)
  }
`;

const MY_SOCIAL_PROMOTION_POSTS = gql`
  query MySocialPromotionPosts($raffleId: String) {
    mySocialPromotionPosts(raffleId: $raffleId) {
      id
      raffleId
      network
      status
      submittedPermalink
      canonicalPermalink
      disqualificationReason
      snapshots {
        checkedAt
        likesCount
        commentsCount
        repostsOrSharesCount
        viewsCount
      }
    }
  }
`;

interface RaffleData {
  id: string;
  titulo: string;
  descripcion: string;
  totalTickets: number;
  precioPorTicket: number;
  estado: string;
  fechaLimiteSorteo: string;
  winnerId?: string;
  winningTicketNumber?: number | null;
  product?: {
    nombre: string;
    descripcionDetallada?: string;
    imagenes?: string[];
    categoria?: string;
    condicion?: string;
  };
  seller?: {
    id: string;
    nombre: string;
    apellido: string;
    email: string;
  };
  tickets?: { id: string; estado: string }[];
}

interface RaffleResult {
  raffle: RaffleData | null;
}

interface BuyTicketsResult {
  buyTickets: {
    paidWithCredit: boolean;
    creditDebited: number;
    creditBalanceAfter: number;
    totalAmount: number;
    grossSubtotal: number;
    discountApplied: number;
    chargedAmount: number;
    bonusGrantId?: string;
    cantidadComprada: number;
    baseQuantity: number;
    bonusQuantity: number;
    grantedQuantity: number;
    packApplied: boolean;
    packIneligibilityReason?: PackIneligibilityReason;
  };
}

interface BuySelectedTicketsResult {
  buySelectedTickets: {
    paidWithCredit: boolean;
    creditDebited: number;
    creditBalanceAfter: number;
    totalAmount: number;
    grossSubtotal: number;
    discountApplied: number;
    chargedAmount: number;
    bonusGrantId?: string;
    cantidadComprada: number;
    baseQuantity: number;
    bonusQuantity: number;
    grantedQuantity: number;
    packApplied: boolean;
    packIneligibilityReason?: PackIneligibilityReason;
    purchaseMode: "CHOOSE_NUMBERS";
    selectionPremiumPercent: number;
    selectionPremiumAmount: number;
  };
}

interface MyTicketCountInRaffleResult {
  myTicketCountInRaffle: number;
}

interface MyWalletResult {
  myWallet: {
    id: string;
    creditBalance: number;
    sellerPayableBalance: number;
  };
}

interface TicketNumberAvailabilityItem {
  number: number;
  isAvailable: boolean;
}

interface TicketNumberAvailabilityPageData {
  items: TicketNumberAvailabilityItem[];
  totalTickets: number;
  page: number;
  pageSize: number;
  totalPages: number;
  availableCount: number;
  maxSelectable: number;
  premiumPercent: number;
}

interface TicketNumberAvailabilityResult {
  ticketNumberAvailability: TicketNumberAvailabilityPageData;
}

interface PromotionBonusPreview {
  bonusGrantId: string;
  grossSubtotal: number;
  discountApplied: number;
  chargedAmount: number;
}

function getNonActiveRaffleMessage(raffle: RaffleData): string {
  switch (raffle.estado) {
    case "COMPLETADA":
      return "Todos los números se agotaron. El sorteo se está procesando.";
    case "SORTEADA":
      return "La rifa ya fue sorteada.";
    case "EN_ENTREGA":
      return "La rifa ya fue sorteada y el premio está en entrega.";
    case "FINALIZADA":
      return "La rifa finalizó y el premio ya fue entregado.";
    case "CANCELADA":
      return "Esta rifa fue cancelada.";
    default:
      return "Esta rifa ya no está disponible para comprar.";
  }
}

function getEstadoClass(estado: string): string {
  switch (estado) {
    case "ACTIVA":
      return "badge-active";
    case "SORTEADA":
    case "FINALIZADA":
      return "badge-completed";
    case "COMPLETADA":
      return "badge-hot";
    default:
      return "badge-pending";
  }
}

interface PriceHistoryEntry {
  id: string;
  previousPrice: number;
  newPrice: number;
  changedAt: string;
}

interface PriceHistoryResult {
  priceHistory: PriceHistoryEntry[];
}

interface SocialPromotionSnapshot {
  checkedAt: string;
  likesCount?: number;
  commentsCount?: number;
  repostsOrSharesCount?: number;
  viewsCount?: number;
}

interface SocialPromotionPostSummary {
  id: string;
  raffleId: string;
  network: string;
  status: string;
  submittedPermalink: string;
  canonicalPermalink?: string;
  disqualificationReason?: string;
  snapshots?: SocialPromotionSnapshot[];
}

interface RaffleContentProps {
  id: string;
}

export function RaffleContent({ id }: RaffleContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, user } = useAuthStore();
  const [purchaseMode, setPurchaseMode] = useState<"RANDOM" | "CHOOSE_NUMBERS">(
    "RANDOM",
  );
  const [quantity, setQuantity] = useState(1);
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [availabilityPage, setAvailabilityPage] = useState(1);
  const [searchNumberInput, setSearchNumberInput] = useState("");
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [selectedBonusGrantId, setSelectedBonusGrantId] = useState<
    string | null
  >(null);
  const [bonusPreview, setBonusPreview] =
    useState<PromotionBonusPreview | null>(null);
  const confirm = useConfirmDialog();
  const deferredSearchNumberInput = useDeferredValue(searchNumberInput);

  const clearPromotionBonusSelection = () => {
    setSelectedBonusGrantId(null);
    setBonusPreview(null);
  };

  const resetSelectedNumberPurchaseState = () => {
    clearPromotionBonusSelection();
    setSelectedNumbers([]);
    setAvailabilityPage(1);
    setSearchNumberInput("");
  };

  const {
    data,
    loading,
    error,
    refetch: refetchRaffle,
  } = useQuery<RaffleResult>(GET_RAFFLE, {
    variables: { id },
  });
  const isSellerOwner = Boolean(
    isAuthenticated &&
    data?.raffle?.seller?.id &&
    user?.id === data.raffle.seller.id,
  );

  // Query price history
  const { data: priceHistoryData } = useQuery<PriceHistoryResult>(
    GET_PRICE_HISTORY,
    {
      variables: { raffleId: id },
    },
  );

  const { data: socialPromotionData, refetch: refetchSocialPromotionPosts } =
    useQuery<{
      mySocialPromotionPosts: SocialPromotionPostSummary[];
    }>(MY_SOCIAL_PROMOTION_POSTS, {
      variables: { raffleId: id },
      skip: !isSellerOwner,
    });

  // Query favorite status
  const { data: favoriteData } = useQuery<{ isFavorite: boolean }>(
    IS_FAVORITE,
    {
      variables: { raffleId: id },
      skip: !isAuthenticated,
    },
  );
  const { data: myTicketCountData } = useQuery<MyTicketCountInRaffleResult>(
    MY_TICKET_COUNT_IN_RAFFLE,
    {
      variables: { raffleId: id },
      skip: !isAuthenticated || !data?.raffle || isSellerOwner,
    },
  );
  const { data: walletData, refetch: refetchWallet } = useQuery<MyWalletResult>(
    MY_WALLET,
    {
      skip: !isAuthenticated,
    },
  );

  useEffect(() => {
    if (favoriteData?.isFavorite !== undefined) {
      // Sync local state with server data
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsFavorite(favoriteData.isFavorite);
    }
  }, [favoriteData]);

  const parsedSearchNumber = useMemo(() => {
    const trimmedValue = deferredSearchNumberInput.trim();
    if (!trimmedValue) {
      return undefined;
    }

    const parsedValue = Number.parseInt(trimmedValue, 10);
    return Number.isInteger(parsedValue) && parsedValue > 0
      ? parsedValue
      : undefined;
  }, [deferredSearchNumberInput]);
  const searchNumberOutOfRangeForQuery =
    parsedSearchNumber !== undefined &&
    data?.raffle?.totalTickets !== undefined &&
    parsedSearchNumber > data.raffle.totalTickets;

  const {
    data: ticketAvailabilityData,
    loading: ticketAvailabilityLoading,
    error: ticketAvailabilityError,
    refetch: refetchTicketAvailability,
  } = useQuery<TicketNumberAvailabilityResult>(TICKET_NUMBER_AVAILABILITY, {
    notifyOnNetworkStatusChange: true,
    variables: {
      raffleId: id,
      page: availabilityPage,
      pageSize: 100,
    },
    skip: purchaseMode !== "CHOOSE_NUMBERS" || !data?.raffle,
  });

  const {
    data: ticketSearchData,
    loading: ticketSearchLoading,
    error: ticketSearchError,
    refetch: refetchTicketSearch,
  } = useQuery<TicketNumberAvailabilityResult>(TICKET_NUMBER_AVAILABILITY, {
    notifyOnNetworkStatusChange: true,
    variables: {
      raffleId: id,
      page: 1,
      pageSize: 100,
      searchNumber: parsedSearchNumber,
    },
    skip:
      purchaseMode !== "CHOOSE_NUMBERS" ||
      !data?.raffle ||
      parsedSearchNumber === undefined ||
      searchNumberOutOfRangeForQuery,
  });

  const handlePurchaseMutationError = (message: string) => {
    toast.error(message);

    if (!message.includes("ya no están disponibles")) {
      return;
    }

    const unavailableNumbers = Array.from(
      new Set(
        (message.match(/\d+/g) ?? []).map((value) =>
          Number.parseInt(value, 10),
        ),
      ),
    );

    if (unavailableNumbers.length === 0) {
      return;
    }

    let nextSelectedNumbers: number[] = [];
    setSelectedNumbers((currentNumbers) => {
      nextSelectedNumbers = currentNumbers.filter(
        (number) => !unavailableNumbers.includes(number),
      );
      return nextSelectedNumbers;
    });

    if (nextSelectedNumbers.length === 0) {
      clearPromotionBonusSelection();
    }

    if (
      parsedSearchNumber !== undefined &&
      unavailableNumbers.includes(parsedSearchNumber)
    ) {
      setSearchNumberInput("");
    }

    void refetchTicketAvailability();
    if (parsedSearchNumber !== undefined) {
      void refetchTicketSearch();
    }
  };

  const [buyTickets, { loading: buyingRandom }] = useMutation<BuyTicketsResult>(
    BUY_TICKETS,
    {
      onCompleted: async (mutationData) => {
        const result = mutationData.buyTickets;
        toast.success(
          `Compra confirmada. Se debitaron $${result.creditDebited.toFixed(2)} de tu Saldo LUK.`,
        );
        await Promise.all([refetchWallet(), refetchRaffle()]);
      },
      onError: (mutationError) => {
        handlePurchaseMutationError(mutationError.message);
      },
    },
  );
  const [buySelectedTickets, { loading: buyingSelected }] =
    useMutation<BuySelectedTicketsResult>(BUY_SELECTED_TICKETS, {
      onCompleted: async (mutationData) => {
        const result = mutationData.buySelectedTickets;
        toast.success(
          `Compra confirmada. Se debitaron $${result.creditDebited.toFixed(2)} de tu Saldo LUK.`,
        );
        await Promise.all([
          refetchWallet(),
          refetchRaffle(),
          refetchTicketAvailability(),
        ]);
      },
      onError: (mutationError) => {
        handlePurchaseMutationError(mutationError.message);
      },
    });
  const [incrementViews] = useMutation(INCREMENT_VIEWS);

  // Favorite mutations
  const [addFavorite, { loading: addingFavorite }] = useMutation(ADD_FAVORITE, {
    onError: () => {
      setIsFavorite(false);
      toast.error("Error al agregar a favoritos");
    },
  });

  const [removeFavorite, { loading: removingFavorite }] = useMutation(
    REMOVE_FAVORITE,
    {
      onError: () => {
        setIsFavorite(true);
        toast.error("Error al quitar de favoritos");
      },
    },
  );

  const isTogglingFavorite = addingFavorite || removingFavorite;

  const handleFavoriteClick = async () => {
    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }

    if (isFavorite) {
      const confirmed = await confirm({
        title: "¿Quitar de favoritos?",
        description: `¿Estás seguro que querés quitar "${raffle.titulo}" de tu lista de favoritos?`,
        confirmText: "Quitar",
        cancelText: "Cancelar",
        variant: "destructive",
      });

      if (confirmed) {
        setIsFavorite(false);
        removeFavorite({ variables: { raffleId: id } });
      }
    } else {
      setIsFavorite(true);
      addFavorite({ variables: { raffleId: id } });
    }
  };

  // Increment view count on page load (once per session)
  useEffect(() => {
    const viewedKey = `raffle-viewed-${id}`;
    if (!sessionStorage.getItem(viewedKey)) {
      incrementViews({ variables: { raffleId: id } });
      sessionStorage.setItem(viewedKey, "true");
    }
  }, [id, incrementViews]);

  useEffect(() => {
    const promoFromUrl = searchParams.get("promo");
    if (promoFromUrl) {
      persistSocialPromotionToken(promoFromUrl, id);
    }
  }, [id, searchParams]);

  const promotionToken = useMemo(() => {
    const promoFromUrl = searchParams.get("promo");
    if (promoFromUrl) {
      return promoFromUrl;
    }

    return getStoredSocialPromotionToken(id);
  }, [id, searchParams]);

  if (loading) {
    return <RaffleDetailSkeleton />;
  }

  if (error || !data?.raffle) {
    return (
      <div className="container mx-auto px-4 py-10">
        <div className="rounded-[2rem] border border-border/80 bg-card/90 py-20 text-center shadow-panel">
          <AlertTriangle className="h-16 w-16 mx-auto mb-4 text-destructive" />
          <h1 className="font-display text-4xl mb-2">Rifa no encontrada</h1>
          <Link href="/search">
            <Button className="btn-press">Volver a rifas</Button>
          </Link>
        </div>
      </div>
    );
  }

  const raffle = data.raffle;
  const socialPromotionPosts =
    socialPromotionData?.mySocialPromotionPosts || [];
  const canPromoteThisRaffle = isSellerOwner && raffle.estado === "ACTIVA";
  const canBuyThisRaffle = raffle.estado === "ACTIVA" && !isSellerOwner;
  const shouldShowCountdown = raffle.estado === "ACTIVA";
  const shouldShowWinningNumber =
    raffle.winningTicketNumber !== null &&
    raffle.winningTicketNumber !== undefined &&
    ["SORTEADA", "EN_ENTREGA", "FINALIZADA"].includes(raffle.estado);
  const shouldShowOwnRafflePurchaseNotice =
    raffle.estado === "ACTIVA" && isSellerOwner;
  const images = raffle.product?.imagenes || [];
  const soldTickets =
    raffle.tickets?.filter((t) => t.estado !== "REEMBOLSADO").length || 0;
  const progress = (soldTickets / raffle.totalTickets) * 100;
  const ticketAvailability = ticketAvailabilityData?.ticketNumberAvailability;
  const ticketAvailabilityItems = ticketAvailability?.items ?? [];
  const searchedTicket = ticketSearchData?.ticketNumberAvailability.items[0];
  const searchNumberOutOfRange = Boolean(searchNumberOutOfRangeForQuery);
  const availableNumbersOnPage =
    ticketAvailabilityItems.filter((item) => item.isAvailable).length;
  const shouldShowAvailabilityLoading =
    ticketAvailabilityLoading && ticketAvailabilityItems.length === 0;
  const selectedNumbersSorted = [...selectedNumbers].sort((a, b) => a - b);
  const selectedModePremiumPercent = ticketAvailability?.premiumPercent ?? 5;
  const premiumPerSelectedTicket = Number(
    (raffle.precioPorTicket * (selectedModePremiumPercent / 100)).toFixed(2),
  );
  const selectedModeGrossSubtotal = Number(
    (selectedNumbers.length * raffle.precioPorTicket).toFixed(2),
  );
  const selectedModePremiumAmount = Number(
    (premiumPerSelectedTicket * selectedNumbers.length).toFixed(2),
  );
  const selectedModeChargedBase =
    bonusPreview?.chargedAmount ?? selectedModeGrossSubtotal;
  const selectedModeTotalToCharge = Number(
    (selectedModeChargedBase + selectedModePremiumAmount).toFixed(2),
  );
  const maxSelectable =
    ticketAvailability?.maxSelectable ?? Math.floor(raffle.totalTickets * 0.5);
  const currentUserTicketCount = myTicketCountData?.myTicketCountInRaffle ?? 0;
  const availableRandomTickets = raffle.totalTickets - soldTickets;
  const remainingRandomPurchaseCapacity = Math.max(
    0,
    maxSelectable - currentUserTicketCount,
  );
  const randomPackEvaluation = evaluateSimpleRandomPack({
    requestedQuantity: quantity,
    availableTickets: availableRandomTickets,
    remainingAllowed: remainingRandomPurchaseCapacity,
  });
  const randomGrossSubtotal = Number(
    (randomPackEvaluation.grantedQuantity * raffle.precioPorTicket).toFixed(2),
  );
  const randomPackDiscount = Number(
    (randomPackEvaluation.bonusQuantity * raffle.precioPorTicket).toFixed(2),
  );
  const randomPromotionDiscount = randomPackEvaluation.packApplied
    ? 0
    : (bonusPreview?.discountApplied ?? 0);
  const randomDiscountApplied = Number(
    (randomPackDiscount + randomPromotionDiscount).toFixed(2),
  );
  const randomChargedSubtotal = randomPackEvaluation.packApplied
    ? Number((randomGrossSubtotal - randomPackDiscount).toFixed(2))
    : (bonusPreview?.chargedAmount ?? randomGrossSubtotal);
  const totalToCharge =
    purchaseMode === "CHOOSE_NUMBERS"
      ? selectedModeTotalToCharge
      : randomChargedSubtotal;
  const availableCredit = walletData?.myWallet.creditBalance ?? 0;
  const hasEnoughCredit = availableCredit >= totalToCharge;
  const projectedCreditBalance = Number(
    Math.max(0, availableCredit - totalToCharge).toFixed(2),
  );
  const shouldHidePromotionBonusForRandom =
    purchaseMode === "RANDOM" && randomPackEvaluation.packApplied;
  const randomPackNotice =
    randomPackEvaluation.packIneligibilityReason === "INSUFFICIENT_STOCK"
      ? "Quedan pocos tickets, el pack ya no aplica."
      : randomPackEvaluation.packIneligibilityReason === "BUYER_LIMIT"
        ? "El pack no aplica porque superarías el máximo permitido para esta rifa."
        : null;
  const randomPurchaseButtonLabel = !isAuthenticated
    ? "Iniciar sesión para comprar"
    : !hasEnoughCredit
      ? "Cargar Saldo LUK"
      : randomPackEvaluation.packApplied
        ? `Comprar ${randomPackEvaluation.baseQuantity} y recibir ${randomPackEvaluation.grantedQuantity}`
        : `Comprar ${quantity} Ticket${quantity > 1 ? "s" : ""}`;
  const selectedPurchaseButtonLabel = !isAuthenticated
    ? "Iniciar sesión para comprar"
    : !hasEnoughCredit
      ? "Cargar Saldo LUK"
      : "Comprar números elegidos";
  const buying = buyingRandom || buyingSelected;

  const handleBuy = () => {
    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }
    if (!hasEnoughCredit) {
      router.push("/dashboard/wallet");
      return;
    }
    buyTickets({
      variables: {
        raffleId: id,
        cantidad: quantity,
        bonusGrantId: shouldHidePromotionBonusForRandom
          ? null
          : selectedBonusGrantId,
        promotionToken,
      },
    });
  };

  const handlePurchaseModeChange = (value: string) => {
    const nextPurchaseMode = value as "RANDOM" | "CHOOSE_NUMBERS";
    if (nextPurchaseMode === purchaseMode) {
      return;
    }

    setPurchaseMode(nextPurchaseMode);
    resetSelectedNumberPurchaseState();
  };

  const adjustSearchNumber = (delta: number) => {
    if (!data?.raffle) {
      return;
    }

    const currentNumber = Number.parseInt(searchNumberInput, 10);
    const safeNumber = Number.isFinite(currentNumber) ? currentNumber : 1;
    const nextNumber = Math.min(
      data.raffle.totalTickets,
      Math.max(1, safeNumber + delta),
    );
    setSearchNumberInput(String(nextNumber));
  };

  const toggleSelectedNumber = (number: number, isAvailable: boolean) => {
    if (!isAvailable) {
      return;
    }

    let shouldClearPromotionBonus = false;
    setSelectedNumbers((currentNumbers) => {
      if (currentNumbers.includes(number)) {
        const nextNumbers = currentNumbers.filter(
          (currentNumber) => currentNumber !== number,
        );
        shouldClearPromotionBonus = nextNumbers.length === 0;
        return nextNumbers;
      }

      if (currentNumbers.length >= maxSelectable) {
        toast.error(`Podés elegir hasta ${maxSelectable} números en esta rifa`);
        return currentNumbers;
      }

      return [...currentNumbers, number];
    });

    if (shouldClearPromotionBonus) {
      clearPromotionBonusSelection();
    }
  };

  const handleBuySelectedNumbers = () => {
    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }

    if (selectedNumbersSorted.length === 0) {
      return;
    }
    if (!hasEnoughCredit) {
      router.push("/dashboard/wallet");
      return;
    }

    buySelectedTickets({
      variables: {
        raffleId: id,
        selectedNumbers: selectedNumbersSorted,
        bonusGrantId: selectedBonusGrantId,
        promotionToken,
      },
    });
  };

  return (
    <div className="container mx-auto px-4 pb-16 pt-6">
      <div className="mb-8 overflow-hidden rounded-[2.25rem] border border-border/80 bg-mesh px-5 py-6 shadow-panel sm:px-8 sm:py-7">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`badge-status ${getEstadoClass(raffle.estado)}`}>
            {raffle.estado}
          </span>
          {raffle.product?.categoria ? (
            <span className="rounded-full border border-border/80 bg-card/80 px-3 py-1.5 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              {raffle.product?.categoria}
            </span>
          ) : null}
        </div>
        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
          <div>
            <h1 className="font-display text-3xl leading-none text-balance sm:text-5xl lg:text-6xl">
              {raffle.titulo}
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground">
              {raffle.descripcion}
            </p>
          </div>
          <div className="rounded-[1.8rem] border border-border/80 bg-card/92 p-5 shadow-lift">
            <p className="editorial-kicker text-primary">Ticket</p>
            <p className="mt-3 font-display text-4xl leading-none text-primary sm:text-5xl">
              ${raffle.precioPorTicket}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">por ticket</p>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_420px] lg:items-start">
        <div className="contents lg:block lg:space-y-8">
          {/* Image Gallery */}
          <div className="order-1 space-y-4 lg:order-none">
            <div className="relative aspect-square overflow-hidden rounded-[2rem] border border-border/80 bg-muted shadow-panel lg:aspect-[4/3]">
              {images.length > 0 ? (
                <Image
                  src={getOptimizedImageUrl(
                    images[currentImageIndex],
                    CLOUDINARY_PRESETS.detail,
                  )}
                  alt={raffle.titulo}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover"
                  priority
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Ticket className="h-24 w-24 text-muted-foreground" />
                </div>
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-[oklch(0.14_0.02_260_/_0.38)] via-transparent to-transparent" />

              {images.length > 1 && (
                <>
                  <button
                    onClick={() =>
                      setCurrentImageIndex((i) =>
                        i > 0 ? i - 1 : images.length - 1,
                      )
                    }
                    className="absolute left-4 top-1/2 z-10 rounded-full border border-white/20 bg-card/90 p-2.5 text-foreground backdrop-blur-sm transition-colors hover:bg-card"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() =>
                      setCurrentImageIndex((i) =>
                        i < images.length - 1 ? i + 1 : 0,
                      )
                    }
                    className="absolute right-4 top-1/2 z-10 rounded-full border border-white/20 bg-card/90 p-2.5 text-foreground backdrop-blur-sm transition-colors hover:bg-card"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>

            {images.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-1">
                {images.map((img: string, i: number) => (
                  <button
                    key={i}
                    onClick={() => setCurrentImageIndex(i)}
                    className={`relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-[1.2rem] border-2 shadow-lift ${
                      i === currentImageIndex
                        ? "border-primary"
                        : "border-border/80"
                    }`}
                  >
                    <Image
                      src={getOptimizedImageUrl(
                        img,
                        CLOUDINARY_PRESETS.gallery,
                      )}
                      alt={`Imagen ${i + 1}`}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Description */}
          <div className="order-3 grid gap-8 md:grid-cols-2 lg:order-none">
            <Card>
              <CardHeader>
                <CardTitle>Descripcion</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{raffle.descripcion}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Detalles del Producto</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <span className="text-sm text-muted-foreground">
                    Producto
                  </span>
                  <p className="font-medium">{raffle.product?.nombre}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">
                    Condicion
                  </span>
                  <p className="font-medium">
                    {formatProductCondition(raffle.product?.condicion)}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">
                    Descripcion Detallada
                  </span>
                  <p className="text-sm whitespace-pre-wrap">
                    {raffle.product?.descripcionDetallada}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Q&A Section */}
          <div className="order-4 lg:order-none">
            <RaffleQA
              raffleId={raffle.id}
              sellerId={raffle.seller?.id || ""}
              isRaffleActive={raffle.estado === "ACTIVA"}
            />
          </div>
        </div>

        {/* Info */}
        <div className="order-2 space-y-5 lg:sticky lg:top-28 lg:order-none lg:self-start">
          {/* Seller */}
          <div className="flex flex-col items-start gap-4 rounded-[1.7rem] border border-border/80 bg-card/92 p-5 shadow-panel sm:flex-row sm:items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/12">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="editorial-kicker text-muted-foreground">Vendedor</p>
              <Link
                href={`/seller/${raffle.seller?.id}`}
                className="hover:underline"
              >
                <p className="mt-2 font-display text-2xl leading-none text-primary">
                  {raffle.seller?.nombre} {raffle.seller?.apellido}
                </p>
              </Link>
            </div>
          </div>

          {/* Progress */}
          <div className="space-y-3 rounded-[1.7rem] border border-border/80 bg-card/92 p-5 shadow-panel">
            <div className="flex justify-between text-sm">
              <span className="font-semibold">{soldTickets} vendidos</span>
              <span className="text-muted-foreground">
                {raffle.totalTickets} total
              </span>
            </div>
            <div className="progress-bar h-3">
              <div
                className="progress-fill bg-primary"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {progress.toFixed(0)}% completado
            </p>
          </div>

          {shouldShowCountdown ? (
            <div className="rounded-[1.7rem] border border-border/80 bg-card/92 p-5 shadow-panel">
              <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Tiempo restante:</span>
              </div>
              <Countdown
                targetDate={raffle.fechaLimiteSorteo}
                variant="detailed"
                showSeconds={true}
              />
            </div>
          ) : (
            <div className="space-y-3 rounded-[1.7rem] border border-border/80 bg-card/92 p-5 shadow-panel">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Estado de la rifa</span>
              </div>
              <p className="font-medium">{getNonActiveRaffleMessage(raffle)}</p>
              {shouldShowWinningNumber && (
                <div className="rounded-[1.35rem] border border-border/80 bg-background/72 p-4">
                  <p className="text-sm text-muted-foreground">
                    Número ganador
                  </p>
                  <p className="font-display text-5xl leading-none text-primary">
                    #{raffle.winningTicketNumber}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Price History Badge */}
          {priceHistoryData?.priceHistory &&
            priceHistoryData.priceHistory.length > 0 && (
              <div className="rounded-[1.7rem] border border-success/24 bg-success/10 p-4 shadow-panel">
                <div className="mb-2 flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-success" />
                  <span className="font-medium text-success">
                    Historial de precios
                  </span>
                </div>
                <div className="space-y-1 text-sm">
                  <p className="text-muted-foreground">
                    Precio original:{" "}
                    <span className="line-through">
                      ${priceHistoryData.priceHistory[0].previousPrice}
                    </span>
                  </p>
                  <p className="font-medium text-success">
                    Precio actual: ${raffle.precioPorTicket}{" "}
                    <span className="text-xs">
                      (-
                      {Math.round(
                        ((priceHistoryData.priceHistory[0].previousPrice -
                          raffle.precioPorTicket) /
                          priceHistoryData.priceHistory[0].previousPrice) *
                          100,
                      )}
                      %)
                    </span>
                  </p>
                  {priceHistoryData.priceHistory.length > 1 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground flex items-center gap-1">
                        <History className="h-3 w-3" />
                        Ver {priceHistoryData.priceHistory.length} cambios de
                        precio
                      </summary>
                      <ul className="mt-2 space-y-1 border-l-2 border-muted pl-4">
                        {priceHistoryData.priceHistory.map((entry) => (
                          <li
                            key={entry.id}
                            className="text-xs text-muted-foreground"
                          >
                            {new Date(entry.changedAt).toLocaleDateString(
                              "es-AR",
                            )}
                            : ${entry.previousPrice} → ${entry.newPrice}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              </div>
            )}

          {/* Buy Section */}
          {canBuyThisRaffle && (
            <Card className="border-primary/15">
              <CardHeader>
                <CardTitle className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span>Comprar Tickets</span>
                  <span className="text-2xl text-primary">
                    ${raffle.precioPorTicket}/ticket
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-[1.35rem] border border-primary/15 bg-primary/6 p-4 text-sm">
                  <p className="font-medium">Comprás con Saldo LUK</p>
                  <p className="mt-1 text-muted-foreground">
                    Mercado Pago sólo se usa para cargar saldo. Los tickets se
                    confirman dentro de LUK con tu saldo disponible.
                  </p>
                </div>

                {isAuthenticated ? (
                  <div className="rounded-[1.35rem] border border-border/80 bg-background/72 p-4 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">Saldo LUK disponible</span>
                      <span className="font-display text-2xl leading-none text-primary">
                        ${availableCredit.toFixed(2)}
                      </span>
                    </div>
                    {!hasEnoughCredit ? (
                      <p className="mt-2 text-muted-foreground">
                        Para esta compra te faltan $
                        {(totalToCharge - availableCredit).toFixed(2)}. Cargá
                        saldo antes de comprar; no se reservan tickets sin saldo
                        suficiente.
                      </p>
                    ) : (
                      <p className="mt-2 text-muted-foreground">
                        Después de comprar te quedarían $
                        {projectedCreditBalance.toFixed(2)}.
                      </p>
                    )}
                  </div>
                ) : null}

                <Tabs
                  value={purchaseMode}
                  onValueChange={handlePurchaseModeChange}
                  className="space-y-4"
                >
                  <TabsList className="grid h-auto w-full grid-cols-2">
                    <TabsTrigger value="RANDOM">Aleatorio</TabsTrigger>
                    <TabsTrigger value="CHOOSE_NUMBERS">
                      Elegir números
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="RANDOM" className="space-y-4">
                    <div className="rounded-[1.35rem] border border-primary/15 bg-primary/6 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-bold uppercase tracking-[0.14em] text-primary-foreground">
                          Pack simple
                        </span>
                      </div>
                      <div className="mt-3 space-y-1.5 text-sm">
                        <p className="font-medium text-foreground">
                          Si comprás 5 tickets, te regalamos 1 más.
                        </p>
                        <p className="font-medium text-foreground">
                          Si pagás 10 tickets, recibís 12 en total.
                        </p>
                        <p className="text-muted-foreground">
                          Los tickets extra los subsidia LUK. El vendedor cobra
                          por todos los tickets emitidos.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Cantidad</Label>
                      <div className="flex items-stretch gap-2">
                        <Button
                          variant="outline"
                          className="h-12 w-12 shrink-0 text-xl font-bold"
                          onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        >
                          -
                        </Button>
                        <Input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={quantity}
                          onChange={(e) =>
                            setQuantity(
                              Math.min(
                                raffle.totalTickets,
                                Math.max(
                                  1,
                                  parseInt(
                                    e.target.value.replace(/\D/g, ""),
                                    10,
                                  ) || 1,
                                ),
                              ),
                            )
                          }
                          className="h-12 min-w-0 flex-1 text-center text-lg font-semibold"
                        />
                        <Button
                          variant="outline"
                          className="h-12 w-12 shrink-0 text-xl font-bold"
                          onClick={() =>
                            setQuantity(
                              Math.min(raffle.totalTickets, quantity + 1),
                            )
                          }
                        >
                          +
                        </Button>
                      </div>
                    </div>

                    {randomPackEvaluation.packApplied ? (
                      <div className="rounded-[1.35rem] border border-success/25 bg-success/10 p-4 text-sm">
                        <p className="font-medium text-success">
                          Pack activo: pagás {randomPackEvaluation.baseQuantity}{" "}
                          y recibís {randomPackEvaluation.grantedQuantity}{" "}
                          tickets.
                        </p>
                        <p className="mt-1 text-muted-foreground">
                          Esta compra no se acumula con bonificaciones
                          promocionales.
                        </p>
                      </div>
                    ) : randomPackNotice ? (
                      <div className="rounded-[1.35rem] border border-amber-400/35 bg-amber-50 p-4 text-sm text-amber-950">
                        <p className="font-medium">{randomPackNotice}</p>
                      </div>
                    ) : null}

                    {!shouldHidePromotionBonusForRandom ? (
                      <PromotionBonusSelector
                        raffleId={id}
                        quantity={quantity}
                        sellerId={
                          user?.id !== raffle.seller?.id
                            ? raffle.seller?.id
                            : undefined
                        }
                        selectedBonusGrantId={selectedBonusGrantId}
                        onSelectedBonusGrantIdChange={setSelectedBonusGrantId}
                        onPreviewChange={setBonusPreview}
                      />
                    ) : null}

                    <div className="rounded-[1.35rem] bg-muted/50 p-4">
                      <div className="mb-2 flex justify-between">
                        <span>Tickets pagados</span>
                        <span>{randomPackEvaluation.baseQuantity}</span>
                      </div>
                      {randomPackEvaluation.bonusQuantity > 0 ? (
                        <>
                          <div className="mb-2 flex justify-between">
                            <span>Tickets bonus</span>
                            <span>+{randomPackEvaluation.bonusQuantity}</span>
                          </div>
                          <div className="mb-2 flex justify-between">
                            <span>Total de tickets</span>
                            <span>{randomPackEvaluation.grantedQuantity}</span>
                          </div>
                        </>
                      ) : null}
                      <div className="mb-2 flex justify-between">
                        <span>Subtotal bruto</span>
                        <span>${randomGrossSubtotal.toFixed(2)}</span>
                      </div>
                      {randomDiscountApplied > 0 && (
                        <div className="mb-2 flex justify-between text-success">
                          <span>Subsidio LUK</span>
                          <span>-${randomDiscountApplied.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-lg font-bold">
                        <span>Total a pagar</span>
                        <span className="text-primary">
                          ${totalToCharge.toFixed(2)}
                        </span>
                      </div>
                      {isAuthenticated ? (
                        <div className="mt-2 flex justify-between text-sm text-muted-foreground">
                          <span>Saldo luego de comprar</span>
                          <span>${projectedCreditBalance.toFixed(2)}</span>
                        </div>
                      ) : null}
                    </div>

                    <Button
                      className="w-full"
                      size="lg"
                      onClick={handleBuy}
                      disabled={buying}
                    >
                      {buying ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Procesando...
                        </>
                      ) : (
                        <>
                          <Ticket className="mr-2 h-4 w-4" />
                          {randomPurchaseButtonLabel}
                        </>
                      )}
                    </Button>
                  </TabsContent>

                  <TabsContent value="CHOOSE_NUMBERS" className="space-y-4">
                    <div className="space-y-1">
                      <h3 className="font-semibold">
                        Elegí tus números favoritos
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Pagás un {selectedModePremiumPercent}% extra por ticket
                        para reservar números específicos.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="ticket-number-search">
                        Buscar número exacto
                      </Label>
                      <div className="relative">
                        <Input
                          id="ticket-number-search"
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={searchNumberInput}
                          onChange={(e) =>
                            setSearchNumberInput(
                              e.target.value.replace(/\D/g, ""),
                            )
                          }
                          placeholder={`Entre 1 y ${raffle.totalTickets}`}
                          className="min-h-16 rounded-[1.6rem] border-primary/35 bg-background/80 pr-28 text-2xl tracking-[-0.03em] shadow-panel ring-1 ring-primary/15 placeholder:text-muted-foreground/70 focus-visible:ring-primary/30"
                        />
                        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-full border border-primary/20 bg-card/90 p-1 shadow-panel backdrop-blur">
                          <button
                            type="button"
                            aria-label="Disminuir número"
                            className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-40"
                            onClick={() => adjustSearchNumber(-1)}
                            disabled={
                              parsedSearchNumber === undefined ||
                              parsedSearchNumber <= 1
                            }
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            aria-label="Aumentar número"
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lift transition-transform hover:-translate-y-0.5 hover:bg-primary/92 disabled:opacity-40"
                            onClick={() => adjustSearchNumber(1)}
                            disabled={
                              parsedSearchNumber !== undefined &&
                              parsedSearchNumber >= raffle.totalTickets
                            }
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      {parsedSearchNumber !== undefined && (
                        <div className="rounded-lg border border-dashed p-3 text-sm">
                          {searchNumberOutOfRange ? (
                            <p className="text-muted-foreground">
                              Ese número está fuera del rango de esta rifa.
                            </p>
                          ) : ticketSearchLoading && !ticketSearchData ? (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>Buscando número...</span>
                            </div>
                          ) : ticketSearchError ? (
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <p className="text-muted-foreground">
                                No pudimos consultar ese número. Probá de nuevo.
                              </p>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => void refetchTicketSearch()}
                              >
                                Reintentar
                              </Button>
                            </div>
                          ) : searchedTicket ? (
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="font-medium">
                                  Resultado de búsqueda
                                </p>
                                <p className="text-muted-foreground">
                                  Número #{searchedTicket.number}
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant={
                                  selectedNumbers.includes(
                                    searchedTicket.number,
                                  )
                                    ? "default"
                                    : "outline"
                                }
                                disabled={!searchedTicket.isAvailable}
                                onClick={() =>
                                  toggleSelectedNumber(
                                    searchedTicket.number,
                                    searchedTicket.isAvailable,
                                  )
                                }
                              >
                                {searchedTicket.isAvailable
                                  ? selectedNumbers.includes(
                                      searchedTicket.number,
                                    )
                                    ? "Quitar"
                                    : "Agregar"
                                  : "Ocupado"}
                              </Button>
                            </div>
                          ) : (
                            <p className="text-muted-foreground">
                              No encontramos ese número. Si el mapa todavía está
                              cargando, esperá unos segundos y probá otra vez.
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="space-y-4 rounded-[1.35rem] border border-border/80 bg-background/60 p-4">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-medium">
                            Mapa de números disponibles
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Mostrando 100 números por página. Máximo{" "}
                            {maxSelectable} por compra.
                          </p>
                        </div>
                        {ticketAvailability && (
                          <p className="text-sm text-muted-foreground">
                            {availableNumbersOnPage} disponibles en esta página
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-3 w-3 rounded-full border border-primary/40 bg-card" />
                          Disponible
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-3 w-3 rounded-full bg-primary" />
                          Seleccionado
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-3 w-3 rounded-full border border-border bg-muted/50 opacity-45" />
                          Ocupado
                        </span>
                      </div>

                      <div className="grid min-h-16 grid-cols-5 gap-2 rounded-[1.2rem] border border-border/70 bg-card/45 p-3 sm:grid-cols-8 md:grid-cols-10">
                        {shouldShowAvailabilityLoading ? (
                          <div className="col-span-full flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Cargando mapa de números...</span>
                          </div>
                        ) : ticketAvailabilityError ? (
                          <div className="col-span-full flex flex-col gap-3 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                            <span>
                              No pudimos cargar la disponibilidad de números.
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => void refetchTicketAvailability()}
                            >
                              Reintentar
                            </Button>
                          </div>
                        ) : ticketAvailabilityItems.length === 0 ? (
                          <p className="col-span-full py-3 text-center text-sm text-muted-foreground">
                            Todavía no hay números para mostrar.
                          </p>
                        ) : (
                          ticketAvailabilityItems.map((item) => {
                            const isSelected = selectedNumbers.includes(
                              item.number,
                            );

                            return (
                              <button
                                key={item.number}
                                type="button"
                                aria-label={
                                  isSelected
                                    ? `Número ${item.number} seleccionado`
                                    : item.isAvailable
                                      ? `Número ${item.number} disponible`
                                      : `Número ${item.number} ocupado`
                                }
                                aria-pressed={isSelected}
                                title={
                                  item.isAvailable
                                    ? `Número ${item.number} disponible`
                                    : `Número ${item.number} ocupado`
                                }
                                className={
                                  isSelected
                                    ? "min-h-10 rounded-xl border border-primary bg-primary px-1 text-sm font-bold text-primary-foreground shadow-lift"
                                    : item.isAvailable
                                      ? "min-h-10 rounded-xl border border-border/80 bg-background/80 px-1 text-sm font-semibold text-foreground transition-colors hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
                                      : "min-h-10 cursor-not-allowed rounded-xl border border-border/45 bg-muted/35 px-1 text-sm font-semibold text-muted-foreground/45 opacity-55"
                                }
                                disabled={!item.isAvailable}
                                onClick={() =>
                                  toggleSelectedNumber(
                                    item.number,
                                    item.isAvailable,
                                  )
                                }
                              >
                                {item.number}
                              </button>
                            );
                          })
                        )}
                      </div>

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={
                            !ticketAvailability || availabilityPage <= 1
                          }
                          onClick={() =>
                            setAvailabilityPage((currentPage) =>
                              Math.max(1, currentPage - 1),
                            )
                          }
                        >
                          Anterior
                        </Button>
                        <p className="text-center text-sm text-muted-foreground">
                          Página {ticketAvailability?.page ?? availabilityPage}{" "}
                          de {ticketAvailability?.totalPages ?? 1}
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={
                            !ticketAvailability ||
                            availabilityPage >= ticketAvailability.totalPages
                          }
                          onClick={() =>
                            setAvailabilityPage(
                              (currentPage) => currentPage + 1,
                            )
                          }
                        >
                          Siguiente
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-3 rounded-[1.35rem] bg-muted/50 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-medium">
                            {selectedNumbers.length} número
                            {selectedNumbers.length === 1 ? "" : "s"}{" "}
                            seleccionado
                            {selectedNumbers.length === 1 ? "" : "s"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Elegí números concretos y reservalos al momento del
                            checkout.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={selectedNumbers.length === 0}
                          onClick={() => {
                            setSelectedNumbers([]);
                            clearPromotionBonusSelection();
                          }}
                        >
                          Limpiar
                        </Button>
                      </div>

                      {selectedNumbers.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {selectedNumbersSorted.map((number) => (
                            <Button
                              key={number}
                              type="button"
                              variant="secondary"
                              className="h-auto min-h-9"
                              onClick={() => toggleSelectedNumber(number, true)}
                            >
                              #{number}
                            </Button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Todavía no elegiste ningún número.
                        </p>
                      )}
                    </div>

                    {selectedNumbers.length > 0 && (
                      <PromotionBonusSelector
                        raffleId={id}
                        quantity={selectedNumbers.length}
                        sellerId={
                          user?.id !== raffle.seller?.id
                            ? raffle.seller?.id
                            : undefined
                        }
                        selectedBonusGrantId={selectedBonusGrantId}
                        onSelectedBonusGrantIdChange={setSelectedBonusGrantId}
                        onPreviewChange={setBonusPreview}
                      />
                    )}

                    <div className="rounded-[1.35rem] bg-muted/50 p-4">
                      <div className="mb-2 flex justify-between">
                        <span>Subtotal base</span>
                        <span>${selectedModeGrossSubtotal.toFixed(2)}</span>
                      </div>
                      {bonusPreview && (
                        <div className="mb-2 flex justify-between text-success">
                          <span>Bonificación aplicada</span>
                          <span>
                            -${bonusPreview.discountApplied.toFixed(2)}
                          </span>
                        </div>
                      )}
                      <div className="mb-2 flex justify-between">
                        <span>Premium por elegir números</span>
                        <span>${selectedModePremiumAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-lg font-bold">
                        <span>Total</span>
                        <span className="text-primary">
                          ${selectedModeTotalToCharge.toFixed(2)}
                        </span>
                      </div>
                      {isAuthenticated ? (
                        <div className="mt-2 flex justify-between text-sm text-muted-foreground">
                          <span>Saldo luego de comprar</span>
                          <span>${projectedCreditBalance.toFixed(2)}</span>
                        </div>
                      ) : null}
                    </div>

                    <Button
                      className="w-full"
                      size="lg"
                      onClick={handleBuySelectedNumbers}
                      disabled={buying || selectedNumbers.length === 0}
                    >
                      {buying ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Procesando...
                        </>
                      ) : (
                        <>
                          <Ticket className="mr-2 h-4 w-4" />
                          {selectedPurchaseButtonLabel}
                        </>
                      )}
                    </Button>
                  </TabsContent>
                </Tabs>

                <ComplianceNotice
                  title="Antes de comprar tickets"
                  tone="subtle"
                />
              </CardContent>
            </Card>
          )}

          {shouldShowOwnRafflePurchaseNotice && (
            <Card>
              <CardHeader>
                <CardTitle>
                  No podés comprar tickets de tu propia rifa
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-3 rounded-[1.35rem] border border-secondary/35 bg-secondary/14 p-4 text-sm text-foreground dark:border-secondary/28 dark:bg-secondary/12 dark:text-foreground">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                  <p>
                    La compra está bloqueada para evitar autocompras. Podés
                    compartirla o promocionarla para atraer participantes.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions: Favorite & Share */}
          <div
            className={`grid gap-3 ${
              canPromoteThisRaffle
                ? "sm:grid-cols-2 xl:grid-cols-3"
                : "sm:grid-cols-2"
            }`}
          >
            <Button
              variant="outline"
              className="w-full h-auto min-h-9 whitespace-normal px-3 py-2 text-center leading-snug"
              onClick={handleFavoriteClick}
              disabled={isTogglingFavorite}
            >
              <Heart
                className={`mr-2 h-4 w-4 transition-all ${
                  isFavorite ? "fill-destructive text-destructive" : ""
                } ${isTogglingFavorite ? "opacity-50" : ""}`}
              />
              {isFavorite ? "En Favoritos" : "Agregar a Favoritos"}
            </Button>
            <ShareButtons
              url={typeof window !== "undefined" ? window.location.href : ""}
              title={raffle.titulo}
              label={canPromoteThisRaffle ? "Compartir rápido" : "Compartir"}
              className="w-full"
            />
            {canPromoteThisRaffle && (
              <div className="w-full sm:col-span-2 xl:col-span-1">
                <SocialPromotionManager
                  raffleId={raffle.id}
                  raffleTitle={raffle.titulo}
                  raffleImages={raffle.product?.imagenes || []}
                  ticketPrice={raffle.precioPorTicket}
                  posts={socialPromotionPosts}
                  showHelperText={false}
                  showSummary={false}
                  onChanged={async () => {
                    await refetchSocialPromotionPosts();
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
