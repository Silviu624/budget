import { CdkDrag, CdkDragHandle, CdkDropList, moveItemInArray, type CdkDragDrop } from '@angular/cdk/drag-drop';
import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, inject, linkedSignal, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { ThemeService } from '../../core/theme.service';
import { BudgetStore, NETWORK_ERROR, type CategoryInput } from '../../data/budget-store';
import { fixedTotal } from '../../domain/balances';
import { formatEUR, formatPercent, toTenths } from '../../domain/money';
import { KIND_LABELS, type Category, type CategoryKind, type FixedExpense, type ThemeChoice } from '../../domain/types';
import { Breakpoint } from '../../shared/breakpoint';
import { ConfirmDialog } from '../../shared/confirm-dialog';
import { Icon, kindIcon } from '../../shared/icon';
import { MoneyInput, PercentInput } from '../../shared/money-input';
import { Toast } from '../../shared/toast';
import { ShellService } from '../../shell/shell.service';

interface CategoryDraft {
  name: string;
  kind: CategoryKind;
  percent: number;
  /** 0 means no target. */
  targetCents: number;
  overflowToId: string | null;
  initialBalanceCents: number;
}

const SAVED = 'Modificările au fost salvate.';

/** Setări: default income, theme, the fixed-expense template and the categories. */
@Component({
  selector: 'app-setari',
  imports: [CdkDropList, CdkDrag, CdkDragHandle, NgTemplateOutlet, Icon, MoneyInput, PercentInput, ConfirmDialog],
  templateUrl: './setari.html',
  styleUrl: './setari.scss',
})
export class Setari {
  protected readonly store = inject(BudgetStore);
  protected readonly breakpoint = inject(Breakpoint);
  protected readonly theme = inject(ThemeService);
  private readonly toast = inject(Toast);
  private readonly route = inject(ActivatedRoute);

  protected readonly eur = formatEUR;
  protected readonly pct = formatPercent;
  protected readonly kindIcon = kindIcon;
  protected readonly kinds: { value: CategoryKind; label: string }[] = [
    { value: 'saving', label: KIND_LABELS.saving },
    { value: 'spending', label: KIND_LABELS.spending },
    { value: 'investment', label: KIND_LABELS.investment },
  ];
  protected readonly themes: { value: ThemeChoice; label: string }[] = [
    { value: 'auto', label: 'Automată' },
    { value: 'light', label: 'Luminoasă' },
    { value: 'dark', label: 'Întunecată' },
  ];

  // ---------------------------------------------------------- Venit implicit
  protected readonly incomeDraft = linkedSignal(() => this.store.profile()?.defaultIncomeCents ?? 0);
  protected readonly incomeBusy = signal(false);

  // ------------------------------------------------------------------ Șablon
  protected readonly template = computed(() =>
    [...(this.store.profile()?.fixedExpenseTemplate ?? [])].sort((a, b) => a.position - b.position),
  );
  protected readonly templateTotal = computed(() => fixedTotal(this.template()));
  protected readonly tEditing = signal<number | 'new' | null>(null);
  protected readonly tName = signal('');
  protected readonly tCents = signal(0);
  protected readonly tError = signal<string | null>(null);
  protected readonly tDeleting = signal<number | null>(null);

  // --------------------------------------------------------------- Categorii
  protected readonly categories = this.store.activeCategories;
  protected readonly percentTotal = computed(
    () => this.categories().reduce((s, c) => s + toTenths(c.percent), 0) / 10,
  );
  protected readonly cEditing = signal<string | 'new' | null>(null);
  protected readonly draft = signal<CategoryDraft>(emptyDraft());
  protected readonly cError = signal<string | null>(null);
  protected readonly cDeleting = signal<Category | null>(null);
  protected readonly overflowOptions = computed(() =>
    this.categories().filter((c) => c.kind !== 'spending' && c.id !== this.cEditing()),
  );
  protected readonly deleteCategoryBody = computed(() => {
    const category = this.cDeleting();
    if (!category) {
      return '';
    }
    const hasMovements = this.store.movements().some((m) => m.categoryId === category.id);
    if (hasMovements) {
      const balance = this.store.balances()[category.id] ?? 0;
      return `Soldul de ${formatEUR(balance)} și mișcările rămân în istoric, dar categoria nu mai primește alocări.`;
    }
    return 'Categoria nu va mai primi alocări.';
  });

  protected readonly error = signal<string | null>(null);
  private readonly requested = toSignal(this.route.queryParamMap.pipe(map((p) => p.get('categorie'))), {
    initialValue: null,
  });
  private openedFromQuery = false;

  constructor() {
    inject(ShellService).title.set('Setări');
    effect(() => {
      const id = this.requested();
      const category = id ? this.categories().find((c) => c.id === id) : undefined;
      if (category && !this.openedFromQuery) {
        this.openedFromQuery = true;
        untracked(() => this.startCategoryEdit(category));
      }
    });
  }

  // ---------------------------------------------------------- Venit implicit

  protected async saveIncome(): Promise<void> {
    this.incomeBusy.set(true);
    await this.run(() => this.store.saveProfile({ defaultIncomeCents: this.incomeDraft() }));
    this.incomeBusy.set(false);
  }

  protected setTheme(choice: ThemeChoice): void {
    void this.run(() => this.theme.set(choice), false);
  }

  // ------------------------------------------------------------------ Șablon

  protected startTemplateEdit(index: number): void {
    const expense = this.template()[index];
    this.tEditing.set(index);
    this.tName.set(expense.name);
    this.tCents.set(expense.amountCents);
    this.tError.set(null);
  }

  protected startTemplateAdd(): void {
    this.tEditing.set('new');
    this.tName.set('');
    this.tCents.set(0);
    this.tError.set(null);
  }

  protected cancelTemplate(): void {
    this.tEditing.set(null);
  }

  protected saveTemplate(): void {
    const name = this.tName().trim();
    if (!name) {
      this.tError.set('Numele este obligatoriu.');
      return;
    }
    if (this.tCents() <= 0) {
      this.tError.set('Suma trebuie să fie mai mare decât 0.');
      return;
    }
    const list = [...this.template()];
    const entry: FixedExpense = { name, amountCents: this.tCents(), position: 0 };
    const current = this.tEditing();
    if (current === 'new') {
      list.push(entry);
    } else if (current !== null) {
      list[current] = entry;
    }
    this.tEditing.set(null);
    void this.persistTemplate(list);
  }

  protected askTemplateDelete(index: number): void {
    this.tDeleting.set(index);
  }

  protected askTemplateDeleteCurrent(): void {
    const current = this.tEditing();
    if (typeof current === 'number') {
      this.tDeleting.set(current);
    }
  }

  protected confirmTemplateDelete(): void {
    const index = this.tDeleting();
    if (index === null) {
      return;
    }
    this.tDeleting.set(null);
    this.tEditing.set(null);
    void this.persistTemplate(this.template().filter((_, i) => i !== index));
  }

  protected dropTemplate(event: CdkDragDrop<FixedExpense[]>): void {
    if (event.previousIndex === event.currentIndex) {
      return;
    }
    const list = [...this.template()];
    moveItemInArray(list, event.previousIndex, event.currentIndex);
    this.tEditing.set(null);
    void this.persistTemplate(list);
  }

  protected moveTemplate(index: number, delta: number): void {
    const target = index + delta;
    if (target < 0 || target >= this.template().length) {
      return;
    }
    const list = [...this.template()];
    moveItemInArray(list, index, target);
    this.tEditing.set(target);
    void this.persistTemplate(list);
  }

  protected templateDeleteTitle(): string {
    const index = this.tDeleting();
    return index === null ? '' : `Ștergi cheltuiala „${this.template()[index]?.name ?? ''}”?`;
  }

  private async persistTemplate(list: FixedExpense[]): Promise<void> {
    await this.run(() => this.store.saveTemplate(list));
  }

  // --------------------------------------------------------------- Categorii

  protected startCategoryEdit(category: Category): void {
    this.cEditing.set(category.id);
    this.draft.set({
      name: category.name,
      kind: category.kind,
      percent: category.percent,
      targetCents: category.targetCents ?? 0,
      overflowToId: category.overflowToId,
      initialBalanceCents: category.initialBalanceCents,
    });
    this.cError.set(null);
  }

  protected startCategoryAdd(): void {
    this.cEditing.set('new');
    this.draft.set(emptyDraft());
    this.cError.set(null);
  }

  protected cancelCategory(): void {
    this.cEditing.set(null);
    this.cError.set(null);
  }

  protected patchDraft(patch: Partial<CategoryDraft>): void {
    this.draft.update((d) => ({ ...d, ...patch }));
  }

  protected async saveCategory(): Promise<void> {
    const current = this.cEditing();
    const d = this.draft();
    const name = d.name.trim();
    const id = current === 'new' ? undefined : (current ?? undefined);
    if (!name) {
      this.cError.set('Numele este obligatoriu.');
      return;
    }
    const duplicate = this.categories().some(
      (c) => c.id !== id && c.name.trim().toLocaleLowerCase('ro') === name.toLocaleLowerCase('ro'),
    );
    if (duplicate) {
      this.cError.set('Există deja o categorie cu acest nume.');
      return;
    }
    if (d.kind !== 'spending' && d.overflowToId && d.overflowToId === id) {
      this.cError.set('Alege alt fond decât acesta.');
      return;
    }
    if (id && d.kind === 'spending') {
      const existing = this.categories().find((c) => c.id === id);
      const balance = this.store.balances()[id] ?? 0;
      const hasMovements = this.store.movements().some((m) => m.categoryId === id);
      if (existing && existing.kind !== 'spending' && (balance !== 0 || hasMovements)) {
        this.cError.set('Fondul are sold sau mișcări și nu poate deveni buget de cheltuieli.');
        return;
      }
    }
    const input: CategoryInput = {
      name,
      kind: d.kind,
      percent: d.percent,
      targetCents: d.kind !== 'spending' && d.targetCents > 0 ? d.targetCents : null,
      overflowToId: d.kind !== 'spending' ? d.overflowToId : null,
      initialBalanceCents: d.kind !== 'spending' ? d.initialBalanceCents : 0,
    };
    this.cError.set(null);
    const ok = await this.run(() => this.store.saveCategory(input, id).then(() => undefined));
    if (ok) {
      this.cEditing.set(null);
    }
  }

  protected askCategoryDelete(category: Category): void {
    this.cDeleting.set(category);
  }

  protected askCategoryDeleteCurrent(): void {
    const current = this.cEditing();
    const category = this.categories().find((c) => c.id === current);
    if (category) {
      this.cDeleting.set(category);
    }
  }

  protected async confirmCategoryDelete(): Promise<void> {
    const category = this.cDeleting();
    if (!category) {
      return;
    }
    this.cDeleting.set(null);
    const ok = await this.run(() => this.store.deleteCategory(category.id));
    if (ok && this.cEditing() === category.id) {
      this.cEditing.set(null);
    }
  }

  protected dropCategory(event: CdkDragDrop<Category[]>): void {
    if (event.previousIndex === event.currentIndex) {
      return;
    }
    const ids = this.categories().map((c) => c.id);
    moveItemInArray(ids, event.previousIndex, event.currentIndex);
    void this.run(() => this.store.reorderCategories(ids));
  }

  protected moveCategory(id: string, delta: number): void {
    const ids = this.categories().map((c) => c.id);
    const index = ids.indexOf(id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= ids.length) {
      return;
    }
    moveItemInArray(ids, index, target);
    void this.run(() => this.store.reorderCategories(ids));
  }

  protected caption(category: Category): string {
    if (category.kind === 'spending') {
      return KIND_LABELS.spending;
    }
    const parts = [KIND_LABELS[category.kind]];
    if (category.targetCents !== null) {
      parts.push(`țintă ${formatEUR(category.targetCents)}`);
    }
    parts.push(`sold inițial ${formatEUR(category.initialBalanceCents)}`);
    return parts.join(' · ');
  }

  protected editorTitle(): string {
    return this.cEditing() === 'new' ? 'Adaugă categorie' : 'Editează categoria';
  }

  // ------------------------------------------------------------------ shared

  /** Runs a write, shows the toast on success and the network error otherwise. */
  private async run(write: () => Promise<void>, announce = true): Promise<boolean> {
    try {
      await write();
      this.error.set(null);
      if (announce) {
        this.toast.show(SAVED);
      }
      return true;
    } catch (err) {
      console.error(err);
      this.error.set(NETWORK_ERROR);
      return false;
    }
  }
}

function emptyDraft(): CategoryDraft {
  return { name: '', kind: 'saving', percent: 0, targetCents: 0, overflowToId: null, initialBalanceCents: 0 };
}
