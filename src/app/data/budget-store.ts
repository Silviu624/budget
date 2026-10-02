import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  runTransaction,
  setDoc,
  updateDoc,
  writeBatch,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';
import { AuthService } from '../core/auth.service';
import { db } from '../core/firebase';
import { computePlan, type Plan } from '../domain/allocation';
import { computeBalances } from '../domain/balances';
import { addMonths, compareMonthKeys, monthLabel, todayISO } from '../domain/dates';
import { formatEUR } from '../domain/money';
import { activeByPosition, createPlannedMonth, reconcileAllocations } from '../domain/month';
import { purchaseTotalCents } from '../domain/portfolio';
import type {
  Category,
  FixedExpense,
  Month,
  MonthAllocation,
  Movement,
  Profile,
  PurchaseDetails,
} from '../domain/types';
import { DEFAULT_PROFILE, defaultCategories } from './defaults';

/** Fields of a category that Setări edits. */
export type CategoryInput = Pick<
  Category,
  'name' | 'kind' | 'percent' | 'targetCents' | 'overflowToId' | 'initialBalanceCents'
>;

export const NETWORK_ERROR = 'Nu ne-am putut conecta. Încearcă din nou.';

const profileRef = () => doc(db, 'settings', 'profile');
const categoryRef = (id: string) => doc(db, 'categories', id);
const monthRef = (key: string) => doc(db, 'months', key);
const movementRef = (id: string) => doc(db, 'movements', id);

/**
 * Live view of the household's Firestore data plus every write the app performs.
 * Subscribes while someone is signed in; all signals reset on sign-out.
 */
@Injectable({ providedIn: 'root' })
export class BudgetStore {
  private readonly auth = inject(AuthService);
  private subscriptions: Unsubscribe[] = [];
  private bootstrapping = false;

  private readonly profileLoaded = signal(false);
  private readonly categoriesLoaded = signal(false);
  private readonly monthsLoaded = signal(false);
  private readonly movementsLoaded = signal(false);

  readonly profile = signal<Profile | null>(null);
  readonly categories = signal<Category[]>([]);
  /** Sorted by key ascending. */
  readonly months = signal<Month[]>([]);
  /** Newest first. */
  readonly movements = signal<Movement[]>([]);
  readonly error = signal<string | null>(null);

  readonly loaded = computed(
    () =>
      this.profileLoaded() &&
      this.categoriesLoaded() &&
      this.monthsLoaded() &&
      this.movementsLoaded() &&
      this.profile() !== null,
  );
  readonly activeCategories = computed(() => activeByPosition(this.categories()));
  readonly balances = computed(() => computeBalances(this.categories(), this.movements()));
  /** yyyy-mm-dd in Europe/Bucharest, refreshed every minute. */
  readonly today = signal(todayISO());
  readonly currentMonthKey = computed(() => this.today().slice(0, 7));
  readonly firstMonthKey = computed(() => this.months()[0]?.key ?? null);

  constructor() {
    effect(() => {
      const user = this.auth.user();
      untracked(() => (user ? this.start() : this.stop()));
    });
    if (typeof window !== 'undefined') {
      setInterval(() => this.today.set(todayISO()), 60_000);
    }
  }

  // ------------------------------------------------------------------ reads

  monthByKey(key: string): Month | undefined {
    return this.months().find((m) => m.key === key);
  }

  categoryById(id: string): Category | undefined {
    return this.categories().find((c) => c.id === id);
  }

  /** The month selector may go back to the first month and forward to current month + 1. */
  canGoBack(key: string): boolean {
    const first = this.firstMonthKey();
    return first !== null && compareMonthKeys(key, first) > 0;
  }

  canGoForward(key: string): boolean {
    return compareMonthKeys(key, addMonths(this.currentMonthKey(), 1)) < 0;
  }

  /** Live plan of a month against today's balances (used while it is planned). */
  planFor(month: Month): Plan {
    return computePlan({
      incomeCents: month.incomeCents,
      fixedExpenses: month.fixedExpenses,
      allocations: month.allocations,
      categories: this.categories(),
      balancesBefore: this.balances(),
    });
  }

  movementsOf(categoryId: string): Movement[] {
    return this.movements().filter((m) => m.categoryId === categoryId);
  }

  // --------------------------------------------------------------- lifecycle

  private start(): void {
    if (this.subscriptions.length) {
      return;
    }
    const fail = (err: unknown) => {
      console.error(err);
      this.error.set(NETWORK_ERROR);
    };
    this.subscriptions = [
      onSnapshot(
        profileRef(),
        (snap) => {
          this.profile.set(snap.exists() ? (snap.data() as Profile) : null);
          this.profileLoaded.set(true);
          void this.bootstrapIfEmpty();
        },
        fail,
      ),
      onSnapshot(
        collection(db, 'categories'),
        (qs) => {
          this.categories.set(
            qs.docs
              .map((d) => ({ id: d.id, ...(d.data() as Omit<Category, 'id'>) }))
              .sort((a, b) => a.position - b.position),
          );
          this.categoriesLoaded.set(true);
          void this.bootstrapIfEmpty();
        },
        fail,
      ),
      onSnapshot(
        collection(db, 'months'),
        (qs) => {
          this.months.set(
            qs.docs
              .map((d) => ({ key: d.id, ...(d.data() as Omit<Month, 'key'>) }))
              .sort((a, b) => compareMonthKeys(a.key, b.key)),
          );
          this.monthsLoaded.set(true);
        },
        fail,
      ),
      onSnapshot(
        collection(db, 'movements'),
        (qs) => {
          this.movements.set(
            qs.docs
              .map((d) => ({ id: d.id, ...(d.data() as Omit<Movement, 'id'>) }))
              .sort(
                (a, b) =>
                  b.occurredOn.localeCompare(a.occurredOn) || b.createdAt.localeCompare(a.createdAt),
              ),
          );
          this.movementsLoaded.set(true);
        },
        fail,
      ),
    ];
  }

  private stop(): void {
    for (const unsubscribe of this.subscriptions) {
      unsubscribe();
    }
    this.subscriptions = [];
    this.profile.set(null);
    this.categories.set([]);
    this.months.set([]);
    this.movements.set([]);
    this.error.set(null);
    this.profileLoaded.set(false);
    this.categoriesLoaded.set(false);
    this.monthsLoaded.set(false);
    this.movementsLoaded.set(false);
  }

  /** First sign-in ever: write the default profile and categories (zero balances). */
  private async bootstrapIfEmpty(): Promise<void> {
    if (
      this.bootstrapping ||
      !this.profileLoaded() ||
      !this.categoriesLoaded() ||
      this.profile() !== null ||
      this.categories().length > 0
    ) {
      return;
    }
    this.bootstrapping = true;
    try {
      const batch = writeBatch(db);
      batch.set(profileRef(), DEFAULT_PROFILE);
      for (const category of defaultCategories(this.today())) {
        const { id, ...data } = category;
        batch.set(categoryRef(id), data);
      }
      await batch.commit();
    } catch (err) {
      console.error(err);
      this.error.set(NETWORK_ERROR);
    } finally {
      this.bootstrapping = false;
    }
  }

  // ----------------------------------------------------------------- profile

  async saveProfile(patch: Partial<Profile>): Promise<void> {
    await setDoc(profileRef(), patch, { merge: true });
  }

  async saveTemplate(template: FixedExpense[]): Promise<void> {
    await this.saveProfile({
      fixedExpenseTemplate: template.map((e, position) => ({ name: e.name, amountCents: e.amountCents, position })),
    });
  }

  // ------------------------------------------------------------------ months

  /** Creates the month if missing (template, default income, default percents) and keeps a planned month's categories in sync. */
  async ensureMonth(key: string): Promise<void> {
    const profile = this.profile();
    if (!profile) {
      return;
    }
    const existing = this.monthByKey(key);
    if (!existing) {
      const { key: _key, ...data } = createPlannedMonth(key, profile, this.categories());
      await setDoc(monthRef(key), data);
      return;
    }
    const allocations = reconcileAllocations(existing, this.categories());
    if (allocations !== existing.allocations) {
      await updateDoc(monthRef(key), { allocations });
    }
  }

  async updateMonth(
    key: string,
    patch: Partial<Pick<Month, 'incomeCents' | 'fixedExpenses' | 'allocations'>>,
  ): Promise<void> {
    await updateDoc(monthRef(key), patch as DocumentData);
  }

  /** „Aplică luna”: re-validates, stores the results and posts one contribution per saving category, atomically. */
  async applyMonth(key: string): Promise<void> {
    const categories = this.categories();
    const balances = this.balances();
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(monthRef(key));
      if (!snap.exists()) {
        throw new Error(NETWORK_ERROR);
      }
      const month = { key, ...(snap.data() as Omit<Month, 'key'>) };
      if (month.status !== 'planned') {
        throw new Error('Luna a fost deja aplicată.');
      }
      const plan = computePlan({
        incomeCents: month.incomeCents,
        fixedExpenses: month.fixedExpenses,
        allocations: month.allocations,
        categories,
        balancesBefore: balances,
      });
      if (!plan.canApply) {
        throw new Error('Procentele trebuie să totalizeze 100%.');
      }
      const appliedAt = new Date().toISOString();
      const occurredOn = this.today();
      const allocations: MonthAllocation[] = plan.rows.map((r) => ({
        categoryId: r.categoryId,
        percent: r.percent,
        shareCents: r.shareCents,
        contributionCents: r.contributionCents,
        surplusOutCents: r.surplusOutCents,
        surplusInCents: r.surplusInCents,
        balanceAfterCents: r.balanceAfterCents,
      }));
      tx.update(monthRef(key), { status: 'applied', appliedAt, allocations });
      for (const row of plan.savingRows) {
        if ((row.postedCents ?? 0) > 0) {
          const movement: Omit<Movement, 'id'> = {
            categoryId: row.categoryId,
            type: 'contribution',
            amountCents: row.postedCents!,
            occurredOn,
            note: monthLabel(key),
            monthKey: key,
            createdAt: appliedAt,
          };
          tx.set(doc(collection(db, 'movements')), movement);
        }
      }
    });
  }

  /** „Editează” on an applied month: removes its contributions and clears the stored results, atomically. */
  async reopenMonth(key: string): Promise<void> {
    const contributions = this.movements().filter((m) => m.monthKey === key && m.type === 'contribution');
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(monthRef(key));
      if (!snap.exists()) {
        throw new Error(NETWORK_ERROR);
      }
      const month = snap.data() as Omit<Month, 'key'>;
      if (month.status !== 'applied') {
        return;
      }
      for (const movement of contributions) {
        tx.delete(movementRef(movement.id));
      }
      const allocations: MonthAllocation[] = month.allocations.map((a) => ({
        categoryId: a.categoryId,
        percent: a.percent,
      }));
      tx.update(monthRef(key), { status: 'planned', appliedAt: null, allocations });
    });
  }

  // -------------------------------------------------------------- categories

  async saveCategory(input: CategoryInput, id?: string): Promise<string> {
    const data = normalizeCategory(input);
    if (id) {
      await updateDoc(categoryRef(id), data);
      return id;
    }
    const newId = doc(collection(db, 'categories')).id;
    const position = Math.max(-1, ...this.categories().map((c) => c.position)) + 1;
    const batch = writeBatch(db);
    batch.set(categoryRef(newId), {
      ...data,
      createdOn: this.today(),
      position,
      archivedAt: null,
    });
    for (const month of this.months()) {
      if (month.status === 'planned') {
        batch.update(monthRef(month.key), {
          allocations: [...month.allocations, { categoryId: newId, percent: 0 }],
        });
      }
    }
    await batch.commit();
    return newId;
  }

  /** With movements the category is archived (history stays), otherwise it is deleted. */
  async deleteCategory(id: string): Promise<void> {
    const hasMovements = this.movements().some((m) => m.categoryId === id);
    const batch = writeBatch(db);
    if (hasMovements) {
      batch.update(categoryRef(id), { archivedAt: new Date().toISOString() });
    } else {
      batch.delete(categoryRef(id));
    }
    for (const category of this.categories()) {
      if (category.overflowToId === id) {
        batch.update(categoryRef(category.id), { overflowToId: null });
      }
    }
    for (const month of this.months()) {
      if (month.status === 'planned' && month.allocations.some((a) => a.categoryId === id)) {
        batch.update(monthRef(month.key), {
          allocations: month.allocations.filter((a) => a.categoryId !== id),
        });
      }
    }
    await batch.commit();
  }

  async reorderCategories(orderedIds: string[]): Promise<void> {
    const batch = writeBatch(db);
    orderedIds.forEach((id, position) => batch.update(categoryRef(id), { position }));
    await batch.commit();
  }

  // --------------------------------------------------------------- movements

  async addWithdrawal(categoryId: string, amountCents: number, note: string): Promise<void> {
    const balance = this.balances()[categoryId] ?? 0;
    if (amountCents <= 0) {
      throw new Error('Suma trebuie să fie mai mare decât 0.');
    }
    if (amountCents > balance) {
      throw new Error(`Suma depășește soldul fondului (${formatEUR(balance)}).`);
    }
    const movement: Omit<Movement, 'id'> = {
      categoryId,
      type: 'withdrawal',
      amountCents: -amountCents,
      occurredOn: this.today(),
      note: note.trim(),
      monthKey: null,
      createdAt: new Date().toISOString(),
    };
    await setDoc(doc(collection(db, 'movements')), movement);
  }

  /** A purchase from an investment category: shares × price + fees leave its budget. */
  async addPurchase(
    categoryId: string,
    details: PurchaseDetails,
    note: string,
    occurredOn: string,
  ): Promise<void> {
    const total = purchaseTotalCents(details);
    const balance = this.balances()[categoryId] ?? 0;
    if (total > balance) {
      throw new Error(`Suma depășește bugetul disponibil (${formatEUR(balance)}).`);
    }
    const movement: Omit<Movement, 'id'> = {
      categoryId,
      type: 'purchase',
      amountCents: -total,
      occurredOn,
      note: note.trim(),
      monthKey: null,
      createdAt: new Date().toISOString(),
      purchase: details,
    };
    await setDoc(doc(collection(db, 'movements')), movement);
  }

  async deleteMovement(id: string): Promise<void> {
    await deleteDoc(movementRef(id));
  }
}

function normalizeCategory(input: CategoryInput): CategoryInput {
  const saving = input.kind !== 'spending';
  return {
    name: input.name.trim(),
    kind: input.kind,
    percent: Math.round(input.percent * 10) / 10,
    targetCents: saving ? input.targetCents : null,
    overflowToId: saving ? input.overflowToId : null,
    initialBalanceCents: saving ? input.initialBalanceCents : 0,
  };
}
