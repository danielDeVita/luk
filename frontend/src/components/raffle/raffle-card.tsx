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
    <Link href={`/raffle/${raffle.id}`}>
      <div className="group bg-card rounded-xl border hover:border-primary/25 card-hover card-shine overflow-hidden">
        {/* Image Section */}
        <div className="relative aspect-[4/3] bg-muted overflow-hidden">
          {imageUrl && imageUrl !== '/placeholder.jpg' ? (
            <Image
              src={imageUrl}
              alt={raffle.product?.nombre || raffle.titulo}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted">
              <Sparkles className="w-12 h-12 text-muted-foreground/30" />
            </div>
          )}

          {/* Favorite button */}
          {isAuthenticated && (
            <button
              onClick={handleFavoriteClick}
              disabled={isToggling}
              className="absolute top-3 left-3 p-2 rounded-full bg-card/90 backdrop-blur-sm hover:bg-card transition-all hover:scale-105"
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
          <div className="absolute top-3 right-3 flex flex-col gap-2">
            <span className={`badge-status ${getEstadoClass(raffle.estado)}`}>
              {formatEstado(raffle.estado)}
            </span>
            {hasRecentPriceDrop && raffle.estado === 'ACTIVA' && (
              <span className="badge-status bg-emerald-100 text-emerald-800 flex items-center gap-1">
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
          <div className="absolute bottom-3 left-3">
            <div className="px-3 py-1.5 rounded-lg bg-card/95 backdrop-blur-sm shadow-sm">
              <p className="text-lg font-display text-primary">${raffle.precioPorTicket}</p>
              <p className="text-[10px] text-muted-foreground">por ticket</p>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="p-4">
          <h3 className="font-medium text-card-foreground truncate group-hover:text-primary transition-colors">
            {raffle.titulo}
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5 truncate">
            {raffle.product?.nombre}
          </p>

          {/* Progress Section */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                <span className="font-medium text-card-foreground">{raffle.ticketsVendidos}</span>
                <span className="text-xs">/</span>
                <span className="text-xs">{raffle.totalTickets}</span>
              </span>
              <span className={`text-sm font-medium ${
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

          {/* Footer */}
          <div className="mt-4 pt-3 border-t flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-sm">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <Countdown
                targetDate={raffle.fechaLimiteSorteo}
                variant="compact"
                showSeconds={false}
                className="text-xs"
              />
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-card-foreground">
                ${(raffle.precioPorTicket * raffle.totalTickets).toFixed(0)}
              </p>
              <p className="text-[10px] text-muted-foreground">valor total</p>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

