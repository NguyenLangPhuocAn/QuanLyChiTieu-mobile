import { offlineTransactionQueue } from './offlineTransactionQueue';
import { offlineTransactionChanges } from './offlineTransactionChanges';
import { offlineCategoryQueue } from './offlineCategoryQueue';
import { offlineWalletQueue } from './offlineWalletQueue';
import { offlineBudgetQueue } from './offlineBudgetQueue';
import { offlineSavingsGoalQueue } from './offlineSavingsGoalQueue';
import { offlineLoanDebtQueue } from './offlineLoanDebtQueue';
import { offlineLoanCreateQueue } from './offlineLoanCreateQueue';
import type { OfflineTransactionDraft } from './offlineTransactionQueue';
import type { OfflineTransactionChange } from './offlineTransactionChanges';
import type { OfflineCategoryChange } from './offlineCategoryQueue';
import type { OfflineWalletChange } from './offlineWalletQueue';
import type { OfflineBudgetChange } from './offlineBudgetQueue';
import type { OfflineSavingsGoalChange } from './offlineSavingsGoalQueue';
import type { OfflineLoanDebtChange } from './offlineLoanDebtQueue';
import type { OfflineLoanCreate } from './offlineLoanCreateQueue';

// The pending items shown in the offline sync review.
export type ReviewItems = {
  drafts: OfflineTransactionDraft[];
  changes: OfflineTransactionChange[];
  categories?: OfflineCategoryChange[];
  wallets?: OfflineWalletChange[];
  budgets?: OfflineBudgetChange[];
  savingsGoals?: OfflineSavingsGoalChange[];
  loanDebts?: OfflineLoanDebtChange[];
  loanCreates?: OfflineLoanCreate[];
};

// What each queue looked like when the review was shown.
export type ReviewExpected = {
  drafts: Array<{ id: string; updatedAt: string }>;
  changes: Array<{ transactionId: number; revision: number }>;
  categories: Array<{ id: number; revision: number }>;
  wallets: Array<{ id: number; revision: number }>;
  budgets: Array<{ id: number; revision: number }>;
  savingsGoals: Array<{ id: number; revision: number }>;
  loanDebts: Array<{ id: number; revision: number }>;
  loanCreates: Array<{ id: string; revision: number }>;
};

// Stable key for every reviewable item.
export const reviewItemKeys = (review: ReviewItems | null) => [
  ...(review?.savingsGoals ?? []).map(item => `savings:${item.id}`),
  ...(review?.loanDebts ?? []).map(item => `loan:${item.id}`),
  ...(review?.loanCreates ?? []).map(item => `loanCreate:${item.id}`),
  ...(review?.budgets ?? []).map(item => `budget:${item.id}`),
  ...(review?.wallets ?? []).map(item => `wallet:${item.id}`),
  ...(review?.categories ?? []).map(item => `category:${item.id}`),
  ...(review?.drafts ?? []).map(item => `draft:${item.id}`),
  ...(review?.changes ?? []).map(item => `change:${item.transactionId}`),
];

// Items that point at a wallet/category created offline (negative id) can only
// be synced together with that new wallet/category.
export const reviewDependencies = (review: ReviewItems | null) => {
  const deps: Record<string, string[]> = {};
  const createdWallets = new Set(
    (review?.wallets ?? [])
      .filter(item => item.action === 'CREATE')
      .map(item => item.id),
  );
  const createdCategories = new Set(
    (review?.categories ?? [])
      .filter(item => item.action === 'CREATE')
      .map(item => item.id),
  );
  const add = (
    key: string,
    walletId?: number | null,
    categoryId?: number | null,
  ) => {
    const required: string[] = [];
    if (walletId != null && createdWallets.has(walletId))
      required.push(`wallet:${walletId}`);
    if (categoryId != null && createdCategories.has(categoryId))
      required.push(`category:${categoryId}`);
    if (required.length) deps[key] = required;
  };
  review?.drafts.forEach(item =>
    add(`draft:${item.id}`, item.payload.wallet_id, item.payload.category_id),
  );
  review?.changes.forEach(item =>
    add(
      `change:${item.transactionId}`,
      item.payload?.wallet_id,
      item.payload?.category_id,
    ),
  );
  review?.budgets?.forEach(item =>
    add(
      `budget:${item.id}`,
      item.payload?.wallet_id,
      item.payload?.category_id,
    ),
  );
  review?.loanCreates?.forEach(item =>
    add(`loanCreate:${item.id}`, item.payload.wallet_id),
  );
  return deps;
};

// Remove every reviewed item the user did not select from the device and
// return the expected state of each queue for the items that remain.
export const discardUnselected = async (
  userId: number,
  selected: string[],
  review: ReviewItems,
  expected: ReviewExpected,
): Promise<ReviewExpected> => {
  const keep = new Set(selected);
  const dependencies = reviewDependencies(review);
  for (const key of keep)
    if ((dependencies[key] ?? []).some(need => !keep.has(need)))
      throw Error(
        'Một mục đã chọn cần ví hoặc danh mục mới chưa được chọn. Hãy chọn kèm mục đó.',
      );
  const kept = <T,>(prefix: string, ids: T[]) =>
    ids.filter(id => keep.has(`${prefix}:${id}`));
  return {
    drafts: await offlineTransactionQueue.discardLocalExcept(
      userId,
      expected.drafts,
      kept(
        'draft',
        expected.drafts.map(item => item.id),
      ),
    ),
    changes: await offlineTransactionChanges.discardExcept(
      userId,
      expected.changes,
      kept(
        'change',
        expected.changes.map(item => item.transactionId),
      ),
    ),
    categories: await offlineCategoryQueue.discardExcept(
      userId,
      expected.categories,
      kept(
        'category',
        expected.categories.map(item => item.id),
      ),
    ),
    wallets: await offlineWalletQueue.discardExcept(
      userId,
      expected.wallets,
      kept(
        'wallet',
        expected.wallets.map(item => item.id),
      ),
    ),
    budgets: await offlineBudgetQueue.discardExcept(
      userId,
      expected.budgets,
      kept(
        'budget',
        expected.budgets.map(item => item.id),
      ),
    ),
    savingsGoals: await offlineSavingsGoalQueue.discardExcept(
      userId,
      expected.savingsGoals,
      kept(
        'savings',
        expected.savingsGoals.map(item => item.id),
      ),
    ),
    loanDebts: await offlineLoanDebtQueue.discardExcept(
      userId,
      expected.loanDebts,
      kept(
        'loan',
        expected.loanDebts.map(item => item.id),
      ),
    ),
    loanCreates: await offlineLoanCreateQueue.discardExcept(
      userId,
      expected.loanCreates,
      kept(
        'loanCreate',
        expected.loanCreates.map(item => item.id),
      ),
    ),
  };
};
