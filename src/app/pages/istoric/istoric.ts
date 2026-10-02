import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { BudgetStore } from '../../data/budget-store';
import { fixedTotal } from '../../domain/balances';
import { MONTH_NAMES, monthLabel, parseMonthKey } from '../../domain/dates';
import { formatEUR } from '../../domain/money';
import type { MonthStatus } from '../../domain/types';
import { Breakpoint } from '../../shared/breakpoint';
import { Icon } from '../../shared/icon';
import { StatusChip } from '../../shared/status-chip';
import { ShellService } from '../../shell/shell.service';

interface MonthRow {
  key: string;
  label: string;
  incomeCents: number;
  fixedCents: number;
  remainderCents: number;
  status: MonthStatus;
  current: boolean;
}

/** Istoric: every month, newest first, with totals over the applied months of the current year. */
@Component({
  selector: 'app-istoric',
  imports: [RouterLink, Icon, StatusChip],
  templateUrl: './istoric.html',
  styleUrl: './istoric.scss',
})
export class Istoric {
  protected readonly store = inject(BudgetStore);
  protected readonly breakpoint = inject(Breakpoint);
  private readonly router = inject(Router);

  protected readonly eur = formatEUR;

  protected readonly year = computed(() => this.store.currentMonthKey().slice(0, 4));
  protected readonly rows = computed<MonthRow[]>(() => {
    const current = this.store.currentMonthKey();
    return [...this.store.months()].reverse().map((m) => {
      const fixedCents = fixedTotal(m.fixedExpenses);
      return {
        key: m.key,
        label: monthLabel(m.key),
        incomeCents: m.incomeCents,
        fixedCents,
        remainderCents: m.incomeCents - fixedCents,
        status: m.status,
        current: m.key === current,
      };
    });
  });

  /** Applied months of the current year, oldest first. */
  protected readonly applied = computed(() =>
    this.rows()
      .filter((r) => r.status === 'applied' && r.key.startsWith(this.year()))
      .reverse(),
  );
  protected readonly totals = computed(() => {
    const list = this.applied();
    const sum = (pick: (r: MonthRow) => number) => list.reduce((s, r) => s + pick(r), 0);
    const name = (key: string) => MONTH_NAMES[parseMonthKey(key).month - 1];
    const range =
      list.length === 0
        ? ''
        : list.length === 1
          ? name(list[0].key)
          : `${name(list[0].key)} – ${name(list[list.length - 1].key)}`;
    return {
      count: list.length,
      countLabel: list.length === 1 ? '1 lună aplicată' : `${list.length} luni aplicate`,
      range,
      incomeCents: sum((r) => r.incomeCents),
      fixedCents: sum((r) => r.fixedCents),
      remainderCents: sum((r) => r.remainderCents),
    };
  });

  constructor() {
    inject(ShellService).title.set('Istoric');
  }

  protected open(key: string): void {
    void this.router.navigate(['/sumar', key]);
  }
}
