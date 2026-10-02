import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, output, signal } from '@angular/core';
import { fixedTotal } from '../../domain/balances';
import { formatEUR } from '../../domain/money';
import type { FixedExpense } from '../../domain/types';
import { ConfirmDialog } from '../../shared/confirm-dialog';
import { Icon } from '../../shared/icon';
import { MoneyInput } from '../../shared/money-input';

/** „Cheltuieli fixe”: the month's list with inline editing (mobile: tap a row; desktop: amount inputs + pencil/trash). */
@Component({
  selector: 'app-fixed-expenses-card',
  imports: [NgTemplateOutlet, Icon, MoneyInput, ConfirmDialog],
  templateUrl: './fixed-expenses-card.html',
  styleUrl: './fixed-expenses-card.scss',
  host: { class: 'bu-card' },
})
export class FixedExpensesCard {
  readonly expenses = input.required<FixedExpense[]>();
  readonly readonly = input(false);
  readonly subtitle = input('');
  readonly desktop = input(false);
  readonly changed = output<FixedExpense[]>();

  protected readonly eur = formatEUR;
  protected readonly total = computed(() => fixedTotal(this.expenses()));
  protected readonly editing = signal<number | 'new' | null>(null);
  protected readonly draftName = signal('');
  protected readonly draftCents = signal(0);
  protected readonly draftError = signal<string | null>(null);
  protected readonly deleting = signal<number | null>(null);

  protected readonly deleteTitle = computed(() => {
    const index = this.deleting();
    return index === null ? '' : `Ștergi cheltuiala „${this.expenses()[index]?.name ?? ''}”?`;
  });
  protected readonly deleteBody = computed(() => {
    const index = this.deleting();
    const expense = index === null ? undefined : this.expenses()[index];
    return expense ? `${formatEUR(expense.amountCents)} nu se va mai scădea din venitul acestei luni.` : '';
  });

  protected startEdit(index: number): void {
    const expense = this.expenses()[index];
    this.editing.set(index);
    this.draftName.set(expense.name);
    this.draftCents.set(expense.amountCents);
    this.draftError.set(null);
  }

  protected startAdd(): void {
    this.editing.set('new');
    this.draftName.set('');
    this.draftCents.set(0);
    this.draftError.set(null);
  }

  protected cancel(): void {
    this.editing.set(null);
    this.draftError.set(null);
  }

  protected save(): void {
    const name = this.draftName().trim();
    if (!name) {
      this.draftError.set('Numele este obligatoriu.');
      return;
    }
    if (this.draftCents() <= 0) {
      this.draftError.set('Suma trebuie să fie mai mare decât 0.');
      return;
    }
    const current = this.editing();
    const list = [...this.expenses()];
    const entry = { name, amountCents: this.draftCents(), position: 0 };
    if (current === 'new') {
      list.push(entry);
    } else if (current !== null) {
      list[current] = entry;
    }
    this.emit(list);
    this.editing.set(null);
  }

  protected setAmount(index: number, amountCents: number): void {
    const list = [...this.expenses()];
    list[index] = { ...list[index], amountCents };
    this.emit(list);
  }

  protected askDelete(index: number): void {
    this.deleting.set(index);
  }

  protected askDeleteCurrent(): void {
    const current = this.editing();
    if (typeof current === 'number') {
      this.deleting.set(current);
    }
  }

  protected confirmDelete(): void {
    const index = this.deleting();
    if (index === null) {
      return;
    }
    this.emit(this.expenses().filter((_, i) => i !== index));
    this.deleting.set(null);
    this.editing.set(null);
  }

  private emit(list: FixedExpense[]): void {
    this.changed.emit(list.map((e, position) => ({ name: e.name, amountCents: e.amountCents, position })));
  }
}
