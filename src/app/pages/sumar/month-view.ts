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
  /** What „Aplică luna” posts into the category: contribution + surplus in (the share, for spending buckets). */
  postedCents: number;
  /** What was spent from the category this month („Utilizat”). */
  usedCents: number;
  balanceBeforeCents: number;
  /** Balance once the month is applied and the used amount is taken out. */
  balanceAfterCents: number;
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
  /** Posted into saving and investment funds. */
  savingPostedCents: number;
  /** Posted into every category, spending buckets included. */
  postedTotalCents: number;
  /** Categories that receive money this month. */
  fundsCount: number;
}

/**
 * A planned month is computed live against today's balances. An applied month shows exactly what was
 * posted: the stored results win, and the plan is only recomputed (from the stored balances) for notes.
 * „Utilizat” is always the current value, so „Sold după lună” follows it even on applied months.
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
    const a = stored.get(r.categoryId);
    const s = applied ? a : undefined;
    const saving = r.category.kind !== 'spending';
    const usedCents = a?.usedCents ?? 0;
    const shareCents = s?.shareCents ?? r.shareCents;
    const contributionCents = saving ? (s?.contributionCents ?? r.contributionCents ?? 0) : shareCents;
    const surplusOutCents = saving ? (s?.surplusOutCents ?? r.surplusOutCents ?? 0) : 0;
    const surplusInCents = saving ? (s?.surplusInCents ?? r.surplusInCents ?? 0) : 0;
    const postedCents = contributionCents + surplusInCents;
    const balanceBeforeCents = saving
      ? (r.balanceBeforeCents ?? balancesBefore[r.categoryId] ?? 0)
      : (balancesBefore[r.categoryId] ?? 0);
    const postedBalance = saving
      ? (s?.balanceAfterCents ?? r.balanceAfterCents ?? balanceBeforeCents + postedCents)
      : (s?.balanceAfterCents ?? balanceBeforeCents + postedCents);
    const balanceAfterCents = postedBalance - usedCents;
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
      shareCents,
      contributionCents,
      surplusOutCents,
      surplusInCents,
      postedCents,
      usedCents,
      balanceBeforeCents,
      balanceAfterCents,
      targetPercent: saving && target ? (postedBalance / target) * 100 : null,
      targetReached: saving && target != null && postedBalance >= target,
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
    postedTotalCents: sum(rows, (r) => r.postedCents),
    fundsCount: rows.filter((r) => r.postedCents > 0).length,
  };
}
