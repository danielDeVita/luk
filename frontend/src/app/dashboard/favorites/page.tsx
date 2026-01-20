'use client';

import { useQuery, useMutation } from '@apollo/client/react';
import { useAuthStore } from '@/store/auth';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Heart, Loader2, Clock, Users, Trash2, TrendingDown } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { GET_MY_FAVORITES } from '@/lib/graphql/queries';
import { REMOVE_FAVORITE } from '@/lib/graphql/mutations';
import Image from 'next/image';
import { getOptimizedImageUrl, CLOUDINARY_PRESETS } from '@/lib/cloudinary';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';



interface FavoriteData {
  id: string;
  raffleId: string;
  createdAt: string;
  raffle: {
    id: string;
    titulo: string;
    precioPorTicket: number;
    estado: string;
    ticketsVendidos: number;
    totalTickets: number;
    fechaLimiteSorteo: string;
    lastPriceDropAt?: string;
    product?: {
      nombre: string;
      imagenes?: string[];
    };
    seller?: {
      id: string;
      nombre: string;
      apellido: string;
    };
  };
}

interface MyFavoritesResult {
  myFavorites: FavoriteData[];
}

export default function FavoritesPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const confirm = useConfirmDialog();


  const { data, loading, refetch } = useQuery<MyFavoritesResult>(GET_MY_FAVORITES, {
    skip: !isAuthenticated,
  });

  const [removeFavorite] = useMutation(REMOVE_FAVORITE, {
    onCompleted: () => {
      // Empty to avoid redundancy with confirmation
    },
    onError: (err) => {

      toast.error(err.message);
      // Rollback: clear removing set and refetch to restore
      setRemovingIds(new Set());
      refetch();
    },
  });

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login');
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  // Filter out items being removed for optimistic UI
  const favorites = (data?.myFavorites || []).filter(
    (fav) => !removingIds.has(fav.raffleId)
  );

  const handleRemoveFavorite = async (raffleId: string, title?: string) => {
    const confirmed = await confirm({
      title: '¿Quitar de favoritos?',
      description: `¿Estás seguro que querés quitar "${title || 'esta rifa'}" de tu lista de favoritos?`,
      confirmText: 'Quitar',
      cancelText: 'Cancelar',
      variant: 'destructive',
    });

    if (confirmed) {
      // Optimistic update: immediately hide the card
      setRemovingIds((prev) => new Set(prev).add(raffleId));
      removeFavorite({ variables: { raffleId } });
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Heart className="h-8 w-8 text-red-500" />
        <h1 className="text-3xl font-bold">Mis Favoritos</h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : favorites.length === 0 ? (
        <div className="text-center py-20">
          <Heart className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">No tenés favoritos</h2>
          <p className="text-muted-foreground mb-4">
            Guardá rifas que te interesen haciendo clic en el corazón
          </p>
          <Link href="/search">
            <Button>Explorar Rifas</Button>
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {favorites.map((fav) => (
            <FavoriteCard
              key={fav.id}
              favorite={fav}
              onRemove={handleRemoveFavorite}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FavoriteCard({
  favorite,
  onRemove,
}: {
  favorite: FavoriteData;
  onRemove: (raffleId: string, title: string) => void;
}) {

  const { raffle } = favorite;
  const progress = (raffle.ticketsVendidos / raffle.totalTickets) * 100;
  const imageUrl = raffle.product?.imagenes?.[0];
  const timeLeft = getTimeLeft(raffle.fechaLimiteSorteo);

  // Check if price was recently reduced (within last 48 hours)
  // Using state to compute on mount to avoid impure Date.now() in render
  const [hasRecentPriceDrop, setHasRecentPriceDrop] = useState(false);
  useEffect(() => {
    if (raffle.lastPriceDropAt) {
      const dropTime = new Date(raffle.lastPriceDropAt).getTime();
      const now = Date.now();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHasRecentPriceDrop((now - dropTime) < 48 * 60 * 60 * 1000);
    }
  }, [raffle.lastPriceDropAt]);

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <div className="relative h-48 bg-gray-100">
        <Link href={`/raffle/${raffle.id}`}>
          {imageUrl ? (
            <Image
              src={getOptimizedImageUrl(imageUrl, CLOUDINARY_PRESETS.card)}
              alt={raffle.product?.nombre || raffle.titulo}
              fill
              className="object-cover cursor-pointer"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-primary/10 cursor-pointer">
              <span className="text-muted-foreground text-sm">Sin imagen</span>
            </div>
          )}
        </Link>
        <button
          onClick={() => onRemove(raffle.id, raffle.titulo)}

          className="absolute top-2 right-2 p-2 rounded-full bg-white/80 hover:bg-white transition-colors shadow-sm"
          title="Quitar de favoritos"
        >
          <Trash2 className="h-5 w-5 text-red-500" />
        </button>
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          <span
            className={`px-2 py-1 text-xs font-medium rounded-full ${
              raffle.estado === 'ACTIVA'
                ? 'bg-green-100 text-green-800'
                : raffle.estado === 'SORTEADA'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            {raffle.estado}
          </span>
          {hasRecentPriceDrop && (
            <span className="px-2 py-1 text-xs font-medium rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
              <TrendingDown className="h-3 w-3" />
              Precio reducido
            </span>
          )}
        </div>
      </div>

      <CardHeader className="pb-2">
        <Link href={`/raffle/${raffle.id}`}>
          <CardTitle className="line-clamp-1 text-lg hover:text-primary cursor-pointer">
            {raffle.titulo}
          </CardTitle>
        </Link>
        <p className="text-sm text-muted-foreground">{raffle.product?.nombre}</p>
      </CardHeader>

      <CardContent className="pb-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
          <span className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            {raffle.ticketsVendidos}/{raffle.totalTickets}
          </span>
          <span>{progress.toFixed(0)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>{timeLeft}</span>
        </div>
      </CardContent>

      <CardFooter className="justify-between">
        <span className="text-lg font-bold text-primary">${raffle.precioPorTicket}</span>
        <Link href={`/raffle/${raffle.id}`}>
          <Button size="sm">Ver Rifa</Button>
        </Link>
      </CardFooter>
    </Card>
  );
}

function getTimeLeft(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = date.getTime() - now.getTime();

  if (diff <= 0) return 'Finalizado';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) return `${days}d ${hours}h restantes`;
  if (hours > 0) return `${hours}h restantes`;
  return 'Menos de 1h';
}
