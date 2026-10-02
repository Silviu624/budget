import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { formatDate } from '../../domain/dates';
import { formatEUR, formatPercent } from '../../domain/money';
import { Icon } from '../../shared/icon';
import { PercentInput } from '../../shared/money-input';
import type { MonthView, RowView } from './month-view';

export interface PercentChange {
  categoryId: string;
  percent: number;
}

/** „Alocări”: every category's share this month, grouped, with the overflow notes and the apply footer on desktop. */
@Component({
  selector: 'app-allocations-card',
  imports: [NgTemplateOutlet, Icon, PercentInput],
  templateUrl: './allocations-card.html',
  styleUrl: './allocations-card.scss',
  host: { class: 'bu-card' },
})
export class AllocationsCard {
  readonly view = input.required<MonthView>();
  readonly desktop = input(false);
  readonly percentChange = output<PercentChange>();
  readonly apply = output<void>();

  protected readonly eur = formatEUR;
  protected readonly pct = formatPercent;
  protected readonly plus = (cents: number) => formatEUR(cents, { sign: true });

  protected readonly applied = computed(() => this.view().applied);
  protected readonly appliedDate = computed(() => {
    const at = this.view().month.appliedAt;
    return at ? formatDate(at) : '';
  });
  protected readonly totalShares = computed(
    () => this.view().savingSharesCents + this.view().spendingSharesCents,
  );

  protected keptVerb(): string {
    if (this.desktop()) {
      return 'în fond';
    }
    return this.applied() ? 'au intrat în fond' : 'intră în fond';
  }

  protected sentVerb(): string {
    if (this.desktop()) {
      return '→';
    }
    return this.applied() ? 'au mers către' : 'merg către';
  }

  protected soldLabel(row: RowView): string {
    if (!row.saving) {
      return 'Buget lunar, fără sold';
    }
    const amount = formatEUR(row.balanceAfterCents ?? 0);
    return this.applied() ? `Sold: ${amount}` : `Sold după lună: ${amount}`;
  }

  protected onPercent(row: RowView, percent: number): void {
    this.percentChange.emit({ categoryId: row.category.id, percent });
  }
}
