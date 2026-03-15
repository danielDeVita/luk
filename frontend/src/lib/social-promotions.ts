export const SOCIAL_PROMOTION_STORAGE_KEY = 'luk-social-promotion-context';

interface StoredSocialPromotionContext {
  token: string;
  raffleId?: string;
  storedAt: string;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

export function persistSocialPromotionToken(token: string, raffleId?: string) {
  if (!isBrowser() || !token) return;

  const value: StoredSocialPromotionContext = {
    token,
    raffleId,
    storedAt: new Date().toISOString(),
  };

  window.localStorage.setItem(
    SOCIAL_PROMOTION_STORAGE_KEY,
    JSON.stringify(value),
  );
}

export function getStoredSocialPromotionToken(raffleId?: string): string | null {
  if (!isBrowser()) return null;

  const raw = window.localStorage.getItem(SOCIAL_PROMOTION_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as StoredSocialPromotionContext;
    if (!parsed.token) return null;
    if (raffleId && parsed.raffleId && parsed.raffleId !== raffleId) return null;
    return parsed.token;
  } catch {
    return null;
  }
}

export function clearStoredSocialPromotionToken() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(SOCIAL_PROMOTION_STORAGE_KEY);
}
