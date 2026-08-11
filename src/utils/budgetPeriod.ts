import type { BudgetPeriod } from '../types/budget';

export const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(
    2,
    '0',
  )}-${`${date.getDate()}`.padStart(2, '0')}`;

export const getBudgetDateEditPolicy = (period: BudgetPeriod) => {
  const canEditDates = period === 'CUSTOM';

  return {
    canEditStartDate: canEditDates,
    canEditEndDate: canEditDates,
  };
};

export const getBudgetSaveRange = (
  _period: BudgetPeriod,
  startDate: string,
  endDate: string,
) => ({ start: startDate, end: endDate });

export const getBudgetPeriodRange = (
  period: BudgetPeriod,
  anchor: Date = new Date(),
) => {
  if (period === 'CUSTOM') {
    return { start: toDateKey(anchor), end: toDateKey(anchor) };
  }

  if (period === 'DAY') {
    const date = toDateKey(anchor);
    return { start: date, end: date };
  }

  if (period === 'WEEK') {
    const day = anchor.getDay() || 7;
    const start = new Date(
      anchor.getFullYear(),
      anchor.getMonth(),
      anchor.getDate() - day + 1,
    );
    const end = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate() + 6,
    );
    return { start: toDateKey(start), end: toDateKey(end) };
  }

  if (period === 'YEAR') {
    return {
      start: toDateKey(new Date(anchor.getFullYear(), 0, 1)),
      end: toDateKey(new Date(anchor.getFullYear(), 11, 31)),
    };
  }

  if (period === 'QUARTER') {
    const quarterStartMonth = Math.floor(anchor.getMonth() / 3) * 3;

    return {
      start: toDateKey(new Date(anchor.getFullYear(), quarterStartMonth, 1)),
      end: toDateKey(new Date(anchor.getFullYear(), quarterStartMonth + 3, 0)),
    };
  }

  return {
    start: toDateKey(new Date(anchor.getFullYear(), anchor.getMonth(), 1)),
    end: toDateKey(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)),
  };
};

const parseDateKey = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) {
    return null;
  }

  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
};

export const getNextBudgetPeriodRange = (budget: {
  period: BudgetPeriod;
  end_date: string;
}) => {
  if (budget.period === 'CUSTOM') {
    return null;
  }

  const currentEnd = parseDateKey(budget.end_date);
  if (!currentEnd) {
    return null;
  }

  const start = new Date(
    currentEnd.getFullYear(),
    currentEnd.getMonth(),
    currentEnd.getDate() + 1,
  );

  if (budget.period === 'DAY') {
    const date = toDateKey(start);
    return { start: date, end: date };
  }

  if (budget.period === 'WEEK') {
    const end = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate() + 6,
    );
    return { start: toDateKey(start), end: toDateKey(end) };
  }

  if (budget.period === 'MONTH') {
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    return { start: toDateKey(start), end: toDateKey(end) };
  }

  if (budget.period === 'QUARTER') {
    const end = new Date(start.getFullYear(), start.getMonth() + 3, 0);
    return { start: toDateKey(start), end: toDateKey(end) };
  }

  return {
    start: toDateKey(start),
    end: toDateKey(new Date(start.getFullYear(), 11, 31)),
  };
};
