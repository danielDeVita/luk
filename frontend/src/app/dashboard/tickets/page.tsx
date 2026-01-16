'use client';

import { useQuery, useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client/core';
import { useAuthStore } from '@/store/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Ticket,
  Loader2,
  ExternalLink,
  PackageCheck,
  Truck,
  AlertTriangle,
  Filter,
  X,
  Trophy,
  DollarSign,
  Heart,
  TrendingUp,
  Clock,
  Star,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import { toast } from 'sonner';
import { DisputeDialog } from '@/components/disputes/dispute-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import Image from 'next/image';
import { getOptimizedImageUrl, CLOUDINARY_PRESETS } from '@/lib/cloudinary';

const MY_TICKETS = gql`
  query MyTickets {
    myTickets {
      id
      numeroTicket
      estado
      precioPagado
      createdAt
      raffle {
        id
        titulo
        estado
        deliveryStatus
        trackingNumber
        paymentReleasedAt
        winnerId
        fechaLimiteSorteo
        product {
          imagenes
        }
      }
    }
  }
`;

const BUYER_STATS = gql`
  query BuyerStats {
    buyerStats {
      totalTicketsPurchased
      totalRafflesWon
      winRate
      totalSpent
      activeTickets
      favoritesCount
    }
  }
`;

const RECOMMENDED_RAFFLES = gql`
  query RecommendedRaffles($limit: Int) {
    recommendedRaffles(limit: $limit) {
      id
      titulo
      precioPorTicket
      totalTickets
      ticketsVendidos
      fechaLimiteSorteo
      product {
        imagenes
        categoria
      }
    }
  }
`;

const FAVORITES_ENDING_SOON = gql`
  query FavoritesEndingSoon($hoursThreshold: Int) {
    favoritesEndingSoon(hoursThreshold: $hoursThreshold) {
      id
      titulo
      precioPorTicket
      fechaLimiteSorteo
      product {
        imagenes
      }
    }
  }
`;

const CONFIRM_DELIVERY = gql`
  mutation ConfirmDelivery($raffleId: String!) {
    confirmDelivery(raffleId: $raffleId) {
      id
      deliveryStatus
      confirmedAt
    }
  }
`;

interface TicketData {
  id: string;
  numeroTicket: number;
  estado: string;
  precioPagado: number;
  createdAt: string;
  raffle: {
    id: string;
    titulo: string;
    estado: string;
    deliveryStatus: string;
    trackingNumber?: string;
    paymentReleasedAt?: string;
    winnerId?: string;
    fechaLimiteSorteo: string;
    product?: { imagenes?: string[] };
  };
}

interface BuyerStats {
  totalTicketsPurchased: number;
  totalRafflesWon: number;
  winRate: number;
  totalSpent: number;
  activeTickets: number;
  favoritesCount: number;
}

interface RafflePreview {
  id: string;
  titulo: string;
  precioPorTicket: number;
  totalTickets?: number;
  ticketsVendidos?: number;
  fechaLimiteSorteo: string;
  product?: { imagenes?: string[]; categoria?: string };
}

interface MyTicketsResult {
  myTickets: TicketData[];
}

type TicketStatus = 'ALL' | 'PAGADO' | 'RESERVADO' | 'REEMBOLSADO';
type RaffleStatus = 'ALL' | 'ACTIVA' | 'SORTEADA' | 'FINALIZADA' | 'CANCELADA';

function formatTimeRemaining(deadline: string): string {
  const now = new Date();
  const end = new Date(deadline);
  const diff = end.getTime() - now.getTime();

  if (diff <= 0) return 'Terminada';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  return `${hours}h`;
}

export default function MyTicketsPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();

  // Filter states
  const [ticketStatus, setTicketStatus] = useState<TicketStatus>('ALL');
  const [raffleStatus, setRaffleStatus] = useState<RaffleStatus>('ALL');
  const [showWinsOnly, setShowWinsOnly] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const { data, loading, refetch } = useQuery<MyTicketsResult>(MY_TICKETS, {
    skip: !isAuthenticated,
  });

  const { data: statsData } = useQuery<{ buyerStats: BuyerStats }>(BUYER_STATS, {
    skip: !isAuthenticated,
  });

  const { data: recommendedData } = useQuery<{ recommendedRaffles: RafflePreview[] }>(RECOMMENDED_RAFFLES, {
    skip: !isAuthenticated,
    variables: { limit: 4 },
  });

  const { data: endingSoonData } = useQuery<{ favoritesEndingSoon: RafflePreview[] }>(FAVORITES_ENDING_SOON, {
    skip: !isAuthenticated,
    variables: { hoursThreshold: 48 },
  });

  const [confirmDelivery, { loading: confirming }] = useMutation(CONFIRM_DELIVERY, {
    onCompleted: () => {
      toast.success('Entrega confirmada y pago liberado al vendedor');
      refetch();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login');
    }
  }, [isAuthenticated, router]);

  // Get data from queries
  const tickets = data?.myTickets || [];
  const stats = statsData?.buyerStats;
  const recommendations = recommendedData?.recommendedRaffles || [];
  const favoritesEndingSoon = endingSoonData?.favoritesEndingSoon || [];

  // Filter tickets (useMemo before early return)
  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      if (ticketStatus !== 'ALL' && ticket.estado !== ticketStatus) return false;
      if (raffleStatus !== 'ALL' && ticket.raffle.estado !== raffleStatus) return false;
      if (showWinsOnly && ticket.raffle.winnerId !== user?.id) return false;

      if (dateFrom) {
        const ticketDate = new Date(ticket.createdAt);
        const fromDate = new Date(dateFrom);
        if (ticketDate < fromDate) return false;
      }
      if (dateTo) {
        const ticketDate = new Date(ticket.createdAt);
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (ticketDate > toDate) return false;
      }

      return true;
    });
  }, [tickets, ticketStatus, raffleStatus, showWinsOnly, dateFrom, dateTo, user?.id]);

  const handleConfirmDelivery = (raffleId: string) => {
    if (confirm('¿Confirmás que recibiste el producto en buen estado? Esto liberará el pago al vendedor.')) {
      confirmDelivery({ variables: { raffleId } });
    }
  };

  if (!isAuthenticated) return null;

  const hasActiveFilters = ticketStatus !== 'ALL' || raffleStatus !== 'ALL' || showWinsOnly || dateFrom || dateTo;

  const clearFilters = () => {
    setTicketStatus('ALL');
    setRaffleStatus('ALL');
    setShowWinsOnly(false);
    setDateFrom('');
    setDateTo('');
  };

  // Group by raffle
  const groupedTickets = filteredTickets.reduce((acc: Record<string, { raffle: TicketData['raffle']; tickets: TicketData[] }>, ticket) => {
    const raffleId = ticket.raffle.id;
    if (!acc[raffleId]) {
      acc[raffleId] = {
        raffle: ticket.raffle,
        tickets: [],
      };
    }
    acc[raffleId].tickets.push(ticket);
    return acc;
  }, {});

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Mi Panel de Comprador</h1>

      {/* Buyer Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-blue-500/10">
                <Ticket className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tickets Comprados</p>
                <p className="text-xl font-bold">{stats?.totalTicketsPurchased || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-yellow-500/10">
                <Trophy className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Rifas Ganadas</p>
                <p className="text-xl font-bold">{stats?.totalRafflesWon || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-500/10">
                <TrendingUp className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tasa de Victoria</p>
                <p className="text-xl font-bold">{stats?.winRate.toFixed(1) || 0}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-purple-500/10">
                <DollarSign className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Gastado</p>
                <p className="text-xl font-bold">${stats?.totalSpent.toFixed(2) || '0.00'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-orange-500/10">
                <Clock className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tickets Activos</p>
                <p className="text-xl font-bold">{stats?.activeTickets || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-pink-500/10">
                <Heart className="h-5 w-5 text-pink-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Favoritos</p>
                <p className="text-xl font-bold">{stats?.favoritesCount || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Favorites Ending Soon Alert */}
      {favoritesEndingSoon.length > 0 && (
        <Card className="mb-8 border-orange-500/50 bg-orange-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="h-5 w-5" />
              Favoritos por terminar
            </CardTitle>
            <CardDescription>Estas rifas de tu lista de favoritos terminan pronto</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {favoritesEndingSoon.map((raffle) => (
                <Link key={raffle.id} href={`/raffle/${raffle.id}`}>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-background hover:bg-muted transition-colors">
                    <div className="w-12 h-12 rounded-md overflow-hidden bg-muted flex-shrink-0">
                      {raffle.product?.imagenes?.[0] ? (
                        <Image
                          src={getOptimizedImageUrl(raffle.product.imagenes[0], CLOUDINARY_PRESETS.dashboardThumb)}
                          alt=""
                          width={48}
                          height={48}
                          className="object-cover w-full h-full"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <Ticket className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate text-sm">{raffle.titulo}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>${raffle.precioPorTicket}</span>
                        <span className="text-orange-600 font-medium">
                          {formatTimeRemaining(raffle.fechaLimiteSorteo)}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <Card className="mb-8">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              Recomendados para vos
            </CardTitle>
            <CardDescription>Basado en tus compras y favoritos anteriores</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {recommendations.map((raffle) => (
                <Link key={raffle.id} href={`/raffle/${raffle.id}`}>
                  <div className="group rounded-lg border bg-card overflow-hidden hover:shadow-md transition-shadow">
                    <div className="aspect-video bg-muted relative overflow-hidden">
                      {raffle.product?.imagenes?.[0] ? (
                        <Image
                          src={getOptimizedImageUrl(raffle.product.imagenes[0], CLOUDINARY_PRESETS.card)}
                          alt=""
                          fill
                          className="object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <Ticket className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      {raffle.product?.categoria && (
                        <span className="absolute top-2 left-2 text-xs px-2 py-0.5 rounded bg-black/60 text-white">
                          {raffle.product.categoria}
                        </span>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="font-medium truncate text-sm">{raffle.titulo}</p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                        <span className="font-semibold text-primary">${raffle.precioPorTicket}/ticket</span>
                        <span>
                          {raffle.ticketsVendidos || 0}/{raffle.totalTickets || 0} vendidos
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* My Tickets Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold">Mis Tickets</h2>
        <div className="flex items-center gap-2">
          <Button
            variant={showFilters ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filtros
            {hasActiveFilters && (
              <span className="ml-2 bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded-full">
                {[ticketStatus !== 'ALL', raffleStatus !== 'ALL', showWinsOnly, dateFrom, dateTo].filter(Boolean).length}
              </span>
            )}
          </Button>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />
              Limpiar
            </Button>
          )}
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <Card className="mb-6">
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Estado del Ticket</label>
                <select
                  value={ticketStatus}
                  onChange={(e) => setTicketStatus(e.target.value as TicketStatus)}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="ALL">Todos</option>
                  <option value="PAGADO">Pagado</option>
                  <option value="RESERVADO">Reservado</option>
                  <option value="REEMBOLSADO">Reembolsado</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Estado de la Rifa</label>
                <select
                  value={raffleStatus}
                  onChange={(e) => setRaffleStatus(e.target.value as RaffleStatus)}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="ALL">Todas</option>
                  <option value="ACTIVA">Activa</option>
                  <option value="SORTEADA">Sorteada</option>
                  <option value="FINALIZADA">Finalizada</option>
                  <option value="CANCELADA">Cancelada</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Desde</label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Hasta</label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showWinsOnly}
                    onChange={(e) => setShowWinsOnly(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">Solo ganados</span>
                </label>
              </div>
            </div>
            {hasActiveFilters && (
              <p className="text-sm text-muted-foreground mt-3">
                Mostrando {filteredTickets.length} de {tickets.length} tickets
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center gap-4">
                <Skeleton className="w-16 h-16 rounded-md" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-9 w-24" />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {Array.from({ length: 6 }).map((_, j) => (
                    <Skeleton key={j} className="h-16 rounded-md" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-20">
          <Ticket className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">No tenés tickets</h2>
          <p className="text-muted-foreground mb-4">Participá en rifas para comprar tickets</p>
          <Link href="/search">
            <Button>Explorar Rifas</Button>
          </Link>
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="text-center py-20">
          <Filter className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">Sin resultados</h2>
          <p className="text-muted-foreground mb-4">No hay tickets que coincidan con los filtros aplicados</p>
          <Button variant="outline" onClick={clearFilters}>
            Limpiar Filtros
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.values(groupedTickets).map((group) => {
            const isWinner = group.raffle.winnerId === user?.id;

            return (
              <Card key={group.raffle.id} className={isWinner ? 'border-yellow-500 border-2' : ''}>
                <CardHeader className="flex flex-row items-center gap-4">
                  <div className="w-16 h-16 rounded-md overflow-hidden bg-muted flex-shrink-0">
                    {group.raffle.product?.imagenes?.[0] ? (
                      <Image
                        src={getOptimizedImageUrl(group.raffle.product.imagenes[0], CLOUDINARY_PRESETS.dashboardThumb)}
                        alt=""
                        width={64}
                        height={64}
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <Ticket className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      {group.raffle.titulo}
                      {isWinner && (
                        <span className="text-sm bg-yellow-500 text-black px-2 py-0.5 rounded">🏆 GANADOR</span>
                      )}
                    </CardTitle>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                      <p>
                        Estado:{' '}
                        <span className={group.raffle.estado === 'ACTIVA' ? 'text-green-600' : ''}>
                          {group.raffle.estado}
                        </span>
                      </p>

                      {isWinner && group.raffle.deliveryStatus === 'SHIPPED' && (
                        <div className="flex items-center text-blue-600 font-medium">
                          <Truck className="h-4 w-4 mr-1" />
                          Enviado: {group.raffle.trackingNumber || 'Sin tracking'}
                        </div>
                      )}

                      {isWinner && group.raffle.deliveryStatus === 'CONFIRMED' && (
                        <div className="flex items-center text-green-600 font-medium">
                          <PackageCheck className="h-4 w-4 mr-1" />
                          Entregado y Confirmado
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Link href={`/raffle/${group.raffle.id}`}>
                      <Button variant="outline" size="sm" className="w-full">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Ver Rifa
                      </Button>
                    </Link>

                    {isWinner && group.raffle.deliveryStatus === 'SHIPPED' && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          className="bg-green-600 hover:bg-green-700 flex-1"
                          onClick={() => handleConfirmDelivery(group.raffle.id)}
                          disabled={confirming}
                        >
                          {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar Recepción'}
                        </Button>
                        <DisputeDialog
                          raffleId={group.raffle.id}
                          raffleTitle={group.raffle.titulo}
                          onDisputeOpened={refetch}
                        />
                      </div>
                    )}

                    {isWinner && group.raffle.deliveryStatus === 'DISPUTED' && (
                      <Button variant="destructive" size="sm" disabled className="w-full opacity-100">
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        En Disputa
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    {group.tickets.map((ticket) => (
                      <div
                        key={ticket.id}
                        className={`p-3 rounded-md text-center ${
                          ticket.estado === 'PAGADO'
                            ? 'bg-primary/10 text-primary'
                            : ticket.estado === 'REEMBOLSADO'
                            ? 'bg-muted text-muted-foreground'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        <div className="text-2xl font-bold">#{ticket.numeroTicket}</div>
                        <div className="text-xs">{ticket.estado}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
