import { holdsBalance, type Category, type Month, type Movement } from './types';

/**
 * Balance of every category: initial balance, plus the signed sum of its movements, minus what was
 * marked as „Utilizat” in applied months.
 */
export function computeBalances(
  categories: readonly Category[],
  movements: readonly Movement[],
  months: readonly Month[] = [],
): Record<string, number> {
  const balances: Record<string, number> = {};
  for (const category of categories) {
    if (holdsBalance(category.kind)) {
      balances[category.id] = category.initialBalanceCents;
    }
  }
  for (const movement of movements) {
    if (movement.categoryId in balances) {
      balances[movement.categoryId] += movement.amountCents;
    }
  }
  for (const month of months) {
    if (month.status !== 'applied') {
      continue;
    }
    for (const allocation of month.allocations) {
      if (allocation.categoryId in balances && allocation.usedCents) {
        balances[allocation.categoryId] -= allocation.usedCents;
      }
    }
  }
  return balances;
}

export function fixedTotal(expenses: readonly { amountCents: number }[]): number {
  return expenses.reduce((sum, e) => sum + e.amountCents, 0);
}
