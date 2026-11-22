import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiStorageBaseUrl } from './api';
import type { SavingsGoal } from '../types/savings';
import type { Wallet } from '../types/wallet';

export type SavingsGoalsSnapshot = {
  server: string;
  userId: number;
  updatedAt: string;
  goals: SavingsGoal[];
  wallets: Wallet[];
};

const key = (userId: number) =>
  `savings-goals:v1:${getApiStorageBaseUrl()}:${userId}`;

export const savingsGoalsCache = {
  async save(userId: number, goals: SavingsGoal[], wallets: Wallet[]) {
    const value: SavingsGoalsSnapshot = {
      server: getApiStorageBaseUrl(),
      userId,
      updatedAt: new Date().toISOString(),
      goals,
      wallets,
    };
    await AsyncStorage.setItem(key(userId), JSON.stringify(value));
    return value;
  },

  async read(userId: number): Promise<SavingsGoalsSnapshot | null> {
    const raw = await AsyncStorage.getItem(key(userId));
    if (!raw) return null;
    try {
      const value = JSON.parse(raw) as SavingsGoalsSnapshot;
      return value.server === getApiStorageBaseUrl() &&
        value.userId === userId &&
        typeof value.updatedAt === 'string' &&
        !Number.isNaN(Date.parse(value.updatedAt)) &&
        Array.isArray(value.goals) &&
        Array.isArray(value.wallets) &&
        value.goals.every(goal =>
          Number.isSafeInteger(goal.id) &&
          goal.user_id === userId &&
          typeof goal.name === 'string' &&
          ['ACTIVE', 'COMPLETED', 'CANCELLED'].includes(goal.status) &&
          Array.isArray(goal.entries),
        )
        ? value
        : null;
    } catch {
      return null;
    }
  },
};
