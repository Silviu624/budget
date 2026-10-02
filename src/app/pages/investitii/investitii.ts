import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
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
import type { Movement, TradeDetails } from '../../domain/types';
import { Breakpoint } from '../../shared/breakpoint';
import { ConfirmDialog } from '../../shared/confirm-dialog';
import { Icon } from '../../shared/icon';
import { MoneyInput } from '../../shared/money-input';
import { Toast } from '../../shared/toast';
import { ShellService } from '../../shell/shell.service';

type TradeType = 'purchase' | 'sale';

/** Investiții: the investment budget, the trades made with it, and the resulting portfolio. */
@Component({
  selector: 'app-investitii',
  imports: [NgTemplateOutlet, RouterLink, Icon, MoneyInput, ConfirmDialog],
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

  /** Every active category of kind Investiții. */
  protected readonly funds = computed(() =>
    this.store.activeCategories().filter((c) => c.kind === 'investment'),
  );
  protected readonly fundId = linkedSignal(() => this.funds()[0]?.id ?? null);
  protected readonly trades = computed(() => {
    const ids = new Set(this.funds().map((f) => f.id));
    return this.store
      .movements()
      .filter((m) => (m.type === 'purchase' || m.type === 'sale') && m.trade && ids.has(m.categoryId));
  });
  protected readonly availableCents = computed(() =>
    this.funds().reduce((sum, f) => sum + (this.store.balances()[f.id] ?? 0), 0),
  );
  protected readonly positions = computed(() => buildPositions(this.trades()));
  protected readonly held = computed(() => this.positions().filter((p) => p.shares > 0));
  protected readonly costCents = computed(() => this.held().reduce((sum, p) => sum + p.costCents, 0));
  protected readonly feesCents = computed(() =>
    this.trades().reduce((sum, m) => sum + m.trade!.feesCents, 0),
  );

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
  /** Money leaving (purchase) or entering (sale) the budget. */
  protected readonly tradeTotal = computed(() =>
    this.mode() === 'purchase'
      ? this.tradeValue() + this.tradeFeesCents()
      : Math.max(0, this.tradeValue() - this.tradeFeesCents()),
  );
  protected readonly fundBalance = computed(() => this.store.balances()[this.fundId() ?? ''] ?? 0);
  protected readonly afterCents = computed(() =>
    this.mode() === 'purchase'
      ? this.fundBalance() - this.tradeTotal()
      : this.fundBalance() + this.tradeTotal(),
  );
  /** Symbols currently held in the selected fund, for the sale form. */
  protected readonly heldInFund = computed(() => {
    const id = this.fundId();
    return id ? buildPositions(this.store.movementsOf(id)).filter((p) => p.shares > 0) : [];
  });

  protected readonly deleting = signal<Movement | null>(null);

  constructor() {
    inject(ShellService).title.set('Investiții');
  }

  protected fundName(id: string): string {
    return this.store.categoryById(id)?.name ?? '';
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
    const fundId = this.fundId();
    if (this.busy() || !fundId) {
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
    const details: TradeDetails = {
      symbol,
      shares,
      priceCents: this.priceCents(),
      feesCents: this.tradeFeesCents(),
    };
    if (this.mode() === 'purchase') {
      if (purchaseTotalCents(details) > this.fundBalance()) {
        this.error.set(`Suma depășește bugetul disponibil (${formatEUR(this.fundBalance())}).`);
        return;
      }
    } else {
      const held = this.heldInFund().find((p) => p.symbol === symbol);
      if (!held || held.shares < shares) {
        this.error.set(
          held
            ? `Nu ai atâtea acțiuni ${symbol} (deții ${formatShares(held.shares)}).`
            : `Nu ai acțiuni ${symbol} în acest fond.`,
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
      await this.store.addTrade(fundId, this.mode(), details, this.note(), this.occurredOn());
      this.reset();
      this.toast.show(this.mode() === 'purchase' ? 'Cumpărarea a fost adăugată.' : 'Vânzarea a fost adăugată.');
    } catch (err) {
      this.error.set(err instanceof Error && err.message ? err.message : NETWORK_ERROR);
    } finally {
      this.busy.set(false);
    }
  }

  protected deleteTitle(): string {
    const m = this.deleting();
    return m?.trade ? `Ștergi tranzacția „${m.trade.symbol}” din ${formatDate(m.occurredOn)}?` : '';
  }

  protected deleteBody(): string {
    const m = this.deleting();
    if (!m) {
      return '';
    }
    return m.type === 'purchase'
      ? `Suma de ${formatEUR(-m.amountCents)} se întoarce în bugetul disponibil.`
      : `Suma de ${formatEUR(m.amountCents)} se scade din bugetul disponibil.`;
  }

  protected async confirmDelete(): Promise<void> {
    const m = this.deleting();
    if (!m) {
      return;
    }
    this.deleting.set(null);
    try {
      await this.store.deleteMovement(m.id);
      this.toast.show('Tranzacția a fost ștearsă.');
    } catch (err) {
      console.error(err);
      this.error.set(NETWORK_ERROR);
    }
  }

  protected tradeLabel(m: Movement): string {
    return m.type === 'sale' ? 'Vânzare' : 'Cumpărare';
  }

  protected tradeLine(m: Movement): string {
    const t = m.trade!;
    let text = `${formatShares(t.shares)} × ${formatEUR(t.priceCents)}`;
    if (t.feesCents > 0) {
      text += ` · taxe ${formatEUR(t.feesCents)}`;
    }
    return text;
  }

  protected tradeValueOf(m: Movement): number {
    return tradeValueCents(m.trade!);
  }
}
