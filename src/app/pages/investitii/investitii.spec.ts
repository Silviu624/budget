import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BudgetStore } from '../../data/budget-store';
import type { Trade, TradeType } from '../../domain/types';
import { Breakpoint } from '../../shared/breakpoint';
import { fakeStore } from '../../testing/fake-store';
import { Investitii } from './investitii';

function trade(id: string, type: TradeType, symbol: string, shares: number, priceCents: number, feesCents: number, date: string): Trade {
  return { id, type, symbol, shares, priceCents, feesCents, occurredOn: date, note: '', createdAt: date };
}

async function render(desktop: boolean, withTrades = true) {
  const store = fakeStore();
  if (withTrades) {
    store.trades.set([
      trade('s1', 'sale', 'IWDA', 5, 10000, 100, '2026-09-25'),
      trade('p2', 'purchase', 'IWDA', 10, 9000, 250, '2026-09-20'),
      trade('p1', 'purchase', 'IWDA', 10, 8000, 250, '2026-08-20'),
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
  // Holdings: 15 IWDA at an average of 85,00 € = 1.275,00 €; bought 1.705,00 €; sold 499,00 €; fees 6,00 €.

  it('shows the portfolio and the trades on desktop without touching any balance', async () => {
    const { text, el, store } = await render(true);
    expect(text()).toContain('Investit');
    expect(text()).toContain('1.275,00 €');
    expect(text()).toContain('Cumpărat în total');
    expect(text()).toContain('1.705,00 €');
    expect(text()).toContain('Încasat din vânzări 499,00 €');
    expect(text()).toContain('Taxe plătite');
    expect(text()).toContain('6,00 €');
    expect(text()).toContain('3 tranzacții');
    expect(text()).toContain('+499,00 €');
    expect(text()).toContain('−902,50 €');
    expect(text()).not.toContain('Buget');
    expect(el.querySelectorAll('table')[0].querySelectorAll('tbody tr').length).toBe(1);
    expect(store.balances()['investitii']).toBe(3900000);
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
    expect(text()).toContain('Total plătit');
    expect(text()).toContain('251,50 €');
    form.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(store.addTrade).toHaveBeenCalledWith(
      'purchase',
      { symbol: 'VWCE', shares: 2.5, priceCents: 10000, feesCents: 150 },
      '',
      '2026-10-02',
    );
  });

  it('blocks a sale above the shares held and accepts a valid one', async () => {
    const { fixture, el, store, text } = await render(false);
    (Array.from(el.querySelectorAll('[role="radio"]'))[1] as HTMLButtonElement).click();
    await fixture.whenStable();
    type(el, '#trade-symbol', 'IWDA');
    type(el, '#trade-shares', '1000');
    blurMoney(el, '#trade-price', '100');
    const form = el.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(text()).toContain('Nu ai atâtea acțiuni IWDA (deții 15).');

    type(el, '#trade-shares', '5');
    form.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(store.addTrade).toHaveBeenCalledWith(
      'sale',
      { symbol: 'IWDA', shares: 5, priceCents: 10000, feesCents: 0 },
      '',
      '2026-10-02',
    );
  });

  it('shows the empty states without trades', async () => {
    const { text } = await render(true, false);
    expect(text()).toContain('Nicio acțiune deținută încă.');
    expect(text()).toContain('Nicio tranzacție încă.');
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
