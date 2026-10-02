import { effect, inject, Injectable, signal, untracked } from '@angular/core';
import { BudgetStore } from '../data/budget-store';
import type { ThemeChoice } from '../domain/types';

const CACHE_KEY = 'buget.theme';

/** Setări → Temă: Automată (no attribute, follows the device), Luminoasă or Întunecată. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly store = inject(BudgetStore);
  readonly choice = signal<ThemeChoice>(readCache());

  constructor() {
    this.apply(this.choice());
    effect(() => {
      const saved = this.store.profile()?.theme;
      if (saved && saved !== untracked(this.choice)) {
        this.apply(saved);
      }
    });
  }

  async set(choice: ThemeChoice): Promise<void> {
    this.apply(choice);
    await this.store.saveProfile({ theme: choice });
  }

  private apply(choice: ThemeChoice): void {
    this.choice.set(choice);
    const root = document.documentElement;
    if (choice === 'auto') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', choice);
    }
    try {
      localStorage.setItem(CACHE_KEY, choice);
    } catch {
      // Private mode or blocked storage: the choice still applies for this page load.
    }
  }
}

function readCache(): ThemeChoice {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    return cached === 'light' || cached === 'dark' ? cached : 'auto';
  } catch {
    return 'auto';
  }
}
