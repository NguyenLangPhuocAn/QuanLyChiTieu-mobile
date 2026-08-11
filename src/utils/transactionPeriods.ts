import type {
  TransactionItem,
  TransactionType,
} from '../data/mockTransactions';
import { isNormalCashFlow } from './transactionClassification';

export type PeriodMode =
  | 'day'
  | 'week'
  | 'month'
  | 'quarter'
  | 'year'
  | 'custom';

type WalletBalanceInput = {
  id: number;
  balance: string | number;
  display_balance?: number;
  created_at?: string | null;
};

export type PeriodRange = {
  selectedDate?: string;
  selectedWeekStart?: string;
  selectedMonth?: number;
  selectedQuarter?: number;
  selectedYear?: number;
  dateFrom?: string;
  dateTo?: string;
};

export const toDateInput = (date: Date) =>
  `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(
    2,
    '0',
  )}-${`${date.getDate()}`.padStart(2, '0')}`;

export const parseDateInput = (value?: string | null) => {
  if (!value) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) {
    return null;
  }

  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );

  return Number.isNaN(date.getTime()) ? null : date;
};

export const startOfWeek = (date: Date) => {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = start.getDay() || 7;
  start.setDate(start.getDate() - day + 1);
  start.setHours(0, 0, 0, 0);
  return start;
};

const addDays = (date: Date, amount: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};

const endOfDay = (date: Date) => {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
};

export const getOverviewMonthBounds = (
  selectedMonth: Date,
  anchor: Date = new Date(),
) => {
  const start = new Date(
    selectedMonth.getFullYear(),
    selectedMonth.getMonth(),
    1,
  );
  const isCurrentMonth =
    start.getFullYear() === anchor.getFullYear() &&
    start.getMonth() === anchor.getMonth();
  const end = isCurrentMonth
    ? new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate())
    : new Date(start.getFullYear(), start.getMonth() + 1, 0);

  return { start, end: endOfDay(end) };
};

const sortRange = (start: Date, end: Date) =>
  start <= end ? { start, end } : { start: end, end: start };

export const getPeriodBounds = (
  period: PeriodMode,
  range: PeriodRange = {},
  anchor: Date = new Date(),
) => {
  if (period === 'day') {
    const start =
      parseDateInput(range.selectedDate) ??
      new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
    return { start, end: endOfDay(start) };
  }

  if (period === 'week') {
    const start =
      parseDateInput(range.selectedWeekStart) ?? startOfWeek(anchor);
    return { start, end: endOfDay(addDays(start, 6)) };
  }

  if (period === 'month') {
    const year = range.selectedYear ?? anchor.getFullYear();
    const month = range.selectedMonth ?? anchor.getMonth();
    return {
      start: new Date(year, month, 1),
      end: endOfDay(new Date(year, month + 1, 0)),
    };
  }

  if (period === 'quarter') {
    const year = range.selectedYear ?? anchor.getFullYear();
    const quarter = range.selectedQuarter ?? Math.floor(anchor.getMonth() / 3);
    const start = new Date(year, quarter * 3, 1);
    return {
      start,
      end: endOfDay(new Date(year, quarter * 3 + 3, 0)),
    };
  }

  if (period === 'year') {
    const year = range.selectedYear ?? anchor.getFullYear();
    return {
      start: new Date(year, 0, 1),
      end: endOfDay(new Date(year, 11, 31)),
    };
  }

  const fallbackStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const fallbackEnd = new Date(
    anchor.getFullYear(),
    anchor.getMonth(),
    anchor.getDate(),
  );
  const sorted = sortRange(
    parseDateInput(range.dateFrom) ?? fallbackStart,
    parseDateInput(range.dateTo) ?? fallbackEnd,
  );

  return { start: sorted.start, end: endOfDay(sorted.end) };
};

export const filterTransactionsByPeriod = (
  transactions: TransactionItem[],
  period: PeriodMode,
  range: PeriodRange = {},
  anchor: Date = new Date(),
) => {
  const bounds = getPeriodBounds(period, range, anchor);

  return filterTransactionsByDateBounds(transactions, bounds);
};

export const filterTransactionsByDateBounds = (
  transactions: TransactionItem[],
  bounds: { start: Date; end: Date },
) =>
  transactions.filter(item => {
    const date = new Date(item.date);

    return date >= bounds.start && date <= bounds.end;
  });

export const getPreviousPeriodBounds = (
  period: PeriodMode,
  range: PeriodRange = {},
  anchor: Date = new Date(),
) => {
  const current = getPeriodBounds(period, range, anchor);

  if (period === 'day') {
    const start = addDays(current.start, -1);
    return { start, end: endOfDay(start) };
  }

  if (period === 'week') {
    const start = addDays(current.start, -7);
    return { start, end: endOfDay(addDays(start, 6)) };
  }

  if (period === 'month') {
    const start = new Date(
      current.start.getFullYear(),
      current.start.getMonth() - 1,
      1,
    );
    return {
      start,
      end: endOfDay(new Date(start.getFullYear(), start.getMonth() + 1, 0)),
    };
  }

  if (period === 'quarter') {
    const start = new Date(
      current.start.getFullYear(),
      current.start.getMonth() - 3,
      1,
    );
    return {
      start,
      end: endOfDay(new Date(start.getFullYear(), start.getMonth() + 3, 0)),
    };
  }

  if (period === 'year') {
    const start = new Date(current.start.getFullYear() - 1, 0, 1);
    return { start, end: endOfDay(new Date(start.getFullYear(), 11, 31)) };
  }

  const dayCount = Math.max(
    1,
    Math.floor((current.end.getTime() - current.start.getTime()) / 86400000) +
      1,
  );
  const end = addDays(current.start, -1);
  const start = addDays(end, -(dayCount - 1));
  return { start, end: endOfDay(end) };
};

export const getPeriodRangeForOffset = (
  period: PeriodMode,
  offset: number,
  anchor: Date = new Date(),
): PeriodRange => {
  if (period === 'day') {
    return { selectedDate: toDateInput(addDays(anchor, offset)) };
  }

  if (period === 'week') {
    return {
      selectedWeekStart: toDateInput(addDays(startOfWeek(anchor), offset * 7)),
    };
  }

  if (period === 'month') {
    const target = new Date(
      anchor.getFullYear(),
      anchor.getMonth() + offset,
      1,
    );
    return {
      selectedMonth: target.getMonth(),
      selectedYear: target.getFullYear(),
    };
  }

  if (period === 'quarter') {
    const currentQuarter = Math.floor(anchor.getMonth() / 3);
    const target = new Date(
      anchor.getFullYear(),
      (currentQuarter + offset) * 3,
      1,
    );
    return {
      selectedQuarter: Math.floor(target.getMonth() / 3),
      selectedYear: target.getFullYear(),
    };
  }

  if (period === 'year') {
    return { selectedYear: anchor.getFullYear() + offset };
  }

  return {};
};

export type TrendBucket = {
  label: string;
  start: Date;
  end: Date;
  expense: number;
};

const formatDayMonth = (date: Date) =>
  `${`${date.getDate()}`.padStart(2, '0')}/${`${date.getMonth() + 1}`.padStart(
    2,
    '0',
  )}`;

const makeExpenseBucket = (
  transactions: TransactionItem[],
  start: Date,
  end: Date,
  label: string,
): TrendBucket => {
  const bucketTransactions = filterTransactionsByDateBounds(transactions, {
    start,
    end,
  });

  return {
    label,
    start,
    end,
    expense: sumNormalByType(bucketTransactions, 'expense'),
  };
};

const buildDailyBuckets = (
  transactions: TransactionItem[],
  start: Date,
  end: Date,
) => {
  const buckets: TrendBucket[] = [];
  let cursor = new Date(start);

  while (cursor <= end) {
    const bucketStart = new Date(cursor);
    const bucketEnd = endOfDay(bucketStart);
    buckets.push(
      makeExpenseBucket(
        transactions,
        bucketStart,
        bucketEnd,
        formatDayMonth(bucketStart),
      ),
    );
    cursor = addDays(cursor, 1);
  }

  return buckets;
};

const buildWeekChunks = (
  transactions: TransactionItem[],
  start: Date,
  end: Date,
) => {
  const buckets: TrendBucket[] = [];
  let cursor = new Date(start);

  while (cursor <= end) {
    const bucketStart = new Date(cursor);
    const rawEnd = addDays(bucketStart, 6);
    const bucketEnd = rawEnd > end ? end : endOfDay(rawEnd);
    const label = `${formatDayMonth(bucketStart)}-${formatDayMonth(bucketEnd)}`;
    buckets.push(
      makeExpenseBucket(transactions, bucketStart, bucketEnd, label),
    );
    cursor = addDays(bucketStart, 7);
  }

  return buckets;
};

export const buildOverviewMonthExpenseTrendBuckets = (
  transactions: TransactionItem[],
  selectedMonth: Date,
  anchor: Date = new Date(),
) => {
  const bounds = getOverviewMonthBounds(selectedMonth, anchor);
  return buildWeekChunks(transactions, bounds.start, bounds.end);
};

const buildMonthlyBuckets = (
  transactions: TransactionItem[],
  start: Date,
  end: Date,
) => {
  const buckets: TrendBucket[] = [];
  let cursor = new Date(start.getFullYear(), start.getMonth(), 1);

  while (cursor <= end) {
    const bucketStart = cursor < start ? new Date(start) : new Date(cursor);
    const monthEnd = endOfDay(
      new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0),
    );
    const bucketEnd = monthEnd > end ? end : monthEnd;
    buckets.push(
      makeExpenseBucket(
        transactions,
        bucketStart,
        bucketEnd,
        `T${cursor.getMonth() + 1}`,
      ),
    );
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  return buckets;
};

export const buildExpenseTrendBuckets = (
  transactions: TransactionItem[],
  period: PeriodMode,
  range: PeriodRange = {},
  anchor: Date = new Date(),
) => {
  const bounds = getPeriodBounds(period, range, anchor);

  if (period === 'week') {
    return buildDailyBuckets(transactions, bounds.start, bounds.end);
  }

  if (period === 'month') {
    return buildWeekChunks(transactions, bounds.start, bounds.end);
  }

  if (period === 'quarter' || period === 'year') {
    return buildMonthlyBuckets(transactions, bounds.start, bounds.end);
  }

  if (period === 'custom') {
    const dayCount = Math.max(
      1,
      Math.floor((bounds.end.getTime() - bounds.start.getTime()) / 86400000) +
        1,
    );
    return dayCount <= 31
      ? buildDailyBuckets(transactions, bounds.start, bounds.end)
      : buildWeekChunks(transactions, bounds.start, bounds.end);
  }

  return buildDailyBuckets(transactions, bounds.start, bounds.end);
};

export const estimateWalletBalanceAtDate = (
  wallet: WalletBalanceInput,
  transactions: TransactionItem[],
  endDate: Date,
  mode: 'display' | 'native' = 'display',
) => {
  const walletTransactions = transactions.filter(
    transaction => transaction.walletId === wallet.id,
  );
  const hasTransactionAtOrBeforeEnd = walletTransactions.some(
    transaction => new Date(transaction.date) <= endDate,
  );
  if (!hasTransactionAtOrBeforeEnd) {
    return 0;
  }

  const currentBalance = Number(
    mode === 'display'
      ? wallet.display_balance ?? wallet.balance ?? 0
      : wallet.balance ?? 0,
  );

  return walletTransactions.reduce((balance, transaction) => {
    if (
      new Date(transaction.date) <= endDate
    ) {
      return balance;
    }

    const amount = Number(
      mode === 'display'
        ? transaction.displayAmount ?? transaction.amount ?? 0
        : transaction.amount ?? 0,
    );
    return transaction.type === 'income' ? balance - amount : balance + amount;
  }, currentBalance);
};

export const selectWalletsForPeriodPreview = <T extends { id: number }>(
  wallets: T[],
  balances: Map<number, { native: number; display: number }>,
  isCurrentPeriod: boolean,
  limit = 3,
) => {
  if (isCurrentPeriod) {
    return wallets.slice(0, limit);
  }

  return [...wallets]
    .filter(wallet => Math.abs(balances.get(wallet.id)?.display ?? 0) > 0)
    .sort((left, right) => {
      const rightBalance = Math.abs(balances.get(right.id)?.display ?? 0);
      const leftBalance = Math.abs(balances.get(left.id)?.display ?? 0);
      return rightBalance - leftBalance;
    })
    .slice(0, limit);
};

export const filterNormalTransactions = (transactions: TransactionItem[]) =>
  transactions.filter(item => isNormalCashFlow(item.cashFlowType));

export const selectRecentOverviewTransactions = (
  transactions: TransactionItem[],
  limit = 4,
) => filterNormalTransactions(transactions).slice(0, limit);

export const sumNormalByType = (
  transactions: TransactionItem[],
  type: TransactionType,
) =>
  filterNormalTransactions(transactions)
    .filter(item => item.type === type)
    .reduce((total, item) => total + item.displayAmount, 0);

const formatShortDate = (date: Date) =>
  `${`${date.getDate()}`.padStart(2, '0')}/${`${date.getMonth() + 1}`.padStart(
    2,
    '0',
  )}/${date.getFullYear()}`;

export const getPeriodLabel = (
  period: PeriodMode,
  range: PeriodRange = {},
  anchor: Date = new Date(),
) => {
  const bounds = getPeriodBounds(period, range, anchor);

  if (period === 'day') {
    return formatShortDate(bounds.start);
  }

  if (period === 'week') {
    return `${formatShortDate(bounds.start)} - ${formatShortDate(bounds.end)}`;
  }

  if (period === 'month') {
    return `Tháng ${bounds.start.getMonth() + 1}/${bounds.start.getFullYear()}`;
  }

  if (period === 'quarter') {
    return `Quý ${
      Math.floor(bounds.start.getMonth() / 3) + 1
    }/${bounds.start.getFullYear()}`;
  }

  if (period === 'year') {
    return String(bounds.start.getFullYear());
  }

  return `${formatShortDate(bounds.start)} - ${formatShortDate(bounds.end)}`;
};
