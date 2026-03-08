const PROHIBITED_RAFFLE_PATTERNS = [
  { label: 'fichas', pattern: /\bfichas?\b/i },
  { label: 'saldo', pattern: /\bsaldo\b/i },
  { label: 'creditos', pattern: /\bcr[eé]ditos?\b/i },
  { label: 'gift balance', pattern: /\bgift(?:\s|-)?balance\b/i },
  { label: 'monedas virtuales', pattern: /\bmonedas?\s+virtual(?:es)?\b/i },
  { label: 'top-ups', pattern: /\btop[\s-]?ups?\b/i },
  { label: 'recargas de saldo', pattern: /\brecargas?\s+de\s+saldo\b/i },
  { label: 'bet slips', pattern: /\bbet[\s-]?slips?\b/i },
  {
    label: 'apuestas',
    pattern:
      /\b(?:apuestas?|casino(?:s)?|tragamonedas?|slots?|juegos?\s+de\s+azar|salas?\s+de\s+juego|gambling)\b/i,
  },
] as const;

export const PROHIBITED_RAFFLE_CONTENT_MESSAGE =
  'No se permiten rifas relacionadas con fichas, saldo, creditos, monedas virtuales, apuestas ni valores utilizables fuera del sitio.';

export function findProhibitedRaffleContent(
  values: Array<string | null | undefined>,
): string | null {
  const haystack = values
    .filter((value): value is string => typeof value === 'string')
    .join(' ');

  for (const entry of PROHIBITED_RAFFLE_PATTERNS) {
    if (entry.pattern.test(haystack)) {
      return entry.label;
    }
  }

  return null;
}
