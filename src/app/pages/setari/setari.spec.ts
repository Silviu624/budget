import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BudgetStore } from '../../data/budget-store';
import { Breakpoint } from '../../shared/breakpoint';
import { fakeStore, routeStub } from '../../testing/fake-store';
import { Setari } from './setari';

async function render(desktop: boolean, query: Record<string, string> = {}) {
  const store = fakeStore();
  await TestBed.configureTestingModule({
    imports: [Setari],
    providers: [
      provideRouter([{ path: '**', children: [] }]),
      { provide: BudgetStore, useValue: store },
      { provide: Breakpoint, useValue: { desktop: signal(desktop) } },
      routeStub({}, query),
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(Setari);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, store, el, text: () => el.textContent ?? '' };
}

describe('Setări', () => {
  it('shows the default income, template and categories', async () => {
    const { el, text } = await render(true);
    expect(text()).toContain('Venit implicit');
    expect((el.querySelector('#default-income') as HTMLInputElement).value).toBe('10.000,00');
    expect(text()).toContain('Șablon cheltuieli fixe');
    expect(text()).toContain('Chirie');
    expect(text()).toContain('3.000,00 €');
    expect(text()).toContain('Fond de economii · țintă 18.000,00 € · sold inițial 10.800,00 €');
    expect(text()).toContain('Buget de cheltuieli');
    expect(text()).toContain('Total procente');
    expect(el.querySelector('.bu-card-f')?.textContent).toContain('100%');
    expect(el.querySelectorAll('[role="radio"]').length).toBe(3);
  });

  it('opens the editor of the category named in the query string', async () => {
    const { el, text } = await render(true, { categorie: 'siguranta' });
    expect(text()).toContain('Editează categoria');
    const name = el.querySelector('.row-editing input') as HTMLInputElement;
    expect(name.value).toBe('Fond de siguranță');
    expect(text()).toContain('Surplusul merge către');
  });

  it('validates the category name and saves a valid category', async () => {
    const { fixture, el, store, text } = await render(true, { categorie: 'siguranta' });
    const name = el.querySelector('.row-editing input') as HTMLInputElement;
    name.value = '';
    name.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    const save = Array.from(el.querySelectorAll('.row-editing button')).find((b) => b.textContent?.trim() === 'Salvează') as HTMLButtonElement;
    save.click();
    await fixture.whenStable();
    expect(text()).toContain('Numele este obligatoriu.');

    name.value = 'Investiții';
    name.dispatchEvent(new Event('input'));
    save.click();
    await fixture.whenStable();
    expect(text()).toContain('Există deja o categorie cu acest nume.');

    name.value = 'Fond de urgență';
    name.dispatchEvent(new Event('input'));
    save.click();
    await fixture.whenStable();
    expect(store.saveCategory).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Fond de urgență', kind: 'saving', percent: 20, targetCents: 1800000, overflowToId: 'investitii' }),
      'siguranta',
    );
  });

  it('saves the default income', async () => {
    const { fixture, el, store } = await render(false);
    const income = el.querySelector('#default-income') as HTMLInputElement;
    income.value = '11000';
    income.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(store.saveProfile).toHaveBeenCalledWith({ defaultIncomeCents: 1100000 });
  });
});
