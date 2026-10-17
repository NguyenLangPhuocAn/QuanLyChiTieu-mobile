import AsyncStorage from '@react-native-async-storage/async-storage';

export type RecurringDecisionStatus = 'CONFIRMED' | 'IGNORED';

export type RecurringDecision = {
  patternKey: string;
  status: RecurringDecisionStatus;
  updatedAt: string;
};

export type ManualMoneyPlan = {
  id: string;
  label: string;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  currency: string;
  date: string;
  createdAt: string;
};

const decisionKey = (userId: number) =>
  `quan_ly_chi_tieu_recurring_decisions_v1_${userId}`;
const planKey = (userId: number) =>
  `quan_ly_chi_tieu_manual_money_plans_v1_${userId}`;

const parseArray = <T>(raw: string | null): T[] => {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? (value as T[]) : [];
  } catch {
    return [];
  }
};

const createId = () =>
  `plan_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;

export const financialPlanningService = {
  async listRecurringDecisions(userId: number) {
    return parseArray<RecurringDecision>(
      await AsyncStorage.getItem(decisionKey(userId)),
    ).filter(
      item =>
        item?.patternKey &&
        (item.status === 'CONFIRMED' || item.status === 'IGNORED'),
    );
  },

  async setRecurringDecision(
    userId: number,
    patternKey: string,
    status: RecurringDecisionStatus,
  ) {
    const decisions = await this.listRecurringDecisions(userId);
    const next: RecurringDecision = {
      patternKey,
      status,
      updatedAt: new Date().toISOString(),
    };
    const index = decisions.findIndex(item => item.patternKey === patternKey);
    if (index >= 0) decisions[index] = next;
    else decisions.push(next);
    await AsyncStorage.setItem(decisionKey(userId), JSON.stringify(decisions));
    return next;
  },

  async clearRecurringDecision(userId: number, patternKey: string) {
    const decisions = await this.listRecurringDecisions(userId);
    await AsyncStorage.setItem(
      decisionKey(userId),
      JSON.stringify(decisions.filter(item => item.patternKey !== patternKey)),
    );
  },

  async listManualPlans(userId: number) {
    return parseArray<ManualMoneyPlan>(
      await AsyncStorage.getItem(planKey(userId)),
    ).filter(
      item =>
        item?.id &&
        item.label?.trim() &&
        (item.type === 'INCOME' || item.type === 'EXPENSE') &&
        Number.isFinite(item.amount) &&
        item.amount > 0 &&
        /^\d{4}-\d{2}-\d{2}$/.test(item.date),
    );
  },

  async addManualPlan(
    userId: number,
    input: Omit<ManualMoneyPlan, 'id' | 'createdAt'>,
  ) {
    const label = input.label.trim();
    if (!label || !Number.isFinite(input.amount) || input.amount <= 0) {
      throw new Error('Tên và số tiền dự kiến chưa hợp lệ.');
    }
    const parsedDate = new Date(`${input.date}T00:00:00.000Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(input.date) ||
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== input.date
    ) {
      throw new Error('Ngày dự kiến chưa hợp lệ.');
    }
    const plans = await this.listManualPlans(userId);
    const plan: ManualMoneyPlan = {
      ...input,
      id: createId(),
      label,
      currency: input.currency.trim().toUpperCase(),
      createdAt: new Date().toISOString(),
    };
    plans.push(plan);
    await AsyncStorage.setItem(planKey(userId), JSON.stringify(plans));
    return plan;
  },

  async removeManualPlan(userId: number, id: string) {
    const plans = await this.listManualPlans(userId);
    await AsyncStorage.setItem(
      planKey(userId),
      JSON.stringify(plans.filter(item => item.id !== id)),
    );
  },
};
