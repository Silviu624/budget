import { describe, expect, it } from 'vitest';
import expected from '../../../docs/design/design/expected-octombrie-2026.json';
import seed from '../../../docs/design/design/seed.json';
import { computePlan, computeShares } from './allocation';
import { computeBalances, fixedTotal } from './balances';
import type { Category, CategoryKind, Movement, MovementType } from './types';

function seedCategories(): Category[] {
  return seed.categories.map((c) => ({
    ...c,
    kind: c.kind as CategoryKind,
    initialBalanceCents: c.initialBalanceCents ?? 0,
    archivedAt: null,
  }));
}

function seedMovements(): Movement[] {
  return seed.movements.map((m, i) => ({
    id: String(i),
    categoryId: m.categoryId,
    type: m.type as MovementType,
    amountCents: m.amountCents,
    occurredOn: m.date,
    note: m.note,
    monthKey: 'monthKey' in m ? (m.monthKey as string) : null,
    createdAt: m.date,
  }));
}

describe('seed reproduces expected-octombrie-2026.json', () => {
  const categories = seedCategories();
  const movements = seedMovements();
  const balances = computeBalances(categories, movements);
  const month = seed.months.find((m) => m.key === '2026-10')!;
  const plan = computePlan({
    incomeCents: month.incomeCents,
    fixedExpenses: month.fixedExpenses,
    allocations: month.allocations,
    categories,
    balancesBefore: balances,
  });

  it('balances before the month', () => {
    expect(balances).toEqual(expected.balancesBeforeCents);
    expect(Object.values(balances).reduce((s, b) => s + b, 0)).toBe(expected.fundsTotalCents);
  });

  it('totals', () => {
    expect(plan.incomeCents).toBe(expected.incomeCents);
    expect(plan.fixedTotalCents).toBe(expected.fixedTotalCents);
    expect(plan.remainderCents).toBe(expected.remainderCents);
    expect(plan.percentTotal).toBe(expected.percentTotal);
    expect(plan.unallocatedCents).toBe(0);
    expect(plan.savingPostedCents).toBe(expected.savingContributionsTotalCents);
    expect(plan.canApply).toBe(true);
  });

  it('every row', () => {
    expect(plan.rows.map((r) => r.categoryId)).toEqual(expected.rows.map((r) => r.categoryId));
    for (const row of expected.rows) {
      const actual = plan.rows.find((r) => r.categoryId === row.categoryId)!;
      expect(
        {
          categoryId: actual.categoryId,
          shareCents: actual.shareCents,
          contributionCents: actual.contributionCents,
          surplusOutCents: actual.surplusOutCents,
          surplusInCents: actual.surplusInCents,
          balanceAfterCents: actual.balanceAfterCents,
        },
        row.categoryId,
      ).toEqual(row);
    }
  });

  it('withdrawals in 2026', () => {
    const total = movements
      .filter((m) => m.type === 'withdrawal' && m.occurredOn.startsWith('2026-'))
      .reduce((s, m) => s + m.amountCents, 0);
    expect(total).toBe(expected.withdrawals2026Cents);
  });

  it('history', () => {
    const history = seed.months.map((m) => ({
      month: m.key,
      incomeCents: m.incomeCents,
      fixedCents: fixedTotal(m.fixedExpenses),
      remainderCents: m.incomeCents - fixedTotal(m.fixedExpenses),
      status: m.status,
    }));
    expect(history).toEqual(expected.history);
  });
});

function cat(id: string, position: number, extra: Partial<Category> = {}): Category {
  return {
    id,
    name: id,
    kind: 'saving',
    percent: 0,
    targetCents: null,
    overflowToId: null,
    initialBalanceCents: 0,
    createdOn: '2026-01-01',
    position,
    archivedAt: null,
    ...extra,
  };
}

function plan(
  categories: Category[],
  percents: Record<string, number>,
  balances: Record<string, number>,
  income = 1000,
  fixed = 0,
) {
  return computePlan({
    incomeCents: income,
    fixedExpenses: fixed ? [{ amountCents: fixed }] : [],
    allocations: categories.map((c) => ({ categoryId: c.id, percent: percents[c.id] ?? 0 })),
    categories,
    balancesBefore: balances,
  });
}

const row = (p: ReturnType<typeof computePlan>, id: string) =>
  p.rows.find((r) => r.categoryId === id)!;

describe('overflow edge cases', () => {
  it('destination also full: the excess continues along the chain', () => {
    const cats = [
      cat('a', 0, { targetCents: 1000, overflowToId: 'b' }),
      cat('b', 1, { targetCents: 500, overflowToId: 'c' }),
      cat('c', 2),
    ];
    const p = plan(cats, { a: 50, c: 50 }, { a: 900, b: 500, c: 0 });
    expect(row(p, 'a')).toMatchObject({
      contributionCents: 100,
      surplusOutCents: 400,
      surplusTo: { categoryId: 'b', cents: 400 },
    });
    expect(row(p, 'b')).toMatchObject({ contributionCents: 0, surplusInCents: 0, postedCents: 0 });
    expect(row(p, 'c')).toMatchObject({ contributionCents: 500, surplusInCents: 400, postedCents: 900 });
    expect(p.savingPostedCents).toBe(1000);
  });

  it('cycle a→b→a: the excess stays in the last category reached', () => {
    const cats = [
      cat('a', 0, { targetCents: 1000, overflowToId: 'b' }),
      cat('b', 1, { targetCents: 100, overflowToId: 'a' }),
    ];
    const p = plan(cats, { a: 50, b: 50 }, { a: 900, b: 100 });
    expect(row(p, 'a')).toMatchObject({ contributionCents: 100, surplusOutCents: 400, surplusInCents: 500 });
    expect(row(p, 'b')).toMatchObject({ contributionCents: 0, surplusOutCents: 500, surplusInCents: 400 });
    expect(p.savingPostedCents).toBe(1000);
  });

  it('target already exceeded: room 0, the whole share moves on', () => {
    const cats = [cat('a', 0, { targetCents: 100, overflowToId: 'b' }), cat('b', 1)];
    const p = plan(cats, { a: 50, b: 50 }, { a: 150, b: 0 });
    expect(row(p, 'a')).toMatchObject({
      contributionCents: 0,
      surplusOutCents: 500,
      balanceAfterCents: 150,
      reachesTarget: false,
    });
    expect(row(p, 'b')).toMatchObject({ contributionCents: 500, surplusInCents: 500, balanceAfterCents: 1000 });
  });

  it('target without destination keeps everything and the bar may pass 100%', () => {
    const cats = [cat('a', 0, { targetCents: 100 })];
    const p = plan(cats, { a: 100 }, { a: 150 });
    expect(row(p, 'a')).toMatchObject({ contributionCents: 1000, surplusOutCents: 0, balanceAfterCents: 1150 });
  });

  it('destination archived or spending counts as no destination', () => {
    const cats = [
      cat('a', 0, { targetCents: 100, overflowToId: 'b' }),
      cat('b', 1, { archivedAt: '2026-09-01T00:00:00Z' }),
      cat('c', 2, { targetCents: 100, overflowToId: 'd' }),
      cat('d', 3, { kind: 'spending' }),
    ];
    const p = plan(cats, { a: 50, c: 50 }, { a: 150, c: 150 });
    expect(row(p, 'a')).toMatchObject({ contributionCents: 500, surplusOutCents: 0 });
    expect(row(p, 'c')).toMatchObject({ contributionCents: 500, surplusOutCents: 0 });
  });

  it('marks the month in which a target is reached', () => {
    const cats = [cat('a', 0, { targetCents: 1000, overflowToId: 'b' }), cat('b', 1)];
    const p = plan(cats, { a: 50, b: 50 }, { a: 600, b: 0 });
    expect(row(p, 'a')).toMatchObject({ contributionCents: 400, surplusOutCents: 100, reachesTarget: true });
  });
});

describe('shares and rounding', () => {
  it('largest remainder: 1.000,01 € split 33,3 / 33,3 / 33,4 sums to exactly R', () => {
    const shares = computeShares(100001, [333, 333, 334], 1000);
    expect(shares).toEqual([33300, 33300, 33401]);
    expect(shares.reduce((s, x) => s + x, 0)).toBe(100001);
  });

  it('ties go to the earlier position', () => {
    expect(computeShares(1, [500, 500], 1000)).toEqual([1, 0]);
  });

  it('under 100%: floored shares, the rest is unallocated and apply is blocked', () => {
    const cats = [cat('a', 0), cat('b', 1)];
    const p = plan(cats, { a: 50, b: 40 }, { a: 0, b: 0 }, 1001);
    expect(p.percentTotal).toBe(90);
    expect(row(p, 'a').shareCents).toBe(500);
    expect(row(p, 'b').shareCents).toBe(400);
    expect(p.unallocatedCents).toBe(101);
    expect(p.blockers).toEqual(['percent']);
    expect(p.canApply).toBe(false);
  });

  it('over 100%: the excess shows as a negative unallocated amount', () => {
    const cats = [cat('a', 0), cat('b', 1)];
    const p = plan(cats, { a: 60, b: 50 }, { a: 0, b: 0 });
    expect(p.unallocatedCents).toBe(-100);
    expect(p.blockers).toEqual(['percent']);
  });

  it('negative remainder: no shares and apply is blocked', () => {
    const cats = [cat('a', 0)];
    const p = plan(cats, { a: 100 }, { a: 0 }, 100, 350);
    expect(p.remainderCents).toBe(-250);
    expect(row(p, 'a').shareCents).toBe(0);
    expect(p.blockers).toEqual(['negative']);
  });

  it('ignores allocations of unknown categories and sorts by position', () => {
    const cats = [cat('b', 1), cat('a', 0)];
    const p = computePlan({
      incomeCents: 1000,
      fixedExpenses: [],
      allocations: [
        { categoryId: 'b', percent: 50 },
        { categoryId: 'zzz', percent: 50 },
        { categoryId: 'a', percent: 50 },
      ],
      categories: cats,
      balancesBefore: {},
    });
    expect(p.rows.map((r) => r.categoryId)).toEqual(['a', 'b']);
    expect(p.percentTotal).toBe(100);
  });
});
