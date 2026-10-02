import { describe, expect, it } from 'vitest';
import { buildPositions, formatShares, parseShares, purchaseTotalCents } from './portfolio';
import type { Movement } from './types';

function purchase(symbol: string, shares: number, priceCents: number, feesCents: number, id = symbol): Movement {
  return {
    id,
    categoryId: 'investitii',
    type: 'purchase',
    amountCents: -(Math.round(shares * priceCents) + feesCents),
    occurredOn: '2026-10-02',
    note: '',
    monthKey: null,
    createdAt: '2026-10-02',
    purchase: { symbol, shares, priceCents, feesCents },
  };
}

describe('portfolio', () => {
  it('totals shares × price plus fees, rounded to cents', () => {
    expect(purchaseTotalCents({ symbol: 'IWDA', shares: 10, priceCents: 8520, feesCents: 250 })).toBe(85450);
    expect(purchaseTotalCents({ symbol: 'IWDA', shares: 0.333, priceCents: 10000, feesCents: 0 })).toBe(3330);
  });

  it('groups purchases by symbol with an average price', () => {
    const positions = buildPositions([
      purchase('iwda', 10, 8000, 200, 'a'),
      purchase('IWDA ', 10, 9000, 200, 'b'),
      purchase('VWCE', 1, 10000, 100, 'c'),
    ]);
    expect(positions).toEqual([
      { symbol: 'IWDA', shares: 20, costCents: 170000, feesCents: 400, averagePriceCents: 8500 },
      { symbol: 'VWCE', shares: 1, costCents: 10000, feesCents: 100, averagePriceCents: 10000 },
    ]);
  });

  it('formats and parses share counts', () => {
    expect(formatShares(10)).toBe('10');
    expect(formatShares(0.5)).toBe('0,5');
    expect(formatShares(1234.25)).toBe('1.234,25');
    expect(parseShares('10')).toBe(10);
    expect(parseShares('0,5')).toBe(0.5);
    expect(parseShares('0.25')).toBe(0.25);
    for (const bad of ['0', '', 'abc', '1,2345678', '-1']) {
      expect(() => parseShares(bad)).toThrow();
    }
  });
});
