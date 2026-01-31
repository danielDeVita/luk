import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useQuery } from '@apollo/client/react';
import { SearchFilters } from '../search/search-filters';

describe('SearchFilters', () => {
  const mockOnSearch = vi.fn();
  const mockUseQuery = vi.mocked(useQuery);

  const mockCategories = [
    { id: '1', nombre: 'Electrónica', descripcion: 'Dispositivos electrónicos', icono: '📱', orden: 1 },
    { id: '2', nombre: 'Deportes', descripcion: 'Artículos deportivos', icono: '⚽', orden: 2 },
    { id: '3', nombre: 'Hogar', descripcion: 'Artículos para el hogar', icono: '🏠', orden: 3 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseQuery.mockReturnValue({
      data: { categories: mockCategories },
      loading: false,
      error: undefined,
      refetch: vi.fn(),
    } as ReturnType<typeof useQuery>);
  });

  it('should render search input', () => {
    render(<SearchFilters onSearch={mockOnSearch} />);

    expect(screen.getByPlaceholderText(/Buscar rifas/i)).toBeInTheDocument();
  });

  it('should render category dropdown', () => {
    render(<SearchFilters onSearch={mockOnSearch} />);

    expect(screen.getByText('Categoría')).toBeInTheDocument();
  });

  it('should render price slider with range', () => {
    render(<SearchFilters onSearch={mockOnSearch} />);

    expect(screen.getByText('Precio')).toBeInTheDocument();
    expect(screen.getByText(/\$0/)).toBeInTheDocument();
  });

  it('should render sort dropdown', () => {
    render(<SearchFilters onSearch={mockOnSearch} />);

    expect(screen.getByText('Ordenar por')).toBeInTheDocument();
  });

  it('should render clear filters button', () => {
    render(<SearchFilters onSearch={mockOnSearch} />);

    expect(screen.getByRole('button', { name: /Limpiar/i })).toBeInTheDocument();
  });

  it('should update search term on input change', () => {
    render(<SearchFilters onSearch={mockOnSearch} />);

    const searchInput = screen.getByPlaceholderText(/Buscar rifas/i);
    fireEvent.change(searchInput, { target: { value: 'iPhone' } });

    expect(searchInput).toHaveValue('iPhone');
  });

  it('should call onSearch when search input loses focus', () => {
    render(<SearchFilters onSearch={mockOnSearch} />);

    const searchInput = screen.getByPlaceholderText(/Buscar rifas/i);
    fireEvent.change(searchInput, { target: { value: 'iPhone' } });
    fireEvent.blur(searchInput);

    expect(mockOnSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        searchTerm: 'iPhone',
      })
    );
  });

  it('should call onSearch when Enter key is pressed', () => {
    render(<SearchFilters onSearch={mockOnSearch} />);

    const searchInput = screen.getByPlaceholderText(/Buscar rifas/i);
    fireEvent.change(searchInput, { target: { value: 'Laptop' } });
    fireEvent.keyDown(searchInput, { key: 'Enter' });

    expect(mockOnSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        searchTerm: 'Laptop',
      })
    );
  });

  it('should clear all filters when clear button is clicked', () => {
    render(<SearchFilters onSearch={mockOnSearch} />);

    // Set some filters
    const searchInput = screen.getByPlaceholderText(/Buscar rifas/i);
    fireEvent.change(searchInput, { target: { value: 'Test' } });

    // Click clear button
    const clearButton = screen.getByRole('button', { name: /Limpiar/i });
    fireEvent.click(clearButton);

    // Search input should be empty
    expect(searchInput).toHaveValue('');

    // onSearch should be called with default filters
    expect(mockOnSearch).toHaveBeenCalledWith({
      sortBy: 'CREATED_DESC',
    });
  });
});
