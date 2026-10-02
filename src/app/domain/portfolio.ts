import type { Movement, PurchaseDetails } from './types';

/** Shares × price, rounded to cents. */
export function purchaseValueCents(details: PurchaseDetails): number {
  return Math.round(details.shares * details.priceCents);
}

/** What leaves the investment budget: shares × price + fees. */
export function purchaseTotalCents(details: PurchaseDetails): number {
  return purchaseValueCents(details) + details.feesCents;
}

export interface Position {
  symbol: string;
  shares: number;
  /** Shares × price over every purchase, without fees. */
  costCents: number;
  feesCents: number;
  averagePriceCents: number;
}

/** Holdings per symbol, largest cost first. */
export function buildPositions(movements: readonly Movement[]): Position[] {
  const bySymbol = new Map<string, Position>();
  for (const m of movements) {
    if (m.type !== 'purchase' || !m.purchase) {
      continue;
    }
    const symbol = normalizeSymbol(m.purchase.symbol);
    const position = bySymbol.get(symbol) ?? {
      symbol,
      shares: 0,
      costCents: 0,
      feesCents: 0,
      averagePriceCents: 0,
    };
    position.shares = roundShares(position.shares + m.purchase.shares);
    position.costCents += purchaseValueCents(m.purchase);
    position.feesCents += m.purchase.feesCents;
    bySymbol.set(symbol, position);
  }
  return [...bySymbol.values()]
    .map((p) => ({ ...p, averagePriceCents: p.shares > 0 ? Math.round(p.costCents / p.shares) : 0 }))
    .sort((a, b) => b.costCents - a.costCents);
}

export function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

export function roundShares(shares: number): number {
  return Math.round(shares * 1_000_000) / 1_000_000;
}

/** `10 → "10"`, `0.5 → "0,5"`, `1234.25 → "1.234,25"`. */
export function formatShares(shares: number): string {
  return new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 6 }).format(shares);
}

/** Accepts `10`, `0,5`, `0.5`, up to 6 decimals; must be greater than 0. */
export function parseShares(text: string): number {
  const s = text.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,6})?$/.test(s)) {
    throw new Error('Număr de acțiuni invalid');
  }
  const value = Number(s);
  if (value <= 0) {
    throw new Error('Număr de acțiuni invalid');
  }
  return value;
}
