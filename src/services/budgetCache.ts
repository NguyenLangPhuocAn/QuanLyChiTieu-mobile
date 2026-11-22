import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiStorageBaseUrl } from './api';
import type { Budget } from '../types/budget';
import type { Wallet } from '../types/wallet';
import type { Category } from '../types/category';

export type BudgetCacheSnapshot = {
  server: string;
  userId: number;
  updatedAt: string;
  budgets: Budget[];
  wallets: Wallet[];
  categories: Category[];
};

const key = (userId: number) =>
  `budget-list:v1:${getApiStorageBaseUrl()}:${userId}`;

export const budgetCache = {
  async save(
    userId: number,
    budgets: Budget[],
    wallets: Wallet[],
    categories: Category[],
  ): Promise<BudgetCacheSnapshot> {
    const value: BudgetCacheSnapshot = {
      server: getApiStorageBaseUrl(),
      userId,
      updatedAt: new Date().toISOString(),
      budgets,
      wallets,
      categories,
    };
    await AsyncStorage.setItem(key(userId), JSON.stringify(value));
    return value;
  },

  async read(userId: number): Promise<BudgetCacheSnapshot | null> {
    const raw = await AsyncStorage.getItem(key(userId));
    if (!raw) return null;
    try {
      const value = JSON.parse(raw) as BudgetCacheSnapshot;
      return value.server === getApiStorageBaseUrl() &&
        value.userId === userId &&
        typeof value.updatedAt === 'string' &&
        !Number.isNaN(Date.parse(value.updatedAt)) &&
        Array.isArray(value.budgets) &&
        Array.isArray(value.wallets) &&
        Array.isArray(value.categories) &&
        value.budgets.every(
          budget =>
            Number.isSafeInteger(budget.id) &&
            budget.user_id === userId &&
            typeof budget.name === 'string' &&
            typeof budget.start_date === 'string' &&
            typeof budget.end_date === 'string' &&
            ['NORMAL', 'WARNING', 'EXCEEDED'].includes(budget.status),
        )
        ? value
        : null;
    } catch {
      return null;
    }
  },
};
