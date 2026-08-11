import type { TransactionItem } from '../data/mockTransactions';
import { filterNormalTransactions } from './transactionPeriods';

export type CategoryStat = {
  category: string;
  total: number;
  icon?: string | null;
};

export const buildCategoryStats = (transactions: TransactionItem[], type: 'income' | 'expense'): CategoryStat[] => {
  const totals = new Map<string, { total: number; icon?: string | null }>();

  filterNormalTransactions(transactions)
    .filter(item => item.type === type)
    .forEach(item => {
      const current = totals.get(item.category);
      totals.set(item.category, {
        total: (current?.total ?? 0) + item.displayAmount,
        icon: current?.icon ?? item.categoryIcon,
      });
    });

  return [...totals.entries()]
    .map(([category, value]) => ({ category, total: value.total, icon: value.icon }))
    .sort((left, right) => right.total - left.total)
    .slice(0, 6);
};
