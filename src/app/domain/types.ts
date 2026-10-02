/** Domain types shared by the pure engine, the Firestore layer and the UI. All money is integer euro cents. */

export type CategoryKind = 'saving' | 'spending';

export interface Category {
  id: string;
  name: string;
  kind: CategoryKind;
  /** Default percent of the remainder, one decimal (e.g. 2.5). */
  percent: number;
  /** Saving only. */
  targetCents: number | null;
  /** Saving only: id of another saving category that receives the surplus once the target is reached. */
  overflowToId: string | null;
  /** Saving only. */
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
}

export type MonthStatus = 'planned' | 'applied';

/** Allocation line stored on a month. Result fields are written by „Aplică luna” and null otherwise. */
export interface MonthAllocation {
  categoryId: string;
  percent: number;
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
  incomeCents: number;
  status: MonthStatus;
  /** ISO date-time or null. */
  appliedAt: string | null;
  fixedExpenses: FixedExpense[];
  allocations: MonthAllocation[];
}

export type MovementType = 'contribution' | 'withdrawal';

export interface Movement {
  id: string;
  categoryId: string;
  type: MovementType;
  /** Signed: contributions positive, withdrawals negative. */
  amountCents: number;
  /** ISO date (yyyy-mm-dd). */
  occurredOn: string;
  note: string;
  /** Set for contributions posted by „Aplică luna”. */
  monthKey: string | null;
  /** ISO date-time. */
  createdAt: string;
}

export type ThemeChoice = 'auto' | 'light' | 'dark';

export interface Profile {
  displayName: string;
  defaultIncomeCents: number;
  theme: ThemeChoice;
  fixedExpenseTemplate: FixedExpense[];
}
