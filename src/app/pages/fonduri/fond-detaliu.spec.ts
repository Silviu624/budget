import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BudgetStore } from '../../data/budget-store';
import { Breakpoint } from '../../shared/breakpoint';
import { fakeStore, routeStub } from '../../testing/fake-store';
import { FondDetaliu } from './fond-detaliu';

async function render(id: string, desktop: boolean) {
  const store = fakeStore();
  await TestBed.configureTestingModule({
    imports: [FondDetaliu],
    providers: [
      provideRouter([{ path: '**', children: [] }]),
      { provide: BudgetStore, useValue: store },
      { provide: Breakpoint, useValue: { desktop: signal(desktop) } },
      routeStub({ id }),
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(FondDetaliu);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, store, el, text: () => el.textContent ?? '' };
}

describe('Detaliu fond', () => {
  it('shows Fond de siguranță with its target note and history', async () => {
    const { text, el } = await render('siguranta', true);
    expect(text()).toContain('17.200,00 €');
    expect(text()).toContain('95,6% din țintă');
    expect(text()).toContain(
      'Mai sunt 800,00 € până la țintă. Contribuția planificată din Octombrie o atinge, iar restul de 600,00 € merge către Investiții.',
    );
    expect(text()).toContain('7 mișcări · cele mai noi primele');
    expect(text()).toContain('Planificată · intră la „Aplică luna”');
    expect(text()).toContain('Reparație centrală termică');
    expect(text()).toContain('Sold la pornirea aplicației');
    expect(text()).toContain('Surplusul merge către');
    expect(el.querySelectorAll('table tbody tr').length).toBe(8);
  });

  it('blocks a withdrawal larger than the balance and accepts a valid one', async () => {
    const { fixture, store, el, text } = await render('siguranta', false);
    const amount = el.querySelector('#withdraw-amount') as HTMLInputElement;
    amount.value = '20.000';
    amount.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(text()).toContain('Suma depășește soldul fondului (17.200,00 €).');
    expect(store.addWithdrawal).not.toHaveBeenCalled();

    amount.value = '350';
    amount.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    expect(text()).toContain('16.850,00 €');
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(store.addWithdrawal).toHaveBeenCalledWith('siguranta', 35000, '');
  });
});
