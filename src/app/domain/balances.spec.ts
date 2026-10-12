import { describe, expect, it } from 'vitest';
import { computeBalances } from './balances';
import type { Category, Month, Movement } from './types';

function cat(id: string, kind: Category['kind'], initialBalanceCents = 0): Category {
  return { id, name: id, kind, percent: 0, targetCents: null, overflowToId: null, initialBalanceCents, createdOn: '2026-01-01', position: 0, archivedAt: null };
}

function month(key: string, status: Month['status'], used: Record<string, number>): Month {
  return {
    key,
    year: 2026,
    month: Number(key.slice(5)),
    incomeCents: 0,
    incomes: [],
    status,
    appliedAt: null,
    fixedExpenses: [],
    allocations: Object.entries(used).map(([categoryId, usedCents]) => ({ categoryId, percent: 0, usedCents })),
  };
}

describe('computeBalances', () => {
  const categories = [cat('fond', 'saving', 1000), cat('extra', 'spending')];
  const movements: Movement[] = [
    { id: '1', categoryId: 'fond', type: 'contribution', amountCents: 500, occurredOn: '2026-09-02', note: '', monthKey: '2026-09', createdAt: '' },
    { id: '2', categoryId: 'extra', type: 'contribution', amountCents: 700, occurredOn: '2026-09-02', note: '', monthKey: '2026-09', createdAt: '' },
    { id: '3', categoryId: 'fond', type: 'withdrawal', amountCents: -200, occurredOn: '2026-09-10', note: '', monthKey: null, createdAt: '' },
  ];

  it('every kind holds a balance: initial plus movements', () => {
    expect(computeBalances(categories, movements)).toEqual({ fond: 1300, extra: 700 });
  });

  it('subtracts what was used in applied months only', () => {
    const months = [month('2026-09', 'applied', { fond: 100, extra: 650 }), month('2026-10', 'planned', { extra: 999 })];
    expect(computeBalances(categories, movements, months)).toEqual({ fond: 1200, extra: 50 });
  });

  it('lets a spending bucket go negative when more was used than it had', () => {
    const months = [month('2026-09', 'applied', { extra: 900 })];
    expect(computeBalances(categories, movements, months)['extra']).toBe(-200);
  });
});
