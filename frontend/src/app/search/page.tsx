'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery } from '@apollo/client/react';
import { gql } from '@apollo/client/core';
import { Button } from '@/components/ui/button';
import { Ticket, Loader2 } from 'lucide-react';
import { SearchFilters } from '@/components/search/search-filters';
import { RaffleGridSkeleton } from '@/components/ui/skeleton';
import { RaffleCard } from '@/components/raffle/raffle-card';

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
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-3xl">Explorar rifas</h1>
          {totalCount > 0 && (
            <p className="text-sm text-muted-foreground">
              {displayRaffles.length} de {totalCount} rifas
            </p>
          )}
        </div>
        <SearchFilters onSearch={handleSearch} initialFilters={filters} />
      </div>

      {/* Results */}
      {loading && displayRaffles.length === 0 ? (
        <RaffleGridSkeleton count={8} />
      ) : error ? (
        <div className="text-center py-20">
          <p className="text-destructive mb-4">Error al cargar rifas: {error.message}</p>
          <Button variant="outline" onClick={() => refetch()}>
            Intentar de nuevo
          </Button>
        </div>
      ) : displayRaffles.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <Ticket className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">No se encontraron rifas con estos criterios</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {displayRaffles.map((raffle: RaffleData) => (
              <RaffleCard key={raffle.id} raffle={raffle} />
            ))}
          </div>

          {/* Infinite scroll sentinel */}
          {hasMore && (
            <div
              ref={sentinelRef}
              className="flex justify-center items-center py-8"
              aria-label="Cargando más resultados"
            >
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Cargando más rifas...</span>
            </div>
          )}

          {/* End of results message */}
          {!hasMore && displayRaffles.length > ITEMS_PER_PAGE && (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">
                Has visto todas las {totalCount} rifas disponibles
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
