import type { TransactionItem } from '../data/mockTransactions';
import type { Category } from '../types/category';
import type { Wallet } from '../types/wallet';
import { filterNormalCashFlowCategories } from './transactionClassification';
import { parseTagsInput } from './hashtags';

export type RepeatTransactionRequest = {
  transaction: TransactionItem;
  includeItems: boolean;
  userId: number;
  server: string;
  requestId: string;
};
export const canRepeatTransaction = (t: TransactionItem) =>
  ['income', 'expense'].includes(t.type) &&
  (!t.cashFlowType || t.cashFlowType === 'normal') &&
  Number.isFinite(t.amount) &&
  Math.abs(t.amount) > 0 &&
  Math.abs(t.amount) <= 9999999999999.99 &&
  /^[A-Z]{3}$/.test(t.currency) &&
  (t.currency === 'VND'
    ? Number.isInteger(t.amount)
    : Math.abs(t.amount * 100 - Math.round(t.amount * 100)) < 0.00001);

// Select fields deliberately: never carry an old ID, image, date or bank source.
export function repeatTransactionDraft(
  request: RepeatTransactionRequest,
  scope: { userId: number; server: string },
  wallets: Wallet[],
  categories: Category[],
) {
  const t = request.transaction;
  if (
    request.userId !== scope.userId ||
    request.server !== scope.server ||
    !request.requestId ||
    !canRepeatTransaction(t)
  )
    throw Error('Giao dịch không còn phù hợp để nhập lại.');
  const type: 'INCOME' | 'EXPENSE' = t.type === 'income' ? 'INCOME' : 'EXPENSE';
  const category =
    filterNormalCashFlowCategories(categories).find(
      c => c.id === t.categoryId && c.type === type,
    ) ?? null;
  const wallet =
    wallets.find(
      w =>
        w.id === t.walletId &&
        w.wallet_type !== 'SAVINGS' &&
        w.currency === t.currency,
    ) ?? null;
  return {
    type,
    amount: String(Math.abs(t.amount)),
    currency: t.currency,
    note: t.note,
    tags: parseTagsInput((t.tags ?? []).map(tag => `#${tag}`).join(' '))
      .map(tag => `#${tag}`)
      .join(' '),
    category,
    walletId: wallet?.id ?? null,
    receiptItems: request.includeItems
      ? (t.receiptItems ?? []).map(item => {
          if (
            !item.name.trim() ||
            !Number.isFinite(item.amount) ||
            item.amount <= 0
          )
            throw Error(
              'Chi tiết món cũ chưa hợp lệ. Hãy bỏ chọn kèm chi tiết món.',
            );
          return { name: item.name, amount: String(item.amount) };
        })
      : [],
  };
}
