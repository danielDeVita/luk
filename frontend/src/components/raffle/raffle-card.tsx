'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@apollo/client/react';
import { Clock, Users, Heart, Sparkles, TrendingDown } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { IS_FAVORITE } from '@/lib/graphql/queries';
import { ADD_FAVORITE, REMOVE_FAVORITE } from '@/lib/graphql/mutations';
import { Countdown } from '@/components/ui/countdown';
import { getOptimizedImageUrl, CLOUDINARY_PRESETS } from '@/lib/cloudinary';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';

interface RaffleCardProps {
  raffle: {
    id: string;
    titulo: string;
    precioPorTicket: number;
    totalTickets: number;
    ticketsVendidos: number;
    fechaLimiteSorteo: string;
    estado: string;
    lastPriceDropAt?: string;
    product?: {
      nombre: string;
      imagenes: string[];
      condicion: string;
    };
    seller?: {
      nombre: string;
      apellido: string;
    };
  };
}

export function RaffleCard({ raffle }: RaffleCardProps) {
  const progress = (raffle.ticketsVendidos / raffle.totalTickets) * 100;
  const rawImageUrl = raffle.product?.imagenes?.[0];
  const imageUrl = getOptimizedImageUrl(rawImageUrl, CLOUDINARY_PRESETS.card) || '/placeholder.jpg';
  const isHot = progress >= 75;
  const isAlmostDone = progress >= 90;

  const { isAuthenticated } = useAuthStore();
  const [isFavorite, setIsFavorite] = useState(false);
  const [hasRecentPriceDrop, setHasRecentPriceDrop] = useState(false);
  const confirm = useConfirmDialog();


  // Check if price was recently reduced (within last 48 hours)
  useEffect(() => {
    if (raffle.lastPriceDropAt) {
      const dropTime = new Date(raffle.lastPriceDropAt).getTime();
      const now = Date.now();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHasRecentPriceDrop((now - dropTime) < 48 * 60 * 60 * 1000);
    }
  }, [raffle.lastPriceDropAt]);

  // Query favorite status
  const { data: favoriteData } = useQuery<{ isFavorite: boolean }>(IS_FAVORITE, {
    variables: { raffleId: raffle.id },
    skip: !isAuthenticated,
  });

  useEffect(() => {
    if (favoriteData?.isFavorite !== undefined) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsFavorite(favoriteData.isFavorite);
    }
  }, [favoriteData]);

  // Mutations with optimistic updates
  const [addFavorite, { loading: addingFavorite }] = useMutation(ADD_FAVORITE, {
    onError: () => {
      setIsFavorite(false);
    },
  });

  const [removeFavorite, { loading: removingFavorite }] = useMutation(REMOVE_FAVORITE, {
    onError: () => {
      setIsFavorite(true);
    },
  });

  const handleFavoriteClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) return;

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
        removeFavorite({ variables: { raffleId: raffle.id } });
      }

    } else {
      setIsFavorite(true);
      addFavorite({ variables: { raffleId: raffle.id } });
    }
  };

  const isToggling = addingFavorite || removingFavorite;

  // Format estado for display (no uppercase)
  const formatEstado = (estado: string) => {
    switch (estado) {
      case 'ACTIVA': return 'Activa';
      case 'SORTEADA': return 'Sorteada';
      case 'FINALIZADA': return 'Finalizada';
      case 'COMPLETADA': return 'Completada';
      case 'CANCELADA': return 'Cancelada';
      default: return estado.charAt(0) + estado.slice(1).toLowerCase();
    }
  };

  // Get badge class for estado
  const getEstadoClass = (estado: string) => {
    switch (estado) {
      case 'ACTIVA': return 'badge-active';
      case 'SORTEADA': return 'badge-completed';
      case 'FINALIZADA': return 'badge-pending';
      case 'COMPLETADA': return 'badge-completed';
      case 'CANCELADA': return 'badge-pending';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Link href={`/raffle/${raffle.id}`} className="block h-full">
      <div className="group card-hover card-shine flex h-full flex-col overflow-hidden rounded-[1.9rem] border border-border/80 bg-card/94 shadow-panel hover:border-primary/28">
        {/* Image Section */}
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          {imageUrl && imageUrl !== '/placeholder.jpg' ? (
            <Image
              src={imageUrl}
              alt={raffle.product?.nombre || raffle.titulo}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="object-cover transition-transform duration-700 group-hover:scale-[1.06]"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted">
              <Sparkles className="w-12 h-12 text-muted-foreground/30" />
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-[oklch(0.14_0.02_260_/_0.72)] via-transparent to-transparent" />

          {/* Favorite button */}
          {isAuthenticated && (
            <button
              onClick={handleFavoriteClick}
              disabled={isToggling}
              className="absolute left-3 top-3 rounded-full border border-white/20 bg-card/92 p-2.5 backdrop-blur-md transition-all hover:scale-105 hover:bg-card sm:left-4 sm:top-4"
              title={isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
            >
              <Heart
                className={`h-4 w-4 transition-all duration-200 ${
                  isFavorite
                    ? 'fill-destructive text-destructive'
                    : 'text-muted-foreground hover:text-destructive'
                } ${isToggling ? 'opacity-50' : ''}`}
              />
            </button>
          )}

          {/* Status badge */}
          <div className="absolute right-3 top-3 flex flex-col items-end gap-2 sm:right-4 sm:top-4">
            <span className={`badge-status ${getEstadoClass(raffle.estado)}`}>
              {formatEstado(raffle.estado)}
            </span>
            {hasRecentPriceDrop && raffle.estado === 'ACTIVA' && (
              <span className="badge-status flex items-center gap-1 border-success/24 bg-success/18 text-success">
                <TrendingDown className="h-3 w-3" />
                Rebajado
              </span>
            )}
            {isHot && raffle.estado === 'ACTIVA' && (
              <span className={`badge-status badge-hot ${isAlmostDone ? 'animate-pulse-soft' : ''}`}>
                {isAlmostDone ? '🔥 Ultimos!' : '⭐ Popular'}
              </span>
            )}
          </div>

          {/* Price tag */}
          <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2 sm:bottom-4 sm:left-4 sm:right-4 sm:gap-4">
            <div className="rounded-[1.25rem] border border-white/18 bg-card/92 px-3 py-2 backdrop-blur-md shadow-lift sm:px-4 sm:py-2.5">
              <p className="font-display text-xl leading-none text-primary sm:text-2xl">${raffle.precioPorTicket}</p>
              <p className="mt-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">por ticket</p>
            </div>
            <div className="rounded-full border border-white/18 bg-card/15 px-3 py-1.5 text-right backdrop-blur-md">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-white/80">valor total</p>
              <p className="mt-1 text-xs font-semibold text-white sm:text-sm">${(raffle.precioPorTicket * raffle.totalTickets).toFixed(0)}</p>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="flex flex-1 flex-col gap-5 p-4 sm:p-5">
          <div className="grid min-h-[5.75rem] content-start gap-2">
            <p className="editorial-kicker text-muted-foreground">
              {raffle.product?.condicion ?? 'Producto'}
            </p>
            <h3 className="line-clamp-2 font-display text-2xl leading-none text-card-foreground transition-colors group-hover:text-primary">
              {raffle.titulo}
            </h3>
          </div>
          <p className="truncate text-sm font-medium text-muted-foreground">
            {raffle.product?.nombre}
          </p>

          <div className="rounded-[1.35rem] border border-border/80 bg-background/72 p-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                <span className="font-semibold text-card-foreground">{raffle.ticketsVendidos}</span>
                <span className="text-xs">/ {raffle.totalTickets}</span>
              </span>
              <span className={`font-display text-xl ${
                isAlmostDone ? 'text-destructive' : isHot ? 'text-secondary' : 'text-primary'
              }`}>
                {progress.toFixed(0)}%
              </span>
            </div>
            <div className="progress-bar">
              <div
                className={`progress-fill ${
                  isAlmostDone
                    ? 'bg-destructive'
                    : isHot
                      ? 'bg-secondary'
                      : 'bg-primary'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="mt-auto grid gap-3 border-t border-border/80 pt-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <Countdown
                targetDate={raffle.fechaLimiteSorteo}
                variant="compact"
                showSeconds={false}
                className="text-xs"
              />
            </div>
            <div className="text-left sm:text-right">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">vendedor</p>
              <p className="mt-1 text-sm font-semibold text-card-foreground">
                {raffle.seller?.nombre} {raffle.seller?.apellido}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
