import { describe, expect, it } from 'vitest';
import {
  buildPositions,
  formatShares,
  parseShares,
  positionValueCents,
  purchaseTotalCents,
  saleProceedsCents,
} from './portfolio';
import type { Movement, MovementType } from './types';

function trade(
  type: Extract<MovementType, 'purchase' | 'sale'>,
  symbol: string,
  shares: number,
  priceCents: number,
  feesCents: number,
  occurredOn: string,
): Movement {
  const value = Math.round(shares * priceCents);
  return {
    id: `${type}-${symbol}-${occurredOn}`,
    categoryId: 'investitii',
    type,
    amountCents: type === 'purchase' ? -(value + feesCents) : value - feesCents,
    occurredOn,
    note: '',
    monthKey: null,
    createdAt: occurredOn,
    trade: { symbol, shares, priceCents, feesCents },
  };
}

describe('portfolio', () => {
  it('totals purchases with fees and sales without them, rounded to cents', () => {
    expect(purchaseTotalCents({ symbol: 'IWDA', shares: 10, priceCents: 8520, feesCents: 250 })).toBe(85450);
    expect(saleProceedsCents({ symbol: 'IWDA', shares: 10, priceCents: 8520, feesCents: 250 })).toBe(84950);
    expect(purchaseTotalCents({ symbol: 'IWDA', shares: 0.333, priceCents: 10000, feesCents: 0 })).toBe(3330);
  });

  it('averages the purchases, weighted by shares, and ignores case and spaces in symbols', () => {
    const positions = buildPositions([
      trade('purchase', 'iwda', 10, 8000, 200, '2026-08-01'),
      trade('purchase', 'IWDA ', 30, 9000, 200, '2026-09-01'),
      trade('purchase', 'VWCE', 1, 10000, 100, '2026-09-02'),
    ]);
    expect(positions[0]).toMatchObject({ symbol: 'IWDA', shares: 40, averagePriceCents: 8750, costCents: 350000, feesCents: 400 });
    expect(positions[1]).toMatchObject({ symbol: 'VWCE', shares: 1, averagePriceCents: 10000, costCents: 10000 });
  });

  it('a sale lowers the shares held but keeps the average purchase price', () => {
    const [p] = buildPositions([
      trade('purchase', 'IWDA', 10, 8000, 0, '2026-08-01'),
      trade('purchase', 'IWDA', 10, 10000, 0, '2026-09-01'),
      trade('sale', 'IWDA', 5, 12000, 100, '2026-10-01'),
    ]);
    expect(p).toMatchObject({ shares: 15, averagePriceCents: 9000, costCents: 135000, feesCents: 100, boughtShares: 20, soldShares: 5 });
  });

  it('values a position at the current price, or at the average price without one', () => {
    const [p] = buildPositions([trade('purchase', 'IWDA', 10, 8000, 0, '2026-08-01')]);
    expect(positionValueCents(p, {})).toBe(80000);
    expect(positionValueCents(p, { IWDA: { priceCents: 9000, updatedOn: '2026-10-02' } })).toBe(90000);
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
