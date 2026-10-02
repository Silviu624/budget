import { provideLocationMocks } from '@angular/common/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { vi } from 'vitest';
import { routes } from './app.routes';
import { AuthService } from './core/auth.service';
import { BudgetStore } from './data/budget-store';
import { createPlannedMonth } from './domain/month';
import { Breakpoint } from './shared/breakpoint';
import { fakeStore, seedCategories, seedProfile } from './testing/fake-store';

/** Drives the real routes and shell over the fake store, like a person tapping through the app. */
async function setup(desktop = false) {
  const store = fakeStore();
  // Behave like Firestore: ensureMonth creates a missing month and the snapshot delivers it.
  store.ensureMonth.mockImplementation(async (key: string) => {
    if (!store.months().some((m) => m.key === key)) {
      store.months.update((list) =>
        [...list, createPlannedMonth(key, seedProfile, seedCategories)].sort((a, b) => a.key.localeCompare(b.key)),
      );
    }
  });
  const auth = {
    user: signal({ email: 'home@example.com' }),
    isLoggedIn: signal(true),
    ready: Promise.resolve(),
    login: vi.fn(),
    logout: vi.fn(),
  };
  await TestBed.configureTestingModule({
    providers: [
      provideRouter(routes),
      provideLocationMocks(),
      { provide: BudgetStore, useValue: store },
      { provide: AuthService, useValue: auth },
      { provide: Breakpoint, useValue: { desktop: signal(desktop) } },
    ],
  }).compileComponents();
  const harness = await RouterTestingHarness.create();
  const text = () => (harness.routeNativeElement?.ownerDocument.body.textContent ?? '');
  return { harness, store, text };
}

describe('month navigation', () => {
  it('moves forward to a month that does not exist yet and back again', async () => {
    const { harness, store, text } = await setup();
    await harness.navigateByUrl('/sumar');
    await harness.fixture.whenStable();
    expect(text()).toContain('Octombrie 2026');
    expect(text()).toContain('Rămas de împărțit');

    const next = harness.fixture.nativeElement.ownerDocument.querySelector(
      'button[aria-label="Luna următoare"]',
    ) as HTMLButtonElement;
    expect(next).not.toBeNull();
    next.click();
    await harness.fixture.whenStable();
    await harness.fixture.whenStable();

    expect(store.ensureMonth).toHaveBeenCalledWith('2026-11');
    expect(store.months().some((m) => m.key === '2026-11')).toBe(true);
    expect(text()).toContain('Noiembrie 2026');
    expect(text()).toContain('Rămas de împărțit');
    expect(text()).not.toContain('Octombrie 2026 ');

    const prev = harness.fixture.nativeElement.ownerDocument.querySelector(
      'button[aria-label="Luna anterioară"]',
    ) as HTMLButtonElement;
    prev.click();
    await harness.fixture.whenStable();
    await harness.fixture.whenStable();
    expect(text()).toContain('Octombrie 2026');
    expect(text()).toContain('Rămas de împărțit');
    expect(text()).toContain('Totul este alocat');
  });

  it('bounces a month before the first one back to the current month', async () => {
    const { harness, text } = await setup();
    await harness.navigateByUrl('/sumar/2026-03');
    await harness.fixture.whenStable();
    await harness.fixture.whenStable();
    expect(text()).toContain('Octombrie 2026');
    expect(text()).toContain('Rămas de împărțit');
  });

  it('switches between pages keeping the shell slots in sync', async () => {
    const { harness, text } = await setup(true);
    await harness.navigateByUrl('/sumar');
    await harness.fixture.whenStable();
    expect(text()).toContain('Octombrie 2026');
    await harness.navigateByUrl('/fonduri');
    await harness.fixture.whenStable();
    expect(text()).toContain('Total în fonduri');
    expect(text()).not.toContain('Luna a fost aplicată');
    await harness.navigateByUrl('/sumar/2026-09');
    await harness.fixture.whenStable();
    expect(text()).toContain('Septembrie 2026');
    expect(text()).toContain('Luna a fost aplicată');
  });
});
