import type { Budget } from '../types/budget';
import type { ApiTransaction } from '../types/transaction';
import type { Wallet } from '../types/wallet';
import type { ManualMoneyPlan } from '../services/financialPlanning';

const DAY_MS = 86_400_000;

const amountOf = (transaction: ApiTransaction) =>
  Math.abs(Number(transaction.display_amount ?? transaction.amount) || 0);

const dateOf = (transaction: ApiTransaction) => {
  const value = new Date(transaction.transaction_date);
  return Number.isNaN(value.getTime()) ? null : value;
};

const monthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const previousMonthKeys = (asOf: Date, count: number) =>
  Array.from({ length: count }, (_, index) => {
    const date = new Date(asOf.getFullYear(), asOf.getMonth() - index - 1, 1);
    return monthKey(date);
  }).reverse();

const median = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};

const percentile = (values: number[], ratio: number) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(
    0,
    Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio)),
  );
  return sorted[index];
};

export const calculateIrregularIncome = (
  transactions: ApiTransaction[],
  asOf = new Date(),
  months = 6,
) => {
  const keys = previousMonthKeys(asOf, months);
  const incomeByMonth = new Map(keys.map(key => [key, 0]));
  const expenseByMonth = new Map(keys.map(key => [key, 0]));

  transactions.forEach(transaction => {
    const date = dateOf(transaction);
    if (!date) return;
    const key = monthKey(date);
    if (!incomeByMonth.has(key)) return;
    const amount = amountOf(transaction);
    if (transaction.type === 'INCOME') {
      incomeByMonth.set(key, (incomeByMonth.get(key) ?? 0) + amount);
    } else {
      expenseByMonth.set(key, (expenseByMonth.get(key) ?? 0) + amount);
    }
  });

  const monthlyIncome = keys.map(key => incomeByMonth.get(key) ?? 0);
  const monthlyExpense = keys.map(key => expenseByMonth.get(key) ?? 0);
  const medianIncome = median(monthlyIncome);
  const conservativeIncome = percentile(monthlyIncome, 0.25);
  const medianExpense = median(monthlyExpense);
  const recommendedMonthlySpend = Math.max(
    0,
    Math.min(
      medianExpense || conservativeIncome * 0.8,
      conservativeIncome * 0.8,
    ),
  );

  return {
    months: keys,
    monthlyIncome,
    monthlyExpense,
    medianIncome,
    conservativeIncome,
    medianExpense,
    recommendedMonthlySpend,
    dataMonths: monthlyIncome.filter(value => value > 0).length,
  };
};

export const calculateEmergencyFund = (
  wallets: Wallet[],
  transactions: ApiTransaction[],
  asOf = new Date(),
  targetMonths = 3,
) => {
  const liquidBalance = wallets.reduce(
    (sum, wallet) =>
      sum + Math.max(0, Number(wallet.display_balance ?? wallet.balance) || 0),
    0,
  );
  const history = calculateIrregularIncome(transactions, asOf, 3);
  const essentialMonthlyExpense = history.medianExpense;
  const monthsCovered = essentialMonthlyExpense
    ? liquidBalance / essentialMonthlyExpense
    : 0;
  const targetAmount = essentialMonthlyExpense * targetMonths;

  return {
    liquidBalance,
    essentialMonthlyExpense,
    monthsCovered,
    targetMonths,
    targetAmount,
    gap: Math.max(0, targetAmount - liquidBalance),
  };
};

export const calculateEmergencyIncomeShock = (
  wallets: Wallet[],
  transactions: ApiTransaction[],
  incomeReductionPercent: number,
  asOf = new Date(),
  months = 6,
) => {
  const reduction = Math.max(0, Math.min(100, incomeReductionPercent)) / 100;
  const liquidBalance = wallets.reduce(
    (sum, wallet) =>
      sum + Math.max(0, Number(wallet.display_balance ?? wallet.balance) || 0),
    0,
  );
  const history = calculateIrregularIncome(transactions, asOf, months);
  const incomeAfterReduction = history.conservativeIncome * (1 - reduction);
  const monthlyShortfall = Math.max(
    0,
    history.medianExpense - incomeAfterReduction,
  );
  const monthsCovered = monthlyShortfall
    ? liquidBalance / monthlyShortfall
    : null;

  return {
    incomeReductionPercent: reduction * 100,
    liquidBalance,
    conservativeIncome: history.conservativeIncome,
    incomeAfterReduction,
    essentialMonthlyExpense: history.medianExpense,
    monthlyShortfall,
    monthsCovered,
  };
};

const normalizeMerchant = (value?: string | null) =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('vi')
    .replace(/\b(ref|ma gd|giao dich|thanh toan|chuyen khoan)\b/g, ' ')
    .replace(/\d{4,}/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .slice(0, 60);

export type RecurringMoneyPattern = {
  key: string;
  label: string;
  type: 'INCOME' | 'EXPENSE';
  averageAmount: number;
  intervalDays: number;
  occurrences: number;
  lastDate: string;
  nextDate: string;
  transactionIds: number[];
};

export type ProjectedCashFlowDay = {
  date: string;
  income: number;
  expense: number;
  projectedBalance: number;
  labels: string[];
};

export const detectRecurringMoney = (transactions: ApiTransaction[]) => {
  const groups = new Map<string, ApiTransaction[]>();
  transactions.forEach(transaction => {
    const merchant = normalizeMerchant(transaction.note);
    if (!merchant || amountOf(transaction) <= 0) return;
    const amountBucket = Math.round(amountOf(transaction) / 10_000) * 10_000;
    const key = `${transaction.type}|${merchant}|${amountBucket}`;
    groups.set(key, [...(groups.get(key) ?? []), transaction]);
  });

  const patterns: RecurringMoneyPattern[] = [];
  groups.forEach((items, key) => {
    const sorted = items
      .map(item => ({ item, date: dateOf(item) }))
      .filter((entry): entry is { item: ApiTransaction; date: Date } =>
        Boolean(entry.date),
      )
      .sort((left, right) => left.date.getTime() - right.date.getTime());
    if (sorted.length < 2) return;
    const intervals = sorted
      .slice(1)
      .map(
        (entry, index) =>
          (entry.date.getTime() - sorted[index].date.getTime()) / DAY_MS,
      )
      .filter(days => days >= 20 && days <= 40);
    if (intervals.length !== sorted.length - 1) return;

    const amounts = sorted.map(entry => amountOf(entry.item));
    const averageAmount =
      amounts.reduce((sum, value) => sum + value, 0) / amounts.length;
    if (
      amounts.some(
        value => Math.abs(value - averageAmount) > averageAmount * 0.12,
      )
    ) {
      return;
    }
    const intervalDays = Math.round(median(intervals));
    const last = sorted[sorted.length - 1];
    const next = new Date(
      Date.UTC(
        last.date.getUTCFullYear(),
        last.date.getUTCMonth() + 1,
        last.date.getUTCDate(),
      ),
    );
    patterns.push({
      key,
      label: last.item.note?.trim() || 'Khoản định kỳ',
      type: last.item.type,
      averageAmount,
      intervalDays,
      occurrences: sorted.length,
      lastDate: last.date.toISOString(),
      nextDate: next.toISOString(),
      transactionIds: sorted.map(entry => entry.item.id),
    });
  });

  return patterns.sort(
    (left, right) =>
      new Date(left.nextDate).getTime() - new Date(right.nextDate).getTime(),
  );
};

export const buildUpcomingMoneyCalendar = (
  transactions: ApiTransaction[],
  asOf = new Date(),
  days = 60,
  confirmedPatternKeys?: ReadonlySet<string>,
) => {
  const end = asOf.getTime() + days * DAY_MS;
  return detectRecurringMoney(transactions).filter(pattern => {
    if (confirmedPatternKeys && !confirmedPatternKeys.has(pattern.key)) {
      return false;
    }
    const next = new Date(pattern.nextDate).getTime();
    return next >= asOf.getTime() - DAY_MS && next <= end;
  });
};

export const buildProjectedCashFlow = (
  wallets: Wallet[],
  recurring: RecurringMoneyPattern[],
  manualPlans: ManualMoneyPlan[],
  asOf = new Date(),
  days = 60,
) => {
  const start = new Date(
    Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()),
  ).getTime();
  const end = start + days * DAY_MS;
  const openingBalance = wallets.reduce(
    (sum, wallet) =>
      sum + Number(wallet.display_balance ?? wallet.balance ?? 0),
    0,
  );
  const daily = new Map<
    string,
    { income: number; expense: number; labels: string[] }
  >();
  const add = (
    dateValue: string,
    type: 'INCOME' | 'EXPENSE',
    amount: number,
    label: string,
  ) => {
    const time = new Date(dateValue).getTime();
    if (!Number.isFinite(time) || time < start || time > end) return;
    const key = new Date(time).toISOString().slice(0, 10);
    const value = daily.get(key) ?? { income: 0, expense: 0, labels: [] };
    if (type === 'INCOME') value.income += amount;
    else value.expense += amount;
    value.labels.push(label);
    daily.set(key, value);
  };

  recurring.forEach(item =>
    add(item.nextDate, item.type, item.averageAmount, item.label),
  );
  manualPlans.forEach(item =>
    add(`${item.date}T00:00:00.000Z`, item.type, item.amount, item.label),
  );

  let balance = openingBalance;
  const projectedDays: ProjectedCashFlowDay[] = Array.from(daily.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, value]) => {
      balance += value.income - value.expense;
      return {
        date,
        income: value.income,
        expense: value.expense,
        projectedBalance: balance,
        labels: value.labels,
      };
    });

  return {
    openingBalance,
    days: projectedDays,
    firstRiskDate:
      projectedDays.find(item => item.projectedBalance < 0)?.date ?? null,
    lowestBalance: projectedDays.reduce(
      (lowest, item) => Math.min(lowest, item.projectedBalance),
      openingBalance,
    ),
  };
};

export const calculateSafeToSpendToday = (
  wallets: Wallet[],
  budgets: Budget[],
  transactions: ApiTransaction[],
  asOf = new Date(),
  options?: {
    confirmedPatternKeys?: ReadonlySet<string>;
    manualPlans?: ManualMoneyPlan[];
  },
) => {
  const activeBudgetRemaining = budgets
    .filter(budget => {
      const start = new Date(budget.start_date).getTime();
      const end = new Date(budget.end_date).getTime();
      return start <= asOf.getTime() && end >= asOf.getTime();
    })
    .reduce(
      (sum, budget) =>
        sum +
        Math.max(
          0,
          Number(budget.effective_remaining ?? budget.remaining) || 0,
        ),
      0,
    );
  const lastDay = new Date(
    asOf.getFullYear(),
    asOf.getMonth() + 1,
    0,
  ).getDate();
  const daysRemaining = Math.max(1, lastDay - asOf.getDate() + 1);
  const upcomingExpenses = buildUpcomingMoneyCalendar(
    transactions,
    asOf,
    daysRemaining,
    options?.confirmedPatternKeys,
  )
    .filter(pattern => pattern.type === 'EXPENSE')
    .reduce((sum, pattern) => sum + pattern.averageAmount, 0);
  const endOfPeriod = new Date(
    asOf.getFullYear(),
    asOf.getMonth(),
    asOf.getDate() + daysRemaining,
  ).getTime();
  const manualExpenses = (options?.manualPlans ?? [])
    .filter(plan => {
      const time = new Date(`${plan.date}T00:00:00.000Z`).getTime();
      return (
        plan.type === 'EXPENSE' &&
        time >= asOf.getTime() - DAY_MS &&
        time < endOfPeriod
      );
    })
    .reduce((sum, plan) => sum + plan.amount, 0);
  const liquidBalance = wallets.reduce(
    (sum, wallet) =>
      sum + Math.max(0, Number(wallet.display_balance ?? wallet.balance) || 0),
    0,
  );
  const sourceAmount = activeBudgetRemaining || liquidBalance;
  const availableAfterCommitments = Math.max(
    0,
    sourceAmount - upcomingExpenses - manualExpenses,
  );

  return {
    amount: availableAfterCommitments / daysRemaining,
    source: activeBudgetRemaining ? ('BUDGET' as const) : ('BALANCE' as const),
    sourceAmount,
    upcomingExpenses,
    manualExpenses,
    availableAfterCommitments,
    daysRemaining,
  };
};

export type DataQualityIssue = {
  id: string;
  type: 'DUPLICATE' | 'UNCATEGORIZED' | 'RECEIPT_MISMATCH' | 'MISSING_RATE';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  transactionIds: number[];
};

export const findDataQualityIssues = (
  transactions: ApiTransaction[],
  defaultCurrency: string,
) => {
  const issues: DataQualityIssue[] = [];
  const duplicateGroups = new Map<string, number[]>();

  transactions.forEach(transaction => {
    if (!transaction.category_id) {
      issues.push({
        id: `uncategorized-${transaction.id}`,
        type: 'UNCATEGORIZED',
        severity: 'MEDIUM',
        message: 'Giao dịch chưa có danh mục.',
        transactionIds: [transaction.id],
      });
    }
    const receiptTotal = (transaction.receipt_items ?? []).reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0,
    );
    if (
      receiptTotal > 0 &&
      Math.abs(receiptTotal - amountOf(transaction)) > 1
    ) {
      issues.push({
        id: `receipt-${transaction.id}`,
        type: 'RECEIPT_MISMATCH',
        severity: 'MEDIUM',
        message: 'Tổng chi tiết món khác tổng giao dịch.',
        transactionIds: [transaction.id],
      });
    }
    if (
      transaction.currency.toUpperCase() !== defaultCurrency.toUpperCase() &&
      transaction.display_amount === undefined
    ) {
      issues.push({
        id: `rate-${transaction.id}`,
        type: 'MISSING_RATE',
        severity: 'LOW',
        message: 'Giao dịch khác tiền tệ chưa có giá trị quy đổi.',
        transactionIds: [transaction.id],
      });
    }
    const key = [
      transaction.wallet_id,
      transaction.category_id ?? '',
      transaction.type,
      amountOf(transaction).toFixed(2),
      transaction.transaction_date.slice(0, 10),
      normalizeMerchant(transaction.note),
    ].join('|');
    duplicateGroups.set(key, [
      ...(duplicateGroups.get(key) ?? []),
      transaction.id,
    ]);
  });

  duplicateGroups.forEach(transactionIds => {
    if (transactionIds.length < 2) return;
    issues.push({
      id: `duplicate-${transactionIds.join('-')}`,
      type: 'DUPLICATE',
      severity: 'HIGH',
      message: `${transactionIds.length} giao dịch rất giống nhau trong cùng ngày.`,
      transactionIds,
    });
  });

  return issues.sort((left, right) => {
    const rank = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return rank[left.severity] - rank[right.severity];
  });
};
