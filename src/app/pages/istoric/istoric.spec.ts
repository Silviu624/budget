import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BudgetStore } from '../../data/budget-store';
import { Breakpoint } from '../../shared/breakpoint';
import { fakeStore } from '../../testing/fake-store';
import { Istoric } from './istoric';

async function render(desktop: boolean) {
  const store = fakeStore();
  await TestBed.configureTestingModule({
    imports: [Istoric],
    providers: [
      provideRouter([{ path: '**', children: [] }]),
      { provide: BudgetStore, useValue: store },
      { provide: Breakpoint, useValue: { desktop: signal(desktop) } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(Istoric);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, store, el, text: el.textContent ?? '' };
}

describe('Istoric', () => {
  it('lists every month newest first with the yearly totals (desktop)', async () => {
    const { el, text } = await render(true);
    expect(text).toContain('Venit în 2026');
    expect(text).toContain('49.800,00 €');
    expect(text).toContain('14.800,00 €');
    expect(text).toContain('35.000,00 €');
    expect(text).toContain('5 luni aplicate · Mai – Septembrie');
    const rows = el.querySelectorAll('tbody tr.clickable');
    expect(rows.length).toBe(6);
    expect(rows[0].textContent).toContain('Octombrie 2026');
    expect(rows[0].textContent).toContain('luna curentă');
    expect(rows[5].textContent).toContain('Mai 2026');
    expect(el.querySelector('tr.total')?.textContent).toContain('Total · 5 luni aplicate');
  });

  it('shows the mobile summary and month cards', async () => {
    const { el, text } = await render(false);
    expect(text).toContain('Atinge o lună pentru a o deschide în Sumar.');
    expect(text).toContain('5 luni aplicate · venit 49.800,00 € · cheltuieli 14.800,00 €');
    expect(el.querySelectorAll('a.mrow').length).toBe(6);
    expect(el.querySelector('a.mrow')?.getAttribute('href')).toContain('/sumar/2026-10');
  });

  it('shows the empty state without months', async () => {
    const store = fakeStore();
    store.months.set([]);
    await TestBed.configureTestingModule({
      imports: [Istoric],
      providers: [
        provideRouter([]),
        { provide: BudgetStore, useValue: store },
        { provide: Breakpoint, useValue: { desktop: signal(true) } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(Istoric);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Încă nu există nicio lună.');
  });
});
