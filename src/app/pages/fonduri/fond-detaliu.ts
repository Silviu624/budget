import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { BudgetStore, NETWORK_ERROR } from '../../data/budget-store';
import { formatDate, MONTH_NAMES, monthLabel, parseMonthKey } from '../../domain/dates';
import { formatEUR, formatPercent } from '../../domain/money';
import { Breakpoint } from '../../shared/breakpoint';
import { Icon } from '../../shared/icon';
import { MoneyInput } from '../../shared/money-input';
import { TargetProgress } from '../../shared/target-progress';
import { Toast } from '../../shared/toast';
import { ShellService, TopSlot } from '../../shell/shell.service';
import { buildMonthView } from '../sumar/month-view';

/** One line of „Istoric mișcări”: a movement, the planned contribution, or the starting balance. */
interface HistoryRow {
  kind: 'contribution' | 'withdrawal' | 'initial' | 'planned';
  date: string;
  amountCents: number;
  note: string;
}

/** Detaliu fond: balance and target, withdrawals, the category's settings and its movement history. */
@Component({
  selector: 'app-fond-detaliu',
  imports: [NgTemplateOutlet, RouterLink, Icon, MoneyInput, TargetProgress, TopSlot],
  templateUrl: './fond-detaliu.html',
  styleUrl: './fond-detaliu.scss',
})
export class FondDetaliu {
  protected readonly store = inject(BudgetStore);
  protected readonly breakpoint = inject(Breakpoint);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(Toast);

  protected readonly eur = formatEUR;
  protected readonly pct = formatPercent;
  protected readonly plus = (cents: number) => formatEUR(cents, { sign: true });
  protected readonly date = formatDate;

  private readonly id = toSignal(this.route.paramMap.pipe(map((p) => p.get('id') ?? '')), {
    initialValue: this.route.snapshot.paramMap.get('id') ?? '',
  });
  protected readonly category = computed(() => this.store.categoryById(this.id()));
  protected readonly balance = computed(() => this.store.balances()[this.id()] ?? 0);
  protected readonly overflowName = computed(
    () => this.store.categoryById(this.category()?.overflowToId ?? '')?.name ?? null,
  );

  protected readonly percentOfTarget = computed(() => {
    const target = this.category()?.targetCents;
    return target ? (this.balance() / target) * 100 : 0;
  });
  protected readonly progress = computed(() => Math.max(0, Math.min(100, this.percentOfTarget())));

  protected readonly key = this.store.currentMonthKey;
  protected readonly monthName = computed(() => MONTH_NAMES[parseMonthKey(this.key()).month - 1]);
  protected readonly view = computed(() => {
    const month = this.store.monthByKey(this.key());
    return month ? buildMonthView(month, this.store.categories(), this.store.balances()) : null;
  });
  protected readonly row = computed(() => this.view()?.rows.find((r) => r.category.id === this.id()));
  protected readonly planned = computed(() => this.view()?.applied === false);

  /** Note under the target bar: how far the target is and whether this month reaches it. */
  protected readonly targetNote = computed(() => {
    const category = this.category();
    const target = category?.targetCents;
    if (!category || target === null || target === undefined) {
      return null;
    }
    const left = target - this.balance();
    if (left <= 0) {
      return null;
    }
    const row = this.row();
    let text = `Mai sunt ${formatEUR(left)} până la țintă.`;
    if (this.planned() && row?.targetReached) {
      text += ` Contribuția planificată din ${this.monthName()} o atinge`;
      text +=
        row.surplusOutCents > 0 && row.surplusToName
          ? `, iar restul de ${formatEUR(row.surplusOutCents)} merge către ${row.surplusToName}.`
          : '.';
    }
    return text;
  });

  protected readonly history = computed<HistoryRow[]>(() => {
    const category = this.category();
    if (!category) {
      return [];
    }
    const rows: HistoryRow[] = [];
    const row = this.row();
    if (this.planned() && row && row.postedCents > 0) {
      rows.push({
        kind: 'planned',
        date: monthLabel(this.key()),
        amountCents: row.postedCents,
        note: 'Planificată · intră la „Aplică luna”',
      });
    }
    for (const m of this.store.movementsOf(category.id)) {
      rows.push({ kind: m.type, date: formatDate(m.occurredOn), amountCents: m.amountCents, note: m.note });
    }
    rows.push({
      kind: 'initial',
      date: formatDate(category.createdOn),
      amountCents: category.initialBalanceCents,
      note: 'Sold la pornirea aplicației',
    });
    return rows;
  });

  /** Movements plus the starting balance; the planned contribution is not a movement yet. */
  protected readonly historyCount = computed(() => this.history().filter((h) => h.kind !== 'planned').length);

  protected readonly amountCents = signal(0);
  protected readonly note = signal('');
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly after = computed(() => this.balance() - this.amountCents());

  constructor() {
    inject(ShellService).title.set('Fonduri');
    effect(() => {
      const category = this.category();
      const loaded = this.store.categories().length > 0;
      if (loaded && (!category || category.kind !== 'saving')) {
        untracked(() => void this.router.navigateByUrl('/fonduri', { replaceUrl: true }));
      }
    });
    effect(() => {
      const key = this.key();
      this.store.profile();
      untracked(() => void this.store.ensureMonth(key).catch((err) => console.error(err)));
    });
  }

  protected chipLabel(kind: HistoryRow['kind']): string {
    switch (kind) {
      case 'withdrawal':
        return 'Retragere';
      case 'initial':
        return 'Sold inițial';
      default:
        return 'Contribuție';
    }
  }

  protected chipIcon(kind: HistoryRow['kind']): 'in' | 'out' | 'init' {
    return kind === 'withdrawal' ? 'out' : kind === 'initial' ? 'init' : 'in';
  }

  protected amountText(row: HistoryRow): string {
    return row.kind === 'initial' ? formatEUR(row.amountCents) : formatEUR(row.amountCents, { sign: true });
  }

  protected reset(): void {
    this.amountCents.set(0);
    this.note.set('');
    this.error.set(null);
  }

  protected async submit(): Promise<void> {
    if (this.busy()) {
      return;
    }
    const amount = this.amountCents();
    if (amount <= 0) {
      this.error.set('Suma trebuie să fie mai mare decât 0.');
      return;
    }
    if (amount > this.balance()) {
      this.error.set(`Suma depășește soldul fondului (${formatEUR(this.balance())}).`);
      return;
    }
    if (this.note().length > 120) {
      this.note.set(this.note().slice(0, 120));
    }
    this.busy.set(true);
    try {
      await this.store.addWithdrawal(this.id(), amount, this.note());
      this.reset();
      this.toast.show('Retragerea a fost adăugată.');
    } catch (err) {
      this.error.set(err instanceof Error && err.message ? err.message : NETWORK_ERROR);
    } finally {
      this.busy.set(false);
    }
  }

}
