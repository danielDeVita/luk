import { describe, expect, it } from 'vitest';
import {
  findProhibitedRaffleTerm,
  getProhibitedRaffleContentMessage,
} from '@/lib/legal';

describe('legal raffle validation', () => {
  it('detects prohibited gambling-related terms', () => {
    expect(
      findProhibitedRaffleTerm([
        'Pack de fichas premium',
        'Sirve para casino online',
      ]),
    ).toBe('fichas');
  });

  it('returns null when content describes a regular physical product', () => {
    expect(
      findProhibitedRaffleTerm([
        'PlayStation 5 nueva',
        'Con caja y garantia oficial',
      ]),
    ).toBeNull();
  });

  it('builds a user-facing validation message', () => {
    expect(
      getProhibitedRaffleContentMessage([
        'Saldo para apuestas deportivas',
      ]),
    ).toContain('saldo');
  });
});
