import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BankAppRule } from '../types/bankNotification';

const storageKey = (userId: number) =>
  `quan_ly_chi_tieu_bank_notification_rules_${userId}`;

export const bankNotificationSettings = {
  async getRules(userId: number): Promise<BankAppRule[]> {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as BankAppRule[]) : [];
    } catch {
      return [];
    }
  },

  async saveRules(userId: number, rules: BankAppRule[]) {
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify(rules));
  },
};
