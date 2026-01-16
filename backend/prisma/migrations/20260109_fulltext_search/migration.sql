-- Full-text search migration for PostgreSQL
-- Creates GIN index on raffles table for efficient text search

-- Create a function to generate search vector (combining titulo and descripcion)
CREATE OR REPLACE FUNCTION raffle_search_vector(titulo TEXT, descripcion TEXT)
RETURNS tsvector AS $$
BEGIN
    RETURN (
        setweight(to_tsvector('spanish', COALESCE(titulo, '')), 'A') ||
        setweight(to_tsvector('spanish', COALESCE(descripcion, '')), 'B')
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create GIN index for full-text search
-- Uses expression index with the search vector function
CREATE INDEX IF NOT EXISTS idx_raffles_fulltext_search
ON raffles
USING GIN (
    raffle_search_vector(titulo, descripcion)
);

-- Create index on product name as well for combined searches
CREATE INDEX IF NOT EXISTS idx_products_fulltext_search
ON products
USING GIN (
    to_tsvector('spanish', COALESCE(nombre, '') || ' ' || COALESCE(descripcion_detallada, ''))
);
