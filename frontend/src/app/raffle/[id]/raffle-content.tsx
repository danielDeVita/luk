'use client';

import { useState, useEffect, useMemo, useDeferredValue } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client/core';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Ticket, User, Clock, AlertTriangle, Loader2, ChevronLeft, ChevronRight, Heart, TrendingDown, History } from 'lucide-react';
import { ShareButtons } from '@/components/share/share-buttons';
import { Countdown } from '@/components/ui/countdown';
import Link from 'next/link';
import Image from 'next/image';
import { toast } from 'sonner';
import { RaffleDetailSkeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { IS_FAVORITE } from '@/lib/graphql/queries';
import { ADD_FAVORITE, REMOVE_FAVORITE } from '@/lib/graphql/mutations';
import { getOptimizedImageUrl, CLOUDINARY_PRESETS } from '@/lib/cloudinary';
import { formatProductCondition } from '@/lib/format-condition';
import { RaffleQA } from './raffle-qa';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import { ComplianceNotice } from '@/components/legal/compliance-notice';
import { PromotionBonusSelector } from '@/components/social-promotions/promotion-bonus-selector';
import { SocialPromotionManager } from '@/components/social-promotions/social-promotion-manager';
import {
  getStoredSocialPromotionToken,
  persistSocialPromotionToken,
} from '@/lib/social-promotions';



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
  mutation BuyTickets($raffleId: String!, $cantidad: Int!, $bonusGrantId: String, $promotionToken: String) {
    buyTickets(
      raffleId: $raffleId
      cantidad: $cantidad
      bonusGrantId: $bonusGrantId
      promotionToken: $promotionToken
    ) {
      initPoint
      preferenceId
      totalAmount
      grossSubtotal
      discountApplied
      mpChargeAmount
      bonusGrantId
      cantidadComprada
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
      initPoint
      preferenceId
      totalAmount
      grossSubtotal
      discountApplied
      mpChargeAmount
      bonusGrantId
      cantidadComprada
      purchaseMode
      selectionPremiumPercent
      selectionPremiumAmount
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
    initPoint: string;
    preferenceId: string;
    totalAmount: number;
    grossSubtotal: number;
    discountApplied: number;
    mpChargeAmount: number;
    bonusGrantId?: string;
    cantidadComprada: number;
  };
}

interface BuySelectedTicketsResult {
  buySelectedTickets: {
    initPoint: string;
    preferenceId: string;
    totalAmount: number;
    grossSubtotal: number;
    discountApplied: number;
    mpChargeAmount: number;
    bonusGrantId?: string;
    cantidadComprada: number;
    purchaseMode: 'CHOOSE_NUMBERS';
    selectionPremiumPercent: number;
    selectionPremiumAmount: number;
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
  mpChargeAmount: number;
}

function getNonActiveRaffleMessage(raffle: RaffleData): string {
  switch (raffle.estado) {
    case 'COMPLETADA':
      return 'Todos los números se agotaron. El sorteo se está procesando.';
    case 'SORTEADA':
      return 'La rifa ya fue sorteada.';
    case 'EN_ENTREGA':
      return 'La rifa ya fue sorteada y el premio está en entrega.';
    case 'FINALIZADA':
      return 'La rifa finalizó y el premio ya fue entregado.';
    case 'CANCELADA':
      return 'Esta rifa fue cancelada.';
    default:
      return 'Esta rifa ya no está disponible para comprar.';
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
  const [purchaseMode, setPurchaseMode] = useState<'RANDOM' | 'CHOOSE_NUMBERS'>('RANDOM');
  const [quantity, setQuantity] = useState(1);
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [availabilityPage, setAvailabilityPage] = useState(1);
  const [searchNumberInput, setSearchNumberInput] = useState('');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [selectedBonusGrantId, setSelectedBonusGrantId] = useState<string | null>(null);
  const [bonusPreview, setBonusPreview] = useState<PromotionBonusPreview | null>(null);
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
    setSearchNumberInput('');
  };

  const { data, loading, error } = useQuery<RaffleResult>(GET_RAFFLE, {
    variables: { id },
  });
  const isSellerOwner = Boolean(
    isAuthenticated &&
      data?.raffle?.seller?.id &&
      user?.id === data.raffle.seller.id,
  );

  // Query price history
  const { data: priceHistoryData } = useQuery<PriceHistoryResult>(GET_PRICE_HISTORY, {
    variables: { raffleId: id },
  });

  const {
    data: socialPromotionData,
    refetch: refetchSocialPromotionPosts,
  } = useQuery<{
    mySocialPromotionPosts: SocialPromotionPostSummary[];
  }>(MY_SOCIAL_PROMOTION_POSTS, {
    variables: { raffleId: id },
    skip: !isSellerOwner,
  });

  // Query favorite status
  const { data: favoriteData } = useQuery<{ isFavorite: boolean }>(IS_FAVORITE, {
    variables: { raffleId: id },
    skip: !isAuthenticated,
  });

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

  const {
    data: ticketAvailabilityData,
    refetch: refetchTicketAvailability,
  } = useQuery<TicketNumberAvailabilityResult>(TICKET_NUMBER_AVAILABILITY, {
    variables: {
      raffleId: id,
      page: availabilityPage,
      pageSize: 100,
    },
    skip: purchaseMode !== 'CHOOSE_NUMBERS' || !data?.raffle,
  });

  const {
    data: ticketSearchData,
    refetch: refetchTicketSearch,
  } = useQuery<TicketNumberAvailabilityResult>(TICKET_NUMBER_AVAILABILITY, {
    variables: {
      raffleId: id,
      page: 1,
      pageSize: 100,
      searchNumber: parsedSearchNumber,
    },
    skip:
      purchaseMode !== 'CHOOSE_NUMBERS' ||
      !data?.raffle ||
      parsedSearchNumber === undefined,
  });

  const handlePurchaseMutationError = (message: string) => {
    toast.error(message);

    if (!message.includes('ya no están disponibles')) {
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
      setSearchNumberInput('');
    }

    void refetchTicketAvailability();
    if (parsedSearchNumber !== undefined) {
      void refetchTicketSearch();
    }
  };

  const [buyTickets, { data: buyData, loading: buyingRandom }] =
    useMutation<BuyTicketsResult>(BUY_TICKETS, {
      onError: (mutationError) => {
        handlePurchaseMutationError(mutationError.message);
      },
    });
  const [
    buySelectedTickets,
    {
      data: buySelectedData,
      loading: buyingSelected,
    },
  ] = useMutation<BuySelectedTicketsResult>(BUY_SELECTED_TICKETS, {
    onError: (mutationError) => {
      handlePurchaseMutationError(mutationError.message);
    },
  });
  const [incrementViews] = useMutation(INCREMENT_VIEWS);

  // Favorite mutations
  const [addFavorite, { loading: addingFavorite }] = useMutation(ADD_FAVORITE, {
    onError: () => {
      setIsFavorite(false);
      toast.error('Error al agregar a favoritos');
    },
  });

  const [removeFavorite, { loading: removingFavorite }] = useMutation(REMOVE_FAVORITE, {
    onError: () => {
      setIsFavorite(true);
      toast.error('Error al quitar de favoritos');
    },
  });

  const isTogglingFavorite = addingFavorite || removingFavorite;

  const handleFavoriteClick = async () => {
    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    if (isFavorite) {
      const confirmed = await confirm({
        title: '¿Quitar de favoritos?',
        description: `¿Estás seguro que querés quitar "${raffle.titulo}" de tu lista de favoritos?`,
        confirmText: 'Quitar',
        cancelText: 'Cancelar',
        variant: 'destructive',
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
      sessionStorage.setItem(viewedKey, 'true');
    }
  }, [id, incrementViews]);

  useEffect(() => {
    const promoFromUrl = searchParams.get('promo');
    if (promoFromUrl) {
      persistSocialPromotionToken(promoFromUrl, id);
    }
  }, [id, searchParams]);

  const promotionToken = useMemo(() => {
    const promoFromUrl = searchParams.get('promo');
    if (promoFromUrl) {
      return promoFromUrl;
    }

    return getStoredSocialPromotionToken(id);
  }, [id, searchParams]);

  const checkoutRedirectUrl =
    buyData?.buyTickets?.initPoint ??
    buySelectedData?.buySelectedTickets?.initPoint;

  useEffect(() => {
    if (checkoutRedirectUrl) {
      window.location.href = checkoutRedirectUrl;
    }
  }, [checkoutRedirectUrl]);

  if (loading) {
    return <RaffleDetailSkeleton />;
  }

  if (error || !data?.raffle) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-20">
          <AlertTriangle className="h-16 w-16 mx-auto mb-4 text-destructive" />
          <h1 className="text-2xl font-bold mb-2">Rifa no encontrada</h1>
          <Link href="/search">
            <Button>Volver a rifas</Button>
          </Link>
        </div>
      </div>
    );
  }

  const raffle = data.raffle;
  const socialPromotionPosts = socialPromotionData?.mySocialPromotionPosts || [];
  const canPromoteThisRaffle = isSellerOwner && raffle.estado === 'ACTIVA';
  const canBuyThisRaffle = raffle.estado === 'ACTIVA' && !isSellerOwner;
  const shouldShowCountdown = raffle.estado === 'ACTIVA';
  const shouldShowWinningNumber =
    raffle.winningTicketNumber !== null &&
    raffle.winningTicketNumber !== undefined &&
    ['SORTEADA', 'EN_ENTREGA', 'FINALIZADA'].includes(raffle.estado);
  const shouldShowOwnRafflePurchaseNotice =
    raffle.estado === 'ACTIVA' && isSellerOwner;
  const images = raffle.product?.imagenes || [];
  const soldTickets = raffle.tickets?.filter((t) => t.estado !== 'REEMBOLSADO').length || 0;
  const progress = (soldTickets / raffle.totalTickets) * 100;
  const grossSubtotal = Number((quantity * raffle.precioPorTicket).toFixed(2));
  const ticketAvailability = ticketAvailabilityData?.ticketNumberAvailability;
  const searchedTicket = ticketSearchData?.ticketNumberAvailability.items[0];
  const selectedNumbersSorted = [...selectedNumbers].sort((a, b) => a - b);
  const selectedModePremiumPercent = ticketAvailability?.premiumPercent ?? 5;
  const premiumPerSelectedTicket = Number(
    (
      raffle.precioPorTicket *
      (selectedModePremiumPercent / 100)
    ).toFixed(2),
  );
  const selectedModeGrossSubtotal = Number(
    (selectedNumbers.length * raffle.precioPorTicket).toFixed(2),
  );
  const selectedModePremiumAmount = Number(
    (premiumPerSelectedTicket * selectedNumbers.length).toFixed(2),
  );
  const selectedModeChargedBase =
    bonusPreview?.mpChargeAmount ?? selectedModeGrossSubtotal;
  const selectedModeTotalToCharge = Number(
    (selectedModeChargedBase + selectedModePremiumAmount).toFixed(2),
  );
  const totalToCharge =
    purchaseMode === 'CHOOSE_NUMBERS'
      ? selectedModeTotalToCharge
      : bonusPreview?.mpChargeAmount ?? grossSubtotal;
  const maxSelectable =
    ticketAvailability?.maxSelectable ?? Math.floor(raffle.totalTickets * 0.5);
  const buying = buyingRandom || buyingSelected;

  const handleBuy = () => {
    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }
    buyTickets({
      variables: {
        raffleId: id,
        cantidad: quantity,
        bonusGrantId: selectedBonusGrantId,
        promotionToken,
      },
    });
  };

  const handlePurchaseModeChange = (value: string) => {
    const nextPurchaseMode = value as 'RANDOM' | 'CHOOSE_NUMBERS';
    if (nextPurchaseMode === purchaseMode) {
      return;
    }

    setPurchaseMode(nextPurchaseMode);
    resetSelectedNumberPurchaseState();
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
      router.push('/auth/login');
      return;
    }

    if (selectedNumbersSorted.length === 0) {
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
    <div className="container mx-auto px-4 py-8">
      <div className="grid md:grid-cols-2 gap-8">
        {/* Image Gallery */}
        <div className="space-y-4">
          <div className="relative aspect-square rounded-lg overflow-hidden bg-muted">
            {images.length > 0 ? (
              <Image
                src={getOptimizedImageUrl(images[currentImageIndex], CLOUDINARY_PRESETS.detail)}
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

            {images.length > 1 && (
              <>
                <button
                  onClick={() => setCurrentImageIndex((i) => (i > 0 ? i - 1 : images.length - 1))}
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 z-10"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setCurrentImageIndex((i) => (i < images.length - 1 ? i + 1 : 0))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 z-10"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}
          </div>

          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {images.map((img: string, i: number) => (
                <button
                  key={i}
                  onClick={() => setCurrentImageIndex(i)}
                  className={`relative flex-shrink-0 w-20 h-20 rounded-md overflow-hidden border-2 ${
                    i === currentImageIndex ? 'border-primary' : 'border-transparent'
                  }`}
                >
                  <Image
                    src={getOptimizedImageUrl(img, CLOUDINARY_PRESETS.gallery)}
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

        {/* Info */}
        <div className="space-y-6">
          <div>
            <span className={`inline-block px-3 py-1 text-sm rounded-full mb-2 ${
              raffle.estado === 'ACTIVA' ? 'bg-green-500/20 text-green-600' : 'bg-muted text-muted-foreground'
            }`}>
              {raffle.estado}
            </span>
            <h1 className="text-3xl font-bold mb-2">{raffle.titulo}</h1>
            <p className="text-muted-foreground">{raffle.product?.categoria}</p>
          </div>

          {/* Seller */}
          <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <Link href={`/seller/${raffle.seller?.id}`} className="hover:underline">
                <p className="font-medium text-primary">{raffle.seller?.nombre} {raffle.seller?.apellido}</p>
              </Link>
              <p className="text-sm text-muted-foreground">Vendedor</p>
            </div>
          </div>

          {/* Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{soldTickets} vendidos</span>
              <span>{raffle.totalTickets} total</span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm text-muted-foreground">{progress.toFixed(0)}% completado</p>
          </div>

          {shouldShowCountdown ? (
            <div className="p-4 rounded-lg bg-muted/50 border">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
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
            <div className="space-y-3 rounded-lg border bg-muted/50 p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Estado de la rifa</span>
              </div>
              <p className="font-medium">{getNonActiveRaffleMessage(raffle)}</p>
              {shouldShowWinningNumber && (
                <div className="rounded-lg border bg-background p-4">
                  <p className="text-sm text-muted-foreground">Número ganador</p>
                  <p className="text-3xl font-bold text-primary">
                    #{raffle.winningTicketNumber}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Price History Badge */}
          {priceHistoryData?.priceHistory && priceHistoryData.priceHistory.length > 0 && (
            <div className="p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="h-4 w-4 text-green-600" />
                <span className="font-medium text-green-700 dark:text-green-400">Historial de precios</span>
              </div>
              <div className="space-y-1 text-sm">
                <p className="text-muted-foreground">
                  Precio original: <span className="line-through">${priceHistoryData.priceHistory[0].previousPrice}</span>
                </p>
                <p className="text-green-600 dark:text-green-400 font-medium">
                  Precio actual: ${raffle.precioPorTicket}
                  {' '}
                  <span className="text-xs">
                    (-{Math.round(((priceHistoryData.priceHistory[0].previousPrice - raffle.precioPorTicket) / priceHistoryData.priceHistory[0].previousPrice) * 100)}%)
                  </span>
                </p>
                {priceHistoryData.priceHistory.length > 1 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground flex items-center gap-1">
                      <History className="h-3 w-3" />
                      Ver {priceHistoryData.priceHistory.length} cambios de precio
                    </summary>
                    <ul className="mt-2 space-y-1 pl-4 border-l-2 border-muted">
                      {priceHistoryData.priceHistory.map((entry) => (
                        <li key={entry.id} className="text-xs text-muted-foreground">
                          {new Date(entry.changedAt).toLocaleDateString('es-AR')}: ${entry.previousPrice} → ${entry.newPrice}
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Comprar Tickets</span>
                  <span className="text-2xl text-primary">${raffle.precioPorTicket}/ticket</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Tabs
                  value={purchaseMode}
                  onValueChange={handlePurchaseModeChange}
                  className="space-y-4"
                >
                  <TabsList className="grid h-auto w-full grid-cols-2">
                    <TabsTrigger value="RANDOM">Aleatorio</TabsTrigger>
                    <TabsTrigger value="CHOOSE_NUMBERS">Elegir números</TabsTrigger>
                  </TabsList>

                  <TabsContent value="RANDOM" className="space-y-4">
                    <div className="space-y-2">
                      <Label>Cantidad</Label>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="h-12 w-12 text-xl font-bold"
                          onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        >
                          -
                        </Button>
                        <Input
                          type="number"
                          min={1}
                          value={quantity}
                          onChange={(e) =>
                            setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))
                          }
                          className="h-12 text-center text-lg font-semibold"
                        />
                        <Button
                          variant="outline"
                          className="h-12 w-12 text-xl font-bold"
                          onClick={() => setQuantity(quantity + 1)}
                        >
                          +
                        </Button>
                      </div>
                    </div>

                    <PromotionBonusSelector
                      raffleId={id}
                      quantity={quantity}
                      sellerId={user?.id !== raffle.seller?.id ? raffle.seller?.id : undefined}
                      selectedBonusGrantId={selectedBonusGrantId}
                      onSelectedBonusGrantIdChange={setSelectedBonusGrantId}
                      onPreviewChange={setBonusPreview}
                    />

                    <div className="rounded-lg bg-muted/50 p-4">
                      <div className="mb-2 flex justify-between">
                        <span>Subtotal</span>
                        <span>${grossSubtotal.toFixed(2)}</span>
                      </div>
                      {bonusPreview && (
                        <div className="mb-2 flex justify-between text-green-600">
                          <span>Bonificación aplicada</span>
                          <span>-${bonusPreview.discountApplied.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-lg font-bold">
                        <span>Total</span>
                        <span className="text-primary">${totalToCharge.toFixed(2)}</span>
                      </div>
                    </div>

                    <Button className="w-full" size="lg" onClick={handleBuy} disabled={buying}>
                      {buying ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Procesando...
                        </>
                      ) : (
                        <>
                          <Ticket className="mr-2 h-4 w-4" />
                          Comprar {quantity} Ticket{quantity > 1 ? 's' : ''}
                        </>
                      )}
                    </Button>
                  </TabsContent>

                  <TabsContent value="CHOOSE_NUMBERS" className="space-y-4">
                    <div className="space-y-1">
                      <h3 className="font-semibold">Elegí tus números favoritos</h3>
                      <p className="text-sm text-muted-foreground">
                        Pagás un {selectedModePremiumPercent}% extra por ticket para reservar
                        números específicos.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="ticket-number-search">Buscar número exacto</Label>
                      <Input
                        id="ticket-number-search"
                        type="number"
                        min={1}
                        max={raffle.totalTickets}
                        value={searchNumberInput}
                        onChange={(e) => setSearchNumberInput(e.target.value)}
                        placeholder={`Entre 1 y ${raffle.totalTickets}`}
                      />
                      {parsedSearchNumber !== undefined && (
                        <div className="rounded-lg border border-dashed p-3 text-sm">
                          {searchedTicket ? (
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="font-medium">Resultado de búsqueda</p>
                                <p className="text-muted-foreground">
                                  Número #{searchedTicket.number}
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant={
                                  selectedNumbers.includes(searchedTicket.number)
                                    ? 'default'
                                    : 'outline'
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
                                  ? selectedNumbers.includes(searchedTicket.number)
                                    ? 'Quitar'
                                    : 'Agregar'
                                  : 'Ocupado'}
                              </Button>
                            </div>
                          ) : (
                            <p className="text-muted-foreground">
                              Ese número no existe en esta rifa.
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 rounded-lg border p-4">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-medium">Disponibilidad por página</p>
                          <p className="text-sm text-muted-foreground">
                            Mostrando 100 números por página. Máximo {maxSelectable} por compra.
                          </p>
                        </div>
                        {ticketAvailability && (
                          <p className="text-sm text-muted-foreground">
                            {ticketAvailability.availableCount} disponibles de{' '}
                            {ticketAvailability.totalTickets}
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6">
                        {ticketAvailability?.items.map((item) => {
                          const isSelected = selectedNumbers.includes(item.number);

                          return (
                            <Button
                              key={item.number}
                              type="button"
                              variant={isSelected ? 'default' : 'outline'}
                              className="h-11"
                              disabled={!item.isAvailable}
                              onClick={() =>
                                toggleSelectedNumber(item.number, item.isAvailable)
                              }
                            >
                              #{item.number}
                            </Button>
                          );
                        })}
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={!ticketAvailability || availabilityPage <= 1}
                          onClick={() =>
                            setAvailabilityPage((currentPage) =>
                              Math.max(1, currentPage - 1),
                            )
                          }
                        >
                          Anterior
                        </Button>
                        <p className="text-sm text-muted-foreground">
                          Página {ticketAvailability?.page ?? availabilityPage} de{' '}
                          {ticketAvailability?.totalPages ?? 1}
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={
                            !ticketAvailability ||
                            availabilityPage >= ticketAvailability.totalPages
                          }
                          onClick={() =>
                            setAvailabilityPage((currentPage) => currentPage + 1)
                          }
                        >
                          Siguiente
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-3 rounded-lg bg-muted/50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">
                            {selectedNumbers.length} número
                            {selectedNumbers.length === 1 ? '' : 's'} seleccionado
                            {selectedNumbers.length === 1 ? '' : 's'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Elegí números concretos y reservalos al momento del checkout.
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
                              className="h-9"
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
                          user?.id !== raffle.seller?.id ? raffle.seller?.id : undefined
                        }
                        selectedBonusGrantId={selectedBonusGrantId}
                        onSelectedBonusGrantIdChange={setSelectedBonusGrantId}
                        onPreviewChange={setBonusPreview}
                      />
                    )}

                    <div className="rounded-lg bg-muted/50 p-4">
                      <div className="mb-2 flex justify-between">
                        <span>Subtotal base</span>
                        <span>${selectedModeGrossSubtotal.toFixed(2)}</span>
                      </div>
                      {bonusPreview && (
                        <div className="mb-2 flex justify-between text-green-600">
                          <span>Bonificación aplicada</span>
                          <span>-${bonusPreview.discountApplied.toFixed(2)}</span>
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
                          Comprar números elegidos
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
                <CardTitle>No podés comprar tickets de tu propia rifa</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                  <p>
                    La compra está bloqueada para evitar autocompras. Podés compartirla o
                    promocionarla para atraer participantes.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions: Favorite & Share */}
          <div
            className={`grid gap-3 ${
              canPromoteThisRaffle ? 'sm:grid-cols-2 xl:grid-cols-3' : 'sm:grid-cols-2'
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
                  isFavorite ? 'fill-destructive text-destructive' : ''
                } ${isTogglingFavorite ? 'opacity-50' : ''}`}
              />
              {isFavorite ? 'En Favoritos' : 'Agregar a Favoritos'}
            </Button>
            <ShareButtons
              url={typeof window !== 'undefined' ? window.location.href : ''}
              title={raffle.titulo}
              label={canPromoteThisRaffle ? 'Compartir rápido' : 'Compartir'}
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

      {/* Description */}
      <div className="mt-12 grid md:grid-cols-2 gap-8">
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
              <span className="text-sm text-muted-foreground">Producto</span>
              <p className="font-medium">{raffle.product?.nombre}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Condicion</span>
              <p className="font-medium">{formatProductCondition(raffle.product?.condicion)}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Descripcion Detallada</span>
              <p className="text-sm whitespace-pre-wrap">{raffle.product?.descripcionDetallada}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Q&A Section */}
      <div className="mt-8">
        <RaffleQA
          raffleId={raffle.id}
          sellerId={raffle.seller?.id || ''}
          isRaffleActive={raffle.estado === 'ACTIVA'}
        />
      </div>
    </div>
  );
}
