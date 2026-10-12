import { describe, expect, it } from 'vitest';
import { computeBalances } from '../../domain/balances';
import { buildMonthView } from './month-view';
import { seedCategories, seedMonths, seedMovements } from '../../testing/fake-store';

describe('buildMonthView', () => {
  const categories = seedCategories;
  const balances = computeBalances(categories, seedMovements, seedMonths);
  const october = seedMonths.find((m) => m.key === '2026-10')!;

  it('gives spending buckets a balance that grows by the share and shrinks by what was used', () => {
    const month = {
      ...october,
      allocations: october.allocations.map((a) => (a.categoryId === 'extra' ? { ...a, usedCents: 65000 } : a)),
    };
    const view = buildMonthView(month, categories, balances);
    const extra = view.rows.find((r) => r.category.id === 'extra')!;
    expect(extra).toMatchObject({ shareCents: 70000, postedCents: 70000, usedCents: 65000, balanceBeforeCents: 0, balanceAfterCents: 5000 });
    expect(view.postedTotalCents).toBe(700000);
    expect(view.fundsCount).toBe(11);
  });

  it('takes the used amount off a saving fund after the month', () => {
    const month = {
      ...october,
      allocations: october.allocations.map((a) => (a.categoryId === 'vacante' ? { ...a, usedCents: 20000 } : a)),
    };
    const view = buildMonthView(month, categories, balances);
    const vacante = view.rows.find((r) => r.category.id === 'vacante')!;
    expect(vacante).toMatchObject({ postedCents: 70000, usedCents: 20000, balanceAfterCents: 220000 + 70000 - 20000 });
  });

  it('follows the current used value on an applied month', () => {
    const september = seedMonths.find((m) => m.key === '2026-09')!;
    const applied = {
      ...september,
      allocations: september.allocations.map((a) =>
        a.categoryId === 'extra'
          ? { ...a, shareCents: 70000, contributionCents: 70000, surplusOutCents: 0, surplusInCents: 0, balanceAfterCents: 70000, usedCents: 30000 }
          : a,
      ),
    };
    const view = buildMonthView(applied, categories, balances);
    const extra = view.rows.find((r) => r.category.id === 'extra')!;
    expect(extra.balanceAfterCents).toBe(40000);
  });
});
