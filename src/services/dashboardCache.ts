import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Budget } from '../types/budget';
import type { Category } from '../types/category';
import type { SavingsGoal } from '../types/savings';
import type { TagItem } from '../types/tag';
import type { ApiTransaction } from '../types/transaction';
import type { Wallet } from '../types/wallet';

export type DashboardCache = {
  wallets: Wallet[];
  transactions: ApiTransaction[];
  categories: Category[];
  tags: TagItem[];
  budgets: Budget[];
  savingsGoals: SavingsGoal[];
  updatedAt: string;
};

const key = (userId: number) => `quan_ly_chi_tieu_local_data_${userId}`;

export const dashboardCache = {
  async save(userId: number, data: Omit<DashboardCache, 'updatedAt'>) {
    const value = { ...data, updatedAt: new Date().toISOString() };
    await AsyncStorage.setItem(key(userId), JSON.stringify(value));
    return value;
  },

  async read(userId: number): Promise<DashboardCache | null> {
    const raw = await AsyncStorage.getItem(key(userId));
    if (!raw) return null;

    try {
      return JSON.parse(raw) as DashboardCache;
    } catch {
      return null;
    }
  },
};
