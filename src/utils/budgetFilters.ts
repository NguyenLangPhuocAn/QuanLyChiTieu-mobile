import type { Budget } from '../types/budget';
import type { Category } from '../types/category';
import { isLoanDebtCategory } from './transactionClassification';

export type BudgetPeriodFilter =
  | 'CURRENT'
  | 'PREVIOUS_MONTH'
  | 'PREVIOUS_QUARTER'
  | 'PREVIOUS_YEAR'
  | 'CUSTOM_RANGE'
  | 'ALL';
export type BudgetPeriodFilterRange =
  | { mode: 'all' }
  | { mode: 'containsDate'; date: string }
  | { mode: 'overlapRange'; startDate: string; endDate: string };
type BudgetFilterInput = {
  query: string;
  period: BudgetPeriodFilter;
  customStartDate?: string;
  customEndDate?: string;
  currentDate?: string;
};

const normalizeSearch = (value?: string | number | null) =>
  String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const getBudgetSearchText = (budget: Budget) =>
  normalizeSearch(
    [
      budget.name,
      budget.wallet_name,
      budget.category_name,
      budget.scope === 'CATEGORY' ? 'danh muc' : 'vi',
      budget.period,
      budget.status,
    ].join(' '),
  );

export const getBudgetExpenseCategories = (categories: Category[]) =>
  categories.filter(
    category => category.type === 'EXPENSE' && !isLoanDebtCategory(category),
  );

const parseDate = (value?: string | null) => {
  if (!value) {
    return null;
  }

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.slice(0, 10));
  if (dateOnly) {
    const date = new Date(
      Number(dateOnly[1]),
      Number(dateOnly[2]) - 1,
      Number(dateOnly[3]),
    );

    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
};

const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`;

export const getBudgetPeriodFilterRange = (
  period: BudgetPeriodFilter,
  currentDate?: string,
  customStartDate?: string,
  customEndDate?: string,
): BudgetPeriodFilterRange => {
  const anchor = parseDate(currentDate) ?? new Date();

  if (period === 'ALL') {
    return { mode: 'all' };
  }

  if (period === 'CURRENT') {
    return { mode: 'containsDate', date: toDateKey(anchor) };
  }

  if (period === 'CUSTOM_RANGE') {
    return {
      mode: 'overlapRange',
      startDate: customStartDate ?? toDateKey(anchor),
      endDate: customEndDate ?? toDateKey(anchor),
    };
  }

  if (period === 'PREVIOUS_YEAR') {
    const year = anchor.getFullYear() - 1;
    return {
      mode: 'overlapRange',
      startDate: toDateKey(new Date(year, 0, 1)),
      endDate: toDateKey(new Date(year, 11, 31)),
    };
  }

  if (period === 'PREVIOUS_QUARTER') {
    const currentQuarterStartMonth = Math.floor(anchor.getMonth() / 3) * 3;
    const previousQuarterStart = new Date(anchor.getFullYear(), currentQuarterStartMonth - 3, 1);

    return {
      mode: 'overlapRange',
      startDate: toDateKey(previousQuarterStart),
      endDate: toDateKey(new Date(previousQuarterStart.getFullYear(), previousQuarterStart.getMonth() + 3, 0)),
    };
  }

  return {
    mode: 'overlapRange',
    startDate: toDateKey(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1)),
    endDate: toDateKey(new Date(anchor.getFullYear(), anchor.getMonth(), 0)),
  };
};

const overlapsRange = (budget: Budget, startDate?: string, endDate?: string) => {
  const filterStart = parseDate(startDate);
  const filterEnd = parseDate(endDate);

  if (!filterStart || !filterEnd || filterStart > filterEnd) {
    return true;
  }

  const budgetStart = parseDate(budget.start_date);
  const budgetEnd = parseDate(budget.end_date);

  if (!budgetStart || !budgetEnd) {
    return false;
  }

  return budgetStart <= filterEnd && budgetEnd >= filterStart;
};

const containsDate = (budget: Budget, value?: string) => {
  const current = parseDate(value) ?? new Date();
  const budgetStart = parseDate(budget.start_date);
  const budgetEnd = parseDate(budget.end_date);

  if (!budgetStart || !budgetEnd) {
    return false;
  }

  return budgetStart <= current && budgetEnd >= current;
};

export const filterBudgets = (
  budgets: Budget[],
  filters: BudgetFilterInput,
) => {
  const query = normalizeSearch(filters.query);

  return budgets.filter(budget => {
    const filterRange = getBudgetPeriodFilterRange(
      filters.period,
      filters.currentDate,
      filters.customStartDate,
      filters.customEndDate,
    );
    const matchesPeriod =
      filterRange.mode === 'all' ||
      (filterRange.mode === 'containsDate'
        ? containsDate(budget, filterRange.date)
        : overlapsRange(budget, filterRange.startDate, filterRange.endDate));
    const matchesQuery = !query || getBudgetSearchText(budget).includes(query);

    return matchesPeriod && matchesQuery;
  });
};
