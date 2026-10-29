import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiBaseUrl } from './api';
import type { Budget } from '../types/budget';
import type { Category } from '../types/category';
import type { SavingsGoal } from '../types/savings';
import type { TagItem } from '../types/tag';
import type { ApiTransaction } from '../types/transaction';
import type { Wallet } from '../types/wallet';

export type DashboardCache = {
  server?: string;
  wallets: Wallet[];
  transactions: ApiTransaction[];
  categories: Category[];
  tags: TagItem[];
  budgets: Budget[];
  savingsGoals: SavingsGoal[];
  updatedAt: string;
};

const key = (userId: number) => `quan_ly_chi_tieu_local_data_${userId}`;
const listeners = new Set<() => void>();

export const dashboardCache = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  async save(userId: number, data: Omit<DashboardCache, 'updatedAt'>) {
    const value = {
      ...data,
      server: getApiBaseUrl(),
      updatedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(key(userId), JSON.stringify(value));
    listeners.forEach(listener => listener());
    return value;
  },

  async read(userId: number): Promise<DashboardCache | null> {
    const raw = await AsyncStorage.getItem(key(userId));
    if (!raw) return null;

    try {
      const data = JSON.parse(raw) as DashboardCache;
      return data.server === getApiBaseUrl() &&
        [
          data.wallets,
          data.transactions,
          data.categories,
          data.tags,
          data.budgets,
          data.savingsGoals,
        ].every(Array.isArray) &&
        typeof data.updatedAt === 'string'
        ? data
        : null;
    } catch {
      return null;
    }
  },
};
