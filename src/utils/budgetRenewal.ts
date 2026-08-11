import type { Budget } from '../types/budget';
import type { BudgetPeriodFilter } from './budgetFilters';
import { getNextBudgetPeriodRange, toDateKey } from './budgetPeriod';

const getDateKey = (value: string) => value.slice(0, 10);

const startsImmediatelyAfter = (sourceEnd: string, candidateStart: string) => {
  const sourceEndTime = Date.parse(sourceEnd);
  const candidateStartTime = Date.parse(candidateStart);

  if (!Number.isFinite(sourceEndTime) || !Number.isFinite(candidateStartTime)) {
    return false;
  }

  // MySQL DATETIME(0) drops milliseconds, so consecutive periods differ by
  // either 1 ms in tests or 1 second in persisted data.
  const difference = candidateStartTime - sourceEndTime;
  return difference > 0 && difference <= 1000;
};

export const hasMatchingNextPeriodBudget = (
  source: Budget,
  budgets: Budget[],
) => {
  const nextRange = getNextBudgetPeriodRange(source);
  if (!nextRange) {
    return false;
  }

  return budgets.some(
    item =>
      item.id !== source.id &&
      item.scope === source.scope &&
      item.wallet_id === source.wallet_id &&
      (item.category_id ?? null) === (source.category_id ?? null) &&
      item.period === source.period &&
      ((getDateKey(item.start_date) === nextRange.start &&
        getDateKey(item.end_date) === nextRange.end) ||
        startsImmediatelyAfter(source.end_date, item.start_date)),
  );
};

export const getBudgetRenewalButtonState = (
  hasNextPeriod: boolean,
  isLoading: boolean,
) => {
  if (isLoading) {
    return { label: 'Đang tạo kỳ...', disabled: true };
  }

  if (hasNextPeriod) {
    return { label: 'Đã tạo kỳ mới', disabled: true };
  }

  return { label: 'Tạo kỳ mới', disabled: false };
};

export const shouldShowBudgetRenewal = (
  periodFilter: BudgetPeriodFilter,
  isExpired: boolean,
) => periodFilter !== 'CURRENT' && isExpired;

export const budgetContainsDate = (budget: Budget, date: Date = new Date()) => {
  const key = toDateKey(date);
  return (
    getDateKey(budget.start_date) <= key && getDateKey(budget.end_date) >= key
  );
};
