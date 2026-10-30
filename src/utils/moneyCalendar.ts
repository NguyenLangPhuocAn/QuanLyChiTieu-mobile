import type { Wallet } from '../types/wallet';
import type { OfflineTransactionDraft } from '../services/offlineTransactionQueue';
import {
  billOccurrences,
  billDateOffset,
  isBillDate,
  type BillBook,
} from './recurringBills';

export type MoneyPlan = {
  id: string;
  label: string;
  date: string;
  amount: number;
  currency: string;
  type: 'INCOME' | 'EXPENSE';
};
export const validateMoneyPlan = (plan: MoneyPlan) => {
  if (
    typeof plan.id !== 'string' ||
    !/^[a-zA-Z0-9_-]{1,100}$/.test(plan.id) ||
    typeof plan.label !== 'string' ||
    !plan.label.trim() ||
    plan.label.trim().length > 100 ||
    !isBillDate(plan.date) ||
    !['INCOME', 'EXPENSE'].includes(plan.type) ||
    !/^[A-Z]{3}$/.test(plan.currency) ||
    !Number.isFinite(plan.amount) ||
    plan.amount <= 0 ||
    plan.amount > 9999999999999.99 ||
    (plan.currency === 'VND'
      ? !Number.isInteger(plan.amount)
      : Math.abs(plan.amount * 100 - Math.round(plan.amount * 100)) > 0.0001)
  )
    throw Error('Kiểm tra tên, ngày, tiền tệ và số tiền dự kiến.');
  return { ...plan, label: plan.label.trim() };
};
export function buildMoneyCalendar(input: {
  today: string;
  currency: string;
  wallets: Wallet[];
  book: BillBook;
  plans: MoneyPlan[];
  drafts: OfflineTransactionDraft[];
  reserve?: number;
}) {
  const { today, currency } = input;
  if (!isBillDate(today) || !/^[A-Z]{3}$/.test(currency))
    throw Error('Ngày hoặc tiền tệ chưa hợp lệ.');
  const factor = currency === 'VND' ? 1 : 100;
  const units = (amount: number) => {
    const value = Math.round(amount * factor);
    if (!Number.isFinite(amount) || !Number.isSafeInteger(value))
      throw Error('Số tiền chưa hợp lệ hoặc quá lớn để tính chính xác.');
    return value;
  };
  const sum = (values: number[]) =>
    values.reduce((a, b) => {
      const next = a + b;
      if (!Number.isSafeInteger(next))
        throw Error('Tổng tiền quá lớn để tính chính xác.');
      return next;
    }, 0);
  const end = billDateOffset(today, 29);
  const wallets = input.wallets.filter(
    w => w.wallet_type !== 'SAVINGS' && w.currency === currency,
  );
  const opening = sum(wallets.map(w => units(Number(w.balance))));
  const reserve = units(input.reserve ?? 0);
  if (reserve < 0) throw Error('Tiền giữ lại không được âm.');
  const pending = sum(
    input.drafts
      .filter(
        d =>
          d.payload.type === 'EXPENSE' &&
          wallets.some(w => w.id === d.payload.wallet_id),
      )
      .map(d => {
        const amount = units(Number(d.payload.amount));
        if (amount <= 0) throw Error('Số tiền trong hàng chờ chưa hợp lệ.');
        return amount;
      }),
  );
  const active = input.book.bills.filter(
    b => !b.paused && !b.archived && b.currency === currency,
  );
  const from = active.reduce(
    (first, b) => (b.anchorDate < first ? b.anchorDate : first),
    today,
  );
  const events: Array<{
    id: string;
    label: string;
    date: string;
    originalDate: string;
    amount: number;
    type: 'INCOME' | 'EXPENSE';
    billId?: string;
    variable: boolean;
  }> = billOccurrences({ ...input.book, bills: active }, from, end, today)
    .filter(o => o.status === 'PENDING' || o.status === 'OVERDUE')
    .map(o => ({
      id: `bill:${o.bill.id}:${o.dueDate}`,
      label: o.bill.label,
      date: o.dueDate < today ? today : o.dueDate,
      originalDate: o.dueDate,
      amount: units(o.bill.maxAmount),
      type: 'EXPENSE',
      billId: o.bill.id,
      variable: o.bill.kind === 'VARIABLE',
    }));
  for (const raw of input.plans) {
    const plan = validateMoneyPlan(raw);
    if (
      plan.currency !== currency ||
      plan.date > end ||
      (plan.type === 'INCOME' && plan.date < today)
    )
      continue;
    events.push({
      ...plan,
      id: `plan:${plan.id}`,
      originalDate: plan.date,
      date: plan.date < today ? today : plan.date,
      amount: units(plan.amount),
      variable: false,
    });
  }
  events.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.type.localeCompare(b.type) ||
      a.id.localeCompare(b.id),
  );
  const billCommitment = sum(events.filter(e => e.billId).map(e => e.amount));
  const manualCommitment = sum(
    events.filter(e => !e.billId && e.type === 'EXPENSE').map(e => e.amount),
  );
  const available = sum([
    opening,
    -reserve,
    -pending,
    -billCommitment,
    -manualCommitment,
  ]);
  let balance = sum([opening, -pending, -reserve]);
  let firstRiskDate: string | null = balance < 0 ? today : null;
  const dates = [...new Set(events.map(e => e.date))];
  const days = dates.map(date => {
    const rows = events.filter(e => e.date === date);
    const expense = sum(
      rows.filter(e => e.type === 'EXPENSE').map(e => e.amount),
    );
    const income = sum(
      rows.filter(e => e.type === 'INCOME').map(e => e.amount),
    );
    const beforeIncome = sum([balance, -expense]);
    if (beforeIncome < 0 && !firstRiskDate) firstRiskDate = date;
    balance = sum([beforeIncome, income]);
    return {
      date,
      expense: expense / factor,
      income: income / factor,
      balance: balance / factor,
      risk: beforeIncome < 0,
      events: rows.map(e => ({ ...e, amount: e.amount / factor })),
    };
  });
  return {
    today,
    end,
    days,
    currency,
    firstRiskDate,
    horizonDays: 30,
    opening: opening / factor,
    pending: pending / factor,
    reserve: reserve / factor,
    billCommitment: billCommitment / factor,
    manualCommitment: manualCommitment / factor,
    shortfall: Math.max(0, -available) / factor,
    available: Math.max(0, available) / factor,
    safeDaily: Math.floor(Math.max(0, available) / 30) / factor,
    hasWallets: wallets.length > 0,
  };
}
