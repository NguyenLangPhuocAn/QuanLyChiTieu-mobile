import type { Category } from '../types/category';
import type { ApiTransaction } from '../types/transaction';
import type { TransactionQuery } from '../services/transactions';
import { getTransactionDateKey } from './mapTransactions';
import { getCashFlowType } from './transactionClassification';

const normalized = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLocaleLowerCase('vi')
    .trim();

export const searchCachedTransactions = (
  transactions: ApiTransaction[],
  categories: Category[],
  query: TransactionQuery,
) => {
  const categoryById = new Map(categories.map(category => [category.id, category]));
  const matches = transactions.filter(item => {
    const date = getTransactionDateKey(item.transaction_date);
    const amount = Math.abs(Number(item.amount));
    const category =
      item.category ??
      (item.category_id ? categoryById.get(item.category_id) : null);
    if (query.wallet_id && item.wallet_id !== query.wallet_id) return false;
    if (query.category_id && item.category_id !== query.category_id) return false;
    if (query.type && item.type !== query.type) return false;
    if (query.cash_flow && getCashFlowType(category) !== query.cash_flow)
      return false;
    if (query.from && date < query.from) return false;
    if (query.to && date > query.to) return false;
    if (query.min_amount !== undefined && amount < query.min_amount)
      return false;
    if (query.max_amount !== undefined && amount > query.max_amount)
      return false;
    const note = normalized(item.note ?? '');
    if (query.q && !note.includes(normalized(query.q))) return false;
    if (query.note && !note.includes(normalized(query.note))) return false;
    if (
      query.tag &&
      !(item.tags ?? []).some(tag => normalized(tag).includes(normalized(query.tag!)))
    )
      return false;
    return true;
  });
  return matches.sort((left, right) => {
    const dateDifference = getTransactionDateKey(right.transaction_date).localeCompare(
      getTransactionDateKey(left.transaction_date),
    );
    return dateDifference || right.id - left.id;
  });
};
