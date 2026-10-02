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
  purchaseValueCents,
} from '../../domain/portfolio';
import type { Movement, PurchaseDetails } from '../../domain/types';
import { Breakpoint } from '../../shared/breakpoint';
import { ConfirmDialog } from '../../shared/confirm-dialog';
import { Icon } from '../../shared/icon';
import { MoneyInput } from '../../shared/money-input';
import { Toast } from '../../shared/toast';
import { ShellService } from '../../shell/shell.service';

/** Investiții: the investment budget, what was bought with it, and the resulting holdings. */
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
  protected readonly fund = computed(() => this.funds().find((f) => f.id === this.fundId()) ?? null);
  protected readonly purchases = computed(() => {
    const ids = new Set(this.funds().map((f) => f.id));
    return this.store.movements().filter((m) => m.type === 'purchase' && m.purchase && ids.has(m.categoryId));
  });
  protected readonly availableCents = computed(() =>
    this.funds().reduce((sum, f) => sum + (this.store.balances()[f.id] ?? 0), 0),
  );
  protected readonly investedCents = computed(() =>
    this.purchases().reduce((sum, m) => sum + purchaseValueCents(m.purchase!), 0),
  );
  protected readonly feesCents = computed(() =>
    this.purchases().reduce((sum, m) => sum + m.purchase!.feesCents, 0),
  );
  protected readonly positions = computed(() => buildPositions(this.purchases()));

  // ----------------------------------------------------------------- form
  protected readonly symbol = signal('');
  protected readonly sharesText = signal('');
  protected readonly priceCents = signal(0);
  protected readonly purchaseFeesCents = signal(0);
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
  protected readonly valueCents = computed(() => Math.round(this.sharesValue() * this.priceCents()));
  protected readonly totalCents = computed(() => this.valueCents() + this.purchaseFeesCents());
  protected readonly fundBalance = computed(() => this.store.balances()[this.fundId() ?? ''] ?? 0);
  protected readonly afterCents = computed(() => this.fundBalance() - this.totalCents());

  protected readonly deleting = signal<Movement | null>(null);

  constructor() {
    inject(ShellService).title.set('Investiții');
  }

  protected fundName(id: string): string {
    return this.store.categoryById(id)?.name ?? '';
  }

  protected reset(): void {
    this.symbol.set('');
    this.sharesText.set('');
    this.priceCents.set(0);
    this.purchaseFeesCents.set(0);
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
    const details: PurchaseDetails = {
      symbol,
      shares,
      priceCents: this.priceCents(),
      feesCents: this.purchaseFeesCents(),
    };
    if (purchaseTotalCents(details) > this.fundBalance()) {
      this.error.set(`Suma depășește bugetul disponibil (${formatEUR(this.fundBalance())}).`);
      return;
    }
    this.busy.set(true);
    try {
      await this.store.addPurchase(fundId, details, this.note(), this.occurredOn());
      this.reset();
      this.toast.show('Achiziția a fost adăugată.');
    } catch (err) {
      this.error.set(err instanceof Error && err.message ? err.message : NETWORK_ERROR);
    } finally {
      this.busy.set(false);
    }
  }

  protected deleteTitle(): string {
    const m = this.deleting();
    return m?.purchase ? `Ștergi achiziția „${m.purchase.symbol}” din ${formatDate(m.occurredOn)}?` : '';
  }

  protected deleteBody(): string {
    const m = this.deleting();
    return m ? `Suma de ${formatEUR(-m.amountCents)} se întoarce în bugetul disponibil.` : '';
  }

  protected async confirmDelete(): Promise<void> {
    const m = this.deleting();
    if (!m) {
      return;
    }
    this.deleting.set(null);
    try {
      await this.store.deleteMovement(m.id);
      this.toast.show('Achiziția a fost ștearsă.');
    } catch (err) {
      console.error(err);
      this.error.set(NETWORK_ERROR);
    }
  }

  protected purchaseLine(m: Movement): string {
    const p = m.purchase!;
    let text = `${formatShares(p.shares)} × ${formatEUR(p.priceCents)}`;
    if (p.feesCents > 0) {
      text += ` · taxe ${formatEUR(p.feesCents)}`;
    }
    return text;
  }
}
