import { Component, computed, effect, inject, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BudgetStore } from '../../data/budget-store';
import { formatDate, MONTH_NAMES, monthLabel, parseMonthKey } from '../../domain/dates';
import { formatEUR, formatPercent } from '../../domain/money';
import type { Category } from '../../domain/types';
import { Breakpoint } from '../../shared/breakpoint';
import { Icon } from '../../shared/icon';
import { TargetProgress } from '../../shared/target-progress';
import { ShellService } from '../../shell/shell.service';
import { buildMonthView, type RowView } from '../sumar/month-view';

/** Fonduri: every saving bucket at a glance, plus this month's spending allowances. */
@Component({
  selector: 'app-fonduri',
  imports: [RouterLink, Icon, TargetProgress],
  templateUrl: './fonduri.html',
  styleUrl: './fonduri.scss',
})
export class Fonduri {
  protected readonly store = inject(BudgetStore);
  protected readonly breakpoint = inject(Breakpoint);

  protected readonly eur = formatEUR;
  protected readonly pct = formatPercent;
  protected readonly plus = (cents: number) => formatEUR(cents, { sign: true });

  protected readonly key = this.store.currentMonthKey;
  protected readonly monthName = computed(() => MONTH_NAMES[parseMonthKey(this.key()).month - 1]);
  protected readonly monthTitle = computed(() => monthLabel(this.key()));
  protected readonly month = computed(() => this.store.monthByKey(this.key()));
  protected readonly view = computed(() => {
    const month = this.month();
    return month ? buildMonthView(month, this.store.categories(), this.store.balances()) : null;
  });
  protected readonly planned = computed(() => this.view()?.applied === false);

  protected readonly saving = computed(() => this.store.activeCategories().filter((c) => c.kind === 'saving'));
  protected readonly spending = computed(() => this.store.activeCategories().filter((c) => c.kind === 'spending'));
  protected readonly totalFunds = computed(() =>
    this.saving().reduce((sum, c) => sum + (this.store.balances()[c.id] ?? 0), 0),
  );
  protected readonly withdrawals = computed(() => {
    const year = this.key().slice(0, 4);
    const list = this.store
      .movements()
      .filter((m) => m.type === 'withdrawal' && m.occurredOn.startsWith(year));
    return {
      year,
      totalCents: list.reduce((sum, m) => sum + m.amountCents, 0),
      count: list.length,
      last: list[0] ? formatDate(list[0].occurredOn) : null,
    };
  });

  constructor() {
    inject(ShellService).title.set('Fonduri');
    effect(() => {
      const key = this.key();
      this.store.profile();
      untracked(() => void this.store.ensureMonth(key).catch((err) => console.error(err)));
    });
  }

  protected balance(category: Category): number {
    return this.store.balances()[category.id] ?? 0;
  }

  protected row(category: Category): RowView | undefined {
    return this.view()?.rows.find((r) => r.category.id === category.id);
  }

  protected contributionLabel(): string {
    return this.planned() ? 'Contribuție planificată' : `Contribuție ${this.monthName()}`;
  }
}
