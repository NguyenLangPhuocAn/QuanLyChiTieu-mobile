import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SmartRule } from '../types/smartRule';

const storageKey = (userId: number) => `quan_ly_chi_tieu_smart_rules_${userId}`;

export const normalizeSmartRuleKeyword = (value: string) =>
  value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi');

const normalizeRules = (value: unknown): SmartRule[] => {
  if (!Array.isArray(value)) return [];

  const uniqueRules = new Map<string, SmartRule>();

  value.forEach(item => {
    if (!item || typeof item !== 'object') return [];
    const candidate = item as Partial<SmartRule>;
    const keyword = candidate.keyword?.trim();
    const categoryId = candidate.categoryId;

    if (
      !candidate.id ||
      !keyword ||
      typeof categoryId !== 'number' ||
      !Number.isInteger(categoryId) ||
      !candidate.categoryName
    ) {
      return [];
    }

    uniqueRules.set(normalizeSmartRuleKeyword(keyword), {
      id: candidate.id,
      keyword,
      categoryId,
      categoryName: candidate.categoryName,
      enabled: candidate.enabled !== false,
    });
  });

  return [...uniqueRules.values()];
};

export const findMatchingSmartRule = (note: string, rules: SmartRule[]) => {
  const normalizedNote = normalizeSmartRuleKeyword(note);
  if (!normalizedNote) return null;

  return rules.reduce<SmartRule | null>((bestMatch, rule) => {
    const normalizedKeyword = normalizeSmartRuleKeyword(rule.keyword);
    if (!rule.enabled || !normalizedNote.includes(normalizedKeyword)) {
      return bestMatch;
    }

    if (
      !bestMatch ||
      normalizedKeyword.length >=
        normalizeSmartRuleKeyword(bestMatch.keyword).length
    ) {
      return rule;
    }

    return bestMatch;
  }, null);
};

export const smartRulesService = {
  async getRules(userId: number) {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (!raw) return [];

    try {
      return normalizeRules(JSON.parse(raw));
    } catch {
      return [];
    }
  },

  async saveRules(userId: number, rules: SmartRule[]) {
    const normalized = normalizeRules(rules);
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify(normalized));
    return normalized;
  },
};
