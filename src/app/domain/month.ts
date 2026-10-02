import { parseMonthKey } from './dates';
import type { Category, Month, MonthAllocation, Profile } from './types';

/** A fresh planned month: income and fixed expenses from the template (D2), every active category with its default percent. */
export function createPlannedMonth(key: string, profile: Profile, categories: readonly Category[]): Month {
  const { year, month } = parseMonthKey(key);
  return {
    key,
    year,
    month,
    incomeCents: profile.defaultIncomeCents,
    status: 'planned',
    appliedAt: null,
    fixedExpenses: profile.fixedExpenseTemplate.map((e, i) => ({
      name: e.name,
      amountCents: e.amountCents,
      position: i,
    })),
    allocations: defaultAllocations(categories),
  };
}

export function defaultAllocations(categories: readonly Category[]): MonthAllocation[] {
  return activeByPosition(categories).map((c) => ({ categoryId: c.id, percent: c.percent }));
}

export function activeByPosition(categories: readonly Category[]): Category[] {
  return categories.filter((c) => !c.archivedAt).sort((a, b) => a.position - b.position);
}

/**
 * Planned months follow the category list: new categories join with 0%, archived ones leave.
 * Returns the same array when nothing changed. Applied months are never touched.
 */
export function reconcileAllocations(month: Month, categories: readonly Category[]): MonthAllocation[] {
  if (month.status === 'applied') {
    return month.allocations;
  }
  const active = activeByPosition(categories);
  const existing = new Map(month.allocations.map((a) => [a.categoryId, a]));
  const next = active.map((c) => existing.get(c.id) ?? { categoryId: c.id, percent: 0 });
  const unchanged =
    next.length === month.allocations.length && next.every((a, i) => a === month.allocations[i]);
  return unchanged ? month.allocations : next;
}
