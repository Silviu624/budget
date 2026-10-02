import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { BudgetStore, NETWORK_ERROR } from '../../data/budget-store';
import {
  addMonths,
  compareMonthKeys,
  formatDate,
  formatDateTime,
  isMonthKey,
  monthLabel,
} from '../../domain/dates';
import { formatEUR, formatPercent, MINUS } from '../../domain/money';
import type { FixedExpense } from '../../domain/types';
import { AllocationMeter } from '../../shared/allocation-meter';
import { Breakpoint } from '../../shared/breakpoint';
import { ConfirmDialog } from '../../shared/confirm-dialog';
import { Icon } from '../../shared/icon';
import { MoneyInput } from '../../shared/money-input';
import { StatusChip } from '../../shared/status-chip';
import { BottomSlot, ShellService, TopSlot } from '../../shell/shell.service';
import { AllocationsCard, type PercentChange } from './allocations-card';
import { FixedExpensesCard } from './fixed-expenses-card';
import { buildMonthView } from './month-view';

type Dialog = 'apply' | 'reopen' | null;

/** Sumar: one month, planned (editable) or applied (read-only), with the month selector in the shell. */
@Component({
  selector: 'app-sumar',
  imports: [
    NgTemplateOutlet,
    TopSlot,
    BottomSlot,
    Icon,
    StatusChip,
    AllocationMeter,
    MoneyInput,
    ConfirmDialog,
    FixedExpensesCard,
    AllocationsCard,
  ],
  templateUrl: './sumar.html',
  styleUrl: './sumar.scss',
})
export class Sumar {
  protected readonly store = inject(BudgetStore);
  protected readonly breakpoint = inject(Breakpoint);
  private readonly shell = inject(ShellService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly eur = formatEUR;
  protected readonly pct = formatPercent;
  protected readonly minus = MINUS;

  private readonly routeKey = toSignal(this.route.paramMap.pipe(map((p) => p.get('key'))), {
    initialValue: this.route.snapshot.paramMap.get('key'),
  });
  protected readonly key = computed(() => this.routeKey() ?? this.store.currentMonthKey());
  protected readonly label = computed(() => (isMonthKey(this.key()) ? monthLabel(this.key()) : ''));
  protected readonly month = computed(() => this.store.monthByKey(this.key()));
  protected readonly view = computed(() => {
    const month = this.month();
    return month ? buildMonthView(month, this.store.categories(), this.store.balances()) : null;
  });
  protected readonly canGoBack = computed(() => this.store.canGoBack(this.key()));
  protected readonly canGoForward = computed(() => this.store.canGoForward(this.key()));
  protected readonly defaultIncome = computed(() =>
    formatEUR(this.store.profile()?.defaultIncomeCents ?? 0),
  );
  protected readonly appliedAt = computed(() => {
    const at = this.month()?.appliedAt;
    return at ? formatDateTime(at) : '';
  });
  protected readonly appliedDate = computed(() => {
    const at = this.month()?.appliedAt;
    return at ? formatDate(at) : '';
  });

  protected readonly dialog = signal<Dialog>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.shell.title.set('');
    effect(() => {
      const key = this.key();
      this.store.categories();
      this.store.months();
      this.store.profile();
      untracked(() => void this.ensure(key));
    });
  }

  /** Creates the month on first visit and keeps a planned month's categories in sync; bounces invalid keys. */
  private async ensure(key: string): Promise<void> {
    const current = this.store.currentMonthKey();
    const first = this.store.firstMonthKey() ?? current;
    const tooEarly = compareMonthKeys(key, first) < 0 && key !== current;
    const tooLate = compareMonthKeys(key, addMonths(current, 1)) > 0;
    if (!isMonthKey(key) || tooEarly || tooLate) {
      await this.router.navigateByUrl('/sumar', { replaceUrl: true });
      return;
    }
    try {
      await this.store.ensureMonth(key);
    } catch (err) {
      console.error(err);
      this.error.set(NETWORK_ERROR);
    }
  }

  protected go(delta: number): void {
    void this.router.navigate(['/sumar', addMonths(this.key(), delta)]);
  }

  protected setIncome(incomeCents: number): void {
    void this.save(() => this.store.updateMonth(this.key(), { incomeCents }));
  }

  protected setFixedExpenses(fixedExpenses: FixedExpense[]): void {
    void this.save(() => this.store.updateMonth(this.key(), { fixedExpenses }));
  }

  protected setPercent({ categoryId, percent }: PercentChange): void {
    const month = this.month();
    if (!month) {
      return;
    }
    const allocations = month.allocations.map((a) =>
      a.categoryId === categoryId ? { categoryId, percent } : a,
    );
    void this.save(() => this.store.updateMonth(this.key(), { allocations }));
  }

  protected async confirmDialog(): Promise<void> {
    const which = this.dialog();
    if (!which || this.busy()) {
      return;
    }
    this.busy.set(true);
    try {
      if (which === 'apply') {
        await this.store.applyMonth(this.key());
      } else {
        await this.store.reopenMonth(this.key());
      }
      this.dialog.set(null);
      this.error.set(null);
    } catch (err) {
      this.dialog.set(null);
      this.error.set(err instanceof Error && err.message ? err.message : NETWORK_ERROR);
    } finally {
      this.busy.set(false);
    }
  }

  protected dialogTitle(): string {
    return this.dialog() === 'apply' ? `Aplici luna ${this.label()}?` : `Editezi luna ${this.label()}?`;
  }

  protected dialogBody(): string {
    const posted = formatEUR(this.view()?.savingPostedCents ?? 0, { sign: true });
    const count = this.view()?.fundsCount ?? 0;
    return this.dialog() === 'apply'
      ? `Se adaugă ${posted} în ${count} fonduri, iar luna devine doar pentru citire. O poți edita oricând.`
      : `Contribuțiile de ${posted} vor fi scoase din fonduri până când aplici luna din nou.`;
  }

  private async save(write: () => Promise<void>): Promise<void> {
    try {
      await write();
      this.error.set(null);
    } catch (err) {
      console.error(err);
      this.error.set(NETWORK_ERROR);
    }
  }
}
