'use client';

import { useState, useEffect, useMemo } from 'react';
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

interface PromotionBonusPreview {
  bonusGrantId: string;
  grossSubtotal: number;
  discountApplied: number;
  mpChargeAmount: number;
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
  const [quantity, setQuantity] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [selectedBonusGrantId, setSelectedBonusGrantId] = useState<string | null>(null);
  const [bonusPreview, setBonusPreview] = useState<PromotionBonusPreview | null>(null);
  const confirm = useConfirmDialog();


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

  const [buyTickets, { data: buyData, loading: buying, error: buyError }] = useMutation<BuyTicketsResult>(BUY_TICKETS);
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

  // Handle buy success - redirect to Mercado Pago checkout
  useEffect(() => {
    if (buyData?.buyTickets?.initPoint) {
      // Redirect to Mercado Pago hosted checkout page
      window.location.href = buyData.buyTickets.initPoint;
    }
  }, [buyData]);

  // Handle buy error
  useEffect(() => {
    if (buyError) {
      toast.error(buyError.message);
    }
  }, [buyError]);

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
  const shouldShowOwnRafflePurchaseNotice =
    raffle.estado === 'ACTIVA' && isSellerOwner;
  const images = raffle.product?.imagenes || [];
  const soldTickets = raffle.tickets?.filter((t) => t.estado !== 'REEMBOLSADO').length || 0;
  const progress = (soldTickets / raffle.totalTickets) * 100;
  const grossSubtotal = Number((quantity * raffle.precioPorTicket).toFixed(2));
  const totalToCharge = bonusPreview?.mpChargeAmount ?? grossSubtotal;

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

          {/* Timer - Real-time countdown */}
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
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="text-center h-12 text-lg font-semibold"
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

                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex justify-between mb-2">
                    <span>Subtotal</span>
                    <span>${grossSubtotal.toFixed(2)}</span>
                  </div>
                  {bonusPreview && (
                    <div className="flex justify-between mb-2 text-green-600">
                      <span>Bonificación aplicada</span>
                      <span>-${bonusPreview.discountApplied.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg">
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
