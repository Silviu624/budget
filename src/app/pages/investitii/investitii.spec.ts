import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BudgetStore } from '../../data/budget-store';
import type { Movement, MovementType } from '../../domain/types';
import { Breakpoint } from '../../shared/breakpoint';
import { fakeStore } from '../../testing/fake-store';
import { Investitii } from './investitii';

function trade(
  id: string,
  type: Extract<MovementType, 'purchase' | 'sale'>,
  symbol: string,
  shares: number,
  priceCents: number,
  feesCents: number,
  date: string,
): Movement {
  const value = Math.round(shares * priceCents);
  return {
    id,
    categoryId: 'investitii',
    type,
    amountCents: type === 'purchase' ? -(value + feesCents) : value - feesCents,
    occurredOn: date,
    note: '',
    monthKey: null,
    createdAt: date,
    trade: { symbol, shares, priceCents, feesCents },
  };
}

async function render(desktop: boolean, withTrades = true) {
  const store = fakeStore();
  store.categories.update((list) => list.map((c) => (c.id === 'investitii' ? { ...c, kind: 'investment' as const } : c)));
  if (withTrades) {
    store.movements.update((list) => [
      trade('s1', 'sale', 'IWDA', 5, 10000, 100, '2026-09-25'),
      trade('p2', 'purchase', 'IWDA', 10, 9000, 250, '2026-09-20'),
      trade('p1', 'purchase', 'IWDA', 10, 8000, 250, '2026-08-20'),
      ...list,
    ]);
  }
  await TestBed.configureTestingModule({
    imports: [Investitii],
    providers: [
      provideRouter([{ path: '**', children: [] }]),
      { provide: BudgetStore, useValue: store },
      { provide: Breakpoint, useValue: { desktop: signal(desktop) } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(Investitii);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, store, el, text: () => el.textContent ?? '' };
}

describe('Investiții', () => {
  // Seed balance 39.000,00 € − 802,50 € − 902,50 € + 499,00 € = 37.794,00 €.
  // Holdings: 15 IWDA at an average of 85,00 € = 1.275,00 €; fees 6,00 €.

  it('shows the budget, portfolio and trades on desktop', async () => {
    const { text, el } = await render(true);
    expect(text()).toContain('Buget disponibil');
    expect(text()).toContain('37.794,00 €');
    expect(text()).toContain('Investit');
    expect(text()).toContain('1.275,00 €');
    expect(text()).toContain('la prețul mediu de cumpărare');
    expect(text()).toContain('Taxe plătite');
    expect(text()).toContain('6,00 €');
    expect(text()).toContain('3 tranzacții');
    expect(text()).toContain('Vânzare');
    expect(text()).toContain('+499,00 €');
    const portfolio = el.querySelectorAll('table')[0];
    expect(portfolio.querySelectorAll('tbody tr').length).toBe(1);
    expect(portfolio.textContent).toContain('85,00 €');
  });

  it('adds a purchase after validating the form', async () => {
    const { fixture, el, store, text } = await render(false);
    const form = el.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(text()).toContain('Introdu simbolul.');

    type(el, '#trade-symbol', 'vwce');
    type(el, '#trade-shares', '2,5');
    blurMoney(el, '#trade-price', '100');
    blurMoney(el, '#trade-fees', '1,50');
    await fixture.whenStable();
    expect(text()).toContain('Buget după cumpărare');
    expect(text()).toContain('37.542,50 €');
    form.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(store.addTrade).toHaveBeenCalledWith(
      'investitii',
      'purchase',
      { symbol: 'VWCE', shares: 2.5, priceCents: 10000, feesCents: 150 },
      '',
      '2026-10-02',
    );
  });

  it('blocks a purchase above the budget and a sale above the shares held', async () => {
    const { fixture, el, store, text } = await render(false);
    type(el, '#trade-symbol', 'IWDA');
    type(el, '#trade-shares', '1000');
    blurMoney(el, '#trade-price', '100');
    const form = el.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(text()).toContain('Suma depășește bugetul disponibil (37.794,00 €).');

    (Array.from(el.querySelectorAll('[role="radio"]'))[1] as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(text()).toContain('Buget după vânzare');
    form.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(text()).toContain('Nu ai atâtea acțiuni IWDA (deții 15).');

    type(el, '#trade-shares', '5');
    form.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(store.addTrade).toHaveBeenCalledWith(
      'investitii',
      'sale',
      { symbol: 'IWDA', shares: 5, priceCents: 10000, feesCents: 0 },
      '',
      '2026-10-02',
    );
  });

  it('points to Setări when no investment category exists', async () => {
    const store = fakeStore();
    await TestBed.configureTestingModule({
      imports: [Investitii],
      providers: [
        provideRouter([]),
        { provide: BudgetStore, useValue: store },
        { provide: Breakpoint, useValue: { desktop: signal(true) } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(Investitii);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Nu ai încă o categorie de tip Investiții.');
  });
});

function type(el: HTMLElement, selector: string, value: string): void {
  const input = el.querySelector(selector) as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

function blurMoney(el: HTMLElement, selector: string, value: string): void {
  const input = el.querySelector(selector) as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('blur'));
}
