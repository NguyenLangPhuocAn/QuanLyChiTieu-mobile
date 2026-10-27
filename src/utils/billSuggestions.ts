import type { ApiTransaction } from '../types/transaction';
import { getTransactionDateKey } from './mapTransactions';
import { getCashFlowType } from './transactionClassification';
import {
  billDueDate,
  isBillDate,
  type BillBook,
  type BillCycle,
  type BillInput,
} from './recurringBills';

export type BillSuggestion = {
  key: string;
  merchant: string;
  input: BillInput;
  nextDate: string;
  evidence: { id: number; date: string; amount: number; note: string }[];
};
export type BillSuggestionDecision = {
  key: string;
  status: 'IGNORED' | 'LATER' | 'TRACKED';
  until?: string;
  billId?: string;
};
// Keep plan/package numbers. Only explicitly labelled changing references/months are removed.
const cleanLabel = (note: string) =>
  note
    .replace(
      /\s+(?:ref|mã gd|ma gd|mã giao dịch|ma giao dich|gd)\s*[:#]\s*[^\s].*$/iu,
      '',
    )
    .replace(/\s+(?:tháng|thang|kỳ|ky)\s+\d{1,2}[/.-]\d{4}\s*$/iu, '')
    .trim();
export const billMerchant = (note: string) =>
  cleanLabel(note)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/^(?:thanh toan|tra|payment for)\s+/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
export const isSuggestionKey = (key: unknown): key is string =>
  typeof key === 'string' &&
  /^bill-suggest:v1:[A-Z]{3}:(WEEKLY|MONTHLY|YEARLY):[a-z0-9 ]{3,160}$/.test(
    key,
  );
const dayGap = (a: string, b: string) =>
  Math.round(
    (Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000,
  );
const monthIndex = (date: string) =>
  Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7));

/** Suggestions only. No amount/wallet buckets, no AI, and never writes money. */
export function suggestBills(
  transactions: ApiTransaction[],
  today: string,
): BillSuggestion[] {
  if (!isBillDate(today)) throw new Error('Ngày kiểm tra chưa hợp lệ.');
  const groups = new Map<string, ApiTransaction[]>();
  const dateCache = new Map<string, string>();
  const dateOf = (value: string) => {
    if (!dateCache.has(value))
      dateCache.set(value, getTransactionDateKey(value));
    return dateCache.get(value)!;
  };
  const ids = new Set<number>();
  for (const row of transactions) {
    if (
      !row ||
      typeof row.transaction_date !== 'string' ||
      (row.note != null && typeof row.note !== 'string')
    )
      continue;
    if (ids.has(row.id)) continue;
    ids.add(row.id);
    const amount = Math.abs(Number(row.amount));
    const date = dateOf(row.transaction_date);
    const merchant = billMerchant(row.note ?? '');
    if (
      [
        'chuyen khoan',
        'thanh toan',
        'giao dich',
        'khac',
        'chi',
        'payment',
      ].includes(merchant) ||
      /^(chuyen vi|wallet transfer|hoan tien|refund)\b/.test(merchant) ||
      /\b(chuyen vi|wallet transfer)\b/.test(
        billMerchant(
          typeof row.category?.name === 'string' ? row.category.name : '',
        ),
      )
    )
      continue;
    if (
      row.type !== 'EXPENSE' ||
      getCashFlowType(row.category) !== 'normal' ||
      !Number.isSafeInteger(row.id) ||
      row.id <= 0 ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > 9999999999999.99 ||
      Math.abs(amount * 100 - Math.round(amount * 100)) > 0.00001 ||
      !/^[A-Z]{3}$/.test(row.currency) ||
      (row.currency === 'VND' && !Number.isInteger(amount)) ||
      !isBillDate(date) ||
      date > today ||
      merchant.length < 3 ||
      merchant.length > 160
    )
      continue;
    const key = `${row.currency}|${merchant}`;
    const current = groups.get(key);
    if (current) current.push(row);
    else groups.set(key, [row]);
  }
  const result: BillSuggestion[] = [];
  for (const [group, rows] of groups) {
    const evidence = rows
      .map(row => ({
        id: row.id,
        date: dateOf(row.transaction_date),
        amount: Math.abs(Number(row.amount)),
        note: row.note ?? '',
      }))
      .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
    if (
      evidence.length < 3 ||
      new Set(evidence.map(item => item.date)).size !== evidence.length
    )
      continue;
    const [currency, merchant] = group.split('|');
    let found: BillSuggestion | undefined;
    for (const cycle of ['MONTHLY', 'YEARLY', 'WEEKLY'] as BillCycle[]) {
      const first = evidence[0].date;
      const originalDay = Math.max(
        ...evidence.map(item => Number(item.date.slice(8))),
      );
      let anchorDate = first;
      if (cycle !== 'WEEKLY') {
        let year = Number(first.slice(0, 4)),
          month = Number(first.slice(5, 7));
        while (new Date(Date.UTC(year, month, 0)).getUTCDate() < originalDay) {
          if (cycle === 'YEARLY') year -= 1;
          else if (--month === 0) {
            month = 12;
            year -= 1;
          }
        }
        anchorDate = `${year}-${String(month).padStart(2, '0')}-${String(
          originalDay,
        ).padStart(2, '0')}`;
      }
      if (!isBillDate(anchorDate)) continue;
      const baseIndex =
        cycle === 'WEEKLY'
          ? 0
          : (monthIndex(first) - monthIndex(anchorDate)) /
            (cycle === 'YEARLY' ? 12 : 1);
      const dates = evidence.map(item => item.date);
      const consecutive = dates
        .slice(1)
        .every((date, i) =>
          cycle === 'WEEKLY'
            ? Math.abs(dayGap(date, dates[i]) - 7) <= 1
            : monthIndex(date) - monthIndex(dates[i]) ===
              (cycle === 'YEARLY' ? 12 : 1),
        );
      if (
        !consecutive ||
        dates.some(
          (date, i) =>
            Math.abs(
              dayGap(date, billDueDate({ anchorDate, cycle }, i + baseIndex)),
            ) > (cycle === 'WEEKLY' ? 1 : 3),
        )
      )
        continue;
      let nextIndex = evidence.length + baseIndex;
      let nextDate = billDueDate({ anchorDate, cycle }, nextIndex);
      if (
        dayGap(today, evidence.at(-1)!.date) >
        (cycle === 'WEEKLY' ? 21 : cycle === 'MONTHLY' ? 75 : 400)
      )
        continue;
      while (nextDate < today && nextIndex < 11000)
        nextDate = billDueDate({ anchorDate, cycle }, ++nextIndex);
      if (!isBillDate(nextDate)) continue;
      const amounts = evidence.map(item => item.amount);
      const minAmount = Math.min(...amounts),
        maxAmount = Math.max(...amounts);
      const label = cleanLabel(
        rows.find(row => row.id === evidence.at(-1)!.id)!.note ?? '',
      ).slice(0, 100);
      found = {
        key: `bill-suggest:v1:${currency}:${cycle}:${merchant}`,
        merchant,
        nextDate,
        evidence,
        input: {
          label,
          currency,
          cycle,
          anchorDate,
          startDate: nextDate,
          minAmount,
          maxAmount,
          kind: minAmount === maxAmount ? 'FIXED' : 'VARIABLE',
          note: '',
        },
      };
      break;
    }
    if (found) result.push(found);
  }
  return result.sort(
    (a, b) =>
      a.nextDate.localeCompare(b.nextDate) || a.key.localeCompare(b.key),
  );
}

export function suggestionVisibility(
  candidate: BillSuggestion,
  book: BillBook,
  today: string,
) {
  const decision = book.suggestions?.find(item => item.key === candidate.key);
  if (
    decision?.status === 'TRACKED' ||
    book.bills.some(
      bill =>
        !bill.archived &&
        bill.currency === candidate.input.currency &&
        bill.cycle === candidate.input.cycle &&
        billMerchant(bill.label) === candidate.merchant,
    )
  )
    return 'TRACKED';
  if (
    decision?.status === 'IGNORED' ||
    (decision?.status === 'LATER' && decision.until! > today)
  )
    return 'HIDDEN';
  return 'VISIBLE';
}
