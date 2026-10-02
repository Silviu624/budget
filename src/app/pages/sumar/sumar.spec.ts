import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import seed from '../../../../docs/design/design/seed.json';
import { BudgetStore } from '../../data/budget-store';
import { computeBalances } from '../../domain/balances';
import type { Category, CategoryKind, Month, MonthStatus, Movement, MovementType } from '../../domain/types';
import { Breakpoint } from '../../shared/breakpoint';
import { Sumar } from './sumar';

const categories: Category[] = seed.categories.map((c) => ({
  ...c,
  kind: c.kind as CategoryKind,
  initialBalanceCents: c.initialBalanceCents ?? 0,
  archivedAt: null,
}));
const movements: Movement[] = seed.movements.map((m, i) => ({
  id: String(i),
  categoryId: m.categoryId,
  type: m.type as MovementType,
  amountCents: m.amountCents,
  occurredOn: m.date,
  note: m.note,
  monthKey: 'monthKey' in m ? (m.monthKey as string) : null,
  createdAt: m.date,
}));
const months: Month[] = seed.months.map((m) => ({
  key: m.key,
  year: Number(m.key.slice(0, 4)),
  month: Number(m.key.slice(5)),
  incomeCents: m.incomeCents,
  status: m.status as MonthStatus,
  appliedAt: m.appliedAt,
  fixedExpenses: m.fixedExpenses,
  allocations: m.allocations,
}));

function fakeStore(desktopMonths = months) {
  const monthsSignal = signal(desktopMonths);
  const categoriesSignal = signal(categories);
  const movementsSignal = signal(movements);
  return {
    profile: signal(seed.settings && { ...seed.settings, displayName: 'Silviu & Baby', fixedExpenseTemplate: [] }),
    categories: categoriesSignal,
    months: monthsSignal,
    movements: movementsSignal,
    balances: computed(() => computeBalances(categoriesSignal(), movementsSignal())),
    currentMonthKey: signal('2026-10'),
    firstMonthKey: computed(() => monthsSignal()[0]?.key ?? null),
    monthByKey: (key: string) => monthsSignal().find((m) => m.key === key),
    canGoBack: () => true,
    canGoForward: () => true,
    ensureMonth: vi.fn().mockResolvedValue(undefined),
    updateMonth: vi.fn().mockResolvedValue(undefined),
    applyMonth: vi.fn().mockResolvedValue(undefined),
    reopenMonth: vi.fn().mockResolvedValue(undefined),
  };
}

async function render(key: string, desktop: boolean) {
  const store = fakeStore();
  await TestBed.configureTestingModule({
    imports: [Sumar],
    providers: [
      provideRouter([{ path: '**', children: [] }]),
      { provide: BudgetStore, useValue: store },
      { provide: Breakpoint, useValue: { desktop: signal(desktop) } },
      {
        provide: ActivatedRoute,
        useValue: { paramMap: of(new Map([['key', key]])), snapshot: { paramMap: new Map([['key', key]]) } },
      },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(Sumar);
  await fixture.whenStable();
  return { fixture, store, text: (fixture.nativeElement as HTMLElement).textContent ?? '' };
}

describe('Sumar', () => {
  it('shows the planned October 2026 from the seed (mobile)', async () => {
    const { text, store } = await render('2026-10', false);
    expect(store.ensureMonth).toHaveBeenCalledWith('2026-10');
    expect(text).toContain('Rămas de împărțit');
    expect(text).toContain('7.000,00 €');
    expect(text).toContain('Totul este alocat');
    expect(text).toContain('Țintă atinsă: 800,00 € intră în fond, 600,00 € merg către Investiții');
    expect(text).toContain('Primește +600,00 € surplus din Fond de siguranță');
    expect(text).toContain('Sold după lună: 18.000,00 €');
    expect(text).toContain('Buget lunar, fără sold');
  });

  it('renders the desktop table with the apply footer', async () => {
    const { fixture, text } = await render('2026-10', true);
    expect(fixture.nativeElement.querySelector('table.bu-table')).not.toBeNull();
    expect(text).toContain('La aplicare, +5.600,00 € intră în 8 fonduri.');
    expect(text).toContain('Procent din rămasul de 7.000,00 €');
    const apply = fixture.nativeElement.querySelector('.bu-card-f button') as HTMLButtonElement;
    expect(apply.disabled).toBe(false);
  });

  it('shows an applied month read-only with its stored balances', async () => {
    const { fixture, text } = await render('2026-09', false);
    expect(text).toContain('Luna a fost aplicată');
    expect(text).toContain('Pe 02.09.2026 la 09:14');
    expect(text).toContain('Total încasat');
    expect(fixture.nativeElement.querySelector('input[buMoney]')).toBeNull();
  });

  it('opens the confirm dialog for „Aplică luna”', async () => {
    const { fixture, text: _text, store } = await render('2026-10', true);
    (fixture.nativeElement.querySelector('.bu-card-f button') as HTMLButtonElement).click();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Aplici luna Octombrie 2026?');
    expect(el.textContent).toContain('Se adaugă +5.600,00 € în 8 fonduri');
    (el.querySelector('.bu-dialog .bu-btn.primary') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(store.applyMonth).toHaveBeenCalledWith('2026-10');
  });
});
