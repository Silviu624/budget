import type { Category, FixedExpense, Profile } from '../domain/types';

/** What a brand-new household starts with: the design's template and categories, zero balances. */
export const DEFAULT_TEMPLATE: FixedExpense[] = [
  { name: 'Chirie', amountCents: 95000, position: 0 },
  { name: 'Curent', amountCents: 10000, position: 1 },
  { name: 'Gaz', amountCents: 8000, position: 2 },
  { name: 'Apă', amountCents: 4500, position: 3 },
  { name: 'Internet', amountCents: 4000, position: 4 },
  { name: 'Telefon', amountCents: 5500, position: 5 },
  { name: 'Mâncare', amountCents: 120000, position: 6 },
  { name: 'Combustibil', amountCents: 35000, position: 7 },
  { name: 'Abonamente', amountCents: 18000, position: 8 },
];

export const DEFAULT_PROFILE: Profile = {
  displayName: 'Baby & Babyshutzu',
  defaultIncomeCents: 1000000,
  theme: 'auto',
  fixedExpenseTemplate: DEFAULT_TEMPLATE,
};

type Seed = Pick<Category, 'id' | 'name' | 'kind' | 'percent'> &
  Partial<Pick<Category, 'targetCents' | 'overflowToId'>>;

const SEED: Seed[] = [
  { id: 'siguranta', name: 'Fond de siguranță', kind: 'saving', percent: 20, targetCents: 1800000, overflowToId: 'investitii' },
  { id: 'investitii', name: 'Investiții', kind: 'saving', percent: 40 },
  { id: 'vacante', name: 'Vacanțe', kind: 'saving', percent: 10 },
  { id: 'masina', name: 'Mașină', kind: 'saving', percent: 3 },
  { id: 'casa', name: 'Casă', kind: 'saving', percent: 2 },
  { id: 'cadouri', name: 'Cadouri și sărbători', kind: 'saving', percent: 2 },
  { id: 'sanatate', name: 'Sănătate', kind: 'saving', percent: 2 },
  { id: 'obiectiv', name: 'Obiectiv mare', kind: 'saving', percent: 1, targetCents: 5000000 },
  { id: 'extra', name: 'Cheltuieli extra', kind: 'spending', percent: 10 },
  { id: 'baby', name: 'Bani personali – Baby', kind: 'spending', percent: 5 },
  { id: 'babyshutzu', name: 'Bani personali – Babyshutzu', kind: 'spending', percent: 5 },
];

export function defaultCategories(createdOn: string): Category[] {
  return SEED.map((s, position) => ({
    id: s.id,
    name: s.name,
    kind: s.kind,
    percent: s.percent,
    targetCents: s.targetCents ?? null,
    overflowToId: s.overflowToId ?? null,
    initialBalanceCents: 0,
    createdOn,
    position,
    archivedAt: null,
  }));
}
