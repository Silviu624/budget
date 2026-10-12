/** Domain types shared by the pure engine, the Firestore layer and the UI. All money is integer euro cents. */

export type CategoryKind = 'saving' | 'spending' | 'investment';

export const KIND_LABELS: Record<CategoryKind, string> = {
  saving: 'Fond de economii',
  spending: 'Buget de cheltuieli',
  investment: 'Investiții',
};

/** Every kind keeps a running balance: the month's share comes in, „Utilizat” goes out, the rest carries over. */
export function holdsBalance(_kind: CategoryKind): boolean {
  return true;
}

export interface Category {
  id: string;
  name: string;
  kind: CategoryKind;
  /** Default percent of the remainder, one decimal (e.g. 2.5). */
  percent: number;
  /** Balance-holding kinds only. */
  targetCents: number | null;
  /** Balance-holding kinds only: id of another such category that receives the surplus once the target is reached. */
  overflowToId: string | null;
  /** Balance-holding kinds only. */
  initialBalanceCents: number;
  /** ISO date (yyyy-mm-dd). */
  createdOn: string;
  position: number;
  /** ISO date-time when archived, or null while active. */
  archivedAt: string | null;
}

export interface FixedExpense {
  name: string;
  amountCents: number;
  position: number;
  /** On a month: the day it was marked as paid, or null. Never set on the template. */
  paidOn?: string | null;
}

/** An amount that came in during a month („Salariu”, „Bonus”); the month's income is their sum. */
export type IncomeEntry = FixedExpense;

export type MonthStatus = 'planned' | 'applied';

/** Allocation line stored on a month. Result fields are written by „Aplică luna” and null otherwise. */
export interface MonthAllocation {
  categoryId: string;
  percent: number;
  /** What was actually spent from this category during the month; counted once the month is applied. */
  usedCents?: number | null;
  shareCents?: number | null;
  contributionCents?: number | null;
  surplusOutCents?: number | null;
  surplusInCents?: number | null;
  balanceAfterCents?: number | null;
}

export interface Month {
  /** yyyy-mm, also the document id. */
  key: string;
  year: number;
  month: number;
  /** Always Σ incomes; stored so Istoric and the engine read one number. */
  incomeCents: number;
  incomes: IncomeEntry[];
  status: MonthStatus;
  /** ISO date-time or null. */
  appliedAt: string | null;
  fixedExpenses: FixedExpense[];
  allocations: MonthAllocation[];
}

export type MovementType = 'contribution' | 'withdrawal' | 'purchase' | 'sale';

/** A trade in an investment category: shares of one symbol at one price, plus fees. */
export interface TradeDetails {
  symbol: string;
  /** May be fractional (up to 6 decimals). */
  shares: number;
  priceCents: number;
  feesCents: number;
}

export interface Movement {
  id: string;
  categoryId: string;
  type: MovementType;
  /** Signed: contributions and sales positive, withdrawals and purchases negative. */
  amountCents: number;
  /** ISO date (yyyy-mm-dd). */
  occurredOn: string;
  note: string;
  /** Set for contributions posted by „Aplică luna”. */
  monthKey: string | null;
  /** ISO date-time. */
  createdAt: string;
  /** Set for purchases and sales. */
  trade?: TradeDetails | null;
}

export type ThemeChoice = 'auto' | 'light' | 'dark';

export interface Profile {
  displayName: string;
  /** No longer used: every month starts at 0 and incomes are added as they arrive. */
  defaultIncomeCents: number;
  theme: ThemeChoice;
  fixedExpenseTemplate: FixedExpense[];
}
