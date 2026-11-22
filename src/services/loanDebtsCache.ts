import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiStorageBaseUrl } from './api';
import type { LoanDebt } from '../types/loanDebt';

export type LoanDebtsSnapshot = {
  server: string;
  userId: number;
  updatedAt: string;
  records: LoanDebt[];
};

const key = (userId: number) =>
  `loan-debts:v1:${getApiStorageBaseUrl()}:${userId}`;

export const loanDebtsCache = {
  async save(userId: number, records: LoanDebt[]) {
    const value: LoanDebtsSnapshot = {
      server: getApiStorageBaseUrl(),
      userId,
      updatedAt: new Date().toISOString(),
      records,
    };
    await AsyncStorage.setItem(key(userId), JSON.stringify(value));
    return value;
  },

  async read(userId: number): Promise<LoanDebtsSnapshot | null> {
    const raw = await AsyncStorage.getItem(key(userId));
    if (!raw) return null;
    try {
      const value = JSON.parse(raw) as LoanDebtsSnapshot;
      return value.server === getApiStorageBaseUrl() &&
        value.userId === userId &&
        typeof value.updatedAt === 'string' &&
        !Number.isNaN(Date.parse(value.updatedAt)) &&
        Array.isArray(value.records) &&
        value.records.every(record =>
          Number.isSafeInteger(record.id) &&
          record.user_id === userId &&
          typeof record.person_name === 'string' &&
          ['BORROWED', 'LENT'].includes(record.type) &&
          ['OPEN', 'OVERDUE', 'PAID'].includes(record.status) &&
          Array.isArray(record.payments),
        )
        ? value
        : null;
    } catch {
      return null;
    }
  },
};
