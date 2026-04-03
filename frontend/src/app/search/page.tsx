'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery } from '@apollo/client/react';
import { gql } from '@apollo/client/core';
import { Button } from '@/components/ui/button';
import { Ticket, Loader2 } from 'lucide-react';
import { SearchFilters } from '@/components/search/search-filters';
import { RaffleGridSkeleton } from '@/components/ui/skeleton';
import { RaffleCard } from '@/components/raffle/raffle-card';
import { ComplianceNotice } from '@/components/legal/compliance-notice';

const SEARCH_RAFFLES_PAGINATED = gql`
  query GetRafflesPaginated($pagination: PaginationInput, $filters: RaffleFiltersInput) {
    rafflesPaginated(pagination: $pagination, filters: $filters) {
      items {
        id
        titulo
        descripcion
        totalTickets
        ticketsVendidos
        precioPorTicket
        estado
        fechaLimiteSorteo
        product {
          nombre
          imagenes
          categoria
          condicion
        }
        seller {
          nombre
          apellido
        }
      }
      meta {
        total
        page
        limit
        totalPages
        hasNext
      }
    }
  }
`;

interface RaffleData {
  id: string;
  titulo: string;
  descripcion: string;
  totalTickets: number;
  ticketsVendidos: number;
  precioPorTicket: number;
  estado: string;
  fechaLimiteSorteo: string;
  product?: { nombre: string; imagenes: string[]; categoria?: string; condicion: string };
  seller?: { nombre: string; apellido: string };
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
}

interface RafflesPaginatedResult {
  rafflesPaginated: {
    items: RaffleData[];
    meta: PaginationMeta;
  };
}

const ITEMS_PER_PAGE = 20;

interface SearchFiltersType {
  searchTerm?: string;
  categoria?: string;
  precioMin?: number;
  precioMax?: number;
  sortBy?: string;
  estado?: string;
}

export default function SearchPage() {
  const [filters, setFilters] = useState<SearchFiltersType>({
    sortBy: 'CREATED_DESC',
    estado: 'ACTIVA',
  });
  const [page, setPage] = useState(1);
  const [allRaffles, setAllRaffles] = useState<RaffleData[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef(false);
  const prevFiltersRef = useRef(filters);

  const { data, loading, error, fetchMore, refetch } = useQuery<RafflesPaginatedResult>(
    SEARCH_RAFFLES_PAGINATED,
    {
      variables: {
        pagination: { limit: ITEMS_PER_PAGE, page: 1 },
        filters: filters,
      },
      notifyOnNetworkStatusChange: true,
    }
  );

  // Reset state when data changes (initial load or filter change)
  useEffect(() => {
    if (data?.rafflesPaginated && !isLoadingMore) {
      // Check if filters changed
      const filtersChanged = JSON.stringify(prevFiltersRef.current) !== JSON.stringify(filters);

      if (filtersChanged || allRaffles.length === 0) {
        setAllRaffles(data.rafflesPaginated.items || []);
        setHasMore(data.rafflesPaginated.meta.hasNext);
        setTotalCount(data.rafflesPaginated.meta.total);
        setPage(1);
        prevFiltersRef.current = filters;
      }
    }
  }, [data, filters, isLoadingMore, allRaffles.length]);

  // Load more results
  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore || loading) return;

    loadingRef.current = true;
    setIsLoadingMore(true);
    const nextPage = page + 1;

    try {
      const { data: newData } = await fetchMore({
        variables: {
          pagination: { limit: ITEMS_PER_PAGE, page: nextPage },
          filters: filters,
        },
      });

      if (newData?.rafflesPaginated?.items?.length) {
        setAllRaffles((prev) => {
          // Avoid duplicates by filtering out existing IDs
          const existingIds = new Set(prev.map((r) => r.id));
          const newRaffles = newData.rafflesPaginated.items.filter(
            (r: RaffleData) => !existingIds.has(r.id)
          );
          return [...prev, ...newRaffles];
        });
        setHasMore(newData.rafflesPaginated.meta.hasNext);
        setPage(nextPage);
      }
    } finally {
      loadingRef.current = false;
      setIsLoadingMore(false);
    }
  }, [fetchMore, filters, hasMore, page, loading]);

  // Intersection Observer callback for infinite scroll sentinel
  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (loading || isLoadingMore) return;
      if (observerRef.current) {
        observerRef.current.disconnect();
      }

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasMore && !loadingRef.current) {
            loadMore();
          }
        },
        {
          rootMargin: '200px', // Start loading before reaching the bottom
          threshold: 0,
        }
      );

      if (node) {
        observerRef.current.observe(node);
      }
    },
    [loading, isLoadingMore, hasMore, loadMore]
  );

  // Cleanup observer on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  const handleSearch = (newFilters: SearchFiltersType) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
    setAllRaffles([]); // Reset on filter change
    setPage(1);
    setHasMore(true);
  };

  // Use allRaffles for display (accumulated results)
  const displayRaffles =
    allRaffles.length > 0 ? allRaffles : data?.rafflesPaginated?.items || [];

  return (
    <div className="pb-14 pt-3">
      <div className="container mx-auto px-4">
        <div className="mb-3 overflow-hidden rounded-[2rem] border border-border/80 bg-mesh px-4 py-3 shadow-panel sm:px-5 sm:py-4 lg:px-6">
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="editorial-kicker text-primary">Explorar rifas</p>
              {totalCount > 0 && (
                <p className="text-sm font-medium text-muted-foreground">
                  {displayRaffles.length} de {totalCount} rifas
                </p>
              )}
            </div>
            <SearchFilters onSearch={handleSearch} initialFilters={filters} />
          </div>
        </div>

      {/* Results */}
      {loading && displayRaffles.length === 0 ? (
        <RaffleGridSkeleton count={8} />
      ) : error ? (
        <div className="rounded-[2rem] border border-border/80 bg-card/90 py-20 text-center shadow-panel">
          <p className="mb-4 text-destructive">Error al cargar rifas: {error.message}</p>
          <Button variant="outline" onClick={() => refetch()}>
            Intentar de nuevo
          </Button>
        </div>
      ) : displayRaffles.length === 0 ? (
        <div className="rounded-[2rem] border border-border/80 bg-card/90 py-20 text-center shadow-panel">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-[1.75rem] border border-border/80 bg-muted/60">
            <Ticket className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">No se encontraron rifas con estos criterios</p>
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="editorial-kicker text-muted-foreground">Resultados</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {displayRaffles.map((raffle: RaffleData) => (
              <RaffleCard key={raffle.id} raffle={raffle} />
            ))}
          </div>

          {/* Infinite scroll sentinel */}
          {hasMore && (
            <div
              ref={sentinelRef}
              className="flex justify-center items-center py-10"
              aria-label="Cargando más resultados"
            >
              <div className="inline-flex items-center gap-3 rounded-full border border-border/80 bg-card/85 px-5 py-3 shadow-panel">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Cargando más rifas...</span>
              </div>
            </div>
          )}

          {!hasMore && displayRaffles.length > ITEMS_PER_PAGE && (
            <div className="py-10 text-center">
              <p className="text-sm text-muted-foreground">
                Has visto todas las {totalCount} rifas disponibles
              </p>
            </div>
          )}
        </>
      )}

      <div className="mx-auto mt-14 max-w-4xl">
        <ComplianceNotice
          title="Aviso legal antes de participar"
          tone="subtle"
        />
      </div>
      </div>
    </div>
  );
}
