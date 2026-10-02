/**
 * The month engine: remainder, shares (largest-remainder rounding), targets and overflow chains.
 * Pure functions, implemented exactly as BUILD_BRIEF §4.2–4.3.
 */
import { fixedTotal } from './balances';
import { toTenths } from './money';
import type { Category, MonthAllocation } from './types';

export interface PlanInput {
  incomeCents: number;
  fixedExpenses: readonly { amountCents: number }[];
  allocations: readonly MonthAllocation[];
  categories: readonly Category[];
  /** Current balance of every saving category, before this month. */
  balancesBefore: Readonly<Record<string, number>>;
}

export interface SurplusFlow {
  categoryId: string;
  cents: number;
}

export interface PlanRow {
  categoryId: string;
  category: Category;
  percent: number;
  shareCents: number;
  /** Saving only: the part of its own share that stays in this category. */
  contributionCents: number | null;
  /** Saving only: the part of its own share sent on to the overflow destination. */
  surplusOutCents: number | null;
  /** Saving only: surplus received from other categories. */
  surplusInCents: number | null;
  /** Saving only: contribution + surplus in, i.e. the movement that „Aplică luna” posts. */
  postedCents: number | null;
  balanceBeforeCents: number | null;
  balanceAfterCents: number | null;
  /** Where this category's own surplus went (first hop) and what it received, for the notes. */
  surplusTo: SurplusFlow | null;
  surplusFrom: SurplusFlow[];
  /** Saving with a target: the balance crosses the target during this month. */
  reachesTarget: boolean;
}

export type ApplyBlocker = 'percent' | 'negative';

export interface Plan {
  incomeCents: number;
  fixedTotalCents: number;
  remainderCents: number;
  /** Sum of percentages, one decimal. */
  percentTotal: number;
  /** R − Σ shares: positive while under 100%, negative when over. */
  unallocatedCents: number;
  rows: PlanRow[];
  savingRows: PlanRow[];
  spendingRows: PlanRow[];
  savingPercent: number;
  spendingPercent: number;
  savingSharesCents: number;
  spendingSharesCents: number;
  /** Total posted into saving categories by „Aplică luna”. */
  savingPostedCents: number;
  blockers: ApplyBlocker[];
  canApply: boolean;
}

const UNLIMITED = Number.POSITIVE_INFINITY;

export function computePlan(input: PlanInput): Plan {
  const byId = new Map(input.categories.map((c) => [c.id, c]));
  const ordered = input.allocations
    .filter((a) => byId.has(a.categoryId))
    .map((a) => ({ allocation: a, category: byId.get(a.categoryId)! }))
    .sort((a, b) => a.category.position - b.category.position);

  const fixed = fixedTotal(input.fixedExpenses);
  const remainder = input.incomeCents - fixed;
  const tenths = ordered.map((o) => toTenths(o.allocation.percent));
  const percentTenths = tenths.reduce((s, t) => s + t, 0);
  const shares = computeShares(remainder, tenths, percentTenths);

  const activeSaving = (id: string | null): Category | null => {
    if (!id) {
      return null;
    }
    const c = byId.get(id);
    return c && c.kind !== 'spending' && !c.archivedAt ? c : null;
  };

  const rows: PlanRow[] = ordered.map((o, i) => ({
    categoryId: o.category.id,
    category: o.category,
    percent: o.allocation.percent,
    shareCents: shares[i],
    contributionCents: null,
    surplusOutCents: null,
    surplusInCents: null,
    postedCents: null,
    balanceBeforeCents: null,
    balanceAfterCents: null,
    surplusTo: null,
    surplusFrom: [],
    reachesTarget: false,
  }));

  const savingRows = rows.filter((r) => r.category.kind !== 'spending');
  const rowById = new Map(savingRows.map((r) => [r.categoryId, r]));
  const kept = new Map<string, number>();
  for (const row of savingRows) {
    row.balanceBeforeCents = input.balancesBefore[row.categoryId] ?? 0;
    row.contributionCents = 0;
    row.surplusOutCents = 0;
    row.surplusInCents = 0;
    kept.set(row.categoryId, 0);
  }

  /** How much this category can still take before its target, or unlimited (rule 4.3.4). */
  const roomOf = (row: PlanRow): number => {
    const { targetCents, overflowToId } = row.category;
    const destination = activeSaving(overflowToId);
    if (targetCents === null || !destination || destination.id === row.categoryId) {
      return UNLIMITED;
    }
    const room = Math.max(0, targetCents - (row.balanceBeforeCents ?? 0));
    return Math.max(0, room - (kept.get(row.categoryId) ?? 0));
  };

  const receive = (row: PlanRow, cents: number, from: PlanRow): void => {
    row.surplusInCents! += cents;
    row.surplusFrom.push({ categoryId: from.categoryId, cents });
    kept.set(row.categoryId, kept.get(row.categoryId)! + cents);
  };

  for (const row of savingRows) {
    const own = row.shareCents;
    const keep = Math.min(own, roomOf(row));
    row.contributionCents = keep;
    kept.set(row.categoryId, kept.get(row.categoryId)! + keep);
    let excess = own - keep;
    row.surplusOutCents = excess;
    if (excess <= 0) {
      continue;
    }
    const visited = new Set<string>([row.categoryId]);
    let current = activeSaving(row.category.overflowToId);
    row.surplusTo = { categoryId: current!.id, cents: excess };
    let last: PlanRow | null = null;
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      const target = rowById.get(current.id);
      if (!target) {
        break;
      }
      last = target;
      const take = Math.min(excess, roomOf(target));
      if (take > 0) {
        receive(target, take, row);
        excess -= take;
      }
      if (excess === 0) {
        break;
      }
      current = activeSaving(current.overflowToId);
    }
    if (excess > 0) {
      if (last) {
        // Dead end or cycle: the excess stays in the last category reached.
        receive(last, excess, row);
      } else {
        // The destination is not part of this month: keep everything here.
        row.contributionCents += excess;
        row.surplusOutCents -= excess;
        row.surplusTo = null;
        kept.set(row.categoryId, kept.get(row.categoryId)! + excess);
      }
    }
  }

  for (const row of savingRows) {
    row.postedCents = row.contributionCents! + row.surplusInCents!;
    row.balanceAfterCents = row.balanceBeforeCents! + row.postedCents;
    const target = row.category.targetCents;
    row.reachesTarget =
      target !== null && row.balanceBeforeCents! < target && row.balanceAfterCents >= target;
  }

  const spendingRows = rows.filter((r) => r.category.kind === 'spending');
  const sum = (list: PlanRow[], pick: (r: PlanRow) => number) =>
    list.reduce((s, r) => s + pick(r), 0);
  const blockers: ApplyBlocker[] = [];
  if (percentTenths !== 1000) {
    blockers.push('percent');
  }
  if (remainder < 0) {
    blockers.push('negative');
  }

  return {
    incomeCents: input.incomeCents,
    fixedTotalCents: fixed,
    remainderCents: remainder,
    percentTotal: percentTenths / 10,
    unallocatedCents: remainder - sum(rows, (r) => r.shareCents),
    rows,
    savingRows,
    spendingRows,
    savingPercent: sum(savingRows, (r) => toTenths(r.percent)) / 10,
    spendingPercent: sum(spendingRows, (r) => toTenths(r.percent)) / 10,
    savingSharesCents: sum(savingRows, (r) => r.shareCents),
    spendingSharesCents: sum(spendingRows, (r) => r.shareCents),
    savingPostedCents: sum(savingRows, (r) => r.postedCents ?? 0),
    blockers,
    canApply: blockers.length === 0,
  };
}

/**
 * Shares of the remainder by percent tenths. Floors every share; when the percentages total exactly
 * 100% the leftover cents go one by one to the largest fractional parts (ties by order).
 */
export function computeShares(
  remainderCents: number,
  tenths: readonly number[],
  totalTenths: number,
): number[] {
  if (remainderCents <= 0) {
    return tenths.map(() => 0);
  }
  const raw = tenths.map((t) => remainderCents * t);
  const floors = raw.map((r) => Math.floor(r / 1000));
  if (totalTenths !== 1000) {
    return floors;
  }
  let leftover = remainderCents - floors.reduce((s, f) => s + f, 0);
  const order = raw
    .map((r, i) => ({ i, fraction: r % 1000 }))
    .sort((a, b) => b.fraction - a.fraction || a.i - b.i);
  for (const { i } of order) {
    if (leftover <= 0) {
      break;
    }
    floors[i] += 1;
    leftover -= 1;
  }
  return floors;
}
