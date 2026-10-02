import { computed, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import seed from '../../../docs/design/design/seed.json';
import { computeBalances } from '../domain/balances';
import { activeByPosition } from '../domain/month';
import type {
  Category,
  CategoryKind,
  Month,
  MonthStatus,
  Movement,
  MovementType,
  Prices,
  Profile,
} from '../domain/types';

/** The design's seed as domain objects. */
export const seedCategories: Category[] = seed.categories.map((c) => ({
  ...c,
  kind: c.kind as CategoryKind,
  initialBalanceCents: c.initialBalanceCents ?? 0,
  archivedAt: null,
}));

export const seedMovements: Movement[] = seed.movements.map((m, i) => ({
  id: String(i),
  categoryId: m.categoryId,
  type: m.type as MovementType,
  amountCents: m.amountCents,
  occurredOn: m.date,
  note: m.note,
  monthKey: 'monthKey' in m ? (m.monthKey as string) : null,
  createdAt: m.date,
}));

export const seedMonths: Month[] = seed.months.map((m) => ({
  key: m.key,
  year: Number(m.key.slice(0, 4)),
  month: Number(m.key.slice(5)),
  incomeCents: m.incomeCents,
  status: m.status as MonthStatus,
  appliedAt: m.appliedAt,
  fixedExpenses: m.fixedExpenses,
  allocations: m.allocations,
}));

export const seedProfile: Profile = {
  displayName: 'Silviu & Baby',
  defaultIncomeCents: seed.settings.defaultIncomeCents,
  theme: 'auto',
  fixedExpenseTemplate: seed.fixedExpenseTemplate,
};

/** A BudgetStore stand-in over the seed, with every write mocked. Today is 2026-10-02 as in the designs. */
export function fakeStore() {
  const profile = signal<Profile | null>(seedProfile);
  const categories = signal(seedCategories);
  const months = signal(seedMonths);
  const movements = signal([...seedMovements].reverse());
  const today = signal('2026-10-02');
  const prices = signal<Prices>({});
  return {
    prices,
    profile,
    categories,
    months,
    movements,
    error: signal<string | null>(null),
    loaded: signal(true),
    today,
    currentMonthKey: computed(() => today().slice(0, 7)),
    firstMonthKey: computed(() => months()[0]?.key ?? null),
    activeCategories: computed(() => activeByPosition(categories())),
    balances: computed(() => computeBalances(categories(), movements())),
    monthByKey: (key: string) => months().find((m) => m.key === key),
    categoryById: (id: string) => categories().find((c) => c.id === id),
    movementsOf: (id: string) => movements().filter((m) => m.categoryId === id),
    canGoBack: () => true,
    canGoForward: () => true,
    ensureMonth: vi.fn().mockResolvedValue(undefined),
    updateMonth: vi.fn().mockResolvedValue(undefined),
    applyMonth: vi.fn().mockResolvedValue(undefined),
    reopenMonth: vi.fn().mockResolvedValue(undefined),
    saveProfile: vi.fn().mockResolvedValue(undefined),
    saveTemplate: vi.fn().mockResolvedValue(undefined),
    saveCategory: vi.fn().mockResolvedValue('new-id'),
    deleteCategory: vi.fn().mockResolvedValue(undefined),
    reorderCategories: vi.fn().mockResolvedValue(undefined),
    addWithdrawal: vi.fn().mockResolvedValue(undefined),
    addTrade: vi.fn().mockResolvedValue(undefined),
    savePrice: vi.fn().mockResolvedValue(undefined),
    deleteMovement: vi.fn().mockResolvedValue(undefined),
  };
}

export type FakeStore = ReturnType<typeof fakeStore>;

/** An ActivatedRoute with fixed path and query params. */
export function routeStub(params: Record<string, string> = {}, query: Record<string, string> = {}) {
  const paramMap = new Map(Object.entries(params));
  const queryParamMap = new Map(Object.entries(query));
  return {
    provide: ActivatedRoute,
    useValue: {
      paramMap: of(paramMap),
      queryParamMap: of(queryParamMap),
      snapshot: { paramMap, queryParamMap },
    },
  };
}
