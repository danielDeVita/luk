import { BRAND_NAME } from '@/lib/brand';

export const LEGAL_OPERATOR_NAME = BRAND_NAME;
export const LEGAL_CONTACT_EMAIL = 'legal@luk.app';
export const LEGAL_POSTAL_ADDRESS = 'Ciudad Autónoma de Buenos Aires, Argentina';
export const LEGAL_JURISDICTION_CITY = 'Ciudad Autónoma de Buenos Aires';
export const LEGAL_TERMS_VERSION = '2026-01';
export const LEGAL_LAST_UPDATED = 'Enero 2026';
export const PLATFORM_COMMISSION_PERCENT = 4;

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
  'No se permiten rifas relacionadas con fichas, saldo, creditos, monedas virtuales, apuestas ni valores utilizables fuera de este sitio.';

export function findProhibitedRaffleTerm(
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

export function getProhibitedRaffleContentMessage(
  values: Array<string | null | undefined>,
): string | null {
  const match = findProhibitedRaffleTerm(values);

  if (!match) {
    return null;
  }

  return `${PROHIBITED_RAFFLE_CONTENT_MESSAGE} Detectamos una referencia a "${match}".`;
}
