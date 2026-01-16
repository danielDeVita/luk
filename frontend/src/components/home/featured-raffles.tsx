'use client';

import { useQuery } from '@apollo/client/react';
import { GET_RAFFLES } from '@/lib/graphql/queries';
import { RaffleCard } from '@/components/raffle/raffle-card';
import { Ticket } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface Raffle {
  id: string;
  titulo: string;
  precioPorTicket: number;
  totalTickets: number;
  ticketsVendidos: number;
  fechaLimiteSorteo: string;
  estado: string;
  product?: {
    nombre: string;
    imagenes: string[];
    condicion: string;
  };
  seller?: {
    nombre: string;
    apellido: string;
  };
}

export function FeaturedRaffles() {
  const { data, loading, error } = useQuery<{ raffles: Raffle[] }>(GET_RAFFLES, {
    variables: {
      filters: { estado: 'ACTIVA' },
      pagination: { limit: 10 },
    },
  });

  // Sort by tickets sold (descending) and take top 3
  const featuredRaffles = data?.raffles
    ?.slice()
    .sort((a, b) => b.ticketsVendidos - a.ticketsVendidos)
    .slice(0, 3) || [];

  if (loading) {
    return (
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        <RaffleSkeletonCard />
        <RaffleSkeletonCard />
        <RaffleSkeletonCard />
      </div>
    );
  }

  if (error || featuredRaffles.length === 0) {
    return (
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        <EmptyStateCard />
        <EmptyStateCard />
        <EmptyStateCard />
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
      {featuredRaffles.map((raffle) => (
        <RaffleCard key={raffle.id} raffle={raffle} />
      ))}
    </div>
  );
}

function RaffleSkeletonCard() {
  return (
    <Card className="overflow-hidden card-lift">
      <div className="aspect-[4/3] bg-muted animate-pulse" />
      <CardHeader className="pb-2">
        <div className="h-6 bg-muted rounded animate-pulse w-3/4" />
        <div className="h-4 bg-muted rounded animate-pulse w-1/2 mt-2" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="h-2 bg-muted rounded-full" />
          <div className="flex items-center justify-between">
            <div className="h-8 bg-muted rounded w-20 animate-pulse" />
            <div className="h-4 bg-muted rounded w-24 animate-pulse" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyStateCard() {
  return (
    <Card className="overflow-hidden card-lift lucky-shimmer group cursor-pointer">
      <div className="aspect-[4/3] bg-primary/5 flex items-center justify-center relative">
        <Ticket className="h-20 w-20 text-primary/30 group-hover:scale-110 transition-transform duration-500" />
        <div className="absolute top-3 right-3">
          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-muted text-muted-foreground shadow-lg">
            PRÓXIMAMENTE
          </span>
        </div>
      </div>
      <CardHeader className="pb-2">
        <CardTitle className="line-clamp-1 group-hover:text-primary transition-colors">
          Nuevas rifas pronto...
        </CardTitle>
        <p className="text-sm text-muted-foreground">Volvé más tarde</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full w-0 bg-primary rounded-full" />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-2xl font-display text-primary">$--</span>
              <span className="text-sm text-muted-foreground ml-1">por ticket</span>
            </div>
            <span className="text-sm text-muted-foreground">--/-- tickets</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
