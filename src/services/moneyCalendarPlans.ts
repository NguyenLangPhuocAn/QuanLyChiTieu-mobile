import type { BillScope } from './recurringBills';
import { validateMoneyPlan, type MoneyPlan } from '../utils/moneyCalendar';
import {
  currentPlanningServer,
  planningLocalStore,
} from './planningLocalStore';
export const parseMoneyPlans = (raw: string | null): MoneyPlan[] => {
  if (raw === null) return [];
  try {
    const plans: MoneyPlan[] = JSON.parse(raw);
    if (
      !Array.isArray(plans) ||
      plans.length > 2000 ||
      new Set(plans.map(p => p.id)).size !== plans.length
    )
      throw Error();
    return plans.map(validateMoneyPlan);
  } catch {
    throw Error(
      'Chưa đọc được khoản dự kiến trên máy. Dữ liệu được giữ nguyên.',
    );
  }
};
const change = (
  scope: BillScope,
  update: (plans: MoneyPlan[]) => MoneyPlan[],
) =>
  planningLocalStore.update(
    scope,
    state => {
      if (!currentPlanningServer(scope)) throw Error('Máy chủ đã thay đổi.');
      const plans = update(parseMoneyPlans(state.plans));
      state.plans = JSON.stringify(plans);
      return plans;
    },
    () => currentPlanningServer(scope),
  );
export const moneyCalendarPlans = {
  read: async (scope: BillScope) =>
    parseMoneyPlans((await planningLocalStore.read(scope)).plans),
  add: (scope: BillScope, plan: MoneyPlan) =>
    change(scope, plans => {
      const value = validateMoneyPlan(plan);
      if (plans.some(p => p.id === value.id))
        throw Error('Khoản dự kiến đã tồn tại.');
      return [...plans, value];
    }),
  remove: (scope: BillScope, id: string) =>
    change(scope, plans => plans.filter(p => p.id !== id)),
};
