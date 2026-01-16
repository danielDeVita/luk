/**
 * Full-text Search Utility for PostgreSQL
 *
 * Provides helpers for building efficient full-text search queries
 * using PostgreSQL's tsvector and tsquery features.
 */

/**
 * Normalizes and sanitizes a search term for use with PostgreSQL full-text search.
 * - Removes special characters that could break tsquery
 * - Handles Spanish accents (PostgreSQL 'spanish' config handles this)
 * - Splits into words and joins with OR operator for flexible matching
 *
 * @param searchTerm - Raw user input search string
 * @returns Sanitized string ready for plainto_tsquery or to_tsquery
 */
export function sanitizeSearchTerm(searchTerm: string): string {
  if (!searchTerm || typeof searchTerm !== 'string') {
    return '';
  }

  // Remove potentially dangerous characters for tsquery
  // Keep alphanumeric, spaces, and common Spanish characters
  const sanitized = searchTerm
    .trim()
    .toLowerCase()
    // Remove special tsquery operators and SQL injection risks
    .replace(/[&|!:*()'"\\<>]/g, ' ')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    .trim();

  return sanitized;
}

/**
 * Converts a search term to a tsquery string with OR matching.
 * Each word is prefixed with :* for prefix matching.
 *
 * Example: "iphone 12" -> "iphone:* | 12:*"
 * This matches "iphone", "iphones", "iphone12", etc.
 *
 * @param searchTerm - User's search input
 * @returns Formatted tsquery string
 */
export function toTsqueryOr(searchTerm: string): string {
  const sanitized = sanitizeSearchTerm(searchTerm);
  if (!sanitized) return '';

  const words = sanitized.split(' ').filter((w) => w.length > 0);
  if (words.length === 0) return '';

  // Each word with prefix matching, joined by OR
  return words.map((word) => `${word}:*`).join(' | ');
}

/**
 * Converts a search term to a tsquery string with AND matching.
 * All words must be present for a match.
 *
 * Example: "iphone azul" -> "iphone:* & azul:*"
 *
 * @param searchTerm - User's search input
 * @returns Formatted tsquery string
 */
export function toTsqueryAnd(searchTerm: string): string {
  const sanitized = sanitizeSearchTerm(searchTerm);
  if (!sanitized) return '';

  const words = sanitized.split(' ').filter((w) => w.length > 0);
  if (words.length === 0) return '';

  // Each word with prefix matching, joined by AND
  return words.map((word) => `${word}:*`).join(' & ');
}

/**
 * Escapes a string for safe use in PostgreSQL string literals.
 * Use this when interpolating values into raw SQL queries.
 *
 * @param value - String to escape
 * @returns Escaped string (without surrounding quotes)
 */
export function escapePostgresString(value: string): string {
  if (!value || typeof value !== 'string') {
    return '';
  }

  // Escape single quotes by doubling them
  return value.replace(/'/g, "''");
}

/**
 * Builds a full-text search WHERE clause fragment for raffles.
 * Returns null if search term is empty.
 *
 * @param searchTerm - User's search input
 * @param mode - 'or' for flexible matching (default), 'and' for strict matching
 * @returns SQL fragment or null
 */
export function buildRaffleSearchClause(
  searchTerm: string,
  mode: 'or' | 'and' = 'or',
): string | null {
  const queryStr = mode === 'and' ? toTsqueryAnd(searchTerm) : toTsqueryOr(searchTerm);

  if (!queryStr) {
    return null;
  }

  const escapedQuery = escapePostgresString(queryStr);

  // Uses the raffle_search_vector function created in migration
  return `raffle_search_vector(titulo, descripcion) @@ to_tsquery('spanish', '${escapedQuery}')`;
}

/**
 * Builds a ranking expression for ordering search results by relevance.
 *
 * @param searchTerm - User's search input
 * @returns SQL expression for ts_rank
 */
export function buildRaffleSearchRank(searchTerm: string): string | null {
  const queryStr = toTsqueryOr(searchTerm);

  if (!queryStr) {
    return null;
  }

  const escapedQuery = escapePostgresString(queryStr);

  return `ts_rank(raffle_search_vector(titulo, descripcion), to_tsquery('spanish', '${escapedQuery}'))`;
}
