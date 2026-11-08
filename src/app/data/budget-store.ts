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
import { buildPositions, normalizeSymbol } from '../domain/portfolio';
import type {
  Category,
  FixedExpense,
  Month,
  MonthAllocation,
  Movement,
  Profile,
  Trade,
  TradeDetails,
  TradeType,
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
const tradeRef = (id: string) => doc(db, 'trades', id);

/** Movements written before trades became a ledger of their own. */
interface LegacyTradeMovement {
  type: string;
  occurredOn: string;
  note?: string;
  createdAt: string;
  trade?: TradeDetails | null;
  purchase?: TradeDetails | null;
}

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
  private migratingTrades = false;

  readonly profile = signal<Profile | null>(null);
  readonly categories = signal<Category[]>([]);
  /** Sorted by key ascending. */
  readonly months = signal<Month[]>([]);
  /** Newest first. */
  readonly movements = signal<Movement[]>([]);
  /** Investiții ledger, newest first. */
  readonly trades = signal<Trade[]>([]);
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
  readonly balances = computed(() =>
    computeBalances(this.categories(), this.movements(), this.months()),
  );
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
              .map((d) => {
                const data = d.data() as Omit<Category, 'id'> & { kind: string };
                // Categories of the former „Investiții” kind are saving funds now.
                const kind = data.kind === 'spending' ? 'spending' : 'saving';
                return { id: d.id, ...data, kind } as Category;
              })
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
              .map((d) => {
                const data = d.data() as Omit<Month, 'key'>;
                // Months saved before incomes existed carry a single income line.
                const incomes =
                  data.incomes ??
                  (data.incomeCents > 0 ? [{ name: 'Venit', amountCents: data.incomeCents, position: 0 }] : []);
                return { key: d.id, ...data, incomes };
              })
              .sort((a, b) => compareMonthKeys(a.key, b.key)),
          );
          this.monthsLoaded.set(true);
        },
        fail,
      ),
      onSnapshot(
        collection(db, 'movements'),
        (qs) => {
          const legacy = qs.docs.filter((d) => isLegacyTrade(d.data() as LegacyTradeMovement));
          void this.migrateLegacyTrades(legacy.map((d) => ({ id: d.id, data: d.data() as LegacyTradeMovement })));
          this.movements.set(
            qs.docs
              .filter((d) => !isLegacyTrade(d.data() as LegacyTradeMovement))
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
      onSnapshot(
        collection(db, 'trades'),
        (qs) => {
          this.trades.set(
            qs.docs
              .map((d) => ({ id: d.id, ...(d.data() as Omit<Trade, 'id'>) }))
              .sort(
                (a, b) =>
                  b.occurredOn.localeCompare(a.occurredOn) || b.createdAt.localeCompare(a.createdAt),
              ),
          );
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
    this.trades.set([]);
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
    patch: Partial<Pick<Month, 'incomeCents' | 'incomes' | 'fixedExpenses' | 'allocations'>>,
  ): Promise<void> {
    await updateDoc(monthRef(key), patch as DocumentData);
  }

  /** „Utilizat”: what was spent from a category this month; editable on applied months too. */
  async setUsed(key: string, categoryId: string, usedCents: number): Promise<void> {
    const month = this.monthByKey(key);
    if (!month) {
      return;
    }
    const allocations = month.allocations.map((a) =>
      a.categoryId === categoryId ? { ...a, usedCents } : a,
    );
    await updateDoc(monthRef(key), { allocations });
  }

  /** Marks one fixed expense of a month as paid (today) or not; works on applied months too. */
  async setExpensePaid(key: string, index: number, paid: boolean): Promise<void> {
    const month = this.monthByKey(key);
    if (!month) {
      return;
    }
    const fixedExpenses = month.fixedExpenses.map((e, i) => ({
      name: e.name,
      amountCents: e.amountCents,
      position: e.position,
      paidOn: i === index ? (paid ? this.today() : null) : (e.paidOn ?? null),
    }));
    await updateDoc(monthRef(key), { fixedExpenses });
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
      const used = new Map(month.allocations.map((a) => [a.categoryId, a.usedCents ?? 0]));
      const allocations: MonthAllocation[] = plan.rows.map((r) => {
        const spending = r.category.kind === 'spending';
        const before = balances[r.categoryId] ?? 0;
        return {
          categoryId: r.categoryId,
          percent: r.percent,
          usedCents: used.get(r.categoryId) ?? 0,
          shareCents: r.shareCents,
          contributionCents: spending ? r.shareCents : r.contributionCents,
          surplusOutCents: spending ? 0 : r.surplusOutCents,
          surplusInCents: spending ? 0 : r.surplusInCents,
          balanceAfterCents: spending ? before + r.shareCents : r.balanceAfterCents,
        };
      });
      tx.update(monthRef(key), { status: 'applied', appliedAt, allocations });
      for (const row of plan.rows) {
        const posted = row.category.kind === 'spending' ? row.shareCents : (row.postedCents ?? 0);
        if (posted > 0) {
          const movement: Omit<Movement, 'id'> = {
            categoryId: row.categoryId,
            type: 'contribution',
            amountCents: posted,
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
        usedCents: a.usedCents ?? 0,
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

  /** Records a purchase or sale on the Investiții ledger. No balance is checked or changed. */
  async addTrade(type: TradeType, details: TradeDetails, note: string, occurredOn: string): Promise<void> {
    const symbol = normalizeSymbol(details.symbol);
    if (type === 'sale') {
      const held = buildPositions(this.trades()).find((p) => p.symbol === symbol);
      if (!held || held.shares < details.shares) {
        throw new Error(`Nu ai atâtea acțiuni ${symbol}.`);
      }
    }
    const trade: Omit<Trade, 'id'> = {
      type,
      symbol,
      shares: details.shares,
      priceCents: details.priceCents,
      feesCents: details.feesCents,
      occurredOn,
      note: note.trim(),
      createdAt: new Date().toISOString(),
    };
    await setDoc(doc(collection(db, 'trades')), trade);
  }

  async deleteTrade(id: string): Promise<void> {
    await deleteDoc(tradeRef(id));
  }

  /** One-time move of purchases and sales that were stored as movements into the trades ledger. */
  private async migrateLegacyTrades(legacy: { id: string; data: LegacyTradeMovement }[]): Promise<void> {
    if (legacy.length === 0 || this.migratingTrades) {
      return;
    }
    this.migratingTrades = true;
    try {
      const batch = writeBatch(db);
      for (const { id, data } of legacy) {
        const details = data.trade ?? data.purchase;
        if (details) {
          const trade: Omit<Trade, 'id'> = {
            type: data.type as TradeType,
            symbol: normalizeSymbol(details.symbol),
            shares: details.shares,
            priceCents: details.priceCents,
            feesCents: details.feesCents,
            occurredOn: data.occurredOn,
            note: data.note ?? '',
            createdAt: data.createdAt,
          };
          batch.set(tradeRef(id), trade);
        }
        batch.delete(movementRef(id));
      }
      await batch.commit();
    } catch (err) {
      console.error(err);
    } finally {
      this.migratingTrades = false;
    }
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
    initialBalanceCents: input.initialBalanceCents,
  };
}

function isLegacyTrade(data: LegacyTradeMovement): boolean {
  return data.type === 'purchase' || data.type === 'sale';
}
