import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BudgetStore } from '../../data/budget-store';
import { Breakpoint } from '../../shared/breakpoint';
import { fakeStore } from '../../testing/fake-store';
import { Fonduri } from './fonduri';

async function render(desktop: boolean) {
  const store = fakeStore();
  await TestBed.configureTestingModule({
    imports: [Fonduri],
    providers: [
      provideRouter([{ path: '**', children: [] }]),
      { provide: BudgetStore, useValue: store },
      { provide: Breakpoint, useValue: { desktop: signal(desktop) } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(Fonduri);
  await fixture.whenStable();
  return { fixture, store, text: (fixture.nativeElement as HTMLElement).textContent ?? '' };
}

describe('Fonduri', () => {
  it('shows the KPIs and every fund on desktop', async () => {
    const { text, fixture } = await render(true);
    expect(text).toContain('Total în fonduri');
    expect(text).toContain('68.420,00 €');
    expect(text).toContain('Contribuții planificate · Octombrie');
    expect(text).toContain('+5.600,00 €');
    expect(text).toContain('Retrageri în 2026');
    expect(text).toContain('−4.480,00 €');
    expect(text).toContain('6 retrageri · ultima pe 19.09.2026');
    expect(fixture.nativeElement.querySelectorAll('a.bu-fcard').length).toBe(8);
    expect(text).toContain('95,6% din 18.000,00 €');
    expect(text).toContain('mai sunt 800,00 €');
    expect(text).toContain('Surplusul merge către Investiții: 600,00 €');
    expect(text).toContain('Include 600,00 € surplus din Fond de siguranță');
    expect(text).toContain('Fără țintă');
    expect(text).toContain('10% din rămas · fără sold');
  });

  it('shows the mobile hero and the spending list', async () => {
    const { text } = await render(false);
    expect(text).toContain('Contribuții planificate în Octombrie');
    expect(text).toContain('8 fonduri');
    expect(text).toContain('Bani personali – Baby');
    expect(text).toContain('1.400,00 €');
  });
});
