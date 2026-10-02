import type { Category, Movement } from './types';

/** Balance of every saving category: initial balance plus the signed sum of its movements. */
export function computeBalances(
  categories: readonly Category[],
  movements: readonly Movement[],
): Record<string, number> {
  const balances: Record<string, number> = {};
  for (const category of categories) {
    if (category.kind === 'saving') {
      balances[category.id] = category.initialBalanceCents;
    }
  }
  for (const movement of movements) {
    if (movement.categoryId in balances) {
      balances[movement.categoryId] += movement.amountCents;
    }
  }
  return balances;
}

export function fixedTotal(expenses: readonly { amountCents: number }[]): number {
  return expenses.reduce((sum, e) => sum + e.amountCents, 0);
}
