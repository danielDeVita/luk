'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@apollo/client/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, X } from 'lucide-react';
import { GET_CATEGORIES } from '@/lib/graphql/queries';

interface Category {
  id: string;
  nombre: string;
  descripcion?: string;
  icono?: string;
  orden: number;
}

interface SearchFiltersProps {
  onSearch: (filters: SearchFilters) => void;
  initialFilters?: {
    category?: string;
    searchTerm?: string;
    minPrice?: number;
    maxPrice?: number;
    sortBy?: string;
  };
}

interface SearchFilters {
  searchTerm?: string;
  categoria?: string;
  precioMin?: number;
  precioMax?: number;
  sortBy?: string;
}

export function SearchFilters({ onSearch, initialFilters }: SearchFiltersProps) {
  const [searchTerm, setSearchTerm] = useState(initialFilters?.searchTerm || '');
  const [category, setCategory] = useState<string>(initialFilters?.category || 'ALL');
  const [priceRange, setPriceRange] = useState<[number, number]>([
    initialFilters?.minPrice || 0,
    initialFilters?.maxPrice || 10000,
  ]);
  const [sortBy, setSortBy] = useState(initialFilters?.sortBy || 'CREATED_DESC');

  // Fetch categories from backend
  const { data: categoriesData } = useQuery<{ categories: Category[] }>(GET_CATEGORIES);
  const categories = categoriesData?.categories || [];

  // Build filters object with current or overridden values
  const buildFilters = useCallback((overrides: Partial<{
    searchTerm: string;
    category: string;
    priceRange: [number, number];
    sortBy: string;
  }> = {}): SearchFilters => {
    const currentSearchTerm = overrides.searchTerm ?? searchTerm;
    const currentCategory = overrides.category ?? category;
    const currentPriceRange = overrides.priceRange ?? priceRange;
    const currentSortBy = overrides.sortBy ?? sortBy;

    return {
      searchTerm: currentSearchTerm || undefined,
      categoria: currentCategory === 'ALL' ? undefined : currentCategory,
      precioMin: currentPriceRange[0] > 0 ? currentPriceRange[0] : undefined,
      precioMax: currentPriceRange[1] < 10000 ? currentPriceRange[1] : undefined,
      sortBy: currentSortBy,
    };
  }, [searchTerm, category, priceRange, sortBy]);

  // Debounce price range updates
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(buildFilters());
    }, 500);
    return () => clearTimeout(timer);
  }, [priceRange, buildFilters, onSearch]);

  const handleSearchSubmit = () => {
    onSearch(buildFilters());
  };

  const handleCategoryChange = (val: string) => {
    setCategory(val);
    onSearch(buildFilters({ category: val }));
  };

  const handleSortChange = (val: string) => {
    setSortBy(val);
    onSearch(buildFilters({ sortBy: val }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearchSubmit();
  };

  const clearFilters = () => {
    setSearchTerm('');
    setCategory('ALL');
    setPriceRange([0, 10000]);
    setSortBy('CREATED_DESC');
    onSearch({
      sortBy: 'CREATED_DESC',
    });
  };

  return (
    <div className="space-y-6">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar rifas..."
          className="pl-10"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSearchSubmit}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
        {/* Category Select */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Categoría</label>
          <Select value={category} onValueChange={handleCategoryChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent className="z-50">
              <SelectItem value="ALL">Todas las categorías</SelectItem>
              {[...categories]
                .sort((a, b) => a.orden - b.orden)
                .map((cat) => (
                  <SelectItem key={cat.id} value={cat.nombre}>
                    {cat.icono ? `${cat.icono} ` : ''}{cat.nombre}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        {/* Sort Select */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Ordenar por</label>
          <Select value={sortBy} onValueChange={handleSortChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Ordenar por..." />
            </SelectTrigger>
            <SelectContent className="z-50">
              <SelectItem value="PRICE_ASC">Precio: menor a mayor</SelectItem>
              <SelectItem value="PRICE_DESC">Precio: mayor a menor</SelectItem>
              <SelectItem value="END_DATE_ASC">Fecha fin: más próximos</SelectItem>
              <SelectItem value="END_DATE_DESC">Fecha fin: más lejanos</SelectItem>
              <SelectItem value="CREATED_ASC">Creación: más antiguos</SelectItem>
              <SelectItem value="CREATED_DESC">Creación: más recientes</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Price Slider */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">Precio</span>
            <span className="text-muted-foreground">
              ${priceRange[0]} - ${priceRange[1] === 10000 ? '10k+' : priceRange[1]}
            </span>
          </div>
          <Slider
            value={priceRange}
            min={0}
            max={10000}
            step={100}
            onValueChange={(val) => setPriceRange(val as [number, number])}
            className="py-4"
          />
        </div>

        {/* Clear Button */}
        <Button variant="ghost" onClick={clearFilters} className="w-full">
          <X className="mr-2 h-4 w-4" /> Limpiar
        </Button>
      </div>
    </div>
  );
}
