import type { Movement, TradeDetails } from './types';

/** Shares × price, rounded to cents. */
export function tradeValueCents(details: TradeDetails): number {
  return Math.round(details.shares * details.priceCents);
}

/** What leaves the budget on a purchase: shares × price + fees. */
export function purchaseTotalCents(details: TradeDetails): number {
  return tradeValueCents(details) + details.feesCents;
}

/** What comes back on a sale: shares × price − fees. */
export function saleProceedsCents(details: TradeDetails): number {
  return tradeValueCents(details) - details.feesCents;
}

export interface Position {
  symbol: string;
  /** Shares currently held. */
  shares: number;
  /** Average purchase price, weighted by shares, over every purchase ever made. */
  averagePriceCents: number;
  /** Shares held × average purchase price. */
  costCents: number;
  /** Fees of every purchase and sale. */
  feesCents: number;
  boughtShares: number;
  soldShares: number;
}

/** Holdings per symbol (symbols fully sold are kept with 0 shares), largest cost first. */
export function buildPositions(movements: readonly Movement[]): Position[] {
  const bySymbol = new Map<string, Position & { boughtCostCents: number }>();
  const trades = movements
    .filter((m) => (m.type === 'purchase' || m.type === 'sale') && m.trade)
    .sort((a, b) => a.occurredOn.localeCompare(b.occurredOn) || a.createdAt.localeCompare(b.createdAt));
  for (const m of trades) {
    const t = m.trade!;
    const symbol = normalizeSymbol(t.symbol);
    const p = bySymbol.get(symbol) ?? {
      symbol,
      shares: 0,
      averagePriceCents: 0,
      costCents: 0,
      feesCents: 0,
      boughtShares: 0,
      soldShares: 0,
      boughtCostCents: 0,
    };
    p.feesCents += t.feesCents;
    if (m.type === 'purchase') {
      p.boughtShares = roundShares(p.boughtShares + t.shares);
      p.boughtCostCents += tradeValueCents(t);
      p.shares = roundShares(p.shares + t.shares);
    } else {
      p.soldShares = roundShares(p.soldShares + t.shares);
      p.shares = roundShares(Math.max(0, p.shares - t.shares));
    }
    p.averagePriceCents = p.boughtShares > 0 ? Math.round(p.boughtCostCents / p.boughtShares) : 0;
    p.costCents = Math.round(p.shares * p.averagePriceCents);
    bySymbol.set(symbol, p);
  }
  return [...bySymbol.values()]
    .map(({ boughtCostCents: _ignored, ...p }) => p)
    .sort((a, b) => b.costCents - a.costCents || a.symbol.localeCompare(b.symbol));
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
