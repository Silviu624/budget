import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { BudgetStore, NETWORK_ERROR } from '../../data/budget-store';
import { formatDate } from '../../domain/dates';
import { formatEUR } from '../../domain/money';
import {
  buildPositions,
  formatShares,
  normalizeSymbol,
  parseShares,
  purchaseTotalCents,
  saleProceedsCents,
  tradeValueCents,
} from '../../domain/portfolio';
import type { Trade, TradeDetails, TradeType } from '../../domain/types';
import { Breakpoint } from '../../shared/breakpoint';
import { ConfirmDialog } from '../../shared/confirm-dialog';
import { Icon } from '../../shared/icon';
import { MoneyInput } from '../../shared/money-input';
import { Toast } from '../../shared/toast';
import { ShellService } from '../../shell/shell.service';

/**
 * Investiții: a ledger of purchases and sales and the portfolio they add up to. It never touches a
 * category balance; the money set aside for investing is a fixed expense ticked each month.
 */
@Component({
  selector: 'app-investitii',
  imports: [NgTemplateOutlet, Icon, MoneyInput, ConfirmDialog],
  templateUrl: './investitii.html',
  styleUrl: './investitii.scss',
})
export class Investitii {
  protected readonly store = inject(BudgetStore);
  protected readonly breakpoint = inject(Breakpoint);
  private readonly toast = inject(Toast);

  protected readonly eur = formatEUR;
  protected readonly date = formatDate;
  protected readonly shares = formatShares;

  protected readonly trades = this.store.trades;
  protected readonly positions = computed(() => buildPositions(this.trades()));
  protected readonly held = computed(() => this.positions().filter((p) => p.shares > 0));
  protected readonly costCents = computed(() => this.held().reduce((sum, p) => sum + p.costCents, 0));
  protected readonly boughtCents = computed(() =>
    this.trades()
      .filter((t) => t.type === 'purchase')
      .reduce((sum, t) => sum + purchaseTotalCents(t), 0),
  );
  protected readonly soldCents = computed(() =>
    this.trades()
      .filter((t) => t.type === 'sale')
      .reduce((sum, t) => sum + saleProceedsCents(t), 0),
  );
  protected readonly feesCents = computed(() => this.trades().reduce((sum, t) => sum + t.feesCents, 0));

  // ----------------------------------------------------------------- form
  protected readonly mode = signal<TradeType>('purchase');
  protected readonly symbol = signal('');
  protected readonly sharesText = signal('');
  protected readonly priceCents = signal(0);
  protected readonly tradeFeesCents = signal(0);
  protected readonly occurredOn = linkedSignal(() => this.store.today());
  protected readonly note = signal('');
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);

  protected readonly sharesValue = computed(() => {
    try {
      return parseShares(this.sharesText());
    } catch {
      return 0;
    }
  });
  protected readonly tradeValue = computed(() => Math.round(this.sharesValue() * this.priceCents()));
  /** Cost of a purchase, or proceeds of a sale. */
  protected readonly tradeTotal = computed(() =>
    this.mode() === 'purchase'
      ? this.tradeValue() + this.tradeFeesCents()
      : Math.max(0, this.tradeValue() - this.tradeFeesCents()),
  );

  protected readonly deleting = signal<Trade | null>(null);

  constructor() {
    inject(ShellService).title.set('Investiții');
  }

  protected setMode(mode: TradeType): void {
    this.mode.set(mode);
    this.error.set(null);
  }

  protected reset(): void {
    this.symbol.set('');
    this.sharesText.set('');
    this.priceCents.set(0);
    this.tradeFeesCents.set(0);
    this.note.set('');
    this.error.set(null);
  }

  protected async submit(): Promise<void> {
    if (this.busy()) {
      return;
    }
    const symbol = normalizeSymbol(this.symbol());
    if (!symbol) {
      this.error.set('Introdu simbolul.');
      return;
    }
    let shares: number;
    try {
      shares = parseShares(this.sharesText());
    } catch {
      this.error.set('Numărul de acțiuni trebuie să fie mai mare decât 0.');
      return;
    }
    if (this.priceCents() <= 0) {
      this.error.set('Prețul trebuie să fie mai mare decât 0.');
      return;
    }
    const details: TradeDetails = { symbol, shares, priceCents: this.priceCents(), feesCents: this.tradeFeesCents() };
    if (this.mode() === 'sale') {
      const held = this.held().find((p) => p.symbol === symbol);
      if (!held || held.shares < shares) {
        this.error.set(
          held ? `Nu ai atâtea acțiuni ${symbol} (deții ${formatShares(held.shares)}).` : `Nu ai acțiuni ${symbol}.`,
        );
        return;
      }
      if (saleProceedsCents(details) < 0) {
        this.error.set('Taxele depășesc valoarea vânzării.');
        return;
      }
    }
    this.busy.set(true);
    try {
      await this.store.addTrade(this.mode(), details, this.note(), this.occurredOn());
      this.reset();
      this.toast.show(this.mode() === 'purchase' ? 'Cumpărarea a fost adăugată.' : 'Vânzarea a fost adăugată.');
    } catch (err) {
      this.error.set(err instanceof Error && err.message ? err.message : NETWORK_ERROR);
    } finally {
      this.busy.set(false);
    }
  }

  protected deleteTitle(): string {
    const t = this.deleting();
    return t ? `Ștergi tranzacția „${t.symbol}” din ${formatDate(t.occurredOn)}?` : '';
  }

  protected deleteBody(): string {
    const t = this.deleting();
    return t ? `${formatShares(t.shares)} × ${formatEUR(t.priceCents)} dispar din portofoliu.` : '';
  }

  protected async confirmDelete(): Promise<void> {
    const t = this.deleting();
    if (!t) {
      return;
    }
    this.deleting.set(null);
    try {
      await this.store.deleteTrade(t.id);
      this.toast.show('Tranzacția a fost ștearsă.');
    } catch (err) {
      console.error(err);
      this.error.set(NETWORK_ERROR);
    }
  }

  protected tradeLabel(t: Trade): string {
    return t.type === 'sale' ? 'Vânzare' : 'Cumpărare';
  }

  protected tradeLine(t: Trade): string {
    let text = `${formatShares(t.shares)} × ${formatEUR(t.priceCents)}`;
    if (t.feesCents > 0) {
      text += ` · taxe ${formatEUR(t.feesCents)}`;
    }
    return text;
  }

  /** Signed cash effect: purchases cost money, sales bring it back. */
  protected tradeAmount(t: Trade): number {
    return t.type === 'purchase' ? -purchaseTotalCents(t) : saleProceedsCents(t);
  }

  protected tradeValueOf(t: Trade): number {
    return tradeValueCents(t);
  }
}
