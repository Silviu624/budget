import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BudgetStore } from '../../data/budget-store';
import type { Movement } from '../../domain/types';
import { Breakpoint } from '../../shared/breakpoint';
import { fakeStore } from '../../testing/fake-store';
import { Investitii } from './investitii';

function purchase(id: string, symbol: string, shares: number, priceCents: number, feesCents: number, date: string): Movement {
  return {
    id,
    categoryId: 'investitii',
    type: 'purchase',
    amountCents: -(Math.round(shares * priceCents) + feesCents),
    occurredOn: date,
    note: '',
    monthKey: null,
    createdAt: date,
    purchase: { symbol, shares, priceCents, feesCents },
  };
}

async function render(desktop: boolean, withPurchases = true) {
  const store = fakeStore();
  store.categories.update((list) => list.map((c) => (c.id === 'investitii' ? { ...c, kind: 'investment' as const } : c)));
  if (withPurchases) {
    store.movements.update((list) => [
      purchase('p2', 'IWDA', 10, 9000, 250, '2026-09-20'),
      purchase('p1', 'IWDA', 10, 8000, 250, '2026-08-20'),
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
  it('shows the budget, holdings and purchases on desktop', async () => {
    const { text, el } = await render(true);
    // 39.000,00 € from the seed minus two purchases of 802,50 € and 902,50 €
    expect(text()).toContain('Buget disponibil');
    expect(text()).toContain('37.295,00 €');
    expect(text()).toContain('Investit');
    expect(text()).toContain('1.700,00 €');
    expect(text()).toContain('Taxe plătite');
    expect(text()).toContain('5,00 €');
    expect(text()).toContain('Portofoliu');
    expect(text()).toContain('IWDA');
    expect(text()).toContain('85,00 €');
    expect(el.querySelectorAll('table')[1].querySelectorAll('tbody tr').length).toBe(2);
  });

  it('validates the form and adds a purchase', async () => {
    const { fixture, el, store, text } = await render(false);
    const form = el.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(text()).toContain('Introdu simbolul.');

    type(el, '#purchase-symbol', 'vwce');
    form.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(text()).toContain('Numărul de acțiuni trebuie să fie mai mare decât 0.');

    type(el, '#purchase-shares', '2,5');
    blurMoney(el, '#purchase-price', '100');
    blurMoney(el, '#purchase-fees', '1,50');
    await fixture.whenStable();
    expect(text()).toContain('Buget după achiziție');
    expect(text()).toContain('37.043,50 €');
    form.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(store.addPurchase).toHaveBeenCalledWith(
      'investitii',
      { symbol: 'VWCE', shares: 2.5, priceCents: 10000, feesCents: 150 },
      '',
      '2026-10-02',
    );
  });

  it('blocks a purchase above the available budget', async () => {
    const { fixture, el, store, text } = await render(false);
    type(el, '#purchase-symbol', 'IWDA');
    type(el, '#purchase-shares', '1000');
    blurMoney(el, '#purchase-price', '100');
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(text()).toContain('Suma depășește bugetul disponibil (37.295,00 €).');
    expect(store.addPurchase).not.toHaveBeenCalled();
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
