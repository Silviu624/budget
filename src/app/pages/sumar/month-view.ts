import { computePlan, type Plan } from '../../domain/allocation';
import type { Category, Month } from '../../domain/types';

/** One allocation line as the Sumar screens show it, for planned and applied months alike. */
export interface RowView {
  category: Category;
  saving: boolean;
  percent: number;
  shareCents: number;
  contributionCents: number;
  surplusOutCents: number;
  surplusInCents: number;
  postedCents: number;
  balanceAfterCents: number | null;
  targetPercent: number | null;
  targetReached: boolean;
  surplusToName: string | null;
  surplusFromNames: string[];
}

export interface MonthView {
  month: Month;
  applied: boolean;
  plan: Plan;
  rows: RowView[];
  savingRows: RowView[];
  spendingRows: RowView[];
  savingSharesCents: number;
  spendingSharesCents: number;
  savingPostedCents: number;
  /** Saving categories that receive money this month. */
  fundsCount: number;
}

/**
 * A planned month is computed live against today's balances. An applied month shows exactly what was
 * posted: the stored results win, and the plan is only recomputed (from the stored balances) for notes.
 */
export function buildMonthView(
  month: Month,
  categories: readonly Category[],
  balances: Readonly<Record<string, number>>,
): MonthView {
  const applied = month.status === 'applied';
  let balancesBefore = balances;
  if (applied) {
    const before: Record<string, number> = {};
    for (const a of month.allocations) {
      if (a.balanceAfterCents != null) {
        before[a.categoryId] = a.balanceAfterCents - (a.contributionCents ?? 0) - (a.surplusInCents ?? 0);
      }
    }
    balancesBefore = before;
  }
  const plan = computePlan({
    incomeCents: month.incomeCents,
    fixedExpenses: month.fixedExpenses,
    allocations: month.allocations,
    categories,
    balancesBefore,
  });
  const stored = new Map(month.allocations.map((a) => [a.categoryId, a]));
  const nameOf = (id: string | null | undefined) => categories.find((c) => c.id === id)?.name ?? '';

  const rows: RowView[] = plan.rows.map((r) => {
    const s = applied ? stored.get(r.categoryId) : undefined;
    const saving = r.category.kind !== 'spending';
    const contributionCents = saving ? (s?.contributionCents ?? r.contributionCents ?? 0) : 0;
    const surplusOutCents = saving ? (s?.surplusOutCents ?? r.surplusOutCents ?? 0) : 0;
    const surplusInCents = saving ? (s?.surplusInCents ?? r.surplusInCents ?? 0) : 0;
    const balanceAfterCents = saving ? (s?.balanceAfterCents ?? r.balanceAfterCents) : null;
    const target = r.category.targetCents;
    let surplusFromNames = surplusInCents > 0 ? r.surplusFrom.map((f) => nameOf(f.categoryId)) : [];
    if (surplusInCents > 0 && surplusFromNames.length === 0) {
      surplusFromNames = plan.rows
        .filter((o) => o.category.overflowToId === r.categoryId && (o.surplusOutCents ?? 0) > 0)
        .map((o) => o.category.name);
    }
    return {
      category: r.category,
      saving,
      percent: r.percent,
      shareCents: s?.shareCents ?? r.shareCents,
      contributionCents,
      surplusOutCents,
      surplusInCents,
      postedCents: contributionCents + surplusInCents,
      balanceAfterCents,
      targetPercent: saving && target && balanceAfterCents != null ? (balanceAfterCents / target) * 100 : null,
      targetReached: saving && target != null && balanceAfterCents != null && balanceAfterCents >= target,
      surplusToName: surplusOutCents > 0 ? nameOf(r.surplusTo?.categoryId ?? r.category.overflowToId) : null,
      surplusFromNames,
    };
  });

  const savingRows = rows.filter((r) => r.saving);
  const spendingRows = rows.filter((r) => !r.saving);
  const sum = (list: RowView[], pick: (r: RowView) => number) => list.reduce((s, r) => s + pick(r), 0);
  return {
    month,
    applied,
    plan,
    rows,
    savingRows,
    spendingRows,
    savingSharesCents: sum(savingRows, (r) => r.shareCents),
    spendingSharesCents: sum(spendingRows, (r) => r.shareCents),
    savingPostedCents: sum(savingRows, (r) => r.postedCents),
    fundsCount: savingRows.filter((r) => r.postedCents > 0).length,
  };
}
