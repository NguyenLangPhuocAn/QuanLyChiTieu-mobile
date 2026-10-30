import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiBaseUrl } from './api';
import type { BillScope } from './recurringBills';
import { validateMoneyPlan, type MoneyPlan } from '../utils/moneyCalendar';
const key = (scope: BillScope) => {
  if (!Number.isSafeInteger(scope.userId) || scope.userId <= 0 || !scope.server)
    throw Error('Chưa xác định được tài khoản cho lịch tiền.');
  return `money-calendar:v1:${scope.server}:${scope.userId}`;
};
const locks = new Map<string, Promise<unknown>>();
const read = async (scope: BillScope): Promise<MoneyPlan[]> => {
  const raw = await AsyncStorage.getItem(key(scope));
  if (!raw) return [];
  try {
    const plans: MoneyPlan[] = JSON.parse(raw);
    if (
      !Array.isArray(plans) ||
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
) => {
  const id = key(scope),
    prior = locks.get(id) ?? Promise.resolve();
  const run = prior
    .catch(() => undefined)
    .then(async () => {
      if (scope.server !== getApiBaseUrl()) throw Error('Máy chủ đã thay đổi.');
      const plans = update(await read(scope));
      if (scope.server !== getApiBaseUrl()) throw Error('Máy chủ đã thay đổi.');
      await AsyncStorage.setItem(id, JSON.stringify(plans));
      return plans;
    });
  locks.set(id, run);
  run
    .finally(() => {
      if (locks.get(id) === run) locks.delete(id);
    })
    .catch(() => undefined);
  return run;
};
export const moneyCalendarPlans = {
  read,
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
