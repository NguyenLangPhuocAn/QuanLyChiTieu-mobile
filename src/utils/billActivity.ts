import type { ApiTransaction } from '../types/transaction';
import { billMerchant } from './billSuggestions';
import { currentBillPayment } from './billPaymentChecks';
import { getTransactionDateKey } from './mapTransactions';
import { getCashFlowType } from './transactionClassification';
import {
  billDateOffset,
  billOccurrences,
  isBillDate,
  type BillBook,
  type BillCycle,
  type RecurringBill,
} from './recurringBills';

export type BillEvidence = {
  id: number;
  date: string;
  amount: number;
  note: string;
};
export type BillAlertKind = 'INCREASE' | 'DUPLICATE';
export type BillActivityAlert = {
  key: string;
  kind: BillAlertKind;
  bill: RecurringBill;
  dueDate: string;
  evidence: BillEvidence[];
  baseline?: number;
  increase?: number;
  percent?: number;
};
const scale = (currency: string) => (currency === 'VND' ? 1 : 100);
const units = (amount: number, currency: string) =>
  Math.round(amount * scale(currency));
const gap = (a: string, b: string) =>
  Math.round(
    (Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000,
  );
const month = (date: string) =>
  Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7));
const recentDays = (cycle: BillCycle) =>
  cycle === 'WEEKLY' ? 21 : cycle === 'MONTHLY' ? 75 : 400;
const evidenceSort = (a: BillEvidence, b: BillEvidence) =>
  a.date.localeCompare(b.date) || a.id - b.id;

export function billActivityMerchant(book: BillBook, bill: RecurringBill) {
  const source = book.suggestions
    ?.find(d => d.status === 'TRACKED' && d.billId === bill.id)
    ?.key.split(':');
  return source?.[2] === bill.currency && source[3] === bill.cycle
    ? source[4]
    : billMerchant(bill.label);
}

/** Calendar slot for analysis only, including evidence before tracking began. */
export function billActivitySlot(
  bill: RecurringBill,
  date: string,
): string | null {
  if (!isBillDate(date)) return null;
  if (bill.cycle === 'WEEKLY') {
    const due = billDateOffset(
      bill.anchorDate,
      Math.round(gap(date, bill.anchorDate) / 7) * 7,
    );
    return isBillDate(due) && Math.abs(gap(date, due)) <= 1 ? due : null;
  }
  const [y, m] = date.split('-').map(Number);
  const [, anchorMonth, day] = bill.anchorDate.split('-').map(Number);
  const choices: string[] = [];
  for (const offset of [-1, 0, 1]) {
    const first = new Date(
      Date.UTC(
        bill.cycle === 'YEARLY' ? y + offset : y,
        bill.cycle === 'YEARLY' ? anchorMonth - 1 : m - 1 + offset,
        1,
      ),
    );
    const last = new Date(
      Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
    ).getUTCDate();
    const due = new Date(
      Date.UTC(
        first.getUTCFullYear(),
        first.getUTCMonth(),
        Math.min(day, last),
      ),
    )
      .toISOString()
      .slice(0, 10);
    if (isBillDate(due) && Math.abs(gap(date, due)) <= 3) choices.push(due);
  }
  return (
    choices.sort(
      (a, b) => Math.abs(gap(date, a)) - Math.abs(gap(date, b)),
    )[0] ?? null
  );
}

type AlertKey = [
  string,
  BillAlertKind,
  string,
  BillCycle,
  string,
  string,
  number,
  string,
  string,
  [number, string, number][],
];
export function readBillAlertKey(value: unknown): AlertKey | null {
  if (typeof value !== 'string' || value.length > 120000) return null;
  try {
    const parts = JSON.parse(value) as AlertKey;
    const [
      version,
      kind,
      billId,
      cycle,
      currency,
      due,
      max,
      merchant,
      anchor,
      sources,
    ] = parts;
    if (
      !Array.isArray(parts) ||
      parts.length !== 10 ||
      version !== 'bill-alert:v1' ||
      !['INCREASE', 'DUPLICATE'].includes(kind) ||
      typeof billId !== 'string' ||
      !billId ||
      billId.length > 256 ||
      !['WEEKLY', 'MONTHLY', 'YEARLY'].includes(cycle) ||
      !/^[A-Z]{3}$/.test(currency) ||
      !isBillDate(due) ||
      !Number.isSafeInteger(max) ||
      max <= 0 ||
      typeof merchant !== 'string' ||
      merchant.length > 160 ||
      !isBillDate(anchor) ||
      !Array.isArray(sources) ||
      sources.length < 2 ||
      sources.length > 2000 ||
      sources.some(
        row =>
          !Array.isArray(row) ||
          row.length !== 3 ||
          !Number.isSafeInteger(row[0]) ||
          row[0] <= 0 ||
          row[0] > 2147483647 ||
          !isBillDate(row[1]) ||
          !Number.isSafeInteger(row[2]) ||
          row[2] <= 0,
      ) ||
      new Set(sources.map(row => row[0])).size !== sources.length
    )
      return null;
    return parts;
  } catch {
    return null;
  }
}
const alertKey = (
  book: BillBook,
  bill: RecurringBill,
  kind: BillAlertKind,
  dueDate: string,
  evidence: BillEvidence[],
) =>
  JSON.stringify([
    'bill-alert:v1',
    kind,
    bill.id,
    bill.cycle,
    bill.currency,
    dueDate,
    units(bill.maxAmount, bill.currency),
    billActivityMerchant(book, bill),
    bill.anchorDate,
    evidence.map(row => [row.id, row.date, units(row.amount, bill.currency)]),
  ]);

/** Read-only heuristics for confirmed schedules. Never infers a debt or deletes money. */
export function analyzeBillActivity(
  book: BillBook,
  rows: ApiTransaction[],
  today: string,
) {
  if (!isBillDate(today)) throw new Error('Ngày kiểm tra chưa hợp lệ.');
  const bills = book.bills.filter(
    b => !b.archived && !b.paused && b.id.length <= 256,
  );
  if (!bills.length) return { alerts: [], ambiguousNames: 0 };
  const dateCache = new Map<string, string>();
  const matches = new Map<string, RecurringBill[]>();
  const periods = new Map<string, Map<string, BillEvidence[]>>();
  const assignments = new Map(
    book.periods.flatMap(p =>
      p.status === 'PAID' ? [[p.payment.id, p] as const] : [],
    ),
  );
  for (const bill of book.bills) {
    const merchant = billActivityMerchant(book, bill);
    if (merchant.length < 3 || merchant.length > 160) continue;
    const key = `${bill.currency}|${merchant}`;
    matches.set(key, [...(matches.get(key) ?? []), bill]);
  }
  const idCounts = new Map<number, number>();
  for (const row of rows)
    if (row) idCounts.set(row.id, (idCounts.get(row.id) ?? 0) + 1);
  for (const row of rows) {
    if (
      !row ||
      idCounts.get(row.id) !== 1 ||
      !Number.isSafeInteger(row.id) ||
      row.id <= 0 ||
      row.id > 2147483647 ||
      row.type !== 'EXPENSE' ||
      getCashFlowType(row.category) !== 'normal' ||
      (row.category?.cash_flow_group &&
        row.category.cash_flow_group !== 'NORMAL') ||
      !['number', 'string'].includes(typeof row.amount) ||
      !/^[A-Z]{3}$/.test(row.currency) ||
      (row.note != null && typeof row.note !== 'string') ||
      typeof row.transaction_date !== 'string' ||
      !isBillDate(row.transaction_date.slice(0, 10)) ||
      (!isBillDate(row.transaction_date) &&
        (!/^\d{4}-\d{2}-\d{2}T/.test(row.transaction_date) ||
          !Number.isFinite(Date.parse(row.transaction_date))))
    )
      continue;
    const amount = Math.abs(Number(row.amount));
    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > 9999999999999.99 ||
      Math.abs(amount * scale(row.currency) - units(amount, row.currency)) >
        0.00001
    )
      continue;
    if (!dateCache.has(row.transaction_date))
      dateCache.set(
        row.transaction_date,
        getTransactionDateKey(row.transaction_date),
      );
    const date = dateCache.get(row.transaction_date)!;
    if (!isBillDate(date) || date > today) continue;
    const merchant = billMerchant(row.note ?? '');
    if (
      /^(chuyen vi|wallet transfer|hoan tien|refund)\b/.test(merchant) ||
      /\b(chuyen vi|wallet transfer)\b/.test(
        billMerchant(row.category?.name ?? ''),
      )
    )
      continue;
    let bill: RecurringBill | undefined,
      dueDate: string | null = null;
    const explicit = assignments.get(row.id);
    if (explicit) {
      bill = bills.find(b => b.id === explicit.billId);
      if (!bill || !currentBillPayment({ bill, period: explicit }, row))
        continue;
      dueDate = explicit.dueDate;
    } else {
      if (
        [
          'thanh toan',
          'chuyen khoan',
          'giao dich',
          'khac',
          'chi',
          'payment',
        ].includes(merchant)
      )
        continue;
      const possible = matches.get(`${row.currency}|${merchant}`) ?? [];
      if (
        possible.length !== 1 ||
        !bills.some(active => active.id === possible[0].id)
      )
        continue;
      bill = possible[0];
      dueDate = billActivitySlot(bill, date);
    }
    if (!bill || !dueDate || gap(today, date) > 1096) continue;
    const slots = periods.get(bill.id) ?? new Map<string, BillEvidence[]>();
    const entries = slots.get(dueDate) ?? [];
    entries.push({ id: row.id, date, amount, note: row.note ?? '' });
    slots.set(dueDate, entries);
    periods.set(bill.id, slots);
  }
  const alerts: BillActivityAlert[] = [];
  for (const bill of bills) {
    const slots = [...(periods.get(bill.id)?.entries() ?? [])].sort(
      ([a], [b]) => a.localeCompare(b),
    );
    for (const [dueDate, entries] of slots) {
      if (
        gap(
          today,
          entries.reduce(
            (date, row) => (row.date > date ? row.date : date),
            '2000-01-01',
          ),
        ) > recentDays(bill.cycle)
      )
        continue;
      const byAmount = new Map<number, BillEvidence[]>();
      for (const entry of entries) {
        const value = units(entry.amount, bill.currency);
        const entriesForAmount = byAmount.get(value) ?? [];
        entriesForAmount.push(entry);
        byAmount.set(value, entriesForAmount);
      }
      for (const sameAmount of byAmount.values()) {
        const sorted = sameAmount.sort(evidenceSort);
        for (let start = 0; start < sorted.length; ) {
          let end = start + 1;
          while (
            end < sorted.length &&
            gap(sorted[end].date, sorted[start].date) <= 3
          )
            end++;
          if (end - start >= 2) {
            const evidence = sorted.slice(start, end);
            alerts.push({
              key: alertKey(book, bill, 'DUPLICATE', dueDate, evidence),
              kind: 'DUPLICATE',
              bill,
              dueDate,
              evidence,
            });
          }
          start = end;
        }
      }
    }
    const latest = slots.at(-1);
    const last = slots.slice(-4);
    if (
      !latest ||
      last.length !== 4 ||
      last.some(([, entries]) => entries.length !== 1)
    )
      continue;
    const dates = last.map(([date]) => date);
    if (
      !dates
        .slice(1)
        .every((date, i) =>
          bill.cycle === 'WEEKLY'
            ? gap(date, dates[i]) === 7
            : month(date) - month(dates[i]) ===
              (bill.cycle === 'YEARLY' ? 12 : 1),
        )
    )
      continue;
    const evidence = last.map(([, entries]) => entries[0]);
    if (gap(today, evidence[3].date) > recentDays(bill.cycle)) continue;
    const before = evidence
      .slice(0, 3)
      .map(entry => units(entry.amount, bill.currency));
    const baseline = [...before].sort((a, b) => a - b)[1];
    const current = units(evidence[3].amount, bill.currency);
    const increase = current - baseline;
    if (
      before.some(
        value => Math.abs(value - baseline) > Math.floor(baseline / 10),
      ) ||
      increase < Math.ceil(baseline / 10) ||
      current <= units(bill.maxAmount, bill.currency)
    )
      continue;
    alerts.push({
      key: alertKey(book, bill, 'INCREASE', latest[0], evidence),
      kind: 'INCREASE',
      bill,
      dueDate: latest[0],
      evidence,
      baseline: baseline / scale(bill.currency),
      increase: increase / scale(bill.currency),
      percent: (increase / baseline) * 100,
    });
  }
  return {
    alerts: alerts.sort(
      (a, b) =>
        b.dueDate.localeCompare(a.dueDate) || a.key.localeCompare(b.key),
    ),
    ambiguousNames: [...matches.values()].filter(
      group =>
        group.length > 1 &&
        group.some(b => bills.some(active => active.id === b.id)),
    ).length,
  };
}

export function upcomingBillSummary(book: BillBook, today: string) {
  const end = billDateOffset(today, 29);
  const totals = new Map<
    string,
    {
      currency: string;
      min: number;
      max: number;
      periods: number;
      bills: Set<string>;
      overflow: boolean;
    }
  >();
  for (const occurrence of billOccurrences(book, today, end, today)) {
    if (
      occurrence.status !== 'PENDING' ||
      occurrence.bill.paused ||
      occurrence.bill.archived
    )
      continue;
    const bill = occurrence.bill;
    const total = totals.get(bill.currency) ?? {
      currency: bill.currency,
      min: 0,
      max: 0,
      periods: 0,
      bills: new Set<string>(),
      overflow: false,
    };
    const min = total.min + units(bill.minAmount, bill.currency),
      max = total.max + units(bill.maxAmount, bill.currency);
    if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max))
      total.overflow = true;
    else {
      total.min = min;
      total.max = max;
    }
    total.periods++;
    total.bills.add(bill.id);
    totals.set(bill.currency, total);
  }
  return {
    end,
    totals: [...totals.values()]
      .sort((a, b) => a.currency.localeCompare(b.currency))
      .map(total => ({
        currency: total.currency,
        min: total.overflow ? null : total.min / scale(total.currency),
        max: total.overflow ? null : total.max / scale(total.currency),
        periods: total.periods,
        bills: total.bills.size,
      })),
  };
}
